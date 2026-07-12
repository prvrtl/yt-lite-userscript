# iTube — performance, measured

Measured, not estimated. Where something is not proven, it says so.

## Method

Playwright (Chromium, headed, focused window — so `requestAnimationFrame` is not
throttled), viewport 1512x900, logged out. The script is injected via
`addInitScript`, i.e. at **document-start** — the same moment a userscript
manager runs it, so cold-load effects are real and not simulated.

Each surface is loaded twice per run — once stock, once with iTube — in a fresh
browser context. 3 runs each; the table reports the **median across runs**. After
load, the page is scrolled (8 x 900px) to make comments and related populate,
then a scripted scroll of 150 rAF frames records real frame intervals.

Reproduce: `scratchpad/bench.js` (Playwright).

## Watch page

| Metric | Stock | iTube | Change |
|---|---|---|---|
| DOM nodes | 19,928 | 5,599 | **−72%** |
| JS heap | 123 MB | 109 MB | **−11%** |
| First contentful paint | 1,244 ms | 924 ms | **−26%** |
| DOM content loaded | 1,721 ms | 1,578 ms | −8% |
| Frame time, median | 7.0 ms | 6.9 ms | ~0 |
| **Frame time, p95** | **14.5 ms** | **7.7 ms** | **−47%** |
| Janky frames (>16.7 ms) of 147 | 3 | 1 | −67% |
| Long tasks | 12 | 8 | −33% |
| Long-task time, total | 1,481 ms | 1,118 ms | **−25%** |

The p95 frame time is the number that matters for feel. The median is the same
in both (both hit the frame budget most of the time); it's the *bad* frames —
the ones you actually notice — that halve. Main-thread blocking drops by a
quarter.

## Home page

| Metric | Stock | iTube | Change |
|---|---|---|---|
| DOM nodes | 2,987 | 2,093 | −30% |
| JS heap | 68 MB | 67 MB | −1% |
| First contentful paint | 396 ms | 380 ms | −4% |
| Frame time, p95 | 7.7 ms | 7.7 ms | 0 |
| Long-task time | 686 ms | 622 ms | −9% |

**Honest read: the home page is not the win.** It is already light, it already
hits frame budget, and iTube changes little there beyond node count. The gains
are on the watch page, which is where the weight (comments, related, player
chrome) actually lives.

## What is NOT true

**The stylesheet is not what makes it fast.** It costs about +0.1 ms per full
style recalc — within noise. The universal `*` rules, the `ytd-app *:not(...)`
font rule and the two `:has()` rules were each isolated and re-measured; none is
measurably expensive. The speed comes from work that never happens, not from
cheaper selector matching.

**Never trust a single run.** An earlier one-shot measurement produced a "4.1 ms
p95 regression" that vanished entirely under repetition. It was GC noise.

## Where the speed comes from

- **72% fewer DOM nodes** to lay out, paint and keep alive.
- **No hover-preview `<video>` elements.** Stock spawns a real video element and
  its media buffers per hovered thumbnail; iTube deletes them on spawn.
- **No animations, transitions, shadows or large-surface blur** — nothing to
  composite per frame.
- **Off-screen content skips layout** (`content-visibility: auto`).
- **Bounded lists** — related, comments and replies are capped, so a long
  session cannot grow the tab without limit.

## Caveats

- Chromium, not Safari. Safari is the target; these numbers are a proxy. The DOM
  and script work are identical across both, but frame timing is engine-specific.
- Logged out. A logged-in feed is heavier, so the node reduction is likely a
  floor.
- WebKit-specific behaviour (`webkitPresentationMode` PiP, native fullscreen)
  still needs manual spot checks in Safari.
