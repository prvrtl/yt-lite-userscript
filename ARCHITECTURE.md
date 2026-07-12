# iTube — architecture

## The shift

Up to v2.9 iTube was a **skin**: it restyled YouTube's own DOM (`ytd-*`
components). That has a ceiling — the layout, the components and the player
chrome are still YouTube's, so it will always look like YouTube wearing a
costume.

From v3.0 iTube is an **app**. It renders its own UI from YouTube's *data*, not
its DOM. Zero `ytd-*` components are reused.

## Feasibility (verified, not assumed)

Measured live before any of this was written:

| Question | Answer |
|---|---|
| Is the page data available as JSON? | **Yes** — `ytInitialData`, `ytInitialPlayerResponse` |
| Can we call YouTube's own API ourselves? | **Yes** — InnerTube (`/youtubei/v1/*`) with the page's `INNERTUBE_API_KEY` + context returns 200 with real results |
| Can the `<video>` be moved into our own player? | **Yes** — re-parented into our container, `readyState` stayed 4, playback intact |

## The one thing we cannot do

**We cannot play YouTube video without YouTube's player object.** Streams are
signature-protected and delivered adaptively over MSE; there is no supported way
to fetch and decode them ourselves, and working around that would be both
fragile and a licensing problem.

So the YouTube player stays — as a **headless playback engine**:

- Its UI (`.ytp-*` chrome) is never rendered.
- Its `<video>` element is **moved into our own stage**.
- We drive it through the player API (`setVolume`, `seekTo`,
  `setPlaybackQualityRange`, `toggleSubtitles`, …) and the media element.

Every control the user sees is ours. Nothing is a reskin of `.ytp-*`.

## Layers

    ┌─────────────────────────────────────────────┐
    │  iTube UI          our components, our CSS  │  ← 100% ours
    ├─────────────────────────────────────────────┤
    │  iTube data        ytInitialData +          │
    │                    InnerTube fetches        │  ← ours
    ├─────────────────────────────────────────────┤
    │  YouTube engine    player object + <video>  │  ← borrowed, headless
    │                    (MSE, DRM, signatures)   │
    └─────────────────────────────────────────────┘

YouTube's `ytd-app` is parked offscreen (not `display: none` — the player must
keep laying out to decode) and its `<video>` is adopted by our stage.

## Stages

1. **Shell + home** — app root, design system, home feed rendered from data. *(v3.0)*
2. **Watch + player** — our stage, our controls, full API sync. *(v3.1)*
3. **Search + channel** — InnerTube-driven. *(v3.2)*
4. **Comments + related** — continuations, bounded. *(v3.3)*

Each stage ships only when it is measurably faster than the skin it replaces and
loses no function.

## Non-negotiables (carried over — every one of these has bitten us)

- No `innerHTML` anywhere. Trusted Types is enforced on youtube.com.
- No animation/transition except the deliberate thumbnail fade.
- `#movie_player` shadows `addEventListener` — bind via
  `EventTarget.prototype.addEventListener.call(player, …)`.
- Never cycle `loadModule`/`unloadModule('captions')` — stalls the player at
  readyState 0.
- Volume: element volume = ratio × player volume (loudness normalisation);
  debounce ≥300ms or the sliders drift.
- Never sweep the DOM while the user is scrolling.
