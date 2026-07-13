// Layout-geometry snapshot: records position/size of key structural
// elements, rounded to the nearest 4px so ordinary content churn (a
// different video title, a different number of digits in a view count)
// doesn't cause false failures. This is deliberately NOT a pixel diff —
// YouTube's content changes hourly, so pixel baselines would never hold.
// Geometry is content-independent: the sidebar is always 200px wide
// regardless of what's playing.
'use strict';

const fs = require('fs');
const path = require('path');

const BASELINE_DIR = path.join(__dirname, '..', 'baselines');
const ARTIFACT_DIR = path.join(__dirname, '..', 'artifacts');

// Superset of selectors worth tracking across all page types. Selectors
// that don't exist on a given page are simply skipped.
const KEY_SELECTORS = [
  '.hd', '.sidebar', '.content', '.grid',
  '.c:first-child', '.c-thumb:first-child',
  '#itube-stage', '#itube-bar',
  '.watch-meta', '.watch-right', '.watch-left',
  '.ch-banner', '.ch-avatar',
  '.row:first-child', '.row-thumb:first-child',
];

// Containers whose HEIGHT is a function of how many items happened to load
// (infinite scroll, ad-dependent row counts). Their height is content noise,
// not layout: we track position and width, but deliberately not height —
// otherwise the suite goes red every time YouTube returns one more row.
const HEIGHT_IS_CONTENT_DEPENDENT = new Set(['.grid', '.list', '.content', '.watch-left', '.watch-right']);

async function takeSnapshot(page) {
  return page.evaluate(({ selectors, ignoreHeight }) => {
    const round4 = (n) => Math.round(n / 4) * 4;
    const itube = document.querySelector('#itube');
    const geometry = {};
    for (const sel of selectors) {
      const scope = sel.startsWith('#') ? document : itube;
      const el = scope ? scope.querySelector(sel) : null;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const box = { x: round4(r.left), y: round4(r.top), w: round4(r.width), h: round4(r.height) };
      if (ignoreHeight.includes(sel)) delete box.h;
      geometry[sel] = box;
    }
    const counts = {
      c: document.querySelectorAll('#itube .c').length,
      row: document.querySelectorAll('#itube .row').length,
      commentRow: document.querySelectorAll('#itube .comment-row').length,
    };
    return { geometry, counts };
  }, { selectors: KEY_SELECTORS, ignoreHeight: [...HEIGHT_IS_CONTENT_DEPENDENT] });
}

function baselinePath(pageName) {
  return path.join(BASELINE_DIR, `${pageName}.json`);
}

async function saveScreenshot(page, pageName) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const file = path.join(ARTIFACT_DIR, `${pageName}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

// Compares a fresh snapshot against the committed baseline. If `update` is
// true, writes/overwrites the baseline instead of comparing and returns no
// violations.
function diffSnapshot(pageName, snapshot, { update = false } = {}) {
  const violations = [];
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  const file = baselinePath(pageName);

  if (update) {
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2) + '\n');
    return violations;
  }

  if (!fs.existsSync(file)) {
    violations.push({ check: 'snapshot-baseline-missing', detail: `no baseline at ${file} — run "npm run test:update" first` });
    return violations;
  }

  const baseline = JSON.parse(fs.readFileSync(file, 'utf8'));

  for (const [sel, base] of Object.entries(baseline.geometry || {})) {
    const cur = snapshot.geometry[sel];
    if (!cur) {
      violations.push({ check: 'snapshot-geometry', detail: `${sel} missing from current page (baseline had ${JSON.stringify(base)})` });
      continue;
    }
    for (const dim of ['x', 'y', 'w', 'h']) {
      if (Math.abs(cur[dim] - base[dim]) > 4) {
        violations.push({ check: 'snapshot-geometry', detail: `${sel}.${dim} expected ${base[dim]} got ${cur[dim]} (baseline=${JSON.stringify(base)} current=${JSON.stringify(cur)})` });
      }
    }
  }
  for (const sel of Object.keys(snapshot.geometry)) {
    if (!(sel in (baseline.geometry || {}))) {
      violations.push({ check: 'snapshot-geometry', detail: `${sel} present now but absent from baseline — run "npm run test:update" if this is intentional` });
    }
  }

  return violations;
}

module.exports = { takeSnapshot, saveScreenshot, diffSnapshot, baselinePath, KEY_SELECTORS };
