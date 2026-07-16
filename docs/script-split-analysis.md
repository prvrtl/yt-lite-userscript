# Should iTube split into a fast-loading core + lazy modules?

**Question (from the roadmap):** split `itube.user.js` into a tiny core that
loads/paints instantly plus modules loaded on demand, to (a) make first paint
faster and (b) scale to more features without one giant file.

**Answer: no — not for performance. The script is not the bottleneck.** Keep the
single file. If the file ever becomes unwieldy to *maintain*, use a build-time
concatenation (dev-time modules → one shipped file), never runtime module
loading. Details and numbers below.

---

## Measured (cold load, userscript injected at document-start, viewport 1280×800)

| Metric | watch | home |
|---|---|---|
| File size | 197 KB / 5798 lines (~30% is the CSS-in-JS block) | — |
| **Script parse/compile** (`new Function(src)`, no exec) | **2.6 ms** | 2.6 ms |
| **Script execution** (the whole IIFE: build DOM, inject CSS, mount, route) | **6.1 ms** | 1.8 ms |
| First loader paint (from navigation) | ~640 ms | ~580 ms |
| `#itube` shell mounted | ~675 ms | ~597 ms |
| Video first frame (`readyState≥2`) | ~1490 ms | — |
| Watch meta data filled (channel name) | ~1660 ms | — |

Reproduce: `node tests/../scratchpad probe` pattern — a Playwright cold load that
(1) wraps the source with `performance.now()` around the IIFE to time execution,
(2) times `new Function(source)` for parse-only, (3) samples the paint/data
timeline via `requestAnimationFrame`.

## What the numbers mean

- **The script costs ~9 ms total** (2.6 parse + ~6 exec). That is nothing. It is
  not what the user waits on.
- **First paint (~600 ms) is browser + YouTube page setup**, not iTube. The
  userscript injects the boot loader within ~9 ms of its own start; the browser
  simply can't composite a first frame until the document and YouTube's own
  document-start scripts have run. A smaller iTube core cannot move this — the
  ~600 ms is spent elsewhere.
- **Content readiness (~1.5–1.7 s) is YouTube's data**: the `next` fetch and the
  player boot. Splitting iTube's own code does not change when YouTube's data
  arrives. This is the real "loading" time, and it is already masked by the
  v4.7.0 boot loader (which paints immediately and reports what is loading).

**Conclusion:** first paint is gated by the page and the network, not by parsing
or executing iTube. Splitting for first-paint speed optimizes a ~9 ms cost and
would add network round-trips — a net loss.

## Why runtime splitting is also the wrong tool here

- **Trusted Types / CSP.** youtube.com enforces Trusted Types and a strict CSP.
  `eval`/`new Function` are already forbidden (see RECOVERY.md invariants), and a
  dynamic `import()` of a module hosted off-origin (GitHub raw, a CDN) is blocked
  by the page's `script-src`. So runtime module loading of remote chunks is not
  available to us.
- **`@require` doesn't help first paint.** Userscript managers fetch all
  `@require`d files and concatenate them *before* the script runs, so they add
  zero laziness at runtime — they'd only reorganize source, at the cost of the
  single-file auto-update story (`@updateURL`/`@downloadURL` point at one file;
  splitting distribution across files complicates updates and review).
- **Views are already lazy in the way that matters.** Each view (`mountHome`,
  `mountWatch`, `mountSearch`, `mountChannel`, `mountFeed`, …) only builds its
  DOM when its route is entered. The non-active views cost nothing but their
  (trivial) parse. So the "lazy modules" benefit is already largely realized
  without any split.

## Scalability (goal b) — there is enormous headroom

At 197 KB / ~9 ms, the script can grow **10–20×** and still parse+execute in
under ~100 ms. Splitting for performance is premature by a wide margin. The real
scaling risk is *maintainability* of one long file, not runtime cost.

If/when the file becomes genuinely hard to work in, the right move is a
**build-time concatenation**, not runtime loading:

- Author in modules (e.g. `src/core/`, `src/views/`, `src/design/`), and a build
  step concatenates them into the single `itube.user.js` that ships and
  auto-updates. Dev-time modularity, ship-time single file — no CSP/Trusted-Types
  problem, no extra network requests, no change to the update story.
- **Cost:** this breaks the project's deliberate "no build step" convention
  (CLAUDE.md). That convention has real value (clone-and-install, trivial review,
  no toolchain rot). So only adopt a build step when the maintainability pain is
  concrete — not speculatively.

A reasonable module boundary *if* that day comes (for organization, not speed):

| Module | Contents |
|---|---|
| `core` | boot loader, router, `innertube` client + auth, `walk`/`findNode`, the player-bar engine, ad handling |
| `extractors` | `extractVideos`/`extractComment`/`paintHeader`/… (the YouTube-coupling surface RECOVERY.md maps) |
| `views` | one file each: home, search, channel, watch, playlist, feed, unhandled |
| `design` | the CSS-in-JS block (~1765 lines) |

## Recommendation

1. **Do not split now.** First paint is already effectively instant on iTube's
   side (~9 ms); the wait is YouTube's page + data, which the boot loader already
   covers.
2. **Keep the single file** while it remains workable. Revisit only on a
   *maintainability* trigger, not a performance one.
3. If that trigger arrives, adopt a **build-time concat** (modules → one shipped
   file) along the boundary above — never runtime/remote module loading, which
   Trusted Types + CSP block anyway.
4. What actually improves *perceived* cold-start is already done (the v4.7.0
   staged boot loader) and is where further effort should go if this comes up
   again (e.g. finer loader stages), not code-splitting.
