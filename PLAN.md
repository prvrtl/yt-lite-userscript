# iTube — plan and quality control

**This file is a historical milestone log, not an active spec.** Everything
below M5 documents the **v2.9 skin** (restyled/pruned YouTube's own `ytd-*`
DOM), an approach abandoned at v3.0. iTube is now an **app** (`itube.user.js`,
currently v4.50) that renders its own UI from YouTube's data and never reuses a
`ytd-*` component — no sweeper, no per-card pruning, no `content-visibility`
over YouTube's nodes, no feature flags. None of that code exists any more. For
what the app actually does today — invariants, data shapes, current stages —
read `ARCHITECTURE.md`; for the recovery runbook read `RECOVERY.md`; for the
current per-commit quality gates read `CLAUDE.md`.

Original goal (still true): make YouTube dramatically faster in Safari,
replace Google's UI with an Apple-style Liquid Glass one, and lose zero
functionality. Shipped first as a userscript; the Safari-extension packaging
below (M5) was never completed and is not in progress.

## Milestones (M1–M4.5: the legacy v2 skin — see note above)

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
- [x] Home grid polish: hover pills on grid cards (background flip only, no
      transforms/animations), rounded cards, glass chips
- [x] Search results, channel pages, subscriptions, history, playlists:
      ytd-video-renderer / ytd-playlist-video-renderer / ytd-channel-renderer get
      rounded cards + hover pills + content-visibility (long search lists now
      skip offscreen layout). Channel pages reuse the rich-grid rules.
      Spot-check in Safari: caption-snippet rows under search results rendered
      light when dark was forced post-render (document-start forcing should fix).
- [x] Dialogs/menus glass restyle: menu popups, dialogs, sheets get dark glass
      (blur OK — small surfaces), rounded dropdown clipping, item hover pills,
      inner spec-layer backgrounds forced transparent. Computed styles verified;
      full visual pass PENDING re-check (session was image-throttled during QC) —
      re-verify in Safari.
- [x] macOS-native fidelity pass: site-wide -apple-system typography (caption
      segments and their descendants excluded to respect user caption fonts),
      macOS focus rings (:focus-visible, #0a84ff dark / #007aff light),
      ::selection accent, guide sidebar [active] selection pills, instant
      :active pressed states (bar buttons, tonal buttons), tabular-nums
      duration badges, content-visibility on guide sections. Verified live:
      fonts resolve to -apple-system on watch+home, active pill renders
      rgba(255,255,255,.12), DOM 4303/3350 nodes, console clean. Deliberate
      skips: custom scrollbars (would disable Safari's native auto-hiding
      overlay scrollbars), radius rework (existing scale already coherent).
- [x] Shape/consistency pass: search field + magnifier button are now ONE pill
      (input = left half, button = right half, shared border, seam removed);
      playlist panel (#playlist) is a glass card with content-visibility on its
      rows. Fixed a latent breakage: YouTube renamed button classes from kebab
      (.yt-spec-button-shape-next--tonal) to camelCase (.ytSpecButtonShapeNextTonal),
      so all tonal-button styling had been silently dead — both forms are now
      selected. Filled buttons (Subscribe) rendered white-on-white under forced
      dark because YT's text-primary-inverse var breaks; now explicitly
      #f1f1f1 bg / #0f0f0f text (inverted in light theme).
      NOTE: verify class names against the live DOM after YT ships a redesign —
      silent CSS misses are invisible until screenshotted.
- [x] Light theme variant: html:not([dark])-scoped overrides recolor all glass
      surfaces (masthead, chips, cards, popups) with dark-on-light values; wins
      by specificity when FORCE_DARK is off. Player bar stays dark glass over
      video by design. Verified visually on home in light mode.

### M3.5 — Compact + symmetrical pass (done)
- [x] Player bar: 3 zones (#ytl-left / #ytl-center / #ytl-right) with the four
      rarely-used controls (speed, quality, captions, autoplay) moved into an
      overflow popover (#ytl-menu, "⋯"). Left/right zones use `flex: 0 0 190px`
      — an EQUAL FIXED BASIS, not min-width: a floor lets the heavier right zone
      grow (measured 150 vs 184px) and pushes the seek bar off-centre.
      Verified: both zones 190px, #ytl-center centre-x == #ytl-bar centre-x
      (545.5 == 545.5). Selects are REPARENTED, never recreated, so every
      existing handler/populate path keeps working (speed 1.5x round-trip
      verified through the menu).
      NOTE: the popover must sit FLUSH on the bar (`bottom: 100%`). An 8px gap
      leaves a band where the top element is #movie_player, not a bar
      descendant, so bar.mouseleave fires and closes the menu before the cursor
      reaches it. mouseleave also guards on `menu.contains(e.relatedTarget)`,
      and the menu is force-closed on SPA nav (else the autohide guard keeps
      the bar stuck visible).
- [x] Masthead compacted via `--ytd-masthead-height: 52px` (set the var YT owns
      rather than overriding heights, so sticky offsets stay consistent).
- [x] One radius scale: 12 thumbnails / 16 cards+popups / 18 player / 22 bar.
- [x] Compact rows: related list, playlist panel, menu items.
- [x] Replies capped (MAX_REPLIES=10) — threads were bounded but replies were
      not, so expanding a big thread grew the DOM without limit. Reuses capList,
      which only strips the continuation once the cap is reached (never before
      first load — that bug already bit us once with comments).

### M3.6 — Home grid density (done)
- [x] Home feed regridded: YouTube caps cards at --ytd-rich-grid-item-max-width
      700px, which on a wide window yields 2-3 giant cards and a dead right
      margin. Override the grid vars (max-width 100%, min-width GRID_MIN_WIDTH,
      12px margins) and replace the flex #contents with
      `display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))`.
      Density is tunable via the GRID_MIN_WIDTH const.
      Verified at 1590px viewport: 3 cards (418px wide, 418x235 thumbs) → 5
      cards (253px wide, 237x133 thumbs), rows uniform at 266px, no horizontal
      overflow, 2,215 nodes. contain-intrinsic-size lowered 320px → 250px to
      match the new card height.

### M3.7 — iTube design system (done)
- [x] Site recoloured from the landing page's palette by overriding YouTube's OWN
      theme tokens rather than chasing individual rules. The token namespace is
      `--yt-sys-color-baseline--*` (the old `--yt-spec-*` names are GONE from
      current builds — re-probe the live DOM before assuming any token name).
      Mapped: base-background #0b0c10, raised #16181f, text-primary #f2f3f5,
      text-secondary #969aa6, call-to-action #0a84ff, outline/tonal-rim
      rgba(255,255,255,.11). Light theme mirrors it (#f6f7f9 / #14161c / #007aff).
- [x] Accent is now Apple blue, not YouTube white/red: filled buttons (Subscribe)
      and the selected chip are #0a84ff with white text. Verified Subscribe
      computes rgb(10,132,255) on white text.
- [x] Feed/related/search rows are true glass cards (surface fill + hairline +
      inset highlight), matching the landing page's card treatment.
- [x] Ambient accent glow behind the app (single static radial gradient — no
      repaint cost) and tightened title typography (600 weight, -.012em).

### M3.8 — Shorts removed, sidebar redesigned (done)
- [x] Shorts gone everywhere (REMOVE_SHORTS): sidebar + mini-sidebar entries,
      channel Shorts tab, reel shelves, shorts lockups. Redirect of /shorts/<id>
      → /watch?v=<id> stays, so a shared Shorts link still plays (with a real
      scrubber) instead of 404ing.
      NOTE: the Shorts guide entry has NO href — it is JS-navigated — so the only
      stable hook is `a[title="Shorts"]` ("Shorts" is not localized). Hidden via
      `:has()` in CSS and REMOVED via pruneShorts() in the sweeper.
      `:has()` must NOT go in the KILL selector string: one unsupported selector
      makes the whole querySelectorAll throw and takes the entire sweep down.
      Hence the separate guarded pruneShorts().
- [x] Sidebar redesign (CLEAN_SIDEBAR): transparent ground, hairline section
      separators, uppercase eyebrow section titles, 38px rows on 10px pills,
      accent-tinted active row (blue fill + blue icon/label), and the legal-links
      footer removed. Light theme mirrors it.

### M3.9 — Native app pass (done)
- [x] YouTube's icons replaced with our own SF-style stroke set (NATIVE_ICONS):
      swapIcons() rewrites the children of icon hosts in the guide + masthead,
      mapped by exact lowercase label. TWO host types exist — `yt-icon` (guide,
      hamburger) and `.ytIconWrapperHost` (Create, Notifications, voice search).
      Missing the second one silently leaves YouTube icons in the masthead.
      Verified live: 27 guide icons + Guide/Create/Notifications all swapped.
- [x] YouTube logo → "iTube" wordmark (brandLogo()); the anchor keeps its href so
      click-to-home still works.
- [x] Home genre chip bar removed (HIDE_CHIP_BAR). Scope it to
      ytd-feed-filter-chip-bar-renderer ONLY — hiding yt-chip-cloud-renderer also
      kills the SEARCH filter chips, which are useful.
- [x] Sidebar cut to Home / Subscriptions / You (MINIMAL_SIDEBAR):
      `ytd-guide-section-renderer:nth-of-type(n+4)` drops Explore, More from
      YouTube, Report history. Positional — recheck if YT reorders sections.
- [x] Watched-progress bars recoloured off YouTube red to the accent.
      Kept red: the LIVE badge (red is semantic for live, as it is on Apple's
      platforms).
- [x] FIXED A LATENT BUG affecting EVERYTHING sweep-driven: sweep was scheduled
      with a bare requestIdleCallback, which YouTube's busy main thread can starve
      for 20-30s on first load (measured). Pruning, caps, icons and logo all waited
      on it. Now `requestIdleCallback(cb, { timeout: 1200 })` bounds it.
      NOTE: the icon-swap must stamp data-ytl only AFTER the label resolves —
      stamping on attempt permanently blacklists icons whose aria-label Polymer
      hasn't bound yet (non-deterministic, load-order dependent).

### M4 — Performance proof
- [x] Baseline vs iTube measured A/B, script injected at document-start, written
      up in PERF.md with method and honest gaps. Repro script is committed:
      `tests/bench.js`. Watch page (v4.1.3, median of 3): 22,107 → 6,865 nodes
      (−69%), frame p95 20.6 → 8.0 ms, janky frames 9 → 0, long-task time
      2,382 → 982 ms.
      NOTE: the old v2 numbers in this slot (3,647 → 2,364 nodes etc.) are
      superseded and were measured against a different program — the skin that
      pruned YouTube's DOM in place. v4 prunes nothing; the nodes never get
      built. Do not mix the two.
      KEY FINDING, do not re-litigate: our CSS does NOT speed up style recalc —
      it costs ~+0.1ms per full pass (within noise). The speed comes from work
      that never happens, NOT from cheaper selector matching.
      Never trust a single run here: a "4.1ms p95" appeared once and vanished
      under 5x repetition. It was GC noise.
- [x] Frame rate during scroll — MEASURED. `tests/bench.js` runs headed Chromium
      with a FOCUSED window, so requestAnimationFrame is not throttled, and
      records real frame intervals over a 150-frame scripted scroll. p95 and
      janky-frame counts are tight and repeatable across runs (no overlap).
      Still Chromium, not Safari — see the caveats in PERF.md.
- [x] Cold-load timing — DECIDED NOT TO REPORT. The script IS injected at
      document-start now (addInitScript), so load-time effects are visible, but
      first contentful paint is network-dominated and its per-run ranges overlap
      completely between stock and iTube. Claiming an FCP win was noise twice
      before; it stays retracted. Long tasks ARE reported (they are stable).

### M4.5 — Visual weight reduction (done)
- [x] Feed/search/related cards flattened: no fill, no border, no inset sheen.
      The thumbnail is the only shape; hover is the only affordance. Comments
      became a divided list. Ambient glow removed. Verified via computed style
      (card bg transparent, border 0, shadow none, thumb radius 12).
      Visual sign-off still PENDING on a healthy session — Chrome was
      rate-limited (0 thumbnails loading) during the check.

### M5 — iTube branding + extension
- [x] Rename userscript to itube.user.js, meta/name/version reset. `@updateURL`
      and `@downloadURL` point at itube.user.js; currently v4.1.3.
      `youtube-lite.user.js` (v2.9, the legacy skin) is deliberately LEFT IN
      PLACE so existing installs keep auto-updating from their own `@updateURL`.
      Do not delete it; do not point install instructions at it (this shipped
      broken once — the website and README installed the legacy skin).
- [x] README with install instructions (Userscripts.app / Tampermonkey Safari),
      and the landing page at `docs/index.html`. Both install itube.user.js.
- [ ] Safari Web Extension scaffold (content script = the userscript core)
- [ ] App Store packaging notes (Xcode project, signing, review guidelines re:
      third-party site modification)

### User requests folded in
- [x] Inline hover-preview PLAYER fully removed (new yt-thumbnail-view-model
      video variant included): sweeper deletes preview video elements on spawn,
      freeing media buffers. Animated-webp "gif" thumbnails stay allowed
      (user: "simple gif is enough"). Verified: 4s hover → 0 video elements.

## Per-iteration quality control

Every loop iteration must pass ALL gates before commit:

1. `node --check itube.user.js` passes.
2. `cd tests && npm test` — the Playwright suite, against live youtube.com,
   logged out, script injected at document-start. It covers home, search,
   channel, watch, playlist, the unhandled route and the /shorts redirect, with
   layout, geometry-snapshot, functional, hard-navigation, responsive and
   console-error checks per page. A red here is either a real regression or
   YouTube changing its payload — re-run before believing it.
3. `cd tests && npm run test:selftest` — injects a real shipped CSS bug and
   asserts the layout checks catch it. If this passes vacuously, the suite is
   not trustworthy.
4. Screenshot review (`tests/artifacts/*.png`, written by every run): no
   white-on-white / broken layout, bar legible over bright and dark frames.
5. `cd tests && node bench.js` if the change could plausibly affect performance.
   Watch page settles around ~6,900 total document nodes; a large jump means
   ytd-app started hydrating its lists again (see PERF.md).
6. No console errors originating from the script (pattern: itube).
7. Known-freeze regressions absent: no synchronous observer re-assertion, no
   per-event player API writes, no defineProperty traps on media elements.
8. Commit with a plain message, no AI attribution, push.

## Hard-won constraints from the v2 skin era

These describe manipulating **YouTube's own DOM** (`ytd-*` components) — the
thing v3.0 stopped doing. Kept only as history; the still-true ones are
carried forward (and kept current) in `ARCHITECTURE.md`'s "Non-negotiables"
section — that is the list to actually follow today, not this one.

- YouTube enforces Trusted Types: no innerHTML anywhere. **Still true**, still
  binding, still in ARCHITECTURE.md — this one was never skin-specific.
- YT strips the controls attribute; never fight it synchronously (tab freeze).
  **Dead**: v4 never touches YouTube's native `<video controls>` attribute at
  all — it has its own player bar and the native controls stay hidden/unused.
- YT fades volume on mute/unmute; volume sync must be debounced ≥300ms.
  **Still true**, still in ARCHITECTURE.md.
- Loudness normalization: element volume = ratio × player volume; write back
  through the measured ratio or sliders drift. **Still true**, still in
  ARCHITECTURE.md.
- Comments arrive through ytd-continuation-item-renderer: remove it only after
  the cap is reached, never before first load. **Dead**: v4 does not reuse
  YouTube's comment renderer at all; it extracts comment data itself
  (`extractComment`/`commentEntityMap` — see RECOVERY.md §2.3) and renders its
  own comment cards with its own cap (`MAX_COMMENTS`/`MAX_REPLIES`).
- ytd-lottie-player IS the like-button icon; never remove it. **Dead**: the
  like/dislike buttons are iTube's own elements with iTube's own icon set.
- engagement-panel-structured-description powers "...more"; keep it. **Dead**:
  the description card, its "…more" expansion, and its link chips are all
  iTube's own (`buildDescriptionSegments`, see RECOVERY.md §1).
- Safari gets the same desktop Polymer app as Chrome (verified: same build
  hash, same shells). **Still relevant**: `ytd-app` is still the parked,
  headless engine underneath v4, so this remains true, but it is no longer
  about selector parity — v4 has no `ytd-*` selectors to keep parity on.
  Safari-only player behaviors (webkitPresentationMode, native fullscreen)
  still need manual spot checks.
