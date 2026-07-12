# iTube — performance, measured

Numbers here are measured, not estimated. Where a claim could not be verified,
it says so. Anything not listed has not been measured and must not be claimed.

## Method

Chrome (same machine, same session, same account), a real logged-in YouTube.
For each surface the SAME page in the SAME tab is measured twice: once stock,
then again after applying iTube's shipped CSS and its DOM work (KILL list,
panel pruning, related/comment caps). Measuring both halves in one tab removes
machine, network and account variance.

Style+layout cost is measured by forcing a full style recalc and layout
(`classList.toggle` on `<html>`, then read `document.body.offsetHeight`) and
timing it — 20 iterations per run, 5 runs, reporting the median of the run
medians. Single-run numbers are worthless here: the first attempt showed a
"4.1ms p95" that vanished under repetition. It was GC noise.

## Results — watch page

| Metric | Stock | iTube | Change |
|---|---|---|---|
| DOM nodes | 3,647 | 2,364 | **−35%** |
| JS heap | 86 MB | 82 MB | −4 MB |
| Full style recalc + layout (median) | 0.2 ms | 0.3 ms | +0.1 ms |

Earlier, on a healthy (non-throttled) session, the same watch page measured
**10,631 → 3,202 nodes (−70%)**. The 3,647 baseline above is a *partially
loaded* page — this session was rate-limited by YouTube, so comments and
related never fully populated. The −35% is therefore a floor, not a ceiling:
the more YouTube loads, the more iTube removes (comments and related are the
capped lists).

Player chrome: YouTube's control bar is **161 nodes**; iTube's glass bar is
**33**. Showing/hiding it is one opacity+visibility flip, versus YouTube's
class churn across the whole chrome subtree.

## What is NOT true

**iTube's stylesheet does not make style recalc faster.** It costs about
+0.1 ms per full recalc — within noise, but it is not a win, and it was worth
checking: the sheet leans on universal selectors (`* { box-shadow: none }`,
`ytd-app *:not(...)` for the font, plus two `:has()` rules). Isolating each of
those rules and re-measuring showed no measurable cost from any of them on a
page of this size (all variants 0.2–0.3 ms). So they are affordable — but the
speed story is not "our CSS is cheaper to match."

**Scroll smoothness / frame rate is UNMEASURED.** `requestAnimationFrame` is
throttled in a background tab, so frame timing could not be captured in this
harness. Any claim about "no stutter" or FPS is unsupported until measured in
Safari with the Web Inspector timeline, on a focused window.

## Where the speed actually comes from

Not from cheaper CSS matching. From work that never happens:

- **35–70% fewer DOM nodes** to lay out, paint and keep alive.
- **Zero hover-preview `<video>` elements.** Stock YouTube spawns a real video
  element (and its media buffers) per hovered thumbnail; iTube deletes them on
  spawn. Verified: 4s of hovering → 0 video elements.
- **No animations, transitions, shadows or backdrop blur** on large surfaces —
  they are killed globally, so there is nothing to composite each frame.
- **Off-screen content skips layout entirely** via `content-visibility: auto`
  on feed items, comments, related rows and guide sections.
- **Bounded lists.** Related, comments and replies are capped, so a long
  session cannot grow the tab without limit.

## Open

- [ ] Frame timing during scroll, measured in Safari (focused window).
- [ ] Cold-load timing (LCP / long tasks) with the script at `document-start`,
      which is how it actually runs — the harness above injects post-load, so
      it cannot see load-time effects.
