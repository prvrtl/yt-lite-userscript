#!/usr/bin/env node
// Orchestrator: runs every check across every page in one browser session
// per page, prints a PASS/FAIL table, and exits non-zero on any failure.
'use strict';

const {
  launchBrowser,
  newContext,
  openPage,
  waitForApp,
} = require('./lib/harness');
const { runLayoutChecks } = require('./checks/layout');
const {
  runWatchFunctional,
  checkYtdAppHidden,
  checkWatchToWatchNavigation,
  checkHomeNavigation,
  checkFeedToWatchNavigation,
  checkShortsRedirect,
  checkInfiniteScroll,
  checkUnhandledPage,
  checkUnhandledLinkRouting,
  checkResponsive,
  checkDescriptionTimestampSeek,
  checkCommentBodyLinks,
  checkCommentsOffCopy,
  checkUserRouteClientSide,
  checkFiltersInUrl,
  checkSearchSuggestions,
  checkSuggestionsDontResurrectAfterSubmit,
  checkAboutTab,
  checkVideoCrossfade,
  checkCrossfadeSkipsWithPiP,
  checkWatchLoadSkeleton,
  checkSkeletonReducedMotion,
  checkColdLoadSkeleton,
  checkBootLoaderColdLoad,
  checkBootLoaderFeedColdLoad,
  checkBootLoaderReducedMotion,
  checkBootLoaderNoSpaReappear,
} = require('./checks/functional');
const { takeSnapshot, saveScreenshot, diffSnapshot } = require('./checks/snapshot');
const { checkVideoAds, checkFeedAds, checkAdStateMachine } = require('./checks/ads');
const { runChannelChecks } = require('./checks/channels');
const { checkNodeBudget } = require('./checks/perf');
const { checkGatedFeeds, checkHeaderSignIn, checkWatchActions } = require('./checks/signedout');

const PAGES = {
  home: 'https://www.youtube.com/',
  search: 'https://www.youtube.com/results?search_query=liquid+glass+design',
  channel: 'https://www.youtube.com/@mkbhd/videos',
  watch: 'https://www.youtube.com/watch?v=aircAruvnKk',
  // A public playlist (3Blue1Brown, "Neural networks") — the /playlist route
  // renders through the same feed mount as the sidebar's Watch later, so this
  // covers a code path nothing else touched.
  playlist: 'https://www.youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi',
  // A route iTube deliberately does not implement: it must render the
  // "isn't available in iTube yet" card and STILL keep ytd-app hidden.
  unhandled: 'https://www.youtube.com/premium',
};

// Pages that are feeds of clickable video cards — the ones where the
// feed -> watch hard-navigation regression can be observed.
const FEED_PAGES = new Set(['home', 'search', 'channel', 'playlist']);

// Pages with a paginated list behind an IntersectionObserver sentinel.
const SCROLLING_PAGES = new Set(['search', 'channel']);

// A regular video used for the /shorts/<id> redirect check (the redirect is
// id-preserving, so any watchable id proves it).
const SHORTS_REDIRECT_ID = 'aircAruvnKk';

const ERROR_PATTERN = /itube|innerHTML|Trusted Types/i;

function parseArgs(argv) {
  const args = { page: null, check: null, update: false, force: false, selftest: false };
  for (const a of argv) {
    if (a === '--update') args.update = true;
    else if (a === '--force') args.force = true;
    else if (a === '--selftest') args.selftest = true;
    else if (a.startsWith('--page=')) args.page = a.slice('--page='.length);
    else if (a.startsWith('--check=')) args.check = a.slice('--check='.length);
  }
  return args;
}

function fmt(v) {
  return `check=${v.check} ${v.detail}`;
}

// Runs every applicable check against a single page inside one browser
// session, and returns { results: [{name, violations}], errors }.
async function runPageChecks(context, pageName, url, { checkFilter, update, force }) {
  const { page, errors } = await openPage(context, url);
  await waitForApp(page, { timeout: 30000 });

  const results = [];
  const want = (name) => !checkFilter || checkFilter === name;

  // Grid/list content (search results, channel videos, related videos)
  // fetches and renders a moment after waitForApp resolves. Give it a real
  // chance to settle before either layout or snapshot measure it, so both
  // checks see the same "loaded" page regardless of check order.
  await page.waitForFunction(() => {
    const grid = document.querySelector('.grid');
    if (grid && grid.children.length === 0) return false;
    return true;
  }, { timeout: 8000 }).catch(() => {});
  await page.waitForSelector('.c, .rc, .row, #itube-stage', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);

  // Layout and snapshot read passive page state, so they must run BEFORE
  // functional — functional clicks around (expands comments, navigates to a
  // different video, reloads), which mutates the DOM and would otherwise
  // make the snapshot/layout measurements depend on functional's test order
  // instead of the page's natural first-load state.
  if (want('layout')) {
    const violations = await runLayoutChecks(page);
    results.push({ name: 'layout', violations });
  }

  if (want('snapshot')) {
    let snap = await takeSnapshot(page);
    let violations = diffSnapshot(pageName, snap, { update, force });
    // COUNTS are the one part of the snapshot that is a race, not a
    // measurement: a grid/rail keeps filling after the settle above, and under
    // full-suite load (five pages sharing one browser, ads and video decoding
    // in flight) the first sample can land mid-fill — which is exactly the
    // observed flake where channel/playlist failed in a full run and passed in
    // isolation. Geometry is stable at first paint; counts are not. So a count
    // violation is re-sampled ONCE after a real settle before it is believed.
    // A genuinely empty rail still fails: the floor is >= 1 and re-sampling an
    // empty grid returns 0 again.
    if (!update && violations.some((v) => v.check === 'snapshot-count')) {
      const first = violations.filter((v) => v.check === 'snapshot-count').map((v) => v.detail);
      await page.waitForTimeout(3000);
      const resampled = await takeSnapshot(page);
      const after = diffSnapshot(pageName, resampled, { update, force });
      const stillFailing = after.filter((v) => v.check === 'snapshot-count');
      console.log(`  ${pageName} / snapshot: count re-sample after settle — first pass: [${first.join(' ; ')}] -> counts now ${JSON.stringify(resampled.counts)} (${stillFailing.length} still below floor)`);
      snap = resampled;
      violations = after;
    }
    await saveScreenshot(page, pageName);
    results.push({ name: 'snapshot', violations });
  }

  // Responsive runs after the passive measurements (it resizes the viewport,
  // and restores it afterwards) but before functional, which navigates away.
  if (want('responsive')) {
    const violations = await checkResponsive(page);
    results.push({ name: 'responsive', violations });
  }

  // Passive too: counts nodes, clicks nothing. `perfViolations` is held by
  // reference: on the watch page a second pass appends to it once comments are
  // on screen (they do not exist until something expands them, and expanding
  // them here would break functional.js's "comments are collapsed by default"
  // assertion).
  let perfViolations = null;
  if (want('perf')) {
    perfViolations = await checkNodeBudget(page, pageName);
    results.push({ name: 'perf', violations: perfViolations });
  }

  if (want('functional')) {
    let violations = [];
    violations = violations.concat(await checkYtdAppHidden(page));
    if (pageName === 'unhandled') {
      violations = violations.concat(await checkUnhandledPage(page));
    }
    if (pageName === 'watch') {
      violations = violations.concat(await runWatchFunctional(page));
      violations = violations.concat(await checkWatchToWatchNavigation(page));
      violations = violations.concat(await checkVideoCrossfade(page));
      violations = violations.concat(await checkWatchLoadSkeleton(page));
      violations = violations.concat(await checkSkeletonReducedMotion(page));
      violations = violations.concat(await checkCrossfadeSkipsWithPiP(page));
      violations = violations.concat(await checkDescriptionTimestampSeek(page));
      violations = violations.concat(await checkCommentsOffCopy(page));
      const toggle = await page.$('.comments-toggle');
      const disabled = toggle ? await page.evaluate((el) => el.disabled, toggle) : true;
      if (toggle && !disabled) {
        const opened = await page.evaluate(() => document.querySelectorAll('.comment-row').length > 0);
        if (!opened) await toggle.click().catch(() => {});
        await page.waitForFunction(() => document.querySelectorAll('.comment-row').length > 0, { timeout: 15000 }).catch(() => {});
        violations = violations.concat(await checkCommentBodyLinks(page));
      }
    }
    if (SCROLLING_PAGES.has(pageName)) {
      violations = violations.concat(await checkInfiniteScroll(page, pageName));
    }
    if (pageName === 'search') {
      violations = violations.concat(await checkFiltersInUrl(page));
      violations = violations.concat(await checkSearchSuggestions(page));
      violations = violations.concat(await checkSuggestionsDontResurrectAfterSubmit(page));
    }
    if (pageName === 'channel') {
      violations = violations.concat(await checkAboutTab(page));
    }
    if (pageName !== 'watch') {
      violations = violations.concat(await checkHomeNavigation(page));
    }
    // Runs once (on home): clicking a route iTube doesn't implement must be a
    // client-side route, while /redirect?q= must stay a native navigation.
    if (pageName === 'home') {
      violations = violations.concat(await checkUnhandledLinkRouting(page));
      violations = violations.concat(await checkUserRouteClientSide(page));
      violations = violations.concat(await checkBootLoaderNoSpaReappear(page));
    }
    results.push({ name: 'functional', violations });
  }

  // Channel links run after functional (which navigates away) and before
  // hardnav, and they re-open the page under test themselves — they click
  // through to a channel page, so they cannot leave the page where they found
  // it.
  // `unhandled` is the one page with no cards and no author anywhere on it by
  // design, so there is nothing for these to assert.
  if (want('channels') && pageName !== 'unhandled') {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await waitForApp(page, { timeout: 30000 });
    await page.waitForSelector('.c, .rc, .row, #itube-stage', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    const violations = await runChannelChecks(page, pageName, url);
    results.push({ name: 'channels', violations });

    // Comment rows are cards too, and they are the one card kind that does not
    // exist at first paint. Budget them once they are actually rendered.
    if (pageName === 'watch' && perfViolations) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await waitForApp(page, { timeout: 30000 });
      const toggle = await page.$('.comments-toggle');
      if (toggle) await toggle.click().catch(() => {});
      await page.waitForFunction(() => document.querySelectorAll('.comment-row').length > 0, { timeout: 15000 }).catch(() => {});
      for (const v of await checkNodeBudget(page, pageName)) perfViolations.push(v);
    }
  }

  // Hard-navigation is its own check so it reads as its own row in the
  // summary table: it is the highest-value regression in the suite, and
  // burying it inside `functional` would hide it. It runs LAST on the page
  // because it navigates to /watch and walks the history stack.
  if (want('hardnav') && FEED_PAGES.has(pageName)) {
    // The preceding functional checks click "Home", so re-open the page under
    // test rather than asserting on whatever route we happen to be sitting on.
    // (When hardnav is the only check requested, the page is still pristine.)
    if (checkFilter !== 'hardnav') {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await waitForApp(page, { timeout: 30000 });
      await page.waitForSelector('.c, .row', { timeout: 8000 }).catch(() => {});
    }
    const violations = await checkFeedToWatchNavigation(page, pageName);
    results.push({ name: 'hardnav', violations });
  }

  if (want('errors')) {
    const violations = [];
    for (const err of errors.pageErrors) {
      violations.push({ check: 'no-page-errors', detail: err.split('\n')[0] });
    }
    for (const msg of errors.consoleErrors) {
      if (ERROR_PATTERN.test(msg)) {
        violations.push({ check: 'no-console-errors', detail: msg });
      }
    }
    results.push({ name: 'errors', violations });
  }

  await page.close();
  return results;
}

// Injects the exact CSS bug that shipped (`.body { max-width: 1720px;
// margin: 0 auto; }`, which floats the sidebar into the middle of the
// screen) AFTER the app has mounted, then asserts the layout check catches
// it via the sidebar-pinned violation. This is the proof the pipeline is
// worth anything: if this fails, the checks aren't actually looking at
// geometry.
//
// The bug only manifests when the viewport is wider than the 1720px
// max-width (on a normal 1440px viewport `margin: 0 auto` has no leftover
// space to redistribute, so nothing moves) — this is exactly the wide
// desktop monitor scenario it originally shipped under, so the self-test
// runs in its own wide context rather than the default 1440px one.
async function runSelftest(browser) {
  const context = await newContext(browser, { viewport: { width: 1920, height: 1080 } });
  const { page } = await openPage(context, PAGES.watch);
  await waitForApp(page, { timeout: 30000 });

  await page.addStyleTag({ content: '#itube .body { max-width: 1720px; margin: 0 auto; }' });
  await page.waitForTimeout(200);

  const violations = await runLayoutChecks(page);
  await context.close();

  const caught = violations.some((v) => v.check === 'sidebar-pinned');
  return { caught, violations };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const start = Date.now();

  const browser = await launchBrowser();

  if (args.selftest) {
    console.log('=== SELF-TEST: injecting the shipped `.body { max-width: 1720px; margin: 0 auto }` bug ===');
    const { caught, violations } = await runSelftest(browser);
    for (const v of violations) console.log('  ' + fmt(v));
    console.log('');
    if (caught) {
      console.log('SELF-TEST PASSED: layout check detected the sidebar-pinned violation.');
    } else {
      console.log('SELF-TEST FAILED: layout check did NOT catch the injected bug. The pipeline is not trustworthy.');
    }
    await browser.close();
    console.log(`\nTotal runtime: ${((Date.now() - start) / 1000).toFixed(1)}s`);
    process.exit(caught ? 0 : 1);
  }

  const context = await newContext(browser);

  // `--check=ads` and `--check=signedout` run only their own suites, which own
  // their contexts — there is no point opening every page just to run zero
  // per-page checks on it.
  const OWN_CONTEXT_CHECKS = new Set(['ads', 'signedout']);
  const pageNames = OWN_CONTEXT_CHECKS.has(args.check) ? [] : (args.page ? [args.page] : Object.keys(PAGES));
  for (const name of pageNames) {
    if (!PAGES[name]) {
      console.error(`Unknown page "${name}". Known pages: ${Object.keys(PAGES).join(', ')}`);
      process.exit(2);
    }
  }

  const table = [];
  let anyFail = false;

  for (const pageName of pageNames) {
    const url = PAGES[pageName];
    console.log(`\n--- ${pageName} (${url}) ---`);
    let results;
    try {
      results = await runPageChecks(context, pageName, url, { checkFilter: args.check, update: args.update, force: args.force });
    } catch (err) {
      console.error(`  ERROR running checks for ${pageName}: ${err.stack || err}`);
      table.push({ page: pageName, check: 'harness', status: 'FAIL' });
      anyFail = true;
      continue;
    }
    for (const { name, violations } of results) {
      const status = violations.length === 0 ? 'PASS' : 'FAIL';
      if (status === 'FAIL') anyFail = true;
      table.push({ page: pageName, check: name, status, count: violations.length });
      console.log(`  ${pageName} / ${name}: ${status}${violations.length ? ` (${violations.length} violation${violations.length === 1 ? '' : 's'})` : ''}`);
      for (const v of violations) {
        console.log(`    page=${pageName} ${fmt(v)}`);
      }
    }
  }

  // /shorts/<id> is not a page in PAGES: the app rewrites the URL before it
  // renders anything, so it has no layout or baseline of its own — only the
  // destination is worth asserting. It runs once, not per page.
  if (!args.page && (!args.check || args.check === 'functional')) {
    console.log(`\n--- shorts (https://www.youtube.com/shorts/${SHORTS_REDIRECT_ID}) ---`);
    let violations;
    try {
      violations = await checkShortsRedirect(context, SHORTS_REDIRECT_ID);
    } catch (err) {
      console.error(`  ERROR running the shorts redirect check: ${err.stack || err}`);
      violations = [{ check: 'shorts-redirect', detail: String(err.message || err).split('\n')[0] }];
    }
    const status = violations.length === 0 ? 'PASS' : 'FAIL';
    if (status === 'FAIL') anyFail = true;
    table.push({ page: 'shorts', check: 'functional', status, count: violations.length });
    console.log(`  shorts / functional: ${status}${violations.length ? ` (${violations.length} violation${violations.length === 1 ? '' : 's'})` : ''}`);
    for (const v of violations) console.log(`    page=shorts ${fmt(v)}`);
  }

  // The cold-load watch skeleton runs once, in its own freshly-opened page: it
  // must sample the load from BEFORE any page script runs, which the shared
  // per-page `page` (already mounted) cannot do.
  if (!args.page && (!args.check || args.check === 'functional')) {
    console.log('\n--- cold-load skeleton (https://www.youtube.com/watch?v=aircAruvnKk) ---');
    let violations;
    try {
      violations = await checkColdLoadSkeleton(context);
    } catch (err) {
      console.error(`  ERROR running the cold-load skeleton check: ${err.stack || err}`);
      violations = [{ check: 'cold-load-skeleton', detail: String(err.message || err).split('\n')[0] }];
    }
    const status = violations.length === 0 ? 'PASS' : 'FAIL';
    if (status === 'FAIL') anyFail = true;
    table.push({ page: 'coldload', check: 'skeleton', status, count: violations.length });
    console.log(`  cold-load skeleton: ${status}${violations.length ? ` (${violations.length} violation${violations.length === 1 ? '' : 's'})` : ''}`);
    for (const v of violations) console.log(`    page=coldload ${fmt(v)}`);
  }

  // The cold-start boot loader (#itube-boot) is a separate concern from the
  // watch-meta skeleton above: it covers the window BEFORE the app shell even
  // exists, on every route, not just watch. Each of these opens its own fresh
  // page for the same reason checkColdLoadSkeleton does — the sampler has to
  // be installed before any page script runs.
  if (!args.page && (!args.check || args.check === 'functional')) {
    console.log('\n--- boot loader: cold watch load ---');
    let violations;
    try {
      violations = await checkBootLoaderColdLoad(context);
    } catch (err) {
      console.error(`  ERROR running the boot loader cold watch load check: ${err.stack || err}`);
      violations = [{ check: 'boot-loader-cold-watch', detail: String(err.message || err).split('\n')[0] }];
    }
    let status = violations.length === 0 ? 'PASS' : 'FAIL';
    if (status === 'FAIL') anyFail = true;
    table.push({ page: 'bootloader', check: 'cold-watch', status, count: violations.length });
    console.log(`  boot loader / cold-watch: ${status}${violations.length ? ` (${violations.length} violation${violations.length === 1 ? '' : 's'})` : ''}`);
    for (const v of violations) console.log(`    page=bootloader ${fmt(v)}`);

    console.log('\n--- boot loader: cold home load ---');
    try {
      violations = await checkBootLoaderFeedColdLoad(context);
    } catch (err) {
      console.error(`  ERROR running the boot loader cold home load check: ${err.stack || err}`);
      violations = [{ check: 'boot-loader-cold-feed', detail: String(err.message || err).split('\n')[0] }];
    }
    status = violations.length === 0 ? 'PASS' : 'FAIL';
    if (status === 'FAIL') anyFail = true;
    table.push({ page: 'bootloader', check: 'cold-feed', status, count: violations.length });
    console.log(`  boot loader / cold-feed: ${status}${violations.length ? ` (${violations.length} violation${violations.length === 1 ? '' : 's'})` : ''}`);
    for (const v of violations) console.log(`    page=bootloader ${fmt(v)}`);

    console.log('\n--- boot loader: reduced motion ---');
    try {
      violations = await checkBootLoaderReducedMotion(context);
    } catch (err) {
      console.error(`  ERROR running the boot loader reduced-motion check: ${err.stack || err}`);
      violations = [{ check: 'boot-loader-reduced-motion', detail: String(err.message || err).split('\n')[0] }];
    }
    status = violations.length === 0 ? 'PASS' : 'FAIL';
    if (status === 'FAIL') anyFail = true;
    table.push({ page: 'bootloader', check: 'reduced-motion', status, count: violations.length });
    console.log(`  boot loader / reduced-motion: ${status}${violations.length ? ` (${violations.length} violation${violations.length === 1 ? '' : 's'})` : ''}`);
    for (const v of violations) console.log(`    page=bootloader ${fmt(v)}`);
  }

  // The signed-out suite runs once, in its own contexts: it opens the
  // account-gated feeds (subscriptions/history/library/Watch later), which are
  // not in PAGES because they render no content at all when logged out — which
  // is the entire point of the check.
  if (!args.page && (!args.check || args.check === 'signedout')) {
    for (const [name, fn] of [['feeds', checkGatedFeeds], ['header', checkHeaderSignIn], ['actions', checkWatchActions]]) {
      console.log(`\n--- signedout / ${name} ---`);
      let res;
      try {
        res = await fn(browser);
      } catch (err) {
        console.error(`  ERROR running the signedout/${name} check: ${err.stack || err}`);
        res = { violations: [{ check: 'signedout-' + name, detail: String(err.message || err).split('\n')[0] }], detail: '' };
      }
      const status = res.violations.length ? 'FAIL' : 'PASS';
      if (status === 'FAIL') anyFail = true;
      table.push({ page: 'signedout', check: name, status, count: res.violations.length });
      console.log(`  signedout / ${name}: ${status} — ${res.detail}`);
      for (const v of res.violations) console.log(`    page=signedout ${fmt(v)}`);
    }
  }

  // Ad removal runs once, in its own contexts (it seeds a known volume into
  // localStorage before load and hooks fetch to see the raw ad payloads), and
  // it is the one check that can legitimately be SKIPPED: YouTube may serve no
  // ad at all on a given run. A skip is reported, never laundered into a pass.
  if (!args.page && (!args.check || args.check === 'ads')) {
    for (const [name, fn] of [['statemachine', checkAdStateMachine], ['video', checkVideoAds], ['feed', checkFeedAds]]) {
      console.log(`\n--- ads / ${name} ---`);
      let res;
      try {
        res = await fn(browser);
      } catch (err) {
        console.error(`  ERROR running the ads/${name} check: ${err.stack || err}`);
        res = { violations: [{ check: 'ads-' + name, detail: String(err.message || err).split('\n')[0] }], skipped: false, detail: '' };
      }
      const status = res.violations.length ? 'FAIL' : (res.skipped ? 'SKIP' : 'PASS');
      if (status === 'FAIL') anyFail = true;
      table.push({ page: 'ads', check: name, status, count: res.violations.length });
      console.log(`  ads / ${name}: ${status} — ${res.detail}`);
      for (const v of res.violations) console.log(`    page=ads ${fmt(v)}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('page'.padEnd(10) + 'check'.padEnd(14) + 'status');
  for (const row of table) {
    console.log(row.page.padEnd(10) + row.check.padEnd(14) + row.status);
  }

  await browser.close();
  console.log(`\nTotal runtime: ${((Date.now() - start) / 1000).toFixed(1)}s`);
  process.exit(anyFail ? 1 : 0);
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
