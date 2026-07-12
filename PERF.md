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

## Watch page (v2.8.0)

| Metric | Stock | iTube | Change |
|---|---|---|---|
| DOM nodes | 20,243 | 5,553 | **−73%** |
| Frame time, median | 7.0 ms | 7.0 ms | ~0 |
| **Frame time, p95** | **17.4 ms** | **7.7 ms** | **−56%** |
| **Worst frame** | **22.5 ms** | **8.1 ms** | **−64%** |
| Janky frames (>16.7 ms) of 147 | 12 | **0** | −100% |
| Long tasks | 11 | 8 | −27% |
| Long-task time, total | 1,501 ms | 1,108 ms | **−26%** |

Per-run p95 — stock 17.4 / 17.1 / 17.9 ms, iTube 7.7 / 7.7 / 7.6 ms. Tight, no
overlap, repeatable. The median frame is identical in both (both hit budget most
of the time); what changes is the *bad* frames — the ones you actually feel —
which halve, and the janky ones, which disappear entirely.

Killing `#frosted-glass` (see below) is a large part of this: it was a fixed,
full-width, 112px-tall layer with `backdrop-filter: blur(48px)` — recomposited
on every scroll frame.

### Two metrics deliberately NOT reported, because they are noise

- **JS heap.** Per-run: stock 118 / 123 / 155 MB, iTube 145 / 168 / 102 MB.
  Ranges overlap completely; GC timing dominates.
- **First contentful paint.** Per-run across two benchmarks: stock 608–1,272 ms,
  iTube 776–1,208 ms. Network-dominated, ranges overlap. Earlier versions of this
  file claimed −26% and then −12% FCP. **Both were noise.** Retracted.

Node count and frame timing are tight and repeatable. Those are the only numbers
worth trusting here.

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

## Fast scrolling on grid pages (v2.9.0)

Extreme fast scroll (180px per frame, 120 frames), channel grid, 120 cards both
sides:

| Metric | Stock | iTube |
|---|---|---|
| Frame time, p95 | 17.9 ms | 17.9 ms |
| Janky frames | 6 | 6 |
| Cumulative layout shift | 0 | 0 |
| Skeleton placeholders visible | **52** | **0** |
| Thumbnails lazy-loaded / faded in | 0 | all |

**Honest read: grid scrolling is PARITY, not a win.** iTube is not faster here.
What it removes is the *ugliness* — YouTube's grey skeleton blobs — and it does
so without costing frames.

Getting to parity took three fixes, and the first attempt was a REGRESSION
(p95 15.8 → 29 ms, worst frame 420 ms). What actually mattered:

1. **The sweeper must not run while the user is scrolling.** It now defers
   (200ms after the last scroll event). Sweeping mid-scroll — full-document
   querySelectorAll on every mutation, while YouTube streams in new cards — is
   what produced the 420ms frame.
2. **`contain: layout paint style` on cards** + a fixed `aspect-ratio: 16/9` on
   thumbnails, so an image decoding cannot reflow the grid. p95 26.5 → 22 ms,
   janky 13 → 7.
3. **`contain-intrinsic-size: auto <len>`** (not a fixed guess). Our fixed 230px
   was a lie — cards render 245px — so every offscreen card mis-reserved space.
   `auto` makes the browser remember each element's real size.

A confound worth recording: iTube's cards are denser, so at equal scroll
distance it can render ~25% MORE cards than stock (150 vs 120). Per card the
cost is identical; per frame it can be higher purely because more content passes
the viewport. Always check the card count before comparing frame times.

## The single most expensive thing YouTube ships

`#frosted-glass` — a **fixed, full-width, 112px-tall** element (double the 56px
header) with `backdrop-filter: blur(48px)`, `z-index: 2018`. A large blurred
fixed layer must be recomposited every scroll frame. We already paint the
masthead glass ourselves, so it is pure waste. It is now `display: none`.

If you only ever apply one rule from this project, apply that one.

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
