# yt-us (iTube)

A userscript that replaces YouTube's web UI with its own. It does **not** reskin
YouTube's DOM: it renders its own app from YouTube's *data* (`ytInitialData` +
authenticated InnerTube `/youtubei/v1/*` fetches), and borrows YouTube's player
object purely as a headless playback engine — the `<video>` is re-parented into
iTube's own stage. `ytd-app` is parked offscreen (never `display: none` — the
player must keep laying out to decode). Read `ARCHITECTURE.md` before changing
anything structural.

## Stack

Single vanilla JavaScript file, no framework, no build step, no runtime
dependencies.

Entry point / whole app: **`itube.user.js`** (IIFE, `@run-at document-start`,
matches `https://www.youtube.com/*`, excludes `/embed/*` and `/live_chat*`).

`youtube-lite.user.js` is the LEGACY v2.9 skin. It is kept only because existing
installs auto-update from its own `@updateURL` — do not delete it, do not
develop against it, and never point install instructions at it.

## Key files

- `itube.user.js` — the entire app: router, InnerTube client, data extractors,
  every view (home / watch / search / channel / feeds / playlist / unhandled),
  the glass player bar, and the CSS-in-JS design system.
- `tests/` — a Playwright suite that runs against **live youtube.com**, logged
  out, with the userscript injected at document-start exactly as a userscript
  manager would.
- `ARCHITECTURE.md` — why the app is shaped this way, plus the data shapes
  (`lockupViewModel`!) that have bitten us.
- `RECOVERY.md` — the coupling map + runbook for fixing iTube after YouTube
  changes a payload/player/DOM/endpoint: symptom → which test goes red → which
  extractor to re-point, plus the invariants and the untested blind spots.
  Start here when the suite goes red after a YouTube change.
- `PERF.md` — what is measured, and what is explicitly NOT claimed.
- `PLAN.md` — milestone tracker / QA log.

## Commands

There is no build system and no lint command. There IS a test suite:

```
cd tests && npm install     # once
cd tests && npm test        # every check, every page
cd tests && npm run test:selftest   # proves the layout checks can actually fail
cd tests && node bench.js   # the repro script behind PERF.md
```

Useful flags: `--page=watch`, `--check=layout|snapshot|functional|hardnav|responsive|errors`.

`npm run test:update` rewrites the geometry baselines in `tests/baselines/`. It
deliberately REFUSES to overwrite structural geometry (`.hd`, `.sidebar`,
`.content`, `#itube-stage`) unless you also pass `--force`, and prints what it
refused — rewriting every number on every run is how a real regression gets
laundered into the "expected" values.

The suite hits the live site, so a failure can be YouTube changing its payload
rather than a bug. Re-run before believing a red.

## Conventions

- **No `innerHTML`, ever.** youtube.com enforces Trusted Types. Build DOM with
  `createElement` / `textContent` / `replaceChildren`.
- `#movie_player` **shadows `addEventListener`** — bind player events via
  `EventTarget.prototype.addEventListener.call(player, …)` or they silently do
  nothing.
- **Never cycle `loadModule`/`unloadModule('captions')`** — it stalls the player
  at `readyState` 0.
- Volume: element volume = ratio × player volume (loudness normalisation);
  debounce ≥300ms or the sliders drift.
- No animation or transition except the deliberate thumbnail fade.
- Tunables are a handful of top-of-file `const`s (`MAX_COMMENTS`, `MAX_REPLIES`,
  …). There is no feature-flag system and no config file.
- Files under `tests/` carry explanatory comments — each check says which real
  bug it exists to catch. Match that style.
- **Gotcha:** never reference the bare identifier `CSS` anywhere in
  `itube.user.js` (e.g. `CSS.supports(...)`) — the file declares a top-level
  `const CSS` (the CSS-in-JS stylesheet template) later in the same IIFE
  scope, so an earlier reference hits its temporal dead zone and throws
  `ReferenceError: Cannot access 'CSS' before initialization` at runtime,
  breaking the entire app. `node --check` does not catch this. Use
  `window.CSS` instead.
