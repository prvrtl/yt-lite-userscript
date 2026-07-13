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

1. **Shell + home** — app root, design system, home feed rendered from data. *(v3.0 — done)*
2. **Watch + player** — our stage, our controls, full API sync. *(v3.1 — done: video adopted into our stage, readyState 4; seek, volume round-trip 42→42, mute, speed 1.5x, 9 quality levels, 30 caption tracks, no stall)*
3. **Search + channel** — InnerTube-driven. *(v3.2 — done: search 26 results, channel 90 videos, both our UI)*
4. **Comments + related** — continuations, bounded. *(v3.3 — done: 20 comments/page, cap 50, related rail)*
5. **Routing + feeds** — a client-side router over `history.pushState` +
   `popstate`, with per-route mount/cleanup: watch, home, search, channel, the
   `/feed/*` browse ids, `/playlist?list=…`, and an explicit "not available
   in iTube yet" card for anything unhandled. `/shorts/<id>` is rewritten to
   `/watch?v=<id>`. *(v4.0 — done)*
6. **Playback & discovery polish** — autoplay-next, the playlist queue rail,
   comment replies, comment sort, and search filters (sort / upload date /
   duration). *(v4.1 — done)*

Each stage ships only when it is measurably faster than the skin it replaces and
loses no function.

## Data shapes (learned the hard way)

YouTube is migrating renderers to **`lockupViewModel`**. In that shape the object
carrying `videoId` is only a watch endpoint — it has NO title and NO thumbnail,
so a walker keyed on `videoId` silently returns zero items. The real data lives
elsewhere on the lockup:

    lockupViewModel.contentId                                  → video id
    lockupViewModel.metadata.lockupMetadataViewModel.title.content  → title
    lockupViewModel.contentImage.thumbnailViewModel.image.sources[] → thumbnail
    …overlays[] text matching /^\d+:\d\d/                      → duration

The extractor handles BOTH shapes. Channel pages already use lockups; search and
home are migrating. If a view suddenly renders zero items, this is the first
thing to check.

Channel tabs: never hardcode the `params` blob. Read the browseEndpoint params
off the page and pick the tab by **base64-decoding** them and matching the tab
name (`videos`, `shorts`, `streams`) — locale-independent, survives redesigns.

## Comment replies (resolved — was a known gap)

Replies work. Each thread with replies renders a `.comment-replies-btn` that
fetches the reply continuation on click and appends the replies inline (capped
at `MAX_REPLIES`).

This was a gap for a while and the history is worth keeping, because the trap is
still there: `commentThreadRenderer` has **no `replies` key** in the current
shape, so extracting the token from the thread wrapper is the obvious move and
it is wrong — the first attempt at it broke comment extraction entirely (20 rows
-> 0). The token lives on a separate structure in the response, not on the
thread. If replies regress, that is the distinction to re-check.

## Player bar

Two-row grid: the seek bar spans the FULL width of the bar (its own grid row),
with controls beneath it. Verified: seek 713px inside a 743px bar.

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
