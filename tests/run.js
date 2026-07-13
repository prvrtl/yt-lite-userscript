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
} = require('./checks/functional');
const { takeSnapshot, saveScreenshot, diffSnapshot } = require('./checks/snapshot');

const PAGES = {
  home: 'https://www.youtube.com/',
  search: 'https://www.youtube.com/results?search_query=liquid+glass+design',
  channel: 'https://www.youtube.com/@mkbhd/videos',
  watch: 'https://www.youtube.com/watch?v=aircAruvnKk',
};

const ERROR_PATTERN = /itube|innerHTML|Trusted Types/i;

function parseArgs(argv) {
  const args = { page: null, check: null, update: false, selftest: false };
  for (const a of argv) {
    if (a === '--update') args.update = true;
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
async function runPageChecks(context, pageName, url, { checkFilter, update }) {
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
    const snap = await takeSnapshot(page);
    const violations = diffSnapshot(pageName, snap, { update });
    await saveScreenshot(page, pageName);
    results.push({ name: 'snapshot', violations });
  }

  if (want('functional')) {
    let violations = [];
    violations = violations.concat(await checkYtdAppHidden(page));
    if (pageName === 'watch') {
      violations = violations.concat(await runWatchFunctional(page));
      violations = violations.concat(await checkWatchToWatchNavigation(page));
    }
    if (pageName !== 'watch') {
      violations = violations.concat(await checkHomeNavigation(page));
    }
    results.push({ name: 'functional', violations });
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

  const pageNames = args.page ? [args.page] : Object.keys(PAGES);
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
      results = await runPageChecks(context, pageName, url, { checkFilter: args.check, update: args.update });
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
