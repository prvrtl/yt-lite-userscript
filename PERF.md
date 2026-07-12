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

## Watch page (v2.7.0)

| Metric | Stock | iTube | Change |
|---|---|---|---|
| DOM nodes | 20,241 | 5,567 | **−72%** |
| First contentful paint | 1,156 ms | 1,012 ms | −12% |
| Frame time, median | 6.9 ms | 6.9 ms | ~0 |
| **Frame time, p95** | **16.2 ms** | **8.3 ms** | **−49%** |
| Janky frames (>16.7 ms) of 147 | 3 | **0** | −100% |
| Long tasks | 9 | 6 | −33% |
| Long-task time, total | 1,249 ms | 935 ms | **−25%** |

The p95 frame time is the number that matters for feel. The median is identical
(both hit the frame budget most of the time); it is the *bad* frames — the ones
you actually notice — that halve, and the janky ones that disappear. Main-thread
blocking drops by a quarter.

**JS heap is NOT reported, because it is noise.** Per-run values across 3 runs:
stock 118 / 123 / 155 MB, iTube 145 / 168 / 102 MB. The ranges overlap
completely — GC timing dominates, so any heap number here (in either direction)
is meaningless. Node count (5,517–5,571) and p95 (8.3–8.5 ms) are tight and
repeatable; those are trustworthy.

## Grid cards (v2.7.0, channel grid, 30 cards)

| Metric | Stock | iTube | Change |
|---|---|---|---|
| Total page nodes | 3,890 | 2,542 | **−35%** |
| Nodes per card | 45 | 35 | **−22%** |
| Guide (sidebar) nodes | 195 | 113 | −42% |
| Dead strip under the header | 48 px | **0** | gone |
| Durations still shown | 30 | **30** | none lost |

Per-card pruning removes the channel avatar subtree (12 nodes **and one image
request per card**), thumbnail badges, touch-feedback shapes and hover overlays.
The duration pill is deliberately kept.

**Trap, do not repeat:** the duration pill IS a `yt-thumbnail-badge-view-model` —
the same element type as the "New"/"4K" badges. Removing badges by tag deletes
every duration on the page. Badges are pruned only when they are *not* inside
`yt-thumbnail-bottom-overlay-view-model`.

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
