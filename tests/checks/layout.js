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

  return violations;
}

async function runLayoutChecks(page) {
  return page.evaluate(layoutInPage);
}

module.exports = { runLayoutChecks };
