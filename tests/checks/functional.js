// Behavioural checks: does the player actually work, does the custom bar
// respond to input, does navigation stay client-side, does the UI ever lie
// about state (e.g. "liked" when the like call actually failed).
'use strict';

const { waitForApp, openPage } = require('../lib/harness');

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

// The <video> node is briefly absent while YouTube's player swaps elements
// around a preroll ad, so a bare querySelector here returns null and every
// caller that reads `.currentTime` off it throws. Poll for it, and if it is
// genuinely gone, return a sentinel rather than null: callers stay
// dereference-safe and the `video-ready` check reports the absence honestly
// instead of the run dying with a TypeError.
async function videoState(page) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const state = await page.evaluate(() => {
      const v = document.querySelector('#itube-stage video');
      if (!v) return null;
      return { readyState: v.readyState, paused: v.paused, currentTime: v.currentTime, duration: v.duration };
    });
    if (state) return state;
    await page.waitForTimeout(300);
  }
  return { missing: true, readyState: 0, paused: true, currentTime: 0, duration: NaN };
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

  // The <video> must live INSIDE the stage and have real area. (The old check
  // was `if (!videoState(page))`, which became dead code the moment
  // videoState() started returning a sentinel object instead of null — it can
  // never be falsy, so it asserted nothing at all.)
  const placement = await page.evaluate(() => {
    const stage = document.getElementById('itube-stage');
    const v = document.querySelector('video');
    if (!v) return { video: false };
    const r = v.getBoundingClientRect();
    return {
      video: true,
      inStage: !!stage && stage.contains(v) && v !== stage,
      w: r.width,
      h: r.height,
    };
  });
  if (!placement.video) {
    report('video-in-stage', 'expected a <video> element on the watch page, found none');
    return violations;
  }
  if (!placement.inStage) {
    report('video-in-stage', 'expected the <video> to be a descendant of #itube-stage — it is mounted somewhere else, so YouTube still owns the player');
  }
  if (!(placement.w > 0 && placement.h > 0)) {
    report('video-in-stage', `expected the <video> to have non-zero area, got w=${placement.w} h=${placement.h}`);
  }

  const state = await videoState(page);
  if (state.missing) {
    report('video-in-stage', 'expected <video> inside #itube-stage, found none after 10 polls');
    return violations;
  }
  if (state.readyState < 2) {
    report('video-ready', `expected readyState>=2 got readyState=${state.readyState}`);
  }

  // --- AUTOPLAY: the player must start on its own, with NOBODY calling play() ---
  // The old single `video-plays` check called .play() inside its own retry
  // loop, so it REPAIRED the bug it was meant to detect: a player that mounts
  // paused, or whose autoplay wiring is broken, was quietly fixed by the test
  // and then reported green. Observation and intervention are now separate
  // checks.
  //
  // The context launches with --autoplay-policy=no-user-gesture-required and
  // --mute-audio, so the browser is not the thing preventing playback here.
  let autoplayed = false;
  let autoBefore = 0;
  let autoAfter = 0;
  for (let attempt = 0; attempt < 4 && !autoplayed; attempt++) {
    autoBefore = (await videoState(page)).currentTime;
    await page.waitForTimeout(1200);
    autoAfter = (await videoState(page)).currentTime;
    // A preroll ad swapping into the same <video> resets currentTime to ~0.
    // That is a source change, not a stall: resample rather than fail.
    autoplayed = autoAfter > autoBefore;
  }
  if (!autoplayed) {
    const paused = (await videoState(page)).paused;
    report('video-autoplays', `expected the video to be playing on its own (no .play() call from the test), currentTime went ${autoBefore} -> ${autoAfter} over 4 samples, paused=${paused}`);
  }

  // --- PLAYBACK: once told to play, currentTime must actually advance ---
  // Distinct failure from the above: this is "the media pipeline is dead",
  // not "autoplay never fired".
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
    report('video-advances-when-played', `expected currentTime to advance after calling play() over 4 attempts, before=${lastBefore} after=${lastAfter}`);
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
  // This uses a REAL page.click(), not element.click() in page.evaluate().
  // The synthetic version bypasses hit-testing entirely, so it passed even
  // when the button was covered by an overlay, had pointer-events:none, or was
  // zero-sized — all three of which have actually shipped in this project. The
  // retry loop stays: a preroll ad genuinely can eat the first click.
  let menuOpen = false;
  let clickError = '';
  for (let attempt = 0; attempt < 3 && !menuOpen; attempt++) {
    await showBar(page);
    await page.waitForTimeout(100);
    try {
      await page.click('#itube-more', { timeout: 2000 });
    } catch (err) {
      // Playwright's actionability check failing IS the finding here: the
      // button is not really clickable by a human either.
      clickError = String(err.message || err).split('\n')[0];
      continue;
    }
    await page.waitForTimeout(200);
    menuOpen = await page.evaluate(() => getComputedStyle(document.getElementById('itube-menu')).display !== 'none');
  }
  if (!menuOpen) {
    report('overflow-menu-opens', `expected #itube-menu to be visible after a real click on #itube-more (3 attempts)${clickError ? ` — last click failed: ${clickError}` : ''}`);
  }
  await page.dispatchEvent('#itube-quality', 'mousedown');
  await page.waitForTimeout(150);
  // A single stale option ("auto" left over from the previous video) used to
  // satisfy the old `> 0`. Real quality data is a ladder of several concrete
  // resolutions, each rendered as a resolution the user can recognise.
  //
  // The RESOLUTION shape (720p / Auto) is asserted on the option LABEL, not on
  // its value: `option.value` is YouTube's internal quality level id
  // (`hd1080`, `large`, `tiny`, `auto`) and is passed verbatim to
  // `player.setPlaybackQualityRange()`, so a value of "1080p" would be the
  // bug. The value is instead checked against the level ids the app maps in
  // QUALITY_LABELS — anything else means the app is about to hand the player
  // an id it does not understand.
  const YT_QUALITY_LEVELS = /^(highres|hd2160|hd1440|hd1080|hd720|large|medium|small|tiny|auto)$/;
  const quality = await page.evaluate(() => {
    const sel = document.getElementById('itube-quality');
    if (!sel) return null;
    return [...sel.options].map((o) => ({ value: o.value, label: o.textContent }));
  });
  if (!quality) {
    report('quality-options', 'expected #itube-quality to exist, got null');
  } else {
    if (quality.length < 3) {
      report('quality-options', `expected #itube-quality to have >=3 options (a real ladder, not one stale entry), got ${quality.length}: [${quality.map((o) => o.value).join(', ')}]`);
    }
    const badLabels = quality.filter((o) => !/^\d+p$|^auto$/i.test((o.label || '').trim()));
    if (badLabels.length) {
      report('quality-options', `expected every #itube-quality label to match /^\\d+p$|^auto$/i, got malformed: [${badLabels.map((o) => `${o.value}="${o.label}"`).join(', ')}]`);
    }
    const badValues = quality.filter((o) => !YT_QUALITY_LEVELS.test(o.value));
    if (badValues.length) {
      report('quality-options', `expected every #itube-quality value to be a YouTube quality level id, got: [${badValues.map((o) => o.value).join(', ')}]`);
    }
  }
  await page.keyboard.press('Escape');

  // --- comments collapsed by default, expand on click ---
  const commentsBefore = await page.evaluate(() => document.querySelectorAll('.comment-row').length);
  if (commentsBefore !== 0) {
    report('comments-collapsed-default', `expected 0 .comment-row before expanding, got ${commentsBefore}`);
  }
  // The app sets `commentsToggle.disabled = !commentsToken` — i.e. the button
  // is disabled PRECISELY when comment extraction failed. The old check said
  // `if (!disabled) { ...assert... }`, so it silently passed on the exact
  // failure it exists to catch. A disabled toggle on a normal video IS the
  // violation.
  const toggle = await page.$('.comments-toggle');
  if (!toggle) {
    report('comments-toggle-exists', 'expected .comments-toggle to exist');
  } else if (await page.evaluate((el) => el.disabled, toggle)) {
    report('comments-toggle-disabled', 'the .comments-toggle is disabled on a normal video with comments enabled — the app only disables it when the comments continuation token could not be extracted');
  } else {
    await toggle.click();
    await page.waitForFunction(() => document.querySelectorAll('.comment-row').length > 0, { timeout: 10000 }).catch(() => {});
    const commentsAfter = await page.evaluate(() => document.querySelectorAll('.comment-row').length);
    if (!(commentsAfter > 0)) {
      report('comments-expand-on-click', `expected >0 .comment-row after clicking .comments-toggle, got ${commentsAfter}`);
    }
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
  // Same inversion as the comments toggle: the app sets `likeBtn.disabled =
  // !actionsVideoId`, so a disabled like button means the video id could not
  // be resolved from the page. Skipping the assertion in that case meant the
  // check passed on its own failure mode.
  const likeBtn = await page.$('.watch-like-btn');
  if (!likeBtn) {
    report('like-button-exists', 'expected .watch-like-btn to exist');
  } else if (await page.evaluate((el) => el.disabled, likeBtn)) {
    report('like-button-disabled', 'the .watch-like-btn is disabled on a normal video — the app only disables it when it could not resolve the video id (actionsVideoId), so the actions row is wired to nothing');
  } else {
    await likeBtn.click();
    // Optimistic UI flips immediately, then the failed (logged-out)
    // network call should revert it. Give the revert time to land.
    await page.waitForTimeout(1500);
    const ariaPressed = await page.evaluate((el) => el.getAttribute('aria-pressed'), likeBtn);
    if (ariaPressed !== 'false') {
      report('like-reverts-logged-out', `expected aria-pressed to revert to "false" when logged out, got "${ariaPressed}"`);
    }
  }

  return violations;
}

// ytd-app (YouTube's own UI) must never be visible on any page.
// NOTE the shape: `absent` is a VIOLATION, not a pass. The old check was
// `if (info.present && !hidden)`, so if ytd-app vanished from the document
// entirely — which would mean the page never loaded YouTube's own app, i.e.
// the harness is testing nothing — the check reported green.
async function checkYtdAppHidden(page) {
  const violations = [];
  const info = await page.evaluate(() => {
    const app = document.querySelector('ytd-app');
    if (!app) return { present: false };
    const r = app.getBoundingClientRect();
    const cs = getComputedStyle(app);
    return { present: true, left: r.left, opacity: Number(cs.opacity) };
  });
  if (!info.present) {
    violations.push({ check: 'ytd-app-present-but-hidden', detail: 'ytd-app is absent from the document — YouTube\'s own app never mounted, so "it is hidden" is vacuous and the rest of this suite is not testing a real YouTube page' });
    return violations;
  }
  if (!(info.left <= -9999 || info.opacity === 0)) {
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

// Counts MAIN-FRAME document requests for the duration of `fn`. Ad iframes
// also issue requests with resourceType() === 'document', so filtering to the
// main frame is not optional — without it every count is a false positive.
// Returns { docLoads, urls }.
async function countMainFrameDocLoads(page, fn) {
  const rec = recordMainFrameDocLoads(page);
  try {
    await fn();
  } finally {
    rec.stop();
  }
  return { docLoads: rec.urls.length, urls: rec.urls };
}

// The counting-window version above is only as good as the window: a listener
// that is detached 1.5s after a click cannot see a fallback `location.assign()`
// that fires at 3s, and the reloaded page then satisfies every later assertion.
// This variant keeps recording until the caller explicitly stops it, so the
// window can be held open past the app's WATCH_BOOT_TIMEOUT.
function recordMainFrameDocLoads(page) {
  const mainFrame = page.mainFrame();
  const urls = [];
  const onRequest = (req) => {
    if (req.resourceType() !== 'document') return;
    if (req.frame() !== mainFrame) return;
    urls.push(req.url());
  };
  page.on('request', onRequest);
  return { urls, stop: () => page.off('request', onRequest) };
}

// The app's own fallback timeout (WATCH_BOOT_TIMEOUT in itube.user.js). Any
// reload-detection window has to stay open longer than this, or the reload it
// exists to catch happens after the listener is gone.
const WATCH_BOOT_TIMEOUT = 3000;
const RELOAD_WATCH_MS = WATCH_BOOT_TIMEOUT + 1500;

// Stamps a unique value on `window`. ANY main-frame document load — including
// one that happens long after a doc-load listener was detached — creates a new
// JS global object and wipes it. Timing-independent proof that the document
// the checks end on is the same document they started on.
async function stampMark(page) {
  const mark = `itube-mark-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await page.evaluate((m) => { window.__itubeMark = m; }, mark);
  return mark;
}

async function markSurvived(page, mark) {
  const seen = await page.evaluate(() => window.__itubeMark).catch(() => null);
  return seen === mark;
}

// "The route changed and #itube-stage exists" is NOT "the video plays". A real
// bug shipped straight through this check: Forward into a watch page whose id
// the player still held left the <video> PAUSED forever (paused=true,
// readyState=4, playerState=-1) — every structural assertion passed while the
// user stared at a frozen frame.
//
// The only honest test of playback is the clock: sample currentTime, wait, and
// require that it MOVED. paused=false alone is not enough (a stalled element
// reports paused=false), and readyState alone says nothing about progress.
const PLAY_WINDOW_MS = 2500;
const PLAY_MIN_ADVANCE = 0.2;

async function playbackProbe(page, windowMs = PLAY_WINDOW_MS) {
  const read = () => page.evaluate(() => {
    const v = document.querySelector('#itube-stage video');
    const p = document.getElementById('movie_player');
    return {
      video: !!v,
      paused: v ? v.paused : null,
      readyState: v ? v.readyState : null,
      currentTime: v ? v.currentTime : null,
      playerState: p && typeof p.getPlayerState === 'function' ? p.getPlayerState() : null,
    };
  });
  await page.waitForFunction(() => {
    const v = document.querySelector('#itube-stage video');
    return v && v.readyState >= 2;
  }, { timeout: 15000 }).catch(() => {});
  const before = await read();
  await page.waitForTimeout(windowMs);
  const after = await read();
  const advanced = !!before.video && !!after.video
    && after.currentTime > before.currentTime + PLAY_MIN_ADVANCE;
  return {
    before,
    after,
    advanced,
    playing: advanced && after.paused === false,
    detail: `paused=${after.paused}, readyState=${after.readyState}, playerState=${after.playerState}, currentTime ${before.currentTime} -> ${after.currentTime} over ${windowMs}ms`,
  };
}

// Clicking sidebar "Home" must be a pure client-side route change.
// The old version ran this on the HOME page — clicking "Home" while already on
// "/" and then asserting pathname === "/" is a tautology that holds even if
// the click handler does nothing at all. So: navigate somewhere else FIRST,
// then come back.
async function checkHomeNavigation(page) {
  const violations = [];
  const home = await page.$('.nav-row[href="/"]');
  if (!home) {
    violations.push({ check: 'home-link-exists', detail: 'expected .nav-row[href="/"] to exist' });
    return violations;
  }

  // If we're already on "/", route away so that clicking Home is a real
  // transition. History is a feed route that exists logged-out (it renders an
  // empty state, which is fine — we only care that the path changed).
  if (await page.evaluate(() => location.pathname === '/')) {
    const away = await page.$('.nav-row[href="/feed/history"]');
    if (!away) {
      violations.push({ check: 'home-nav-precondition', detail: 'expected .nav-row[href="/feed/history"] to exist so the Home click is a real navigation and not a no-op' });
      return violations;
    }
    await away.click();
    await page.waitForFunction(() => location.pathname !== '/', { timeout: 8000 }).catch(() => {});
    const awayPath = await page.evaluate(() => location.pathname);
    if (awayPath === '/') {
      violations.push({ check: 'home-nav-routes', detail: 'clicking a non-Home sidebar row did not change location.pathname — the sidebar is not routing at all' });
      return violations;
    }
  }

  const pathBefore = await page.evaluate(() => location.pathname);
  const { docLoads } = await countMainFrameDocLoads(page, async () => {
    await page.click('.nav-row[href="/"]');
    await page.waitForFunction(() => location.pathname === '/', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
  });
  if (docLoads > 0) {
    violations.push({ check: 'home-nav-no-reload', detail: `expected 0 main-frame document loads clicking Home (from "${pathBefore}"), got ${docLoads}` });
  }
  const path = await page.evaluate(() => location.pathname);
  if (path !== '/') {
    violations.push({ check: 'home-nav-routes', detail: `expected location.pathname === "/" after clicking Home (from "${pathBefore}"), got "${path}"` });
  }
  return violations;
}

// THE hard-navigation regression check: clicking a video card in a feed
// (home/search/channel) must be a client-side route change, and so must Back
// and Forward afterwards. A full document load throws away the mounted app,
// re-downloads YouTube's entire page, and is the single biggest thing the
// userscript exists to avoid.
async function checkFeedToWatchNavigation(page, pageName) {
  const violations = [];

  // `.c` = grid card (home/channel/playlist), `.row` = list row (search). Both
  // ARE the <a> themselves rather than containers wrapping one, so match the
  // element directly as well as any nested link.
  //
  // NOTE: the logged-out home feed legitimately renders ZERO video cards —
  // plain YouTube serves a feedNudgeRenderer instead of a grid to a session
  // with no watch history — so there is nothing to click there and nothing to
  // assert. That is a property of YouTube, not a bug in the app.
  const card = await page.$([
    '#itube .c[href^="/watch"]',
    '#itube .row[href^="/watch"]',
    '#itube .c a[href^="/watch"]',
    '#itube .row a[href^="/watch"]',
  ].join(', '));
  if (!card) {
    if (pageName !== 'home') {
      violations.push({ check: 'feed-card-exists', detail: `expected at least one video card linking to /watch on the ${pageName} page` });
    }
    return violations;
  }

  const pathBefore = await page.evaluate(() => location.pathname + location.search);

  // Two independent detectors, because either one alone can be fooled:
  //  - the doc-load counter is held open past the app's 3s boot-fallback, so a
  //    late `location.assign()` is still inside the window;
  //  - the window mark is timing-independent: whenever the reload happens, the
  //    global object is replaced and the mark is gone at the end of the check.
  const clickMark = await stampMark(page);
  const rec = recordMainFrameDocLoads(page);
  let survived;
  try {
    await card.click();
    await page.waitForFunction(() => location.pathname === '/watch', { timeout: 15000 }).catch(() => {});
    await page.waitForSelector('#itube-stage', { timeout: 15000 }).catch(() => {});
    // Hold the window open past WATCH_BOOT_TIMEOUT: the fallback reload this
    // check exists to catch fires ~3s after the click, i.e. long after the
    // player is expected to be up.
    await page.waitForTimeout(RELOAD_WATCH_MS);
    survived = await markSurvived(page, clickMark);
  } finally {
    rec.stop();
  }
  const pathAfter = await page.evaluate(() => location.pathname);
  if (pathAfter !== '/watch') {
    violations.push({ check: 'feed-to-watch-routes', detail: `expected location.pathname === "/watch" after clicking a video card on ${pageName}, got "${pathAfter}"` });
    return violations;
  }
  if (rec.urls.length > 0) {
    violations.push({ check: 'feed-to-watch-no-reload', detail: `clicking a video card on ${pageName} caused ${rec.urls.length} main-frame document load(s) — a full page reload, not a client-side route: ${rec.urls.join(' , ')}` });
  }
  if (!survived) {
    violations.push({ check: 'feed-to-watch-no-reload', detail: `window.__itubeMark did not survive the ${pageName} -> watch navigation — the document was replaced, i.e. something did a full page load (the boot fallback firing on an already-routed page looks exactly like this)` });
  }

  // The app must survive the transition, not just the URL.
  const stage = await page.$('#itube-stage');
  if (!stage) {
    violations.push({ check: 'feed-to-watch-mounts-player', detail: `no #itube-stage after navigating from ${pageName} to a watch page` });
  }

  // …and the video must actually PLAY, not merely mount.
  const played = await playbackProbe(page);
  if (!played.playing) {
    violations.push({ check: 'feed-to-watch-plays', detail: `after clicking a video card on ${pageName} the video is not playing: ${played.detail}` });
  }

  // --- Back, then Forward ---
  const backMark = await stampMark(page);
  const backRec = recordMainFrameDocLoads(page);
  let backSurvived;
  try {
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(RELOAD_WATCH_MS);
    backSurvived = await markSurvived(page, backMark);
  } finally {
    backRec.stop();
  }
  const backPath = await page.evaluate(() => location.pathname + location.search);
  if (backRec.urls.length > 0) {
    violations.push({ check: 'back-no-reload', detail: `going Back from watch to ${pageName} caused ${backRec.urls.length} main-frame document load(s) — popstate is doing a full reload: ${backRec.urls.join(' , ')}` });
  }
  if (!backSurvived) {
    violations.push({ check: 'back-no-reload', detail: `window.__itubeMark did not survive going Back to ${pageName} — the document was replaced` });
  }
  if (backPath !== pathBefore) {
    violations.push({ check: 'back-restores-route', detail: `expected Back to restore "${pathBefore}", got "${backPath}"` });
  }

  // Back lands on the FEED, which has no player — the watch teardown hands the
  // <video> back to #movie_player and pauses it. So the playback assertion here
  // is the mirror image of the one on /watch: nothing may still be playing
  // inside a stage. (The paused element this leaves behind is exactly what
  // Forward then has to resume — see below.)
  const backPlayback = await page.evaluate(() => {
    const v = document.querySelector('#itube-stage video');
    return { inStage: !!v, paused: v ? v.paused : null };
  });
  if (backPlayback.inStage && backPlayback.paused === false) {
    violations.push({ check: 'back-stops-playback', detail: `after going Back to ${pageName} a <video> is still playing inside #itube-stage — the watch view was not torn down` });
  }

  const fwdMark = await stampMark(page);
  const fwdRec = recordMainFrameDocLoads(page);
  let fwdSurvived;
  try {
    await page.goForward({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(RELOAD_WATCH_MS);
    fwdSurvived = await markSurvived(page, fwdMark);
  } finally {
    fwdRec.stop();
  }
  const fwdPath = await page.evaluate(() => location.pathname);
  if (fwdRec.urls.length > 0) {
    violations.push({ check: 'forward-no-reload', detail: `going Forward back to the watch page caused ${fwdRec.urls.length} main-frame document load(s): ${fwdRec.urls.join(' , ')}` });
  }
  if (!fwdSurvived) {
    violations.push({ check: 'forward-no-reload', detail: 'window.__itubeMark did not survive going Forward to the watch page — the document was replaced' });
  }
  if (fwdPath !== '/watch') {
    violations.push({ check: 'forward-restores-route', detail: `expected Forward to restore "/watch", got "${fwdPath}"` });
  }

  // THE regression this check exists for: the player still holds this video id,
  // so nothing reloads it — and the teardown on the way out paused it. Unless
  // the navigation resumes it, the user gets a frozen frame that only a manual
  // click recovers.
  const fwdPlayed = await playbackProbe(page);
  if (!fwdPlayed.playing) {
    violations.push({ check: 'forward-resumes-playback', detail: `after going Forward from ${pageName} back to the watch page the video is not playing: ${fwdPlayed.detail}` });
  }

  return violations;
}

// F8: a route iTube does not implement must still be a client-side route — the
// destination is the SAME "isn't available in iTube yet" card either way, so a
// native navigation buys a whole document load for an identical result. But
// `/redirect?q=` (YouTube's outbound-link bouncer, used by description and
// sponsor links) MUST stay a native navigation.
async function checkUnhandledLinkRouting(page) {
  const violations = [];

  const unhandledHref = '/premium';
  await page.evaluate((href) => {
    const a = document.createElement('a');
    a.id = 'itube-test-unhandled-link';
    a.href = href;
    a.textContent = 'unhandled';
    a.style.position = 'fixed';
    a.style.left = '0';
    a.style.bottom = '0';
    a.style.zIndex = '99999';
    document.querySelector('#itube').appendChild(a);
  }, unhandledHref);

  const mark = await stampMark(page);
  const rec = recordMainFrameDocLoads(page);
  let survived;
  try {
    await page.click('#itube-test-unhandled-link');
    await page.waitForFunction(() => location.pathname === '/premium', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
    survived = await markSurvived(page, mark);
  } finally {
    rec.stop();
  }

  const path = await page.evaluate(() => location.pathname);
  if (path !== unhandledHref) {
    violations.push({ check: 'unhandled-link-routes', detail: `expected clicking an unhandled in-app link to land on "${unhandledHref}", got "${path}"` });
  }
  if (rec.urls.length > 0) {
    violations.push({ check: 'unhandled-link-no-reload', detail: `clicking "${unhandledHref}" caused ${rec.urls.length} main-frame document load(s) — the destination is the same unhandled card either way, so the reload is pure cost: ${rec.urls.join(' , ')}` });
  }
  if (!survived) {
    violations.push({ check: 'unhandled-link-no-reload', detail: `window.__itubeMark did not survive clicking "${unhandledHref}" — the document was replaced` });
  }
  const card = await page.$('#itube .unhandled');
  if (!card) {
    violations.push({ check: 'unhandled-link-renders-card', detail: `expected the .unhandled card after SPA-routing to "${unhandledHref}"` });
  }
  await page.evaluate(() => document.getElementById('itube-test-unhandled-link')?.remove());

  // A /redirect?q= link must NOT be intercepted: preventDefault() on it would
  // break every outbound description/sponsor link on the site.
  const notIntercepted = await page.evaluate(async () => {
    const a = document.createElement('a');
    a.id = 'itube-test-redirect-link';
    a.href = '/redirect?q=' + encodeURIComponent('https://example.com/');
    a.textContent = 'redirect';
    document.querySelector('#itube').appendChild(a);
    // Dispatch the click manually. The probe runs on `document` in the bubble
    // phase — i.e. AFTER the app's own listener on #itube — so it reads the
    // app's verdict first, then swallows the default itself so the test does
    // not actually navigate away.
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    let prevented = null;
    const probe = (e) => { prevented = e.defaultPrevented; e.preventDefault(); };
    document.addEventListener('click', probe, false);
    a.dispatchEvent(ev);
    document.removeEventListener('click', probe, false);
    a.remove();
    return prevented;
  });
  if (notIntercepted) {
    violations.push({ check: 'redirect-link-not-intercepted', detail: 'a /redirect?q= link had its click defaultPrevented by the app — YouTube\'s outbound bouncer must be allowed to navigate natively, otherwise every description/sponsor link dead-ends on the unhandled card' });
  }

  return violations;
}

// /shorts/<id> must be rewritten to the normal watch page and actually play.
// (The app does this with location.replace(), so a document load here is
// expected and deliberate — the assertion is about the destination, not the
// mechanism.)
async function checkShortsRedirect(context, videoId) {
  const { page } = await openPage(context, `https://www.youtube.com/shorts/${videoId}`);
  const violations = [];
  try {
    await page.waitForFunction(() => location.pathname === '/watch', { timeout: 15000 }).catch(() => {});
    const path = await page.evaluate(() => location.pathname);
    if (path !== '/watch') {
      violations.push({ check: 'shorts-redirect', detail: `expected /shorts/${videoId} to redirect to location.pathname === "/watch", got "${path}"` });
      return violations;
    }
    const v = await page.evaluate(() => new URLSearchParams(location.search).get('v'));
    if (v !== videoId) {
      violations.push({ check: 'shorts-redirect', detail: `expected the redirect to carry ?v=${videoId}, got "${v}"` });
    }

    await waitForApp(page, { timeout: 30000 });
    await page.waitForFunction(() => {
      const el = document.querySelector('#itube-stage video');
      return el && el.readyState >= 2;
    }, { timeout: 20000 }).catch(() => {});

    let advanced = false;
    let before = 0;
    let after = 0;
    for (let attempt = 0; attempt < 4 && !advanced; attempt++) {
      if ((await videoState(page)).paused) {
        await page.evaluate(() => document.querySelector('#itube-stage video')?.play().catch(() => {}));
        await page.waitForTimeout(400);
      }
      before = (await videoState(page)).currentTime;
      await page.waitForTimeout(1200);
      after = (await videoState(page)).currentTime;
      advanced = after > before;
    }
    if (!advanced) {
      violations.push({ check: 'shorts-redirect-plays', detail: `expected the redirected video to play, currentTime went ${before} -> ${after} over 4 attempts` });
    }
  } finally {
    await page.close();
  }
  return violations;
}

// Infinite scroll: the sentinel at the bottom of a list must load more items.
// `.content` is the scroll container (the document itself doesn't scroll), so
// scrolling the window would silently do nothing and the check would pass on
// a broken IntersectionObserver.
async function checkInfiniteScroll(page, pageName) {
  const violations = [];
  const itemSel = pageName === 'search' ? '.row' : '.c';

  const countItems = () => page.evaluate((sel) => document.querySelectorAll('#itube ' + sel).length, itemSel);
  const before = await countItems();
  if (before === 0) {
    violations.push({ check: 'infinite-scroll', detail: `expected the ${pageName} page to render at least one "${itemSel}" before scrolling, got 0` });
    return violations;
  }

  let after = before;
  for (let i = 0; i < 4 && after <= before; i++) {
    await page.evaluate(() => {
      const content = document.querySelector('#itube .content');
      if (content) content.scrollTop = content.scrollHeight;
    });
    await page.waitForFunction(
      ({ sel, prev }) => document.querySelectorAll('#itube ' + sel).length > prev,
      { sel: itemSel, prev: before },
      { timeout: 6000 }
    ).catch(() => {});
    after = await countItems();
  }

  if (!(after > before)) {
    violations.push({ check: 'infinite-scroll', detail: `expected the ${pageName} "${itemSel}" count to grow after scrolling to the bottom 4 times, stayed at ${before}` });
  }
  return violations;
}

// A route the app doesn't implement must render the explicit "not available"
// card — and must NOT fall back to letting YouTube's own UI through.
async function checkUnhandledPage(page) {
  const violations = [];
  const info = await page.evaluate(() => {
    const wrap = document.querySelector('#itube .unhandled');
    if (!wrap) return { present: false };
    const r = wrap.getBoundingClientRect();
    return {
      present: true,
      text: wrap.textContent || '',
      visible: r.width > 0 && r.height > 0,
      hasHomeLink: !!wrap.querySelector('a[href="/"]'),
    };
  });
  if (!info.present) {
    violations.push({ check: 'unhandled-card', detail: 'expected an .unhandled card on a route iTube does not implement, found none' });
    return violations;
  }
  if (!info.visible) {
    violations.push({ check: 'unhandled-card', detail: 'the .unhandled card exists but has zero area' });
  }
  if (!/isn't available in iTube yet/i.test(info.text)) {
    violations.push({ check: 'unhandled-card', detail: `expected the .unhandled card to say "isn't available in iTube yet", got "${info.text.trim()}"` });
  }
  if (!info.hasHomeLink) {
    violations.push({ check: 'unhandled-card', detail: 'expected the .unhandled card to offer a link back to Home' });
  }
  return violations;
}

// The layout must hold at a narrow laptop width and on a very wide monitor.
// The `.body { max-width: 1720px; margin: 0 auto }` bug that shipped was
// invisible at the default 1440px test viewport and only appeared on a wide
// screen, so width is a dimension this suite has to actually exercise.
async function checkResponsive(page, widths = [900, 2560]) {
  const violations = [];
  const original = page.viewportSize();
  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height: original ? original.height : 900 });
      await page.waitForTimeout(400);
      const info = await page.evaluate(() => {
        const itube = document.querySelector('#itube');
        const sidebar = itube && itube.querySelector('.sidebar');
        const content = itube && itube.querySelector('.content');
        const overflow = [];
        for (const sel of ['#itube', '.sidebar', '.content']) {
          const el = sel.startsWith('#') ? document.querySelector(sel) : itube && itube.querySelector(sel);
          if (!el) continue;
          if (el.scrollWidth > el.clientWidth + 1) {
            overflow.push(`${sel} scrollWidth=${el.scrollWidth} > clientWidth=${el.clientWidth}`);
          }
        }
        return {
          vw: window.innerWidth,
          docScrollWidth: document.documentElement.scrollWidth,
          sidebarLeft: sidebar ? sidebar.getBoundingClientRect().left : null,
          contentRight: content ? content.getBoundingClientRect().right : null,
          overflow,
        };
      });

      if (info.sidebarLeft === null) {
        violations.push({ check: 'responsive-sidebar-pinned', detail: `no .sidebar at width=${width}` });
      } else if (Math.abs(info.sidebarLeft) > 1) {
        violations.push({ check: 'responsive-sidebar-pinned', detail: `at width=${width} expected .sidebar.left === 0, got ${info.sidebarLeft.toFixed(1)}` });
      }
      for (const o of info.overflow) {
        violations.push({ check: 'responsive-no-overflow', detail: `at width=${width}: ${o}` });
      }
      if (info.docScrollWidth > info.vw + 1) {
        violations.push({ check: 'responsive-no-overflow', detail: `at width=${width} the document scrolls horizontally: scrollWidth=${info.docScrollWidth} > innerWidth=${info.vw}` });
      }
      if (info.contentRight !== null && info.contentRight > info.vw + 1) {
        violations.push({ check: 'responsive-no-overflow', detail: `at width=${width} .content.right=${info.contentRight.toFixed(1)} exceeds the viewport (${info.vw})` });
      }
    }
  } finally {
    if (original) await page.setViewportSize(original);
    await page.waitForTimeout(300);
  }
  return violations;
}

module.exports = {
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
};
