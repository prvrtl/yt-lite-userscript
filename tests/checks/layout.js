// Generic layout invariants, asserted on GEOMETRY and RELATIONSHIPS between
// elements — not CSS properties. This is the direct response to a real bug
// that shipped: `.body { max-width: 1720px; margin: 0 auto; }` passed every
// property-based check ("sidebar has overflow:auto") while the sidebar was
// visibly floating in the middle of the screen. Every check here reads
// getBoundingClientRect() (or an equivalent computed value) so a bug like
// that fails loudly.
'use strict';

// Runs entirely inside the page. Returns an array of violation strings.
// Kept as one big in-page function so it can be sent to the browser with a
// single page.evaluate() call, and so the whole layout snapshot is read from
// one consistent frame (no back-and-forth serialization mid-measurement).
function layoutInPage() {
  const violations = [];
  const report = (check, detail) => violations.push({ check, detail });

  const ALLOWED_SPACING = new Set([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 32, 40, 48]);

  const itube = document.querySelector('#itube');
  if (!itube) {
    report('itube-present', 'expected #itube to exist, got null');
    return violations;
  }

  const vw = window.innerWidth;

  // Collect every visible element inside #itube. "Visible" = not
  // display:none, not visibility:hidden, non-zero area. This deliberately
  // walks ALL descendants, not a curated list, so unexpected regressions in
  // elements nobody thought to check still get caught.
  const all = Array.from(itube.querySelectorAll('*'));
  const visible = [];
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    visible.push({ el, rect: r, cs });
  }

  const describe = (el) => {
    if (el.id) return '#' + el.id;
    if (el.className && typeof el.className === 'string') {
      return el.tagName.toLowerCase() + '.' + el.className.trim().split(/\s+/).join('.');
    }
    return el.tagName.toLowerCase();
  };

  const q = (sel) => itube.querySelector(sel);
  const rectOf = (sel) => {
    const el = q(sel);
    return el ? el.getBoundingClientRect() : null;
  };

  // --- (a) NO HORIZONTAL OVERFLOW on the major scroll containers ---
  for (const sel of ['#itube', '.sidebar', '.content', '.watch-right']) {
    const el = q(sel);
    if (!el) continue;
    if (el.scrollWidth > el.clientWidth + 1) {
      report('no-horizontal-overflow', `${sel} scrollWidth=${el.scrollWidth} > clientWidth=${el.clientWidth}`);
    }
  }

  // --- (b) NOTHING OUT OF BOUNDS ---
  for (const { el, rect } of visible) {
    if (rect.left < -1 || rect.right > vw + 1) {
      report('within-viewport', `${describe(el)} left=${rect.left.toFixed(1)} right=${rect.right.toFixed(1)} viewportWidth=${vw}`);
    }
  }

  // --- (c) SIDEBAR PINNED — the exact bug that shipped ---
  const sidebarRect = rectOf('.sidebar');
  const contentRect = rectOf('.content');
  if (sidebarRect) {
    if (Math.abs(sidebarRect.left - 0) > 1) {
      report('sidebar-pinned', `expected left=0 got left=${sidebarRect.left.toFixed(1)}`);
    }
    if (Math.abs(sidebarRect.width - 200) > 1) {
      report('sidebar-pinned', `expected width=200 got width=${sidebarRect.width.toFixed(1)}`);
    }
  }
  if (sidebarRect && contentRect) {
    if (Math.abs(contentRect.left - sidebarRect.right) > 1) {
      report('sidebar-pinned', `expected content.left=${sidebarRect.right.toFixed(1)} (sidebar.right) got content.left=${contentRect.left.toFixed(1)}`);
    }
  }

  // --- SIGNED-IN SIDEBAR: rows must not compress when the list overflows ---
  // The test session is LOGGED OUT, so the subscriptions list is empty and the
  // sidebar never overflows. A real signed-in user has 20+ channels, which
  // overflowed the flex column and shrank every nav row from 40px to 17px —
  // a bug invisible to a logged-out run. Simulate the signed-in state.
  const sidebarEl = q('.sidebar');
  if (sidebarEl) {
    const heightsBefore = [...document.querySelectorAll('.nav-row')]
      .map((r) => Math.round(r.getBoundingClientRect().height));

    const injected = [];
    for (let i = 0; i < 30; i++) {
      const a = document.createElement('a');
      a.className = 'nav-chan';
      a.href = '/';
      const img = document.createElement('img');
      img.className = 'nav-chan-avatar';
      const span = document.createElement('span');
      span.textContent = 'Simulated Subscription Channel ' + i;
      a.append(img, span);
      sidebarEl.appendChild(a);
      injected.push(a);
    }

    const overflows = sidebarEl.scrollHeight > sidebarEl.clientHeight;
    const heightsAfter = [...document.querySelectorAll('.nav-row')]
      .map((r) => Math.round(r.getBoundingClientRect().height));
    const chanWraps = [...document.querySelectorAll('.nav-chan span')]
      .some((s) => s.getBoundingClientRect().height > 24);

    for (const el of injected) el.remove();

    if (overflows) {
      const squashed = heightsAfter.some((h, i) => h < (heightsBefore[i] || 40) - 1);
      if (squashed) {
        report('sidebar-overflow-signed-in',
          `nav rows compressed when the sidebar overflows: ${heightsBefore[0]}px -> ${heightsAfter[0]}px (flex children must not shrink)`);
      }
      if (chanWraps) {
        report('sidebar-overflow-signed-in', 'subscription names wrap to multiple lines (must truncate with ellipsis)');
      }
    }
  }

  // --- (d) NO OVERLAP of major regions ---
  const intersects = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  if (sidebarRect && contentRect && intersects(sidebarRect, contentRect)) {
    report('no-region-overlap', `.sidebar (${JSON.stringify(rectStr(sidebarRect))}) overlaps .content (${JSON.stringify(rectStr(contentRect))})`);
  }
  const hdRect = rectOf('.hd');
  const bodyRect = rectOf('.body');
  if (hdRect && bodyRect && hdRect.bottom > bodyRect.top + 1) {
    report('hd-above-body', `expected .hd.bottom <= .body.top, got hd.bottom=${hdRect.bottom.toFixed(1)} body.top=${bodyRect.top.toFixed(1)}`);
  }

  function rectStr(r) {
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  }

  // --- (e) NO COLLAPSED CONTENT ---
  const MIN_SIZE = {
    '.c-thumb': 80,
    '.rc-thumb': 40,
    '.row-thumb': 60,
    '#itube-stage': 200,
    '.watch-meta': 60,
    '.sidebar': 200,
  };
  for (const [sel, minHeight] of Object.entries(MIN_SIZE)) {
    for (const el of itube.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.height <= minHeight) {
        report('no-collapsed-content', `${sel} expected height>${minHeight} got height=${r.height.toFixed(1)}`);
      }
    }
  }

  // --- (f) THUMBNAIL ASPECT ratio ~16:9 ---
  const TARGET_RATIO = 16 / 9;
  for (const sel of ['.c-thumb', '.row-thumb']) {
    for (const el of itube.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const ratio = r.width / r.height;
      if (Math.abs(ratio - TARGET_RATIO) > 0.15) {
        report('thumbnail-aspect', `${sel} expected ratio~${TARGET_RATIO.toFixed(2)} got ratio=${ratio.toFixed(2)} (w=${r.width.toFixed(1)} h=${r.height.toFixed(1)})`);
      }
    }
  }

  // --- (g) GRID ALIGNMENT within the first row of .grid ---
  const grid = q('.grid');
  if (grid) {
    const cards = Array.from(grid.children).filter((c) => c.classList.contains('c'));
    if (cards.length > 1) {
      const rects = cards.map((c) => c.getBoundingClientRect());
      const firstTop = rects[0].top;
      const firstRowRects = rects.filter((r) => Math.abs(r.top - firstTop) <= 2);
      if (firstRowRects.length > 1) {
        const tops = firstRowRects.map((r) => r.top);
        const widths = firstRowRects.map((r) => r.width);
        const minTop = Math.min(...tops), maxTop = Math.max(...tops);
        if (maxTop - minTop > 2) {
          report('grid-alignment', `first-row card tops not aligned: min=${minTop.toFixed(1)} max=${maxTop.toFixed(1)}`);
        }
        const minW = Math.min(...widths), maxW = Math.max(...widths);
        if (maxW - minW > 2) {
          report('grid-alignment', `first-row card widths not aligned: min=${minW.toFixed(1)} max=${maxW.toFixed(1)}`);
        }
        const sorted = [...firstRowRects].sort((a, b) => a.left - b.left);
        const gaps = [];
        for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i].left - sorted[i - 1].right);
        if (gaps.length > 1) {
          const minGap = Math.min(...gaps), maxGap = Math.max(...gaps);
          if (maxGap - minGap > 2) {
            report('grid-alignment', `first-row card gaps not equal: min=${minGap.toFixed(1)} max=${maxGap.toFixed(1)} gaps=[${gaps.map((g) => g.toFixed(1)).join(',')}]`);
          }
        }
      }
    }
  }

  // --- (h) SPACING SCALE ("healthy paddings") ---
  // Negative margins are a deliberate, common pattern here (e.g. `.c { padding:
  // 8px; margin: -8px }` expands the hit-area and offsets it back) — the sign
  // encodes direction, not a different spacing decision, so we compare
  // magnitude.
  const SPACING_PROPS = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'gap', 'rowGap', 'columnGap'];
  // `margin: 0 auto` centering resolves to a content-dependent pixel value in
  // getComputedStyle — that's a geometric relationship (centered in its
  // container), not a spacing-scale decision. Rather than guess from
  // geometry, read the actually-authored rules: any selector that declares
  // marginLeft/marginRight/margin as `auto` is centering, not spacing, so
  // elements matching it are exempt on that axis.
  const autoMarginSelectors = { left: [], right: [] };
  try {
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      if (!rules) continue;
      for (const rule of rules) {
        if (!rule.style) continue;
        const ml = rule.style.marginLeft;
        const mr = rule.style.marginRight;
        const shorthand = rule.style.margin;
        if (ml === 'auto' || (shorthand && /(^|\s)auto(\s|$)/.test(shorthand))) autoMarginSelectors.left.push(rule.selectorText);
        if (mr === 'auto' || (shorthand && /(^|\s)auto(\s|$)/.test(shorthand))) autoMarginSelectors.right.push(rule.selectorText);
      }
    }
  } catch (e) {}
  const matchesAny = (el, selectors) => {
    for (const sel of selectors) {
      try { if (sel && el.matches(sel)) return true; } catch (e) {}
    }
    return false;
  };
  const isAutoCentered = (el, prop) => {
    if (prop === 'marginLeft') return matchesAny(el, autoMarginSelectors.left);
    if (prop === 'marginRight') return matchesAny(el, autoMarginSelectors.right);
    return false;
  };
  for (const { el, cs } of visible) {
    for (const prop of SPACING_PROPS) {
      const raw = cs[prop];
      if (!raw || raw === 'normal') continue;
      const px = parseFloat(raw);
      if (!isFinite(px) || px === 0) continue;
      if (isAutoCentered(el, prop)) continue;
      const rounded = Math.round(Math.abs(px));
      if (!ALLOWED_SPACING.has(rounded)) {
        report('spacing-scale', `${describe(el)} ${prop}=${raw} not in allowed spacing scale`);
      }
    }
  }

  // --- (i) LEGIBILITY: text color must differ from effective background ---
  const effectiveBg = (el) => {
    let node = el;
    while (node && node !== itube.parentElement) {
      const cs = getComputedStyle(node);
      const bg = cs.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      node = node.parentElement;
    }
    return 'rgba(0, 0, 0, 0)';
  };
  for (const { el, cs } of visible) {
    const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!hasText) continue;
    const color = cs.color;
    const bg = effectiveBg(el);
    if (color === bg) {
      report('legibility', `${describe(el)} text color equals effective background (${color})`);
    }
  }

  // --- (j) TEXT NOT CLIPPED ---
  for (const sel of ['.c-title', '.row-title', '.watch-title', '.comment-text']) {
    for (const el of itube.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const hasClamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && cs.webkitLineClamp !== '';
      if (hasClamp) continue;
      if (el.scrollHeight > el.clientHeight + 2) {
        report('text-not-clipped', `${sel} scrollHeight=${el.scrollHeight} > clientHeight=${el.clientHeight} and no line-clamp set`);
      }
    }
  }

  // --- (k) SURFACE CLIPPED BY AN OVERFLOW ANCESTOR (inline axis) ---
  // The bug this catches: `.rc { padding: 6px; margin: -6px }` bleeds the
  // hover pill outward, but `.watch-right` is a scroll container with no
  // horizontal padding and overflow clips at the PADDING box — so the left
  // 6px of the pill was shaved off while top/bottom kept their inset, and the
  // thumbnail sat flush against the pill's left edge. Any element that paints
  // a surface worth preserving (background, rounded corners, or an outward
  // negative inline margin) must fit inside the padding box of its nearest
  // horizontal clipper. Vertical overflow is NOT checked: scrolling down a
  // scroll container is the whole point of one.
  const chrome = document.querySelector('#itube-bar');
  const stage = document.querySelector('#itube-stage');
  const isPlayerChrome = (el) =>
    (chrome && chrome.contains(el)) || (stage && stage.contains(el));

  const paintsSurface = (cs) => {
    const bg = cs.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return true;
    if (parseFloat(cs.borderRadius) > 0) return true;
    if (parseFloat(cs.marginLeft) < 0 || parseFloat(cs.marginRight) < 0) return true;
    return false;
  };

  // Nearest ancestor that clips horizontally, searching up to (and including)
  // #itube. `overflow-x: visible` is the only non-clipping value.
  const clipperOf = (el) => {
    let node = el.parentElement;
    while (node) {
      if (getComputedStyle(node).overflowX !== 'visible') return node;
      if (node === itube) return null;
      node = node.parentElement;
    }
    return null;
  };

  let clipped = 0;
  for (const { el, rect, cs } of visible) {
    if (clipped >= 3) break;
    if (cs.position === 'fixed') continue;
    if (isPlayerChrome(el)) continue;
    if (!paintsSurface(cs)) continue;
    const clipper = clipperOf(el);
    if (!clipper) continue;
    const cr = clipper.getBoundingClientRect();
    const ccs = getComputedStyle(clipper);
    const boxLeft = cr.left + parseFloat(ccs.borderLeftWidth || 0);
    const boxRight = cr.right - parseFloat(ccs.borderRightWidth || 0);
    if (rect.left < boxLeft - 1) {
      report('surface-clipped', `${describe(el)} is clipped by ${describe(clipper)} on the left: element left=${rect.left.toFixed(1)} clip box left=${boxLeft.toFixed(1)} (a padded surface whose bleed is cut off renders with asymmetric insets)`);
      clipped++;
      continue;
    }
    if (rect.right > boxRight + 1) {
      report('surface-clipped', `${describe(el)} is clipped by ${describe(clipper)} on the right: element right=${rect.right.toFixed(1)} clip box right=${boxRight.toFixed(1)} (a padded surface whose bleed is cut off renders with asymmetric insets)`);
      clipped++;
    }
  }

  // --- (l) INSET SYMMETRY on card surfaces ---
  // Independent of cause: whatever the reason (clipping, a stray one-sided
  // margin, an asymmetric padding shorthand), the rendered gap between a card
  // and its content must look the same on all four sides. Measured from the
  // union box of the card's laid-out children, so it reflects what a human
  // actually sees rather than what the CSS claims. Only the first 8 of each
  // selector are inspected — a 40-card grid is homogeneous and would just
  // repeat the same violation 40 times.
  let asym = 0;
  for (const sel of ['.c', '.rc', '.row']) {
    for (const el of Array.from(itube.querySelectorAll(sel)).slice(0, 8)) {
      if (asym >= 3) break;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      const kids = Array.from(el.children).filter((k) => {
        const kcs = getComputedStyle(k);
        if (kcs.display === 'none') return false;
        if (kcs.position === 'absolute' || kcs.position === 'fixed') return false;
        const kr = k.getBoundingClientRect();
        return kr.width > 0 && kr.height > 0;
      });
      if (!kids.length) continue;

      const rects = kids.map((k) => k.getBoundingClientRect());
      const union = {
        left: Math.min(...rects.map((r) => r.left)),
        right: Math.max(...rects.map((r) => r.right)),
        top: Math.min(...rects.map((r) => r.top)),
        bottom: Math.max(...rects.map((r) => r.bottom)),
      };
      const l = union.left - rect.left;
      const r = rect.right - union.right;
      const t = union.top - rect.top;
      const b = rect.bottom - union.bottom;

      const gaps = [l, r, t, b];
      const spread = Math.max(...gaps) - Math.min(...gaps);
      if (spread > 1.5) {
        report('inset-symmetry', `${describe(el)} has asymmetric insets: left=${l.toFixed(1)} right=${r.toFixed(1)} top=${t.toFixed(1)} bottom=${b.toFixed(1)} (all four should match the padding)`);
        asym++;
      }
    }
    if (asym >= 3) break;
  }

  return violations;
}

async function runLayoutChecks(page) {
  return page.evaluate(layoutInPage);
}

module.exports = { runLayoutChecks };
