// Behavioural checks: does the player actually work, does the custom bar
// respond to input, does navigation stay client-side, does the UI ever lie
// about state (e.g. "liked" when the like call actually failed).
'use strict';

const { waitForApp, openPage, newContext } = require('../lib/harness');

// A known 24-audio-track video (dubbed languages + original). This is the
// only page in the suite that needs a SPECIFIC video rather than any watch
// URL, so it runs once, in its own context, rather than as part of
// runWatchFunctional (which runs against the default single-track video and
// must see the Audio row hidden — see 'audio-row-hidden-single-track').
const MULTI_AUDIO_VIDEO_ID = '0e3GPea1Tyg';

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

// Clicks a card the way a human does: by pointing at a spot inside it.
//
// A card is no longer a single <a>. It is a container whose video link is an
// overlay anchor stretched across it, with the channel name sitting ABOVE that
// overlay as its own link. That is what makes the author reachable without
// nesting one <a> inside another. The consequence for a test is that
// `elementHandle.click()` on the card (or on its title/thumb) fails
// actionability with "…intercepts pointer events" — Playwright is right, the
// overlay does cover it, and that interception is the feature.
//
// So aim the mouse at the coordinates of a specific part of the card and let
// the browser hit-test, exactly like a user. `part` picks WHICH part, which
// matters: pointing at the channel name is supposed to open the CHANNEL, while
// pointing at the title/thumbnail is supposed to open the VIDEO.
async function clickCardPart(page, card, part) {
  const target = await card.$(part);
  const box = await (target || card).boundingBox();
  if (!box) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
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
  // aircAruvnKk is not reliably single-track (it currently serves 9 auto-dub
  // tracks), so this can't just assert on whatever the fixture happens to be
  // today. Instead force the deterministic shape: stub getAvailableAudioTracks
  // to return exactly one track (the current one), reopen the menu, and the
  // Audio row must stay hidden — most videos ARE single-track, and a row with
  // nothing to switch between must not appear. The multi-track case (row
  // visible, options populated with real language names, switching works) is
  // covered separately by checkAudioTrackSelector against a known multi-track
  // video.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const p = document.getElementById('movie_player');
    if (p) p.getAvailableAudioTracks = () => [(p.getAudioTrack && p.getAudioTrack()) || {}];
  });
  await page.click('#itube-more', { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(200);
  const audioRowDisplay = await page.evaluate(() => {
    const row = document.getElementById('itube-audio')?.parentElement;
    return row ? getComputedStyle(row).display : null;
  });
  if (audioRowDisplay !== 'none') {
    report('audio-row-hidden-single-track', `expected the Audio menu row to be display:none when getAvailableAudioTracks() returns exactly one track, got display:${audioRowDisplay}`);
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
  //
  // Wait for the button to be VISIBLE first: the actions row lives inside
  // .watch-channel, which the load skeleton (v4.6.0) sets display:none until the
  // owner data arrives. Under full-suite load that reveal can lag the video
  // being ready, so a bare .click() here would sit 30s on a display:none button.
  // A genuine "meta never loaded" still surfaces — the button stays hidden, the
  // wait lapses, and the existence/disabled checks below report it.
  await page.waitForSelector('.watch-like-btn', { state: 'visible', timeout: 15000 }).catch(() => {});
  const likeBtn = await page.$('.watch-like-btn');
  if (!likeBtn) {
    report('like-button-exists', 'expected .watch-like-btn to exist');
  } else if (await page.evaluate((el) => el.disabled, likeBtn)) {
    report('like-button-disabled', 'the .watch-like-btn is disabled on a normal video — the app only disables it when it could not resolve the video id (actionsVideoId), so the actions row is wired to nothing');
  } else if (!(await likeBtn.isVisible())) {
    report('like-button-hidden', 'the .watch-like-btn stayed hidden past the 15s wait — the watch meta never revealed past the load skeleton, so the actions row is unreachable');
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
  // Click the TITLE, not the card's centre: the centre of a compact related
  // card lands on the channel-name link, which correctly opens the channel
  // rather than the video.
  const clicked = await clickCardPart(page, related, '.rc-title');
  if (!clicked) {
    violations.push({ check: 'related-card-exists', detail: 'the first .rc related card has no layout box to click' });
    page.off('response', onResponse);
    return violations;
  }
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

  // `.c` = grid card (home/channel/playlist), `.row` = list row (search). Each
  // is a CONTAINER whose video link is an overlay anchor stretched across it
  // (the channel name is a sibling link on top) — so match the card by the
  // video link it contains, and click it through the overlay by coordinates.
  //
  // NOTE: the logged-out home feed legitimately renders ZERO video cards —
  // plain YouTube serves a feedNudgeRenderer instead of a grid to a session
  // with no watch history — so there is nothing to click there and nothing to
  // assert. That is a property of YouTube, not a bug in the app.
  const card = await page.$('#itube .c:has(a[href^="/watch"]), #itube .row:has(a[href^="/watch"])');
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
    await clickCardPart(page, card, '.c-title, .row-title');
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
//
// 400/560 exercise the narrow-phone breakpoints added for Wave 2 Chunk B:
// below 1000px the sidebar must collapse to a narrow icon rail (not sit at a
// rigid 232px forcing everything else to be squeezed or clipped), and below
// 600px it must stop being a left column entirely — it becomes a full-width
// top bar (logo + search) with the content stacked beneath it, so the content
// starts at the left edge instead of being pushed right. The watch page's two-column
// `minmax(0, 1fr) clamp(340px, 24vw, 460px)` grid used to leave the LEFT
// (video) column with none of the room — at a narrow width the right column's
// 340px floor ate the whole viewport and `#itube-stage`/`.watch-left`
// shrank toward zero. That is the exact defect this check pins down: the
// stage must keep a sane width instead of collapsing. Feed grids
// (`.grid .c` / `.list .row`) must reflow to fewer columns rather than being
// clipped by `.content`'s `overflow-x: hidden`.
async function checkResponsive(page, widths = [400, 560, 900, 2560]) {
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
        const stage = document.querySelector('#itube-stage');
        const watchLeft = itube && itube.querySelector('.watch-left');
        const firstCard = itube && itube.querySelector('.grid .c, .list .row');
        const overflow = [];
        for (const sel of ['#itube', '.sidebar', '.content']) {
          const el = sel.startsWith('#') ? document.querySelector(sel) : itube && itube.querySelector(sel);
          if (!el) continue;
          if (el.scrollWidth > el.clientWidth + 1) {
            overflow.push(`${sel} scrollWidth=${el.scrollWidth} > clientWidth=${el.clientWidth}`);
          }
        }
        const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
        const contentRect = content ? content.getBoundingClientRect() : null;
        return {
          vw: window.innerWidth,
          docScrollWidth: document.documentElement.scrollWidth,
          sidebarLeft: sidebarRect ? sidebarRect.left : null,
          sidebarWidth: sidebarRect ? sidebarRect.width : null,
          sidebarHeight: sidebarRect ? sidebarRect.height : null,
          contentLeft: contentRect ? contentRect.left : null,
          contentRight: contentRect ? contentRect.right : null,
          stageWidth: stage ? stage.getBoundingClientRect().width : null,
          watchLeftWidth: watchLeft ? watchLeft.getBoundingClientRect().width : null,
          cardRight: firstCard ? firstCard.getBoundingClientRect().right : null,
          cardWidth: firstCard ? firstCard.getBoundingClientRect().width : null,
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

      if (width <= 600) {
        // Below 600px the sidebar is no longer a left column: it becomes a
        // full-width top bar (logo + search) and the content stacks beneath it.
        // The defect this pins is the sidebar eating horizontal space at phone
        // widths — so the content must start at the left edge (left ~= 0) and
        // the sidebar must be a short bar, not a tall column swallowing the row.
        if (info.contentLeft !== null && info.contentLeft > 4) {
          violations.push({ check: 'responsive-sidebar-collapse', detail: `at width=${width} expected the sidebar to become a top bar (content full-width, left~=0), got content.left=${info.contentLeft.toFixed(1)}` });
        }
        if (info.sidebarHeight !== null && info.sidebarHeight > 220) {
          violations.push({ check: 'responsive-sidebar-collapse', detail: `at width=${width} expected the sidebar to be a short top bar (height<=220), got height=${info.sidebarHeight.toFixed(1)}` });
        }
      } else if (width < 1000) {
        if (info.sidebarWidth !== null && info.sidebarWidth > 120) {
          violations.push({ check: 'responsive-sidebar-collapse', detail: `at width=${width} expected .sidebar to collapse below 1000px, got width=${info.sidebarWidth.toFixed(1)}` });
        }
      }

      if (width <= 600 && info.stageWidth !== null) {
        const minSane = Math.min(240, info.vw * 0.5);
        if (info.stageWidth < minSane) {
          violations.push({ check: 'responsive-watch-stage-width', detail: `at width=${width} #itube-stage width=${info.stageWidth.toFixed(1)} collapsed below the sane minimum ${minSane.toFixed(1)}` });
        }
        if (info.watchLeftWidth !== null && info.watchLeftWidth < minSane) {
          violations.push({ check: 'responsive-watch-stage-width', detail: `at width=${width} .watch-left width=${info.watchLeftWidth.toFixed(1)} collapsed below the sane minimum ${minSane.toFixed(1)}` });
        }
      }

      if (width <= 600 && info.cardRight !== null && info.contentRight !== null) {
        if (info.cardRight > info.contentRight + 1) {
          violations.push({ check: 'responsive-grid-reflow', detail: `at width=${width} a feed card extends to ${info.cardRight.toFixed(1)}, past .content's right edge ${info.contentRight.toFixed(1)} (clipped instead of reflowed)` });
        }
        if (info.cardWidth !== null && info.cardWidth <= 0) {
          violations.push({ check: 'responsive-grid-reflow', detail: `at width=${width} the first feed card rendered with zero width` });
        }
      }
    }
  } finally {
    if (original) await page.setViewportSize(original);
    await page.waitForTimeout(300);
  }
  return violations;
}

// A description "1:23" link that points at the SAME video used to be a dead
// click: it rendered as /watch?v=<sameId>&t=83s, the router saw an unchanged
// video id and no-opped, and the timestamp did nothing. The fix intercepts the
// click and calls player.seekTo() directly, while leaving the href intact so
// middle-click/Cmd-click still open a real timestamped URL. This asserts the
// left-click path: the clock actually jumps, and it does so WITHOUT a
// navigation (reusing the doc-load counting pattern from
// checkWatchToWatchNavigation).
async function checkDescriptionTimestampSeek(page) {
  const violations = [];
  const currentVideoId = await page.evaluate(() => new URLSearchParams(location.search).get('v'));

  const handle = await page.evaluateHandle((vid) => {
    const links = [...document.querySelectorAll('.watch-desc-link')];
    return links.find((a) => {
      const href = a.getAttribute('href') || '';
      if (!/[?&]t=\d/.test(href)) return false;
      try {
        const url = new URL(href, location.origin);
        const linkVid = url.searchParams.get('v');
        return !linkVid || linkVid === vid;
      } catch (e) {
        return false;
      }
    }) || null;
  }, currentVideoId);
  const el = handle.asElement();
  if (!el) {
    console.log("  timestamp-seek: SKIP — this video's description has no same-video timestamp link (.watch-desc-link with t=)");
    return violations;
  }

  const targetSeconds = await page.evaluate((a) => {
    const m = (a.getAttribute('href') || '').match(/[?&]t=(\d+)/);
    return m ? Number(m[1]) : null;
  }, el);
  const before = await page.evaluate(() => document.querySelector('#itube-stage video')?.currentTime ?? null);

  const rec = recordMainFrameDocLoads(page);
  await el.click();
  await page.waitForTimeout(700);
  rec.stop();

  const after = await page.evaluate(() => ({
    currentTime: document.querySelector('#itube-stage video')?.currentTime ?? null,
    pathname: location.pathname,
    v: new URLSearchParams(location.search).get('v'),
  }));

  if (rec.urls.length > 0) {
    violations.push({ check: 'timestamp-seek-no-reload', detail: `expected 0 main-frame document loads clicking a description timestamp link, got ${rec.urls.length}: ${rec.urls.join(' , ')}` });
  }
  if (after.pathname !== '/watch' || after.v !== currentVideoId) {
    violations.push({ check: 'timestamp-seek-same-video', detail: `expected to stay on /watch?v=${currentVideoId}, got pathname=${after.pathname} v=${after.v}` });
  }
  if (targetSeconds == null || after.currentTime == null || Math.abs(after.currentTime - targetSeconds) > 2) {
    violations.push({ check: 'timestamp-seek-jumps', detail: `expected currentTime to land within ~2s of target ${targetSeconds}, before=${before} after=${after.currentTime}` });
  }
  return violations;
}

// Best-effort: comment bodies now render clickable segments (timestamps seek,
// URLs/mentions are real links) instead of one plain-text blob. Not every
// video's top comments contain a link, so this skips cleanly rather than
// asserting on content the live site may not have served this run.
async function checkCommentBodyLinks(page) {
  const violations = [];
  const links = await page.evaluate(() => [...document.querySelectorAll('.comment-text a')].map((a) => ({
    href: a.getAttribute('href'),
    nested: !!a.querySelector('a'),
  })));
  if (!links.length) {
    console.log('  comment-body-links: SKIP — no <a> found inside any .comment-text on this run');
    return violations;
  }
  const bad = links.filter((l) => !l.href || !/^(\/|https?:\/\/)/.test(l.href) || l.nested);
  if (bad.length) {
    violations.push({
      check: 'comment-body-link-shape',
      detail: `${bad.length}/${links.length} .comment-text links are malformed (want a real channel/watch/http href, no nested <a>): ${bad.slice(0, 3).map((l) => JSON.stringify(l)).join(' ; ')}`,
    });
  }
  return violations;
}

// Best-effort/optional: a deterministic comments-disabled video is hard to
// pin to a live id, so this only asserts something when the CURRENT video
// happens to have comments disabled (commentsToggle.disabled reflects that
// directly — see resetComments in itube.user.js). Otherwise it skips cleanly.
async function checkCommentsOffCopy(page) {
  const violations = [];
  const info = await page.evaluate(() => {
    const toggle = document.querySelector('.comments-toggle');
    const label = toggle ? toggle.querySelector('span') : null;
    return { disabled: toggle ? toggle.disabled : null, text: label ? label.textContent : null };
  });
  if (!info.disabled) {
    console.log('  comments-off-copy: SKIP — this video has comments enabled, nothing to assert');
    return violations;
  }
  if (info.text !== 'Comments are turned off.') {
    violations.push({ check: 'comments-off-copy', detail: `expected the comments pill label to read "Comments are turned off." on a video with comments disabled, got "${info.text}"` });
  }
  return violations;
}

// A legacy /user/<name> channel URL used to fall straight through
// CHANNEL_PATH_RE, land on { type: 'unhandled' }, and render the "isn't
// available" card instead of the channel — even though the click was already
// intercepted client-side. Proves both halves: no reload, AND the channel
// mount (not the unhandled one) is what actually renders.
async function checkUserRouteClientSide(page) {
  const violations = [];
  const userHref = '/user/YouTube';
  await page.evaluate((href) => {
    const a = document.createElement('a');
    a.id = 'itube-test-user-link';
    a.href = href;
    a.textContent = 'legacy user link';
    a.style.position = 'fixed';
    a.style.left = '0';
    a.style.bottom = '0';
    a.style.zIndex = '99999';
    document.querySelector('#itube').appendChild(a);
  }, userHref);

  const mark = await stampMark(page);
  const rec = recordMainFrameDocLoads(page);
  let survived;
  try {
    await page.click('#itube-test-user-link');
    await page.waitForFunction(() => (
      document.querySelector('.ch-header') || document.querySelector('.empty') || document.querySelector('.unhandled')
    ), { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    survived = await markSurvived(page, mark);
  } finally {
    rec.stop();
  }

  const info = await page.evaluate(() => ({
    path: location.pathname,
    mountedChannel: !!(document.querySelector('.ch-header') || document.querySelector('.empty')),
    mountedUnhandled: !!document.querySelector('.unhandled'),
  }));
  await page.evaluate(() => document.getElementById('itube-test-user-link')?.remove());

  if (info.path !== userHref) {
    violations.push({ check: 'user-route-client-side', detail: `expected clicking "${userHref}" to SPA-route to it, got pathname "${info.path}"` });
  }
  if (rec.urls.length > 0) {
    violations.push({ check: 'user-route-no-reload', detail: `clicking "${userHref}" caused ${rec.urls.length} main-frame document load(s), expected a client-side route: ${rec.urls.join(' , ')}` });
  }
  if (!survived) {
    violations.push({ check: 'user-route-no-reload', detail: `window.__itubeMark did not survive clicking "${userHref}" — the document was replaced` });
  }
  if (info.mountedUnhandled || !info.mountedChannel) {
    violations.push({ check: 'user-route-mounts-channel', detail: `expected "${userHref}" to mount the channel view (CHANNEL_PATH_RE must match legacy /user/ paths), got mountedUnhandled=${info.mountedUnhandled} mountedChannel=${info.mountedChannel}` });
  }
  return violations;
}

// The applied search filter used to live in memory only: reload or Back lost
// it silently. Asserts the filter round-trips through the URL's own `sp`
// param (YouTube's real param name) both ways — select change -> URL, and
// URL -> restored select on reload — without asserting on result CONTENT,
// which the live site can legitimately vary.
async function checkFiltersInUrl(page) {
  const violations = [];
  const selects = await page.$$('.search-filter-select');
  if (!selects.length) {
    violations.push({ check: 'filters-in-url-select-exists', detail: 'expected .search-filter-select elements on the search page' });
    return violations;
  }
  const sortSelect = selects[0];
  const options = await page.evaluate((el) => [...el.options].map((o) => o.value).filter(Boolean), sortSelect);
  if (!options.length) {
    violations.push({ check: 'filters-in-url-select-exists', detail: 'expected the sort filter select to have at least one non-empty option' });
    return violations;
  }
  const chosen = options[0];
  await sortSelect.selectOption(chosen);
  await page.waitForFunction((val) => new URLSearchParams(location.search).get('sp') === val, chosen, { timeout: 5000 }).catch(() => {});
  const spAfterChange = await page.evaluate(() => new URLSearchParams(location.search).get('sp'));
  if (spAfterChange !== chosen) {
    violations.push({ check: 'filters-in-url-sp-set', detail: `expected location.search to gain sp=${chosen} after changing the sort filter, got sp=${spAfterChange}` });
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForApp(page, { timeout: 30000 });
  await page.waitForSelector('.search-filter-select', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
  const restored = await page.evaluate(() => {
    const sel = document.querySelector('.search-filter-select');
    return { spInUrl: new URLSearchParams(location.search).get('sp'), selectValue: sel ? sel.value : null };
  });
  if (restored.spInUrl !== chosen) {
    violations.push({ check: 'filters-in-url-survives-reload', detail: `expected sp=${chosen} to survive reload, got sp=${restored.spInUrl}` });
  }
  if (restored.selectValue !== chosen) {
    violations.push({ check: 'filters-in-url-select-restored', detail: `expected the sort <select> value to be restored to "${chosen}" after reload, got "${restored.selectValue}"` });
  }
  return violations;
}

// The suggestions dropdown is fetched from a third-party endpoint
// (suggestqueries-clients6.youtube.com) that can be flaky or briefly
// throttled in CI, so a missing dropdown is a SKIP, not a FAIL — but once it
// shows up, its keyboard behavior and submit behavior are asserted for real:
// ArrowDown/ArrowUp must move the highlighted row, and Enter must submit the
// HIGHLIGHTED suggestion (not just whatever was typed), landing on
// /results?search_query=<that suggestion> without leaving the dropdown open.
async function checkSearchSuggestions(page) {
  const violations = [];
  const input = await page.$('.search');
  if (!input) {
    violations.push({ check: 'search-suggestions-input', detail: 'expected a .search input in the header' });
    return violations;
  }

  await input.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await input.type('liquid glass', { delay: 30 });
  await page.waitForSelector('.search-suggest.show .search-suggest-row', { timeout: 5000 }).catch(() => {});
  let rows = await page.$$('.search-suggest-row');
  if (!rows.length) {
    console.log('  search-suggestions: SKIP — no suggestions arrived (third-party endpoint variance), nothing to assert');
    return violations;
  }

  const texts = await page.evaluate(() => [...document.querySelectorAll('.search-suggest-row')].map((r) => r.textContent));

  await page.keyboard.press('ArrowDown');
  let active = await page.evaluate(() => document.querySelector('.search-suggest-row.active')?.textContent || null);
  if (active !== texts[0]) {
    violations.push({ check: 'search-suggestions-keyboard', detail: `ArrowDown expected to highlight "${texts[0]}", got "${active}"` });
  }
  if (texts.length > 1) {
    await page.keyboard.press('ArrowDown');
    active = await page.evaluate(() => document.querySelector('.search-suggest-row.active')?.textContent || null);
    if (active !== texts[1]) {
      violations.push({ check: 'search-suggestions-keyboard', detail: `second ArrowDown expected to highlight "${texts[1]}", got "${active}"` });
    }
    await page.keyboard.press('ArrowUp');
    active = await page.evaluate(() => document.querySelector('.search-suggest-row.active')?.textContent || null);
    if (active !== texts[0]) {
      violations.push({ check: 'search-suggestions-keyboard', detail: `ArrowUp expected to move back to "${texts[0]}", got "${active}"` });
    }
  }

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.pathname === '/results', { timeout: 5000 }).catch(() => {});
  const afterEnter = await page.evaluate(() => ({
    path: location.pathname,
    q: new URLSearchParams(location.search).get('search_query'),
    suggestVisible: !!document.querySelector('.search-suggest.show'),
  }));
  if (afterEnter.path !== '/results' || afterEnter.q !== texts[0]) {
    violations.push({ check: 'search-suggestions-submit', detail: `expected Enter on the highlighted suggestion to navigate to /results?search_query=${encodeURIComponent(texts[0])}, got path=${afterEnter.path} q=${afterEnter.q}` });
  }
  if (afterEnter.suggestVisible) {
    violations.push({ check: 'search-suggestions-submit', detail: 'the suggestions dropdown is still visible after submitting' });
  }

  const input2 = await page.$('.search');
  await input2.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await input2.type('never gonna', { delay: 30 });
  await page.waitForSelector('.search-suggest.show .search-suggest-row', { timeout: 5000 }).catch(() => {});
  rows = await page.$$('.search-suggest-row');
  if (!rows.length) {
    console.log('  search-suggestions: SKIP (click phase) — no suggestions arrived for the second query');
    return violations;
  }
  const clickText = await page.evaluate((el) => el.textContent, rows[0]);
  await rows[0].click();
  await page.waitForFunction((q) => new URLSearchParams(location.search).get('search_query') === q, clickText, { timeout: 5000 }).catch(() => {});
  const afterClick = await page.evaluate(() => ({
    path: location.pathname,
    q: new URLSearchParams(location.search).get('search_query'),
  }));
  if (afterClick.path !== '/results' || afterClick.q !== clickText) {
    violations.push({ check: 'search-suggestions-click', detail: `expected clicking a suggestion row to navigate to /results?search_query=${encodeURIComponent(clickText)}, got path=${afterClick.path} q=${afterClick.q}` });
  }

  return violations;
}

// Regression: hideSuggestions() used to clear only the dropdown DOM, not the
// pending debounce timer or the in-flight fetch generation. So a suggestion
// request that was still in flight when the user SUBMITTED (Enter within the
// 150ms debounce, or clicking a video) resolved AFTER navigation and re-opened
// the dropdown on the results/watch page over an unfocused input — the app
// popping open a menu on a page the user had already left.
//
// checkSearchSuggestions can't catch this: it waits for the dropdown to appear
// BEFORE pressing Enter, so by submit time there is no pending timer/fetch.
// This reproduces the real condition — submit while a request is still pending
// — deterministically by MOCKING the suggest endpoint (the live one is
// third-party and its timing can't be relied on to land post-navigation).
async function checkSuggestionsDontResurrectAfterSubmit(page) {
  const violations = [];
  const suggestRe = /suggestqueries.*\/complete\/search/;
  // Canned reply keyed off the query, so the resurrected dropdown (if the bug
  // is present) has real rows to render and `search.value === q` still holds
  // after mountSearch re-sets the input value post-navigation.
  await page.route(suggestRe, (route) => {
    const q = new URL(route.request().url()).searchParams.get('q') || 'x';
    const body = JSON.stringify([q, [[q + ' one'], [q + ' two'], [q + ' three']]]);
    return route.fulfill({ status: 200, contentType: 'application/json', body });
  });
  try {
    const input = await page.$('.search');
    if (!input) {
      violations.push({ check: 'suggestions-resurrect-input', detail: 'expected a .search input in the header' });
      return violations;
    }
    await input.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    // Type then submit immediately — the debounce timer scheduled by the last
    // keystroke is still pending when Enter fires, which is the exact bug
    // condition. (A short per-key delay keeps the whole type well under 150ms.)
    await input.type('resurrect probe', { delay: 5 });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => location.pathname === '/results', { timeout: 5000 }).catch(() => {});
    // Well past the 150ms debounce plus the (instant, mocked) fetch: a
    // resurrected dropdown would have rendered by now.
    await page.waitForTimeout(700);
    const visible = await page.evaluate(() => !!document.querySelector('.search-suggest.show'));
    if (visible) {
      violations.push({ check: 'suggestions-no-resurrect-after-submit', detail: 'the suggestions dropdown reappeared after the search was submitted — a debounce timer or in-flight suggestion request outlived hideSuggestions() and re-opened the dropdown post-navigation, over an unfocused input on a page the user already left' });
    }
  } finally {
    await page.unroute(suggestRe).catch(() => {});
  }
  return violations;
}

// The About tab has to behave like Videos/Playlists: a real tab button that
// mounts content client-side. Reuses the doc-load counting pattern from
// checkUserRouteClientSide — the failure mode this guards against is the tab
// silently falling back to a full navigation (or not existing at all).
async function checkAboutTab(page) {
  const violations = [];
  const aboutHandle = await page.evaluateHandle(() => (
    [...document.querySelectorAll('.ch-tab')].find((b) => b.textContent.trim() === 'About') || null
  ));
  const aboutBtn = aboutHandle.asElement();
  if (!aboutBtn) {
    violations.push({ check: 'about-tab-exists', detail: 'expected a "About" .ch-tab button beside Videos/Playlists' });
    return violations;
  }

  const mark = await stampMark(page);
  const rec = recordMainFrameDocLoads(page);
  try {
    await aboutBtn.click();
    await page.waitForFunction(() => location.pathname.endsWith('/about'), { timeout: 15000 }).catch(() => {});
    await page.waitForSelector('.ch-about-desc, .ch-about-stats, .ch-about .empty', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
  } finally {
    rec.stop();
  }
  const survived = await markSurvived(page, mark);

  const info = await page.evaluate(() => ({
    path: location.pathname,
    hasAbout: !!document.querySelector('.ch-about'),
    hasDescOrStats: !!(document.querySelector('.ch-about-desc') || document.querySelector('.ch-about-stats')),
  }));

  if (!info.path.endsWith('/about')) {
    violations.push({ check: 'about-tab-url', detail: `expected the URL to end in /about after clicking the About tab, got "${info.path}"` });
  }
  if (!survived) {
    violations.push({ check: 'about-tab-client-side', detail: 'clicking the About tab wiped window state — the page reloaded' });
  }
  if (rec.urls.length > 0) {
    violations.push({ check: 'about-tab-client-side', detail: `clicking the About tab caused ${rec.urls.length} main-frame document load(s), expected a client-side mount: ${rec.urls.join(' , ')}` });
  }
  if (!info.hasAbout || !info.hasDescOrStats) {
    violations.push({ check: 'about-tab-content', detail: 'expected the About tab to mount a description/stats block (.ch-about-desc or .ch-about-stats)' });
  }
  return violations;
}

// Clicking a related video used to swap the <video> source with nothing
// covering the gap: the decoder drops the old frame before the new one is
// ready, so the stage goes black or freezes for a beat. The fix snapshots the
// stage into a <canvas> the instant the switch starts and fades it out once
// the new video has actually painted. This asserts the whole contract: the
// overlay shows up, it goes away again within its ~1.5s hard timeout, the
// underlying <video> is never hidden while it's covering for it (the actual
// failure mode this exists to prevent), the stage box never moves, there is
// no main-frame reload, and playback is still advancing afterward.
async function checkVideoCrossfade(page) {
  const violations = [];
  await page.waitForSelector('.rc', { timeout: 10000 }).catch(() => {});
  const related = await page.$('.rc');
  if (!related) {
    violations.push({ check: 'crossfade-related-exists', detail: 'expected at least one .rc related card to trigger a watch-to-watch switch' });
    return violations;
  }
  // The crossfade only has something worth snapshotting once the CURRENT
  // video has actually reached a decodable frame (readyState >= 2) — YouTube's
  // own player cycles readyState down to 0 and back a few times while it
  // resolves formats after any switch, so clicking again mid-cycle (e.g. right
  // after checkWatchToWatchNavigation's own switch) is a real, correct skip
  // condition, not a bug. Wait for that settle first so this check exercises
  // the overlay path instead of the guarded no-op path.
  await page.waitForFunction(() => {
    const v = document.querySelector('#itube-stage video');
    return v && v.readyState >= 2;
  }, { timeout: 8000 }).catch(() => {});
  const stageBefore = await page.evaluate(() => {
    const r = document.querySelector('#itube-stage')?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  });
  const titleBefore = await page.evaluate(() => document.querySelector('.watch-title')?.textContent || '');
  const rec = recordMainFrameDocLoads(page);
  const clicked = await clickCardPart(page, related, '.rc-title');
  if (!clicked) {
    rec.stop();
    violations.push({ check: 'crossfade-related-exists', detail: 'the first .rc related card has no layout box to click' });
    return violations;
  }

  const result = await page.evaluate(() => new Promise((resolve) => {
    const stage = document.getElementById('itube-stage');
    const start = performance.now();
    let sawOverlay = false;
    let sawVideoHidden = false;
    const poll = () => {
      const canvas = stage && stage.querySelector('canvas.itube-crossfade');
      const video = stage && stage.querySelector('video');
      if (canvas && Number(getComputedStyle(canvas).opacity) > 0) sawOverlay = true;
      if (video && getComputedStyle(video).display === 'none') sawVideoHidden = true;
      if (performance.now() - start < 3000) {
        requestAnimationFrame(poll);
      } else {
        resolve({
          sawOverlay,
          sawVideoHidden,
          overlayGoneAtEnd: !(stage && stage.querySelector('canvas.itube-crossfade')),
        });
      }
    };
    requestAnimationFrame(poll);
  }));
  rec.stop();

  await page.waitForFunction(
    (prev) => document.querySelector('.watch-title')?.textContent !== prev,
    titleBefore,
    { timeout: 8000 }
  ).catch(() => {});

  const stageAfter = await page.evaluate(() => {
    const r = document.querySelector('#itube-stage')?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  });
  // YouTube's own player cycles readyState/currentTime a few times while it
  // resolves formats after a switch (see the crossfade-overlay-appears
  // comment above), so a single fixed-delay sample can land mid-cycle. Poll
  // instead of sleeping once: this only cares that playback eventually
  // resumes, not how many buffering cycles it took to get there.
  const playbackOk = await page.evaluate(() => new Promise((resolve) => {
    const video = document.querySelector('#itube-stage video');
    if (!video) { resolve(false); return; }
    const t0 = video.currentTime;
    const deadline = performance.now() + 6000;
    const poll = () => {
      if (video.currentTime > t0 || !video.paused) { resolve(true); return; }
      if (performance.now() > deadline) { resolve(false); return; }
      setTimeout(poll, 250);
    };
    poll();
  }));

  if (!result.sawOverlay) {
    violations.push({ check: 'crossfade-overlay-appears', detail: 'expected a canvas.itube-crossfade snapshot overlay to appear with opacity > 0 during a watch-to-watch switch' });
  }
  if (!result.overlayGoneAtEnd) {
    violations.push({ check: 'crossfade-overlay-removed', detail: 'expected the crossfade snapshot overlay to be gone within ~1.5s (its hard timeout), it was still present after 2.2s' });
  }
  if (result.sawVideoHidden) {
    violations.push({ check: 'crossfade-no-black-flash', detail: 'the <video> element was display:none at some point during the switch — that is the black-flash failure mode the crossfade overlay exists to cover for' });
  }
  if (rec.urls.length > 0) {
    violations.push({ check: 'crossfade-no-reload', detail: `expected 0 main-frame document loads during the crossfade switch, got ${rec.urls.length}: ${rec.urls.join(' , ')}` });
  }
  if (stageBefore && stageAfter) {
    // A tolerance wider than 1px is deliberate: the related/queue list can
    // grow or shrink enough between videos to toggle the page's own vertical
    // scrollbar, which shifts the viewport width by a scrollbar's worth of
    // pixels — a real but unrelated effect, not a regression in the
    // crossfade. What this guards against is the stage collapsing or
    // resizing by anything bigger than that.
    const moved = Math.abs(stageBefore.x - stageAfter.x) > 24 || Math.abs(stageBefore.y - stageAfter.y) > 24
      || Math.abs(stageBefore.width - stageAfter.width) > 24 || Math.abs(stageBefore.height - stageAfter.height) > 24;
    if (moved) {
      violations.push({ check: 'crossfade-no-layout-jump', detail: `#itube-stage box moved during the switch: before=${JSON.stringify(stageBefore)} after=${JSON.stringify(stageAfter)}` });
    }
  }
  if (!playbackOk) {
    violations.push({ check: 'crossfade-playback-resumes', detail: 'expected playback to resume (currentTime advancing, or not paused) after the switch completed' });
  }
  return violations;
}

// The crossfade is explicitly skipped when Picture-in-Picture is active (the
// video has left the stage, so there is nothing on the stage to snapshot).
// Headless Chromium generally refuses to actually enter PiP with no window
// manager behind it, so this is best-effort: it only asserts the guard when
// it can actually get the browser into PiP, and skips cleanly (with a reason)
// otherwise rather than passing vacuously or failing on an environment limit.
async function checkCrossfadeSkipsWithPiP(page) {
  const violations = [];
  await page.waitForSelector('.rc', { timeout: 10000 }).catch(() => {});
  const related = await page.$('.rc');
  if (!related) return violations;
  const enteredPiP = await page.evaluate(() => {
    const video = document.querySelector('#itube-stage video');
    if (!video || typeof video.requestPictureInPicture !== 'function') return Promise.resolve(false);
    return video.requestPictureInPicture().then(() => true).catch(() => false);
  });
  if (!enteredPiP) {
    console.log('  crossfade-pip-skip: SKIP — headless Chromium would not enter real Picture-in-Picture here, cannot exercise the PiP guard');
    return violations;
  }
  const clicked = await clickCardPart(page, related, '.rc-title');
  if (clicked) {
    await page.waitForTimeout(400);
    const hasOverlay = await page.evaluate(() => !!document.querySelector('#itube-stage canvas.itube-crossfade'));
    if (hasOverlay) {
      violations.push({ check: 'crossfade-pip-skip', detail: 'expected no crossfade overlay while Picture-in-Picture is active' });
    }
  }
  await page.evaluate(() => (document.exitPictureInPicture ? document.exitPictureInPicture().catch(() => {}) : null));
  return violations;
}

// Before renderMeta() applies a video's data, the meta card used to render as
// visibly broken: an empty avatar circle, an empty channel name, and a
// metaDivider line sitting above nothing (channelRow hidden/empty while the
// divider it sits under stayed visible). The skeleton exists to occupy that
// gap deliberately instead. This drives a real watch-to-watch switch (the
// only path with an observable async gap — the initial hard load renders
// synchronously from ytInitialData) and asserts: the skeleton actually shows
// up, the divider is never shown while its own channelRow is hidden (the
// structural version of the orphaned-divider bug — a stale channel NAME
// lingering hidden behind it isn't the bug; a divider floating over nothing
// visible is), the skeleton is gone by the time real data lands, and the
// real name text is there afterward.
async function checkWatchLoadSkeleton(page) {
  const violations = [];
  await page.waitForSelector('.rc', { timeout: 10000 }).catch(() => {});
  const related = await page.$('.rc');
  if (!related) {
    violations.push({ check: 'skeleton-related-exists', detail: 'expected at least one .rc related card to trigger a watch-to-watch switch' });
    return violations;
  }
  // Arm the observer BEFORE clicking, not after — renderWatchFor's async gap
  // can be short enough on a fast connection that a probe installed only
  // after the click misses the whole loading window and asserts nothing.
  await page.evaluate(() => {
    window.__skeletonProbe = new Promise((resolve) => {
      const sk = document.querySelector('.watch-skeleton');
      const divider = document.querySelector('.watch-meta-divider');
      const channelRow = document.querySelector('.watch-channel');
      const nameEl = document.querySelector('.watch-channel-name');
      let sawSkeleton = false;
      let orphanedDivider = false;
      const check = () => {
        if (sk) {
          const skVisible = getComputedStyle(sk).display !== 'none' && Number(getComputedStyle(sk).opacity) > 0;
          if (skVisible) sawSkeleton = true;
        }
        const dividerVisible = divider && getComputedStyle(divider).display !== 'none';
        const channelRowVisible = channelRow && getComputedStyle(channelRow).display !== 'none';
        if (dividerVisible && !channelRowVisible) orphanedDivider = true;
      };
      check();
      const mo = new MutationObserver(check);
      mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style', 'class'] });
      setTimeout(() => {
        mo.disconnect();
        check();
        resolve({
          sawSkeleton,
          orphanedDivider,
          skeletonGoneAtEnd: !sk || getComputedStyle(sk).display === 'none',
          nameAtEnd: (nameEl && nameEl.textContent || '').trim(),
        });
      }, 6000);
    });
  });

  const clicked = await clickCardPart(page, related, '.rc-title');
  if (!clicked) {
    violations.push({ check: 'skeleton-related-exists', detail: 'the first .rc related card has no layout box to click' });
    return violations;
  }

  const result = await page.evaluate(() => window.__skeletonProbe);

  if (!result.sawSkeleton) {
    violations.push({ check: 'watch-skeleton-appears', detail: 'expected .watch-skeleton to become visible while the next video\'s meta was loading, it never did' });
  }
  if (result.orphanedDivider) {
    violations.push({ check: 'watch-skeleton-no-orphan-divider', detail: 'watch-meta-divider was visible while its own .watch-channel row was hidden — the exact broken pre-load state (a divider over nothing) the skeleton exists to replace' });
  }
  if (!result.skeletonGoneAtEnd) {
    violations.push({ check: 'watch-skeleton-hides', detail: 'expected .watch-skeleton to be hidden once the new video\'s meta had loaded' });
  }
  if (!result.nameAtEnd) {
    violations.push({ check: 'watch-skeleton-real-content', detail: 'expected .watch-channel-name to have real text after the switch completed' });
  }
  return violations;
}

// prefers-reduced-motion must turn the shimmer off rather than merely making
// it subtle — getComputedStyle resolves a display:none element's pseudo
// element fine, so this does not need to catch the skeleton mid-load.
async function checkSkeletonReducedMotion(page) {
  const violations = [];
  const normal = await page.evaluate(() => {
    const el = document.querySelector('.watch-skeleton-avatar');
    return el ? getComputedStyle(el, '::after').animationName : null;
  });
  if (normal == null) {
    violations.push({ check: 'skeleton-reduced-motion-baseline', detail: 'expected a .watch-skeleton-avatar element to exist to test the shimmer animation' });
    return violations;
  }
  if (normal === 'none') {
    violations.push({ check: 'skeleton-shimmer-present', detail: 'expected the shimmer keyframe to be applied by default, got animation-name: none' });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => {
    const el = document.querySelector('.watch-skeleton-avatar');
    return el ? getComputedStyle(el, '::after').animationName : null;
  });
  await page.emulateMedia({ reducedMotion: null });
  if (reduced !== 'none') {
    violations.push({ check: 'skeleton-reduced-motion-disables', detail: `expected the shimmer keyframe to be disabled under prefers-reduced-motion, got animation-name: ${reduced}` });
  }
  return violations;
}

// The skeleton must cover the COLD page-load window, not only SPA switches.
// This is the state the user actually screenshotted: a fresh /watch load shows
// a ~2s gap before the ytInitialData-derived meta renders, and before this was
// guarded that gap displayed the broken pre-load state — an empty
// .watch-channel row under a visible .watch-meta-divider, a divider drawn over
// nothing — with no skeleton at all. checkWatchLoadSkeleton exercises ONLY the
// SPA related-click path (renderWatchFor), so it could not catch the cold-load
// regression; renderMeta()'s no-data branch is a separate code path. This opens
// a genuinely cold page with the sampler installed BEFORE any page script runs,
// so it sees the earliest frames.
async function checkColdLoadSkeleton(context) {
  const violations = [];
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__cold = { sawSkeleton: false, sawOrphanDivider: false, nameAt: null, t0: Date.now() };
    const tick = () => {
      const st = window.__cold;
      const sk = document.querySelector('.watch-skeleton');
      const divider = document.querySelector('.watch-meta-divider');
      const nameEl = document.querySelector('.watch-channel-name');
      if (sk) {
        const cs = getComputedStyle(sk);
        if (cs.display !== 'none' && Number(cs.opacity) > 0) st.sawSkeleton = true;
      }
      const nameText = (nameEl && nameEl.textContent || '').trim();
      if (divider && getComputedStyle(divider).display !== 'none' && !nameText) st.sawOrphanDivider = true;
      if (nameText && st.nameAt === null) st.nameAt = Date.now() - st.t0;
      if (Date.now() - st.t0 < 8000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  try {
    await page.goto('https://www.youtube.com/watch?v=aircAruvnKk', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => window.__cold && (window.__cold.nameAt !== null || Date.now() - window.__cold.t0 > 7000),
      { timeout: 12000 }
    ).catch(() => {});
    await page.waitForTimeout(300);
    const res = await page.evaluate(() => window.__cold);
    if (res.sawOrphanDivider) {
      violations.push({ check: 'cold-load-skeleton-no-orphan', detail: `on a COLD /watch load the broken pre-load state appeared: .watch-meta-divider was visible over an empty .watch-channel-name (name filled at ${res.nameAt}ms) — the divider-over-nothing the skeleton exists to replace. The skeleton must cover the cold-load window, not only SPA switches.` });
    }
    // Only demand the skeleton when there was actually a gap to cover: if the
    // meta rendered near-instantly (ytInitialData already present at
    // document-start) there is legitimately nothing to skeleton over.
    if (!res.sawSkeleton && (res.nameAt === null || res.nameAt > 400)) {
      violations.push({ check: 'cold-load-skeleton-appears', detail: `expected .watch-skeleton to cover the cold-load window (real content filled at ${res.nameAt}ms), but the skeleton never became visible` });
    }
  } finally {
    await page.close();
  }
  return violations;
}

// The cold-start boot loader (#itube-boot) is the very first thing painted at
// document-start, before ytInitialData/the app shell exist. It must (1) be on
// screen before any real content, (2) report a real current step rather than
// sitting stuck on "Starting…", and (3) vanish exactly once the watch stage
// has an actual playable frame — never leaving a stuck overlay, and never
// revealing a black stage (video readyState<2) underneath it. This samples a
// genuinely cold /watch load with the sampler installed BEFORE any page
// script runs, the same way checkColdLoadSkeleton does.
async function checkBootLoaderColdLoad(context) {
  const violations = [];
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__boot = { sawAtStart: false, labels: [], removedAt: null, videoReadyAtFade: null, overlayPosition: null, t0: Date.now() };
    const tick = () => {
      const st = window.__boot;
      const overlay = document.querySelector('#itube-boot');
      const label = document.querySelector('#itube-boot .itube-boot-label');
      if (overlay && !st.sawAtStart) st.sawAtStart = true;
      // The loader must be out of normal flow so that its presence and removal
      // can never reflow the app underneath it — that, not a runtime box diff,
      // is what "no layout shift on handoff" actually means. (Measuring
      // #itube-stage across the fade is meaningless here: it is a fixed overlay,
      // and the stage legitimately resizes its own aspect ratio as the video's
      // dimensions arrive in the same window — a shift the loader cannot cause.)
      if (overlay && st.overlayPosition === null) st.overlayPosition = getComputedStyle(overlay).position;
      if (label && label.textContent && st.labels[st.labels.length - 1] !== label.textContent) {
        st.labels.push(label.textContent);
      }
      if (!overlay && st.removedAt === null) {
        st.removedAt = Date.now() - st.t0;
        const v = document.querySelector('#itube-stage video');
        st.videoReadyAtFade = v ? v.readyState : null;
      }
      if (Date.now() - st.t0 < 10000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  try {
    await page.goto('https://www.youtube.com/watch?v=aircAruvnKk', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => window.__boot && (window.__boot.removedAt !== null || Date.now() - window.__boot.t0 > 9000),
      { timeout: 12000 }
    ).catch(() => {});
    await page.waitForTimeout(300);
    const res = await page.evaluate(() => window.__boot);

    if (!res.sawAtStart) {
      violations.push({ check: 'boot-loader-first-paint', detail: 'expected #itube-boot to exist on a cold /watch load before content settled, it was never observed' });
    }
    if (res.labels.length === 0) {
      violations.push({ check: 'boot-loader-label-advances', detail: 'expected the boot label to be non-empty at some point during a cold load, it never was' });
    } else if (!res.labels.some((l) => /player/i.test(l))) {
      violations.push({ check: 'boot-loader-label-route-specific', detail: `expected the boot label to advance past "Starting…" to a watch-specific label containing "player", saw: ${JSON.stringify(res.labels)}` });
    }
    if (res.removedAt === null) {
      violations.push({ check: 'boot-loader-removed', detail: 'expected #itube-boot to be removed from the DOM once the video had a real frame, it never was (stuck overlay)' });
    } else if (res.videoReadyAtFade != null && res.videoReadyAtFade < 2 && res.removedAt < 7500) {
      // Only a defect if the loader gave up EARLY with no frame. A readyState<2
      // fade at ~8s is the deliberate hard-fallback firing on a genuinely slow
      // load (the safety net that stops the overlay ever sticking forever) —
      // revealing the stage then is intended, not a black-stage regression.
      violations.push({ check: 'boot-loader-no-black-stage', detail: `boot loader faded early (${res.removedAt}ms) while video.readyState was ${res.videoReadyAtFade} (<2) — the stage would have shown black underneath it` });
    }
    if (res.overlayPosition !== 'fixed') {
      violations.push({ check: 'boot-loader-no-layout-shift', detail: `expected #itube-boot to be position:fixed so it is out of flow and can never reflow the app on handoff, got position:${res.overlayPosition}` });
    }
  } finally {
    await page.close();
  }
  return violations;
}

// Non-watch routes fade the boot loader on first real content (a card) or a
// settled empty/sign-in state, not a fixed timer. This exercises that path on
// a genuinely cold home load, and checks the label reads a feed-specific
// step rather than the generic fallback.
async function checkBootLoaderFeedColdLoad(context) {
  const violations = [];
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__bootFeed = { sawAtStart: false, labels: [], removedAt: null, hadContentAtFade: null, t0: Date.now() };
    const tick = () => {
      const st = window.__bootFeed;
      const overlay = document.querySelector('#itube-boot');
      const label = document.querySelector('#itube-boot .itube-boot-label');
      if (overlay && !st.sawAtStart) st.sawAtStart = true;
      if (label && label.textContent && st.labels[st.labels.length - 1] !== label.textContent) {
        st.labels.push(label.textContent);
      }
      if (!overlay && st.removedAt === null) {
        st.removedAt = Date.now() - st.t0;
        const view = document.querySelector('#itube .content');
        st.hadContentAtFade = !!(view && view.querySelector('.c, .row, .rc, .empty, .signin-state'));
      }
      if (Date.now() - st.t0 < 10000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  try {
    await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => window.__bootFeed && (window.__bootFeed.removedAt !== null || Date.now() - window.__bootFeed.t0 > 9000),
      { timeout: 12000 }
    ).catch(() => {});
    await page.waitForTimeout(300);
    const res = await page.evaluate(() => window.__bootFeed);

    if (!res.sawAtStart) {
      violations.push({ check: 'boot-loader-feed-first-paint', detail: 'expected #itube-boot to exist on a cold home load before content settled' });
    }
    if (!res.labels.some((l) => /feed/i.test(l))) {
      violations.push({ check: 'boot-loader-feed-label', detail: `expected a route-specific label containing "feed" on the home route, saw: ${JSON.stringify(res.labels)}` });
    }
    if (res.removedAt === null) {
      violations.push({ check: 'boot-loader-feed-removed', detail: 'expected #itube-boot to be removed once the feed had real content, it never was' });
    } else if (!res.hadContentAtFade) {
      violations.push({ check: 'boot-loader-feed-no-early-fade', detail: 'boot loader faded before any .c/.row/.empty/.signin-state existed in the view — it would have revealed an empty view' });
    }
  } finally {
    await page.close();
  }
  return violations;
}

// prefers-reduced-motion must disable the boot loader's own indeterminate
// progress sweep (a separate animation from the later watch-meta shimmer),
// checked at the instant the overlay is created since it fades within
// seconds of a real cold load.
async function checkBootLoaderReducedMotion(context) {
  const violations = [];
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.__bootReduced = null;
    // The userscript itself runs as one synchronous document-start script
    // (registered on the context, ahead of this page-level init script), so
    // by the time this callback even starts the overlay may already be in
    // the DOM — an edge-triggered MutationObserver would miss that insertion
    // entirely. Poll every frame instead, the same pattern the cold-load
    // skeleton sampler uses, so an already-past insertion is still caught.
    const t0 = Date.now();
    const tick = () => {
      const bar = document.querySelector('#itube-boot .itube-boot-bar');
      if (bar) {
        window.__bootReduced = getComputedStyle(bar, '::after').animationName;
        return;
      }
      if (Date.now() - t0 < 5000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  try {
    await page.goto('https://www.youtube.com/watch?v=aircAruvnKk', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__bootReduced !== null, { timeout: 5000 }).catch(() => {});
    const anim = await page.evaluate(() => window.__bootReduced);
    if (anim == null) {
      violations.push({ check: 'boot-loader-reduced-motion-baseline', detail: 'expected the #itube-boot progress bar to exist to test the sweep animation' });
    } else if (anim !== 'none') {
      violations.push({ check: 'boot-loader-reduced-motion-disables', detail: `expected the boot progress sweep to be disabled under prefers-reduced-motion, got animation-name: ${anim}` });
    }
  } finally {
    await page.close();
  }
  return violations;
}

// The boot loader is cold-start only: SPA navigations already have their own
// per-page skeletons/spinners, and a second overlay reappearing on every
// client-side nav would read as a regression to a double-loader. Runs on the
// already-mounted shared page fixture, which is exactly where a resurrection
// bug would show up.
async function checkBootLoaderNoSpaReappear(page) {
  const violations = [];
  const armed = await page.evaluate(() => {
    window.__bootSeenOnSpa = false;
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.id === 'itube-boot') window.__bootSeenOnSpa = true;
        }
      }
    });
    mo.observe(document.documentElement, { childList: true });
    window.__bootSpaObserver = mo;
    return true;
  });
  if (!armed) {
    violations.push({ check: 'boot-loader-spa-guard-setup', detail: 'could not arm the observer watching for #itube-boot resurrecting' });
    return violations;
  }
  const away = await page.$('.nav-row[href="/feed/history"]');
  const home = await page.$('.nav-row[href="/"]');
  if (away) {
    await away.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  if (home) {
    await home.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  const seen = await page.evaluate(() => window.__bootSeenOnSpa);
  await page.evaluate(() => { if (window.__bootSpaObserver) window.__bootSpaObserver.disconnect(); });
  if (seen) {
    violations.push({ check: 'boot-loader-no-spa-reappear', detail: 'expected #itube-boot to never be re-inserted on SPA navigation (it is cold-start only), but it reappeared' });
  }
  return violations;
}

// Exercises the Audio menu row against a real multi-track video: the row
// must appear, the <select> must list every track, and picking a non-default
// option must actually switch the player's audio track. Returns
// { violations, skipped, detail } — a SKIP (not a fail) if this specific
// video no longer has multiple tracks, since that is YouTube's data changing
// underneath a fixed id, not a regression in the app.
async function checkAudioTrackSelector(browser) {
  const context = await newContext(browser);
  try {
    const { page } = await openPage(context, `https://www.youtube.com/watch?v=${MULTI_AUDIO_VIDEO_ID}`);
    await waitForApp(page, { timeout: 30000 });
    await page.waitForFunction(() => {
      const v = document.querySelector('#itube-stage video');
      return v && v.readyState >= 2;
    }, { timeout: 15000 }).catch(() => {});

    let menuOpen = false;
    for (let attempt = 0; attempt < 3 && !menuOpen; attempt++) {
      await page.hover('#itube-stage', { position: { x: 200, y: 200 } });
      await page.waitForTimeout(100);
      try {
        await page.click('#itube-more', { timeout: 2000 });
      } catch {
        continue;
      }
      await page.waitForTimeout(200);
      menuOpen = await page.evaluate(() => getComputedStyle(document.getElementById('itube-menu')).display !== 'none');
    }
    if (!menuOpen) {
      return { violations: [{ check: 'audio-track-menu-opens', detail: 'expected #itube-menu to be visible after clicking #itube-more' }], skipped: false, detail: '' };
    }

    await page.waitForTimeout(300);
    const audioRowDisplay = await page.evaluate(() => {
      const row = document.getElementById('itube-audio')?.parentElement;
      return row ? getComputedStyle(row).display : null;
    });
    const options = await page.evaluate(() => {
      const sel = document.getElementById('itube-audio');
      return sel ? [...sel.options].map((o) => ({ value: o.value, label: o.textContent, selected: o.selected })) : null;
    });

    if (!options || options.length <= 1) {
      return {
        violations: [],
        skipped: true,
        detail: `${MULTI_AUDIO_VIDEO_ID} no longer exposes multiple audio tracks (got ${options ? options.length : 0}) — nothing to assert`,
        options,
      };
    }

    const violations = [];
    if (audioRowDisplay !== 'flex' && audioRowDisplay !== 'block') {
      violations.push({ check: 'audio-row-visible-multi-track', detail: `expected the Audio menu row to be visible on a multi-track video, got display:${audioRowDisplay}` });
    }

    // The labels are the part that actually catches a regression to the
    // hardcoded `.CE` property lookup: when the minified metadata key doesn't
    // match, every option silently falls back to the same literal string
    // ('Track') instead of throwing, so a naive ">1 option" check stays green
    // on completely useless output. Assert the option text is real language
    // names — plural distinct values, none the old fallback literal, and at
    // least one that looks like a word rather than an id/index.
    const labels = options.map((o) => o.label);
    const distinctLabels = new Set(labels);
    if (distinctLabels.size < 2) {
      violations.push({ check: 'audio-option-labels-distinct', detail: `expected >=2 distinct #itube-audio option labels, got ${distinctLabels.size}: [${labels.join(', ')}]` });
    }
    if (labels.some((l) => l === 'Track')) {
      violations.push({ check: 'audio-option-labels-not-fallback', detail: `expected no #itube-audio option labeled the literal fallback 'Track' (a sign the metadata key lookup failed), got: [${labels.join(', ')}]` });
    }
    if (!labels.some((l) => /[A-Za-z]{3,}/.test(l) && l !== 'Track')) {
      violations.push({ check: 'audio-option-labels-real-names', detail: `expected at least one #itube-audio option label to look like a real language name, got: [${labels.join(', ')}]` });
    }

    const readCurrentMetaId = () => page.evaluate(() => {
      const audioMeta = (t) => t && Object.values(t).find((v) => v && typeof v === 'object' && !Array.isArray(v) && typeof v.name === 'string' && typeof v.isDefault === 'boolean' && typeof v.id === 'string');
      const p = document.getElementById('movie_player');
      const t = p?.getAudioTrack?.();
      return audioMeta(t)?.id ?? null;
    });

    const before = await readCurrentMetaId();

    const targetIndex = options.findIndex((o) => !o.selected);
    if (targetIndex === -1) {
      violations.push({ check: 'audio-track-switch', detail: 'expected at least one non-selected option to switch to' });
    } else {
      await page.selectOption('#itube-audio', options[targetIndex].value);
      await page.waitForTimeout(500);
      const after = await readCurrentMetaId();
      if (after === before || after === null) {
        violations.push({ check: 'audio-track-switch', detail: `expected getAudioTrack()'s metadata id to change after selecting a different Audio option, stayed at ${before} (after=${after})` });
      }
    }

    return {
      violations,
      skipped: false,
      detail: `${MULTI_AUDIO_VIDEO_ID}: ${options.length} tracks [${labels.join(', ')}], switched from ${before}`,
      options,
    };
  } finally {
    await context.close();
  }
}

// The dislike count next to .watch-dislike-btn is sourced from the third-
// party Return YouTube Dislike API (fetchDislikes/refreshActions), NOT
// YouTube's own data — YouTube stopped exposing real dislike counts. Two
// things matter: the label shows a clearly-marked ESTIMATE when the API
// answers, and it shows NOTHING (never '0'/'NaN') when the API fails, so a
// broken/unreachable third party can't paint a misleading number. Both
// scenarios are mocked via context.route so this runs deterministically
// against a known response, not whatever the live API currently returns for
// this video.
const DISLIKE_TEST_VIDEO_ID = 'aircAruvnKk';
const RYD_ROUTE_PATTERN = 'https://returnyoutubedislikeapi.com/**';

async function readDislikeLabel(page) {
  await page.waitForSelector('.watch-dislike-btn', { state: 'visible', timeout: 15000 }).catch(() => {});
  const btn = await page.$('.watch-dislike-btn');
  if (!btn) return null;
  return page.evaluate((el) => el.querySelector('span')?.textContent ?? null, btn);
}

async function checkDislikeEstimate(browser) {
  const violations = [];

  // --- success: a known RYD response renders as a labeled estimate ---
  {
    const context = await newContext(browser);
    try {
      await context.route(RYD_ROUTE_PATTERN, (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: DISLIKE_TEST_VIDEO_ID, dateCreated: '2020-01-01', likes: 100000, rawDislikes: 12345,
          rawLikes: 100000, dislikes: 12345, rating: 4, viewCount: 1000000, deleted: false,
        }),
      }));
      const { page } = await openPage(context, `https://www.youtube.com/watch?v=${DISLIKE_TEST_VIDEO_ID}`);
      await waitForApp(page, { timeout: 30000 });
      await page.waitForTimeout(500);
      const label = await readDislikeLabel(page);
      if (label === null) {
        violations.push({ check: 'dislike-estimate-exists', detail: 'expected .watch-dislike-btn (with a label span) to exist' });
      } else if (!label.includes('12') || !/k/i.test(label)) {
        violations.push({ check: 'dislike-estimate-renders', detail: `expected the dislike label to show a compact count for the mocked dislikes:12345 (e.g. "12K"), got "${label}"` });
      } else {
        // The estimate is now marked by the tooltip, not a "~" prefix.
        const title = await page.evaluate(() => document.querySelector('.watch-dislike-btn')?.getAttribute('title') || '');
        if (!/estimat/i.test(title)) {
          violations.push({ check: 'dislike-estimate-labeled', detail: `expected the dislike button to carry an "estimate" tooltip (Return YouTube Dislike), got title="${title}"` });
        }
      }
    } finally {
      await context.close();
    }
  }

  // --- failure: the RYD endpoint erroring must leave the label EMPTY, never 0/NaN ---
  {
    const context = await newContext(browser);
    try {
      await context.route(RYD_ROUTE_PATTERN, (route) => route.fulfill({ status: 500, body: 'error' }));
      const { page } = await openPage(context, `https://www.youtube.com/watch?v=${DISLIKE_TEST_VIDEO_ID}`);
      await waitForApp(page, { timeout: 30000 });
      await page.waitForTimeout(500);
      const label = await readDislikeLabel(page);
      if (label === null) {
        violations.push({ check: 'dislike-estimate-graceful-failure-exists', detail: 'expected .watch-dislike-btn (with a label span) to exist' });
      } else if (label !== '') {
        violations.push({ check: 'dislike-estimate-graceful-failure', detail: `expected the dislike label to stay empty when the RYD API errors (never show a stale/zero/NaN count), got "${label}"` });
      }
    } finally {
      await context.close();
    }
  }

  return violations;
}

// SponsorBlock auto-skip: segments come from a third-party API (privacy
// hash-prefix endpoint, mocked here rather than hit live) and must (1) paint
// as colored markers on the seek bar once the video's duration is known, and
// (2) actually seek the <video> past a segment once the playhead enters it,
// while the feature is enabled. A regression here would silently stop
// skipping sponsors (annoying) or, worse, spin the fetch/marker render on
// every tick (perf regression) — this only proves the user-visible behavior.
const SPONSORBLOCK_TEST_VIDEO_ID = 'aircAruvnKk';
const SPONSORBLOCK_ROUTE_PATTERN = 'https://sponsor.ajay.app/api/skipSegments/**';

async function checkSponsorBlock(browser) {
  const violations = [];
  const context = await newContext(browser);
  try {
    await context.route(SPONSORBLOCK_ROUTE_PATTERN, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        videoID: SPONSORBLOCK_TEST_VIDEO_ID,
        segments: [{ category: 'sponsor', actionType: 'skip', segment: [8, 20], UUID: 'test-uuid' }],
      }]),
    }));
    const { page } = await openPage(context, `https://www.youtube.com/watch?v=${SPONSORBLOCK_TEST_VIDEO_ID}`);
    await waitForApp(page, { timeout: 30000 });
    await page.waitForSelector('#itube-stage video', { timeout: 15000 });
    await page.evaluate(() => {
      const v = document.querySelector('#itube-stage video');
      v.muted = true;
      v.play();
    });
    await page.waitForFunction(() => {
      const v = document.querySelector('#itube-stage video');
      return v && isFinite(v.duration) && v.duration > 0;
    }, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const hasMarker = await page.evaluate(() => !!document.querySelector('.itube-sb-marker'));
    if (!hasMarker) {
      violations.push({ check: 'sponsorblock-marker', detail: 'expected a .itube-sb-marker to appear on the seek bar for the mocked [8,20] sponsor segment, found none' });
    }

    await page.evaluate(() => {
      const v = document.querySelector('#itube-stage video');
      v.currentTime = 10;
    });
    await page.waitForTimeout(800);
    const afterSkip = await page.evaluate(() => document.querySelector('#itube-stage video')?.currentTime ?? 0);
    if (afterSkip < 19.5) {
      violations.push({ check: 'sponsorblock-skip', detail: `expected auto-skip to jump the playhead to >= 19.5s once inside the mocked [8,20] segment, currentTime is ${afterSkip}` });
    }
  } finally {
    await context.close();
  }
  return { violations };
}

// Regression: YouTube migrated videoOwnerRenderer to viewModels on some videos —
// the channel name moved to `attributedTitle.content`, the avatar to
// `avatarStack…image.sources`, the channel id to a nested browseEndpoint, and the
// subscriber line to a plain `content` node. The old extractors read the
// pre-migration paths, so on those videos the owner came out empty. On a cold
// load `videoDetails.author` still filled the name, but the AVATAR was an empty
// <img> (a broken-image box — the reported "weird border"); on an SPA navigation
// there is no videoDetails fallback, so the name was empty too and — because the
// load skeleton only reveals once a name resolves — the meta stayed on the
// shimmer FOREVER (video playing, title shown, channel row never revealing).
//
// This loads a video known to use the new shape and asserts the meta actually
// reveals with a real name AND a loaded avatar. It SKIPs cleanly if the fixture
// video ever stops loading (removed/geo) rather than hard-failing on YouTube.
async function checkWatchMetaReveals(browser) {
  const NEW_SHAPE_VIDEO = 'HZ9UHLTPmw0';
  const violations = [];
  const context = await newContext(browser);
  const { page } = await openPage(context, 'https://www.youtube.com/watch?v=' + NEW_SHAPE_VIDEO);
  try {
    await waitForApp(page, { timeout: 30000 }).catch(() => {});
    await page.waitForFunction(() => {
      const row = document.querySelector('.watch-channel');
      const name = document.querySelector('.watch-channel-name');
      return row && getComputedStyle(row).display !== 'none' && name && (name.textContent || '').trim();
    }, { timeout: 15000 }).catch(() => {});
    // Let the skeleton's ~220ms cross-fade finish before sampling, or the sample
    // catches it mid-fade (display:flex, opacity mid-transition) and misreads a
    // clean reveal as "still shown".
    await page.waitForTimeout(600);
    const s = await page.evaluate(() => {
      const row = document.querySelector('.watch-channel');
      const sk = document.querySelector('.watch-skeleton');
      const name = document.querySelector('.watch-channel-name');
      const av = document.querySelector('img.watch-avatar');
      const title = document.querySelector('.watch-title');
      return {
        skeletonShown: !!sk && getComputedStyle(sk).display !== 'none' && Number(getComputedStyle(sk).opacity) > 0,
        rowVisible: !!row && getComputedStyle(row).display !== 'none',
        name: (name && name.textContent || '').trim(),
        avatarW: av ? av.naturalWidth : 0,
        titleText: (title && title.textContent || '').trim(),
      };
    });
    if (!s.titleText) {
      console.log('  watch-meta-reveals: SKIP — the new-shape fixture video did not load (removed/geo/unavailable), nothing to assert');
      return violations;
    }
    if (s.skeletonShown || !s.rowVisible) {
      violations.push({ check: 'watch-meta-not-stuck-on-skeleton', detail: `the watch meta is STILL on the skeleton on a playing video ("${s.titleText}") — the channel row never revealed (skeletonShown=${s.skeletonShown} rowVisible=${s.rowVisible}). The reveal must never get stuck on the shimmer.` });
    }
    if (!s.name) {
      violations.push({ check: 'watch-meta-owner-name', detail: `channel name empty on a playing video ("${s.titleText}") — the owner extractor missed the current data shape (attributedTitle.content / videoDetails.author)` });
    }
    if (s.name && s.avatarW === 0) {
      violations.push({ check: 'watch-meta-avatar-loads', detail: `the channel avatar did not load (naturalWidth 0) on "${s.titleText}" — an empty <img src> renders as a broken-image box; extract from owner.avatarStack when owner.thumbnail is absent` });
    }
  } finally {
    await page.close();
    await context.close();
  }
  return violations;
}

// Signed-in subscribe SUCCESS used to revert the button. YouTube's successful
// subscribe response carries an openPopupAction (the post-subscribe notification
// popup); the confirmation code treated any openPopupAction / CLIENT_SIGNAL as a
// "blocked" signal (it was meant to catch a SIGN-IN prompt), so the optimistic
// flip snapped back even though the server registered the subscribe (you'd find
// yourself subscribed after a hard refresh). The suite runs logged out — where
// the click short-circuits before the network call — so this fakes LOGGED_IN and
// mocks the endpoint to exercise the signed-in path that no other check reaches.
async function checkSubscribeConfirmsOnPopup(browser) {
  const violations = [];
  const context = await newContext(browser);
  const { page } = await openPage(context, 'https://www.youtube.com/watch?v=aircAruvnKk');
  const subRe = (u) => /\/youtubei\/v1\/subscription\/subscribe/.test(u.toString());
  try {
    await waitForApp(page, { timeout: 30000 }).catch(() => {});
    await page.waitForSelector('.watch-subscribe', { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => { if (window.ytcfg && window.ytcfg.data_) window.ytcfg.data_.LOGGED_IN = true; });
    // A successful subscribe response that carries ONLY a notification popup and
    // no signInEndpoint — the exact shape that used to be misread as blocked.
    await page.route(subRe, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ responseContext: {}, actions: [{ openPopupAction: { popupType: 'TOAST', popup: { notificationActionRenderer: { responseText: { simpleText: 'Subscribed' } } } } }] }),
    }));
    await page.waitForFunction(() => {
      const b = document.querySelector('.watch-subscribe');
      return b && !b.disabled && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0;
    }, { timeout: 15000 }).catch(() => {});
    const btn = await page.$('.watch-subscribe');
    if (!btn) {
      violations.push({ check: 'subscribe-button-exists', detail: 'expected a usable .watch-subscribe on the watch page' });
      return violations;
    }
    const before = await page.evaluate((b) => b.getAttribute('aria-pressed'), btn);
    if (before === 'true') {
      console.log('  subscribe-confirms-on-popup: SKIP — button already reads subscribed, cannot exercise a fresh subscribe');
      return violations;
    }
    await btn.click();
    await page.waitForTimeout(1500);
    const after = await page.evaluate((b) => ({ pressed: b.getAttribute('aria-pressed'), text: b.textContent.trim() }), btn);
    if (after.pressed !== 'true') {
      violations.push({ check: 'subscribe-confirms-on-popup', detail: `after a successful subscribe whose response carried only a notification openPopupAction (no signInEndpoint), the button reverted (aria-pressed=${after.pressed}, "${after.text}") — a notification/confirmation popup must not be read as a failed or blocked mutation` });
    }
  } finally {
    await page.unroute(subRe).catch(() => {});
    await page.close();
    await context.close();
  }
  return violations;
}

// The enable/disable toggle near the logo: iTube must be a real, reversible,
// persistent escape hatch. When toggled off, iTube must NOT mount and YouTube's
// own ytd-app must be left visible (unparked); a re-enable control must appear
// near the logo; and clicking it must bring iTube back and clear the flag.
async function checkItubeToggle(browser) {
  const violations = [];
  const context = await newContext(browser);
  const { page } = await openPage(context, 'https://www.youtube.com/');
  try {
    await waitForApp(page, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    if (!(await page.evaluate(() => !!document.querySelector('#itube .itube-power')))) {
      violations.push({ check: 'itube-toggle-present', detail: 'expected an .itube-power toggle in the iTube header' });
    }
    await page.evaluate(() => localStorage.setItem('itube-off', '1'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const off = await page.evaluate(() => {
      const app = document.querySelector('ytd-app');
      return {
        reenable: !!document.getElementById('itube-reenable'),
        itubeGone: !document.getElementById('itube'),
        ytdVisible: !!(app && getComputedStyle(app).opacity !== '0' && app.getBoundingClientRect().width > 100),
      };
    });
    if (!off.itubeGone) violations.push({ check: 'itube-toggle-disables', detail: 'after toggling off, #itube still rendered — the app must not mount when itube-off is set' });
    if (!off.reenable) violations.push({ check: 'itube-toggle-reenable-shown', detail: 'after toggling off, no #itube-reenable control was shown near the logo' });
    if (!off.ytdVisible) violations.push({ check: 'itube-toggle-shows-youtube', detail: "after toggling off, YouTube's own ytd-app is not visible — iTube must stop parking it and leave native YouTube alone" });
    await page.evaluate(() => { const b = document.getElementById('itube-reenable'); if (b) b.click(); });
    await page.waitForTimeout(4000);
    const back = await page.evaluate(() => ({ itubeBack: !!document.getElementById('itube'), flag: localStorage.getItem('itube-off') }));
    if (!back.itubeBack) violations.push({ check: 'itube-toggle-reenables', detail: 'clicking re-enable did not bring iTube back' });
    if (back.flag === '1') violations.push({ check: 'itube-toggle-persist', detail: 'the itube-off flag was not cleared on re-enable' });
  } finally {
    await page.close();
    await context.close();
  }
  return violations;
}

// The related-video card thumbnail should fly into the video stage on click,
// giving visual continuity across the hard swap between the previous video
// and the new one. Guards two regressions: the fly-in clone failing to
// appear on click at all, and — the easier one to miss — the clone still
// appearing when the user has prefers-reduced-motion: reduce set, which must
// suppress the animation entirely rather than just shortening it.
async function checkThumbFlyAnimation(page) {
  const violations = [];
  const watchUrl = 'https://www.youtube.com/watch?v=aircAruvnKk';

  await page.emulateMedia({ reducedMotion: null });
  let link = await page.$('.rc-link');
  if (!link) {
    console.log('  thumb-fly-animation: SKIP — no .rc-link found on this watch page, nothing to click');
    return { violations };
  }
  const appeared = await page.evaluate(() => {
    const el = document.querySelector('.rc-link');
    el.click();
    return !!document.querySelector('.itube-fly');
  });
  if (!appeared) {
    violations.push({ check: 'thumb-fly-appears', detail: 'clicking a .rc-link related-video card did not spawn an .itube-fly clone synchronously on click — the thumbnail fly-in animation is missing' });
  }

  await page.goto(watchUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await waitForApp(page, { timeout: 30000 }).catch(() => {});

  await page.emulateMedia({ reducedMotion: 'reduce' });
  link = await page.$('.rc-link');
  if (link) {
    const spawned = await page.evaluate(() => {
      const el = document.querySelector('.rc-link');
      el.click();
      return !!document.querySelector('.itube-fly');
    });
    if (spawned) {
      violations.push({ check: 'thumb-fly-reduced-motion', detail: 'clicking a .rc-link related-video card spawned an .itube-fly clone even with prefers-reduced-motion: reduce set — the animation must be suppressed entirely' });
    }
  } else {
    console.log('  thumb-fly-animation: SKIP (reduced-motion pass) — no .rc-link found after reset, nothing to click');
  }

  await page.emulateMedia({ reducedMotion: null });
  return { violations };
}

// Theater mode: a bar button (and the `t` shortcut) must toggle an immersive
// cinema layout — a `.theater` class on the #itube root and a visible
// `.itube-ambient` light-spill canvas — persist the choice in localStorage, and
// tear back down cleanly. This guards the whole feature: the button going dead,
// the ambient canvas never showing (or never hiding again, which would leave a
// blurred overlay stuck on the page), the preference not persisting, and the
// keyboard shortcut regressing. The ambient render loop's zero-idle-cost and
// reduced-motion gating are covered by review of the throttled setTimeout loop;
// here we assert the user-visible state machine.
async function checkTheaterMode(browser) {
  const violations = [];
  const context = await newContext(browser);
  const { page } = await openPage(context, 'https://www.youtube.com/watch?v=aircAruvnKk');
  try {
    await waitForApp(page, { timeout: 30000 }).catch(() => {});
    // Start from a known-off state so a leaked preference from another run
    // can't make this test pass or fail spuriously.
    await page.evaluate(() => { try { localStorage.removeItem('itube-theater'); } catch (e) {} });
    // The button only exists once the player and its control bar are built.
    await page.waitForSelector('#itube-theater', { timeout: 30000 }).catch(() => {});
    if (!(await page.evaluate(() => !!document.getElementById('itube-theater')))) {
      violations.push({ check: 'theater-button-present', detail: 'expected an #itube-theater toggle in the player bar' });
      return violations;
    }
    const read = () => page.evaluate(() => {
      const root = document.getElementById('itube');
      const amb = document.querySelector('.itube-ambient');
      return {
        cls: !!(root && root.classList.contains('theater')),
        disp: amb ? getComputedStyle(amb).display : null,
        pref: (() => { try { return localStorage.getItem('itube-theater'); } catch (e) { return null; } })(),
      };
    });
    await page.evaluate(() => document.getElementById('itube-theater').click());
    const on = await read();
    if (!on.cls) violations.push({ check: 'theater-enters', detail: 'clicking the theater button did not add .theater to #itube' });
    if (on.disp !== 'block') violations.push({ check: 'theater-ambient-shows', detail: `expected .itube-ambient display:block in theater, got ${on.disp}` });
    if (on.pref !== '1') violations.push({ check: 'theater-persists-on', detail: `expected localStorage itube-theater=1 after enabling, got ${on.pref}` });

    await page.evaluate(() => document.getElementById('itube-theater').click());
    const off = await read();
    if (off.cls) violations.push({ check: 'theater-exits', detail: 'clicking the theater button again did not remove .theater' });
    if (off.disp !== 'none') violations.push({ check: 'theater-ambient-hides', detail: `expected .itube-ambient display:none when off, got ${off.disp}` });
    if (off.pref !== '0') violations.push({ check: 'theater-persists-off', detail: `expected localStorage itube-theater=0 after disabling, got ${off.pref}` });

    // The `t` shortcut is YouTube's own theater key — it must toggle too.
    await page.evaluate(() => document.body.click());
    await page.keyboard.press('t');
    await page.waitForTimeout(120);
    if (!(await page.evaluate(() => document.getElementById('itube').classList.contains('theater')))) {
      violations.push({ check: 'theater-key-toggle', detail: "pressing 't' did not toggle theater mode on" });
    }
    await page.keyboard.press('t');
  } finally {
    await page.close();
    await context.close();
  }
  return violations;
}

// A-B repeat loop: setting two marks on the seek bar must show a highlighted
// region + both markers, flip the #itube-ab button to its active state, and
// then actually enforce the loop by snapping playback back to A once it
// crosses B. Clicking the button (rather than the `[`/`]` keys) at fixed
// currentTimes keeps this deterministic instead of racing real playback.
async function checkAbLoop(browser) {
  const violations = [];
  const context = await newContext(browser);
  const { page } = await openPage(context, 'https://www.youtube.com/watch?v=aircAruvnKk');
  try {
    await waitForApp(page, { timeout: 30000 }).catch(() => {});
    await page.waitForSelector('#itube-ab', { timeout: 30000 }).catch(() => {});
    await page.waitForFunction(() => {
      const v = document.querySelector('#itube-stage video');
      return !!v && isFinite(v.duration) && v.duration > 10;
    }, { timeout: 30000 }).catch(() => {});
    if (!(await page.evaluate(() => !!document.getElementById('itube-ab')))) {
      violations.push({ check: 'ab-loop-button-present', detail: 'expected an #itube-ab toggle in the player bar' });
      return violations;
    }
    await page.evaluate(() => {
      const v = document.querySelector('#itube-stage video');
      v.muted = true;
      v.play();
    });
    await page.evaluate(() => { document.querySelector('#itube-stage video').currentTime = 3; });
    await page.evaluate(() => document.getElementById('itube-ab').click());
    await page.evaluate(() => { document.querySelector('#itube-stage video').currentTime = 8; });
    await page.evaluate(() => document.getElementById('itube-ab').click());
    const marked = await page.evaluate(() => ({
      region: !!document.querySelector('.itube-ab-region'),
      active: document.getElementById('itube-ab').classList.contains('active'),
    }));
    if (!marked.region) violations.push({ check: 'ab-loop-markers', detail: 'expected a .itube-ab-region after setting A and B' });
    if (!marked.active) violations.push({ check: 'ab-loop-markers', detail: 'expected #itube-ab to gain .active after setting A and B' });

    await page.evaluate(() => { document.querySelector('#itube-stage video').currentTime = 8.6; });
    await page.waitForTimeout(500);
    const loopedTime = await page.evaluate(() => document.querySelector('#itube-stage video').currentTime);
    if (!(loopedTime < 8)) {
      violations.push({ check: 'ab-loop-enforces', detail: `expected playback past B to snap back toward A (~3s), got currentTime=${loopedTime}` });
    }
    await page.evaluate(() => document.getElementById('itube-ab').click());
  } finally {
    await page.close();
    await context.close();
  }
  return violations;
}

// Account management: the sidebar avatar is a menu button that opens a dropdown
// with a native "Your channel" plus redirects to YouTube's own UI (Studio,
// Settings, Switch account, Sign out). This guards the menu going missing, the
// redirect targets drifting (e.g. Sign out no longer pointing at YouTube's
// logout, or Studio/Settings losing target=_blank so they hijack the SPA), and
// the open/close toggle regressing. Runs logged-out: the avatar is hidden but
// the menu DOM and its wiring still exist and are clickable, so the structure
// and toggle are fully assertable without an account.
async function checkAccountMenu(browser) {
  const violations = [];
  const context = await newContext(browser);
  const { page } = await openPage(context, 'https://www.youtube.com/');
  try {
    await waitForApp(page, { timeout: 30000 }).catch(() => {});
    await page.waitForSelector('#itube .hd-avatar', { state: 'attached', timeout: 30000 }).catch(() => {});
    const shape = await page.evaluate(() => {
      const av = document.querySelector('.hd-avatar');
      const items = [...document.querySelectorAll('.acct-menu .acct-item')].map((a) => ({
        text: a.textContent.trim(), href: a.getAttribute('href'), blank: a.target === '_blank',
      }));
      return {
        isButton: !!av && av.tagName === 'BUTTON' && av.getAttribute('aria-haspopup') === 'menu',
        items,
      };
    });
    if (!shape.isButton) {
      violations.push({ check: 'account-avatar-button', detail: 'expected the .hd-avatar to be a <button aria-haspopup="menu"> opening the account menu' });
    }
    const byText = (t) => shape.items.find((i) => i.text === t);
    const expect = [
      ['Your channel', (i) => i && !i.blank, 'a native (same-tab, SPA) Your channel link'],
      ['YouTube Studio', (i) => i && i.blank && /studio\.youtube\.com/.test(i.href || ''), 'Studio opening studio.youtube.com in a new tab'],
      ['Settings', (i) => i && i.blank && /youtube\.com\/account/.test(i.href || ''), 'Settings opening youtube.com/account in a new tab'],
      ['Switch account', (i) => i && i.blank && /accounts\.google\.com/.test(i.href || ''), 'Switch account opening the Google account chooser'],
      ['Sign out', (i) => i && /youtube\.com\/logout/.test(i.href || ''), 'Sign out pointing at YouTube logout'],
    ];
    for (const [label, ok, desc] of expect) {
      if (!ok(byText(label))) {
        violations.push({ check: 'account-menu-item', detail: `expected ${desc} (item "${label}" missing or wrong)` });
      }
    }
    // The avatar toggles the menu even while hidden (logged out): click opens it,
    // Escape closes it.
    const toggled = await page.evaluate(() => {
      const av = document.querySelector('.hd-avatar');
      const menu = document.querySelector('.acct-menu');
      av.click();
      const opened = menu.classList.contains('open');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const closed = !menu.classList.contains('open');
      return { opened, closed };
    });
    if (!toggled.opened) violations.push({ check: 'account-menu-opens', detail: 'clicking the avatar did not open the account menu (.open)' });
    if (!toggled.closed) violations.push({ check: 'account-menu-escape', detail: 'pressing Escape did not close the account menu' });
  } finally {
    await page.close();
    await context.close();
  }
  return violations;
}

// Playback speed must be able to exceed YouTube's 2x cap and the chosen speed
// must be remembered as a global default applied to the next video. The real
// signal is the underlying <video>.playbackRate (the YT player clamps its own
// setPlaybackRate to <=2, so iTube drives the element directly and re-asserts
// it): this guards both the >2x capability regressing to a clamp and the
// remembered default not surviving a reload.
async function checkPlaybackSpeed(browser) {
  const violations = [];
  const context = await newContext(browser);
  const { page } = await openPage(context, 'https://www.youtube.com/watch?v=aircAruvnKk');
  try {
    await waitForApp(page, { timeout: 30000 }).catch(() => {});
    await page.waitForSelector('#itube-stage video', { timeout: 30000 }).catch(() => {});
    await page.waitForSelector('#itube-speed', { timeout: 15000 }).catch(() => {});
    const set = await page.evaluate(async () => {
      const v = document.querySelector('#itube-stage video');
      if (v) { v.muted = true; try { await v.play(); } catch (e) {} }
      const sel = document.getElementById('itube-speed');
      sel.value = '3';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 1600));
      return {
        playback: v ? v.playbackRate : null,
        stored: (() => { try { return localStorage.getItem('itube-speed'); } catch (e) { return null; } })(),
      };
    });
    if (Math.abs((set.playback || 0) - 3) > 0.01) {
      violations.push({ check: 'speed-beyond-2x', detail: `expected video.playbackRate 3 (past YouTube's 2x cap), got ${set.playback}` });
    }
    if (set.stored !== '3') {
      violations.push({ check: 'speed-persists', detail: `expected localStorage itube-speed=3, got ${set.stored}` });
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForApp(page, { timeout: 30000 }).catch(() => {});
    await page.waitForSelector('#itube-stage video', { timeout: 30000 }).catch(() => {});
    const after = await page.evaluate(async () => {
      const v = document.querySelector('#itube-stage video');
      if (v) { v.muted = true; try { await v.play(); } catch (e) {} }
      await new Promise((r) => setTimeout(r, 1600));
      return v ? v.playbackRate : null;
    });
    if (Math.abs((after || 0) - 3) > 0.01) {
      violations.push({ check: 'speed-default-applied', detail: `after reload the remembered 3x default was not applied, got ${after}` });
    }
  } finally {
    await page.evaluate(() => { try { localStorage.removeItem('itube-speed'); } catch (e) {} }).catch(() => {});
    await page.close();
    await context.close();
  }
  return violations;
}

module.exports = {
  runWatchFunctional,
  checkThumbFlyAnimation,
  checkAbLoop,
  checkTheaterMode,
  checkPlaybackSpeed,
  checkAccountMenu,
  checkItubeToggle,
  checkSubscribeConfirmsOnPopup,
  checkWatchMetaReveals,
  checkDislikeEstimate,
  checkSponsorBlock,
  checkColdLoadSkeleton,
  checkBootLoaderColdLoad,
  checkBootLoaderFeedColdLoad,
  checkBootLoaderReducedMotion,
  checkBootLoaderNoSpaReappear,
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
  checkAudioTrackSelector,
};
