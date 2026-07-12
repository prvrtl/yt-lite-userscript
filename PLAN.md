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
- [ ] Audit every YT player feature against the glass bar: chapters on the seek bar,
      seek-preview thumbnails (storyboard), live streams (DVR seek, LIVE badge),
      premieres, playlists (next/prev buttons), autoplay toggle, caption track/language
      picker, stats-for-nerds entry point
- [ ] Keyboard parity check: k j l f c t m i arrows digits shift+, shift+.
- [ ] Restore access to features hidden with the chrome: report/loop/context-menu items
- [ ] Ads/Premium edge cases: bar must not fight ad playback state
- [ ] Shorts page: either restyle or redirect to normal watch UI

### M3 — Liquid Glass everywhere
- [ ] Watch page metadata, comments, sidebar as glass cards
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
