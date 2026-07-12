# iTube — plan and quality control

Goal: make YouTube dramatically faster in Safari by simplifying the DOM and
Chrome-optimized rendering, replace Google's UI with Apple-style Liquid Glass,
and lose zero functionality. Ship first as a userscript, later as a Safari
extension for the App Store.

## Milestones

### M1 — Solid baseline (done)
- [x] Kill animations/transitions/shadows/backdrop-filter globally
- [x] content-visibility on feeds, comments, related
- [x] Deep DOM pruning: hidden panels, legacy iconsets, player overlays, promo shelves
- [x] Bounded DOM: related/comments caps with working continuations
- [x] Custom glass player bar: play, seek+buffer, time, volume (loudness-ratio synced),
      speed, quality (persisted), CC, PiP, fullscreen — CSP/Trusted-Types safe
- [x] Glass skin v1: masthead, search, chips, buttons, rounded surfaces
- [x] Forced dark theme (glass skin is dark-first)

### M2 — Zero functionality loss (tricky part)
- [x] Keyboard parity check: k m c t digits verified working with chrome hidden
      (real key presses; YT hotkey handlers live on document, unaffected by hiding
      the chrome). j/l/arrows/f use the same handler path.
- [x] Playlist next/prev buttons in glass bar (player.nextVideo()/previousVideo();
      prev hidden outside playlists; verified advancing a Mix, index 2 → 3)
- [x] Caption language picker: CC select in glass bar via toggleSubtitles +
      setOption('captions','track'). API-verified (tracklist, track set to de-DE
      rendered German segments, off works). Visual re-check DONE on healthy
      session: English track rendered live segments via the shipped code path.
      NOTE: never cycle loadModule/unloadModule('captions') — it reproducibly
      stalls the player at readyState 0.
- [x] Player-bar autohide matching YouTube: show on mousemove, hide after 2.8s
      idle while playing, hide on mouseleave, pinned while paused. Hidden state
      is visibility:hidden (zero paint/backdrop cost in Safari).
      NOTE: #movie_player shadows DOM addEventListener with the player API —
      always bind via EventTarget.prototype.addEventListener.call(player, ...).
      Bar render cost vs stock YT chrome: 33 nodes vs 161; show/hide is one
      opacity/visibility flip vs YT's class-churn over the whole chrome subtree.
- [x] Autoplay toggle: "Auto" button proxies YT's hidden .ytp-autonav-toggle-button
      (keeps YT persistence/server sync; dimmed when off). Verified round-trip.
- [x] Chapters: tick marks on the seek bar, parsed from the chapters engagement
      panel data (ytInitialData on load, yt-navigate-finish detail on SPA nav).
      Verified: 35-chapter video → 34 ticks (0:00 skipped), monotonic positions.
      SPA-nav refresh implemented via yt-navigate-finish; spot-check in Safari.
- [x] Seek-preview thumbnails (storyboard): hover the seek bar → glass-framed
      preview with timestamp, parsed from getPlayerResponse().storyboards spec.
      Lazy: nothing fetched until first hover; sprite changes swap one
      background-image; position updates are background-position only. Verified:
      spec parse (160x90, 5x5 grid, 1603 thumbs), sprite URL loads (800x450),
      distinct sprites across positions. Disabled on live streams.
- [x] Live streams: LIVE badge (red at live head, dimmed when behind; click =
      seekToLiveHead), duration hidden, DVR scrubbing kept. Live detection via
      getVideoData().isLive. Note: live duration is FINITE (growing DVR window),
      so isFinite checks do NOT detect liveness; raw DVR seeks snap to segment
      boundaries (same as stock).
- [x] Premieres: defensively guarded (bar builds only when video+player exist,
      all player APIs optional-chained, fmt handles NaN/Infinity). No live
      premiere was available to test against — spot-check when one is encountered.
- [x] Stats-for-nerds: verified — right-click context menu (8 items) opens with
      chrome hidden, stats panel renders live data, close button works.
- [ ] Restore access to features hidden with the chrome: report/loop/context-menu items
- [ ] Ads/Premium edge cases: bar must not fight ad playback state
- [x] Shorts: redirect /shorts/<id> → /watch?v=<id> (REDIRECT_SHORTS toggle).
      Chosen over restyling because the watch page GAINS functionality (Shorts
      player lacks scrubber/speed/quality). Bare /shorts feed and channel
      /shorts tabs untouched; runs at document-start and in the sweeper for SPA
      navs. Regex verified against 6 URL shapes; live redirect spot-check in
      Safari (no short reachable in this session's feeds).

### M3 — Liquid Glass everywhere
- [x] Watch page metadata, comments, sidebar as glass cards (description card,
      per-thread comment cards, sidebar hover pills; translucent fills + hairline
      borders + inset highlight, no blur on large surfaces)
- [ ] Home grid polish, hover states without animations
- [ ] Search results, channel pages, subscriptions, history, playlists
- [ ] Dialogs/menus (ytd-popup-container) glass restyle
- [ ] Light theme variant (currently dark-only)

### M4 — Performance proof
- [ ] Baseline vs iTube numbers: DOM nodes, LCP, long tasks, memory (Chrome tracing
      as proxy + manual Safari spot checks)
- [ ] Idle CPU on watch page ≤ stock YouTube
- [ ] No layout thrash from the sweeper (verify with Performance panel)

### M5 — iTube branding + extension
- [ ] Rename userscript to itube.user.js, meta/name/version reset
- [ ] README with install instructions (Userscripts.app / Tampermonkey Safari)
- [ ] Safari Web Extension scaffold (content script = the userscript core)
- [ ] App Store packaging notes (Xcode project, signing, review guidelines re:
      third-party site modification)

## Per-iteration quality control

Every loop iteration must pass ALL gates before commit:

1. `node --check` passes.
2. Fresh-page injection test in Chrome on BOTH a watch page and the home page.
3. Feature checklist (watch page): video plays, seek lands, volume drag sticks,
   mute round-trips, quality switch takes effect, speed switch audible,
   SPA navigation to another video keeps the bar working, comments load (capped),
   related capped, description "...more" expands.
4. Screenshot review: no white-on-white / broken layout, bar legible over bright
   and dark video frames.
5. DOM budget: watch page ≤ 6,000 nodes after settle.
6. No console errors originating from the script (pattern: ytl|yt-lite).
7. Known-freeze regressions absent: no synchronous observer re-assertion, no
   per-event player API writes, no defineProperty traps on media elements.
8. Commit with a plain message, no AI attribution, push.

## Hard-won constraints (do not relearn these)

- YouTube enforces Trusted Types: no innerHTML anywhere.
- YT strips the controls attribute; never fight it synchronously (tab freeze).
- YT fades volume on mute/unmute; volume sync must be debounced ≥300ms.
- Loudness normalization: element volume = ratio × player volume; write back
  through the measured ratio or sliders drift.
- Comments arrive through ytd-continuation-item-renderer: remove it only after
  the cap is reached, never before first load.
- ytd-lottie-player IS the like-button icon; never remove it.
- engagement-panel-structured-description powers "...more"; keep it.
- Safari gets the same desktop Polymer app as Chrome (verified: same build hash,
  same shells) — Chrome-verified selectors are valid, but Safari-only behaviors
  (webkitPresentationMode, native fullscreen) need manual spot checks.
