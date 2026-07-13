// Behavioural checks: does the player actually work, does the custom bar
// respond to input, does navigation stay client-side, does the UI ever lie
// about state (e.g. "liked" when the like call actually failed).
'use strict';

const { waitForApp } = require('../lib/harness');

async function getPlayerVolume(page) {
  return page.evaluate(() => {
    const p = document.getElementById('movie_player');
    if (p && typeof p.getVolume === 'function') return Math.round(p.getVolume());
    const v = document.querySelector('#itube-stage video');
    return v ? Math.round(v.volume * 100) : null;
  });
}

async function isPlayerMuted(page) {
  return page.evaluate(() => {
    const p = document.getElementById('movie_player');
    if (p && typeof p.isMuted === 'function') return p.isMuted();
    const v = document.querySelector('#itube-stage video');
    return v ? v.muted : null;
  });
}

async function videoState(page) {
  return page.evaluate(() => {
    const v = document.querySelector('#itube-stage video');
    if (!v) return null;
    return { readyState: v.readyState, paused: v.paused, currentTime: v.currentTime, duration: v.duration };
  });
}

// #itube-bar is hidden (opacity 0, visibility hidden, pointer-events none)
// until the stage gets a mousemove — it auto-hides again ~2.8s after the
// last one. Any check that clicks a bar control needs to summon it first.
async function showBar(page) {
  await page.hover('#itube-stage', { position: { x: 200, y: 200 } });
  await page.waitForTimeout(80);
}

// Runs the full watch-page functional suite. Assumes the harness already
// navigated to a /watch URL and waitForApp() resolved.
async function runWatchFunctional(page) {
  const violations = [];
  const report = (check, detail) => violations.push({ check, detail });

  // --- video mounted, decoding, and actually advancing ---
  await page.waitForFunction(() => {
    const v = document.querySelector('#itube-stage video');
    return v && v.readyState >= 2;
  }, { timeout: 15000 }).catch(() => {});

  let state = await videoState(page);
  if (!state) {
    report('video-in-stage', 'expected <video> inside #itube-stage, found none');
    return violations;
  }
  if (state.readyState < 2) {
    report('video-ready', `expected readyState>=2 got readyState=${state.readyState}`);
  }

  // Playback must advance — but a preroll AD occupies the same <video> element
  // and can be mid-transition (paused, buffering, or swapping source) at the
  // moment we sample. That produced a flaky failure. Retry a few times before
  // declaring the player dead: a genuinely broken player never advances at all.
  let advanced = false;
  let lastBefore = 0;
  let lastAfter = 0;
  for (let attempt = 0; attempt < 4 && !advanced; attempt++) {
    if ((await videoState(page)).paused) {
      await page.evaluate(() => document.querySelector('#itube-stage video').play().catch(() => {}));
      await page.waitForTimeout(400);
    }
    lastBefore = (await videoState(page)).currentTime;
    await page.waitForTimeout(1200);
    lastAfter = (await videoState(page)).currentTime;
    advanced = lastAfter > lastBefore;
  }
  if (!advanced) {
    report('video-plays', `expected currentTime to advance over 4 attempts, before=${lastBefore} after=${lastAfter}`);
  }

  // --- video fills the stage ---
  const boxes = await page.evaluate(() => {
    const v = document.querySelector('#itube-stage video');
    const stage = document.getElementById('itube-stage');
    const vr = v.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    return { v: { x: vr.left, y: vr.top, w: vr.width, h: vr.height }, s: { x: sr.left, y: sr.top, w: sr.width, h: sr.height } };
  });
  if (Math.abs(boxes.v.w - boxes.s.w) > 2 || Math.abs(boxes.v.h - boxes.s.h) > 2 ||
    Math.abs(boxes.v.x - boxes.s.x) > 2 || Math.abs(boxes.v.y - boxes.s.y) > 2) {
    report('video-fills-stage', `video box ${JSON.stringify(boxes.v)} !== stage box ${JSON.stringify(boxes.s)}`);
  }

  // --- bar exists ---
  const barExists = await page.$('#itube-bar');
  if (!barExists) {
    report('bar-exists', 'expected #itube-bar to exist');
    return violations;
  }

  // --- #itube-play toggles pause ---
  await showBar(page);
  const pausedBefore1 = (await videoState(page)).paused;
  await page.click('#itube-play');
  await page.waitForTimeout(150);
  const pausedAfter1 = (await videoState(page)).paused;
  if (pausedAfter1 === pausedBefore1) {
    report('play-button-toggles', `expected #itube-play click to flip paused, stayed paused=${pausedAfter1}`);
  }

  // --- clicking the stage toggles pause (debounced ~220ms) ---
  const pausedBefore2 = (await videoState(page)).paused;
  await page.click('#itube-stage', { position: { x: 20, y: 20 } });
  await page.waitForTimeout(400);
  const pausedAfter2 = (await videoState(page)).paused;
  if (pausedAfter2 === pausedBefore2) {
    report('stage-click-toggles', `expected stage click to flip paused, stayed paused=${pausedAfter2}`);
  }

  // --- clicking #itube-bar itself (not a control) must NOT toggle pause ---
  await showBar(page);
  const pausedBefore3 = (await videoState(page)).paused;
  const barBox = await page.evaluate(() => {
    const r = document.getElementById('itube-bar').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.click(barBox.x + barBox.w / 2, barBox.y + 2);
  await page.waitForTimeout(400);
  const pausedAfter3 = (await videoState(page)).paused;
  if (pausedAfter3 !== pausedBefore3) {
    report('bar-click-no-toggle', `expected clicking #itube-bar to leave paused=${pausedBefore3} unchanged, got paused=${pausedAfter3}`);
  }

  // Make sure playback is running before the keyboard tests below.
  if ((await videoState(page)).paused) {
    await page.evaluate(() => document.querySelector('#itube-stage video').play());
    await page.waitForTimeout(200);
  }

  // --- keyboard: 'l' seeks forward ---
  const seekBefore = (await videoState(page)).currentTime;
  let seeked = false;
  let sb = seekBefore;
  let sa = 0;
  for (let attempt = 0; attempt < 3 && !seeked; attempt++) {
    sb = (await videoState(page)).currentTime;
    await page.keyboard.press('l');
    await page.waitForTimeout(250);
    sa = (await videoState(page)).currentTime;
    // A preroll ad swapping into the same <video> resets currentTime to ~0.
    // That is a media-source change, not a broken seek: resample and retry.
    if (sa < sb) continue;
    seeked = sa > sb;
  }
  if (!seeked) {
    report('key-l-seeks-forward', `expected currentTime to increase after 'l' over 3 attempts, before=${sb} after=${sa}`);
  }

  // --- keyboard: ArrowDown lowers volume by exactly 5 ---
  const volBefore = await getPlayerVolume(page);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  const volAfter = await getPlayerVolume(page);
  const expectedVol = Math.max(0, volBefore - 5);
  if (volAfter !== expectedVol) {
    report('key-arrowdown-volume', `expected volume=${expectedVol} (${volBefore}-5) got volume=${volAfter}`);
  }

  // --- keyboard: 'm' mutes ---
  await page.keyboard.press('m');
  await page.waitForTimeout(150);
  const muted = await isPlayerMuted(page);
  if (muted !== true) {
    report('key-m-mutes', `expected isMuted()===true after 'm', got ${muted}`);
  }
  // unmute again so later checks aren't affected by mute state.
  await page.keyboard.press('m');
  await page.waitForTimeout(150);

  // --- keyboard: '/' focuses .search ---
  await page.keyboard.press('/');
  await page.waitForTimeout(100);
  const focusedIsSearch = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('search'));
  if (!focusedIsSearch) {
    report('key-slash-focuses-search', `expected document.activeElement to be .search after '/'`);
  }
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());

  // --- volume persistence across reload ---
  await page.evaluate(() => {
    const vol = document.getElementById('itube-vol');
    vol.value = '42';
    vol.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // Volume is persisted to localStorage by a 500ms poll loop in the
  // userscript, so we must wait for at least one tick before reloading.
  await page.waitForTimeout(700);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await page.waitForFunction(() => {
    const v = document.querySelector('#itube-stage video');
    return v && v.readyState >= 2;
  }, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  const restoredVol = await getPlayerVolume(page);
  const sliderVol = await page.evaluate(() => Number(document.getElementById('itube-vol').value));
  if (restoredVol !== 42) {
    report('volume-persistence', `expected player.getVolume()===42 after reload, got ${restoredVol}`);
  }
  if (sliderVol !== 42) {
    report('volume-persistence', `expected #itube-vol.value===42 after reload, got ${sliderVol}`);
  }

  // --- OSD: ArrowRight shows #itube-cue with .show ---
  await page.keyboard.press('ArrowRight');
  const cueShown = await page.evaluate(() => {
    const cue = document.getElementById('itube-cue');
    return !!cue && cue.classList.contains('show');
  });
  if (!cueShown) {
    report('osd-shows-on-seek', `expected #itube-cue to have .show right after ArrowRight`);
  }

  // --- overflow menu opens, quality has options ---
  let menuOpen = false;
  for (let attempt = 0; attempt < 3 && !menuOpen; attempt++) {
    await showBar(page);
    await page.waitForTimeout(100);
    await page.evaluate(() => document.getElementById('itube-more').click());
    await page.waitForTimeout(200);
    menuOpen = await page.evaluate(() => getComputedStyle(document.getElementById('itube-menu')).display !== 'none');
  }
  if (!menuOpen) {
    report('overflow-menu-opens', `expected #itube-menu to be visible after clicking #itube-more (3 attempts)`);
  }
  await page.dispatchEvent('#itube-quality', 'mousedown');
  await page.waitForTimeout(150);
  const qualityCount = await page.evaluate(() => document.getElementById('itube-quality').options.length);
  if (!(qualityCount > 0)) {
    report('quality-options', `expected #itube-quality to have >0 options, got ${qualityCount}`);
  }
  await page.keyboard.press('Escape');

  // --- comments collapsed by default, expand on click ---
  const commentsBefore = await page.evaluate(() => document.querySelectorAll('.comment-row').length);
  if (commentsBefore !== 0) {
    report('comments-collapsed-default', `expected 0 .comment-row before expanding, got ${commentsBefore}`);
  }
  const toggle = await page.$('.comments-toggle');
  if (toggle) {
    const disabled = await page.evaluate((el) => el.disabled, toggle);
    if (!disabled) {
      await toggle.click();
      await page.waitForFunction(() => document.querySelectorAll('.comment-row').length > 0, { timeout: 10000 }).catch(() => {});
      const commentsAfter = await page.evaluate(() => document.querySelectorAll('.comment-row').length);
      if (!(commentsAfter > 0)) {
        report('comments-expand-on-click', `expected >0 .comment-row after clicking .comments-toggle, got ${commentsAfter}`);
      }
    }
  } else {
    report('comments-toggle-exists', 'expected .comments-toggle to exist');
  }

  // --- actions row renders like/dislike/save/share/subscribe ---
  const actionCounts = await page.evaluate(() => ({
    like: document.querySelectorAll('.watch-like-btn').length,
    dislike: document.querySelectorAll('.watch-dislike-btn').length,
    saveOrShare: document.querySelectorAll('.watch-action-btn').length,
    subscribe: document.querySelectorAll('.watch-subscribe').length,
  }));
  if (actionCounts.like < 1) report('actions-row-render', `expected >=1 .watch-like-btn, got ${actionCounts.like}`);
  if (actionCounts.dislike < 1) report('actions-row-render', `expected >=1 .watch-dislike-btn, got ${actionCounts.dislike}`);
  if (actionCounts.saveOrShare < 2) report('actions-row-render', `expected >=2 .watch-action-btn (save+share), got ${actionCounts.saveOrShare}`);
  if (actionCounts.subscribe < 1) report('actions-row-render', `expected >=1 .watch-subscribe, got ${actionCounts.subscribe}`);

  // --- clicking like while logged out must REVERT, never lie ---
  const likeBtn = await page.$('.watch-like-btn');
  if (likeBtn) {
    const likeDisabled = await page.evaluate((el) => el.disabled, likeBtn);
    if (!likeDisabled) {
      await likeBtn.click();
      // Optimistic UI flips immediately, then the failed (logged-out)
      // network call should revert it. Give the revert time to land.
      await page.waitForTimeout(1500);
      const ariaPressed = await page.evaluate((el) => el.getAttribute('aria-pressed'), likeBtn);
      if (ariaPressed !== 'false') {
        report('like-reverts-logged-out', `expected aria-pressed to revert to "false" when logged out, got "${ariaPressed}"`);
      }
    }
  }

  return violations;
}

// ytd-app (YouTube's own UI) must never be visible on any page.
async function checkYtdAppHidden(page) {
  const violations = [];
  const info = await page.evaluate(() => {
    const app = document.querySelector('ytd-app');
    if (!app) return { present: false };
    const r = app.getBoundingClientRect();
    const cs = getComputedStyle(app);
    return { present: true, left: r.left, opacity: Number(cs.opacity) };
  });
  if (info.present && !(info.left <= -9999 || info.opacity === 0)) {
    violations.push({ check: 'ytd-app-hidden', detail: `expected ytd-app offscreen (left<=-9999) or opacity:0, got left=${info.left} opacity=${info.opacity}` });
  }
  return violations;
}

// Clicks a related-video card on the watch page and asserts the navigation
// happened client-side: zero main-frame *document* responses (iframes/ads
// also produce 'document' resourceType responses and would be false
// positives, so we filter to frame === page.mainFrame()).
async function checkWatchToWatchNavigation(page) {
  const violations = [];
  const titleBefore = await page.evaluate(() => document.querySelector('.watch-title')?.textContent || '');
  // Related cards on the watch page use the `.rc` class (`.row` is used by
  // other feed-style lists such as subscriptions/history). The list loads
  // asynchronously after the watch page mounts, so give it a real chance to
  // appear before declaring it missing.
  await page.waitForSelector('.rc', { timeout: 10000 }).catch(() => {});
  const related = await page.$('.rc');
  if (!related) {
    violations.push({ check: 'related-card-exists', detail: 'expected at least one .rc related-video card on watch page' });
    return violations;
  }
  const mainFrame = page.mainFrame();
  let docLoads = 0;
  const onResponse = (res) => {
    if (res.request().resourceType() === 'document' && res.frame() === mainFrame) docLoads++;
  };
  page.on('response', onResponse);
  await related.click();
  // renderWatchFor() awaits a fresh 'next' API fetch before updating
  // .watch-title, so poll for the change rather than a fixed sleep.
  await page.waitForFunction(
    (prev) => document.querySelector('.watch-title')?.textContent !== prev,
    titleBefore,
    { timeout: 8000 }
  ).catch(() => {});
  page.off('response', onResponse);
  const titleAfter = await page.evaluate(() => document.querySelector('.watch-title')?.textContent || '');
  if (docLoads > 0) {
    violations.push({ check: 'watch-to-watch-no-reload', detail: `expected 0 main-frame document loads, got ${docLoads}` });
  }
  if (titleAfter === titleBefore) {
    violations.push({ check: 'watch-to-watch-title-changes', detail: `expected .watch-title to change after clicking a related video, stayed "${titleAfter}"` });
  }
  return violations;
}

// Clicking sidebar "Home" must be a pure client-side route change.
async function checkHomeNavigation(page) {
  const violations = [];
  const home = await page.$('.nav-row[href="/"]');
  if (!home) {
    violations.push({ check: 'home-link-exists', detail: 'expected .nav-row[href="/"] to exist' });
    return violations;
  }
  const mainFrame = page.mainFrame();
  let docLoads = 0;
  const onResponse = (res) => {
    if (res.request().resourceType() === 'document' && res.frame() === mainFrame) docLoads++;
  };
  page.on('response', onResponse);
  await home.click();
  await page.waitForTimeout(1500);
  page.off('response', onResponse);
  if (docLoads > 0) {
    violations.push({ check: 'home-nav-no-reload', detail: `expected 0 main-frame document loads clicking Home, got ${docLoads}` });
  }
  const path = await page.evaluate(() => location.pathname);
  if (path !== '/') {
    violations.push({ check: 'home-nav-routes', detail: `expected location.pathname === "/" after clicking Home, got "${path}"` });
  }
  return violations;
}

module.exports = {
  runWatchFunctional,
  checkYtdAppHidden,
  checkWatchToWatchNavigation,
  checkHomeNavigation,
};
