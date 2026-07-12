// ==UserScript==
// @name         iTube
// @namespace    yt-us
// @version      3.0.0
// @description  YouTube rebuilt as a native-feeling app. Our UI, YouTube's data.
// @match        https://www.youtube.com/*
// @exclude      https://www.youtube.com/embed/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  if (location.pathname !== '/') return;

  const SVGNS = 'http://www.w3.org/2000/svg';
  const icon = (nodes) => {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('width', '17');
    s.setAttribute('height', '17');
    for (const [tag, attrs] of nodes) {
      const n = document.createElementNS(SVGNS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      s.appendChild(n);
    }
    return s;
  };
  const ICONS = {
    home: () => icon([['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linejoin': 'round', d: 'M2.2 7.2 8 2.6l5.8 4.6V13a.9.9 0 0 1-.9.9H3.1a.9.9 0 0 1-.9-.9z' }]]),
    subs: () => icon([
      ['rect', { x: '1.6', y: '3.4', width: '12.8', height: '9.2', rx: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }],
      ['path', { fill: 'currentColor', d: 'M6.7 5.9 10.6 8l-3.9 2.1z' }],
    ]),
    later: () => icon([
      ['circle', { cx: '8', cy: '8', r: '5.9', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }],
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M8 4.6V8l2.4 1.5' }],
    ]),
    history: () => icon([
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', d: 'M2.6 6.2A5.8 5.8 0 1 1 2.2 8' }],
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M1.2 3.6v2.8h2.8' }],
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M8 5.1V8l2.1 1.3' }],
    ]),
  };

  const CSS = `
    #itube {
      position: fixed;
      inset: 0;
      overflow: auto;
      background: var(--ink);
      color: var(--text);
      font-family: -apple-system, system-ui, sans-serif;
      z-index: 9999;
      --ink: #0b0c10;
      --raised: #16181f;
      --text: #f2f3f5;
      --muted: #969aa6;
      --dim: #6d717c;
      --accent: #0a84ff;
      --hairline: rgba(255, 255, 255, .11);
      --surface: rgba(255, 255, 255, .045);
      --r-sm: 10px;
      --r-md: 14px;
      --r-lg: 20px;
    }
    #itube .hd {
      position: sticky;
      top: 0;
      height: 52px;
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 0 24px;
      background: rgba(12, 12, 18, .72);
      backdrop-filter: blur(24px) saturate(1.7);
      -webkit-backdrop-filter: blur(24px) saturate(1.7);
      border-bottom: 1px solid var(--hairline);
      z-index: 1;
    }
    #itube .wordmark {
      font-weight: 600;
      font-size: 19px;
      letter-spacing: -.02em;
      flex: 0 0 auto;
    }
    #itube .search {
      flex: 1 1 auto;
      max-width: 560px;
      margin: 0 auto;
      height: 34px;
      border-radius: 17px;
      background: var(--surface);
      border: 1px solid var(--hairline);
      color: var(--text);
      padding: 0 16px;
      font-size: 14px;
      outline: none;
    }
    #itube .search:focus {
      border: 2px solid var(--accent);
    }
    #itube .body {
      display: flex;
      gap: 24px;
      max-width: 1720px;
      margin: 0 auto;
      padding: 24px;
    }
    #itube .sidebar {
      flex: 0 0 200px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    #itube .nav-row {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 38px;
      padding: 0 10px;
      border-radius: 10px;
      color: var(--text);
      text-decoration: none;
      font-size: 13.5px;
    }
    #itube .nav-row svg {
      flex: 0 0 auto;
      color: var(--muted);
    }
    #itube .nav-row.active {
      background: rgba(10, 132, 255, .16);
    }
    #itube .nav-row.active svg,
    #itube .nav-row.active span {
      color: var(--accent);
    }
    #itube .content {
      flex: 1;
      min-width: 0;
    }
    #itube .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 24px 16px;
    }
    #itube .spacer {
      grid-column: 1 / -1;
      height: 0;
    }
    #itube .sentinel {
      grid-column: 1 / -1;
      height: 1px;
    }
    #itube .spinner {
      grid-column: 1 / -1;
      display: none;
      justify-content: center;
      padding: 20px 0;
      color: var(--muted);
      font-size: 13px;
    }
    #itube .spinner.show {
      display: flex;
    }
    #itube .c {
      display: block;
      color: var(--text);
      text-decoration: none;
      content-visibility: auto;
      contain-intrinsic-size: auto 250px;
      contain: layout paint style;
    }
    #itube .c-thumb {
      aspect-ratio: 16 / 9;
      border-radius: var(--r-md);
      overflow: hidden;
      background: var(--raised);
      position: relative;
    }
    #itube .c:hover .c-thumb {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    #itube .c-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      opacity: 0;
    }
    #itube .c-thumb img.in {
      opacity: 1;
      transition: opacity .18s ease-out;
    }
    #itube .c-dur {
      position: absolute;
      right: 4px;
      bottom: 4px;
      background: rgba(0, 0, 0, .8);
      border-radius: 6px;
      font: 600 11px -apple-system, system-ui, sans-serif;
      font-variant-numeric: tabular-nums;
      color: #fff;
      padding: 2px 4px;
    }
    #itube .c-title {
      margin: 10px 0 0;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -.01em;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    #itube .c-chan {
      margin-top: 4px;
      font-size: 13px;
      color: var(--muted);
    }
    #itube .c-meta {
      margin-top: 2px;
      font-size: 12.5px;
      color: var(--dim);
      font-variant-numeric: tabular-nums;
    }
    ytd-app {
      position: fixed !important;
      left: -99999px !important;
      top: 0 !important;
      width: 1280px !important;
      height: 720px !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;

  const style = document.createElement('style');
  style.id = 'itube-style';
  style.textContent = CSS;
  const mountStyle = () => {
    const root = document.documentElement;
    if (!root) { setTimeout(mountStyle, 0); return; }
    if (style.parentNode !== root) root.appendChild(style);
  };
  mountStyle();

  const cfg = () => window.ytcfg?.data_;
  const innertube = async (endpoint, body) => {
    const c = cfg();
    if (!c?.INNERTUBE_API_KEY) return null;
    try {
      const res = await fetch('/youtubei/v1/' + endpoint + '?key=' + c.INNERTUBE_API_KEY + '&prettyPrint=false', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ context: c.INNERTUBE_CONTEXT, ...body }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const walk = (node, visit) => {
    if (!node || typeof node !== 'object') return;
    visit(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, visit);
    } else {
      for (const key in node) {
        if (Object.prototype.hasOwnProperty.call(node, key)) walk(node[key], visit);
      }
    }
  };

  const getTitle = (node) => (
    node?.title?.runs?.[0]?.text
    || node?.title?.simpleText
    || node?.title?.accessibility?.accessibilityData?.label
    || node?.metadata?.lockupMetadataViewModel?.title?.content
    || node?.headline?.simpleText
    || null
  );

  const getChannel = (node) => (
    node?.longBylineText?.runs?.[0]?.text
    || node?.longBylineText?.simpleText
    || node?.shortBylineText?.runs?.[0]?.text
    || node?.shortBylineText?.simpleText
    || node?.metadata?.lockupMetadataViewModel?.metadata?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content
    || node?.ownerText?.runs?.[0]?.text
    || null
  );

  const getThumb = (node) => {
    const list = node?.thumbnail?.thumbnails;
    if (Array.isArray(list) && list.length) {
      const last = list[list.length - 1];
      if (last?.url) return last.url;
    }
    const sources = node?.thumbnail?.sources;
    if (Array.isArray(sources) && sources.length) {
      const last = sources[sources.length - 1];
      if (last?.url) return last.url;
    }
    return null;
  };

  const getDuration = (node) => {
    const simple = node?.lengthText?.simpleText;
    if (simple) return simple;
    const label = node?.lengthText?.accessibility?.accessibilityData?.label;
    if (label) return label;
    const overlays = node?.thumbnailOverlays;
    if (Array.isArray(overlays)) {
      for (const o of overlays) {
        const t = o?.thumbnailOverlayTimeStatusRenderer?.text;
        const text = t?.simpleText || t?.runs?.[0]?.text;
        if (text) return text;
      }
    }
    return null;
  };

  const getViews = (node) => (
    node?.viewCountText?.simpleText
    || (Array.isArray(node?.viewCountText?.runs) ? node.viewCountText.runs.map((r) => r?.text || '').join('') : null)
    || node?.shortViewCountText?.simpleText
    || node?.shortViewCountText?.accessibility?.accessibilityData?.label
    || null
  );

  const getPublished = (node) => node?.publishedTimeText?.simpleText || null;

  const seenVideoIds = new Set();
  const extractVideos = (root) => {
    const seen = seenVideoIds;
    const out = [];
    walk(root, (node) => {
      if (typeof node.videoId !== 'string' || !node.videoId || seen.has(node.videoId)) return;
      const title = getTitle(node);
      if (!title) return;
      const thumb = getThumb(node);
      if (!thumb) return;
      seen.add(node.videoId);
      out.push({
        id: node.videoId,
        title,
        channel: getChannel(node),
        thumb,
        duration: getDuration(node),
        views: getViews(node),
        published: getPublished(node),
      });
    });
    return out;
  };

  const findContinuationToken = (root) => {
    let token = null;
    walk(root, (node) => {
      if (token) return;
      const t = node?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (typeof t === 'string' && t) token = t;
    });
    return token;
  };

  const createCard = (item) => {
    const a = document.createElement('a');
    a.className = 'c';
    a.href = '/watch?v=' + encodeURIComponent(item.id);
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'c-thumb';
    const img = document.createElement('img');
    img.addEventListener('load', () => img.classList.add('in'), { once: true });
    img.addEventListener('error', () => img.classList.add('in'), { once: true });
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.src = item.thumb;
    thumbWrap.appendChild(img);
    if (item.duration) {
      const dur = document.createElement('span');
      dur.className = 'c-dur';
      dur.textContent = item.duration;
      thumbWrap.appendChild(dur);
    }
    const title = document.createElement('h3');
    title.className = 'c-title';
    title.textContent = item.title;
    const chan = document.createElement('div');
    chan.className = 'c-chan';
    chan.textContent = item.channel || '';
    const meta = document.createElement('div');
    meta.className = 'c-meta';
    meta.textContent = [item.views, item.published].filter(Boolean).join(' · ');
    a.append(thumbWrap, title, chan, meta);
    return a;
  };

  const root = document.createElement('div');
  root.id = 'itube';

  const header = document.createElement('header');
  header.className = 'hd';
  const wordmark = document.createElement('div');
  wordmark.className = 'wordmark';
  wordmark.textContent = 'iTube';
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'search';
  search.placeholder = 'Search';
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = search.value.trim();
    if (q) location.href = '/results?search_query=' + encodeURIComponent(q);
  });
  header.append(wordmark, search);

  const nav = document.createElement('nav');
  nav.className = 'sidebar';
  const NAV_ITEMS = [
    { key: 'home', label: 'Home', href: '/', active: true },
    { key: 'subs', label: 'Subscriptions', href: '/feed/subscriptions' },
    { key: 'later', label: 'Watch later', href: '/playlist?list=WL' },
    { key: 'history', label: 'History', href: '/feed/history' },
  ];
  for (const item of NAV_ITEMS) {
    const row = document.createElement('a');
    row.className = 'nav-row' + (item.active ? ' active' : '');
    row.href = item.href;
    const label = document.createElement('span');
    label.textContent = item.label;
    row.append(ICONS[item.key](), label);
    nav.appendChild(row);
  }

  const content = document.createElement('div');
  content.className = 'content';
  const grid = document.createElement('div');
  grid.className = 'grid';
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  spinner.textContent = 'Loading…';
  const sentinel = document.createElement('div');
  sentinel.className = 'sentinel';
  grid.append(sentinel);
  content.append(grid, spinner);

  const body = document.createElement('div');
  body.className = 'body';
  body.append(nav, content);

  root.append(header, body);

  const mountRoot = () => {
    if (!document.body) { setTimeout(mountRoot, 0); return; }
    document.body.appendChild(root);
  };
  mountRoot();

  let lastScroll = 0;
  addEventListener('scroll', () => { lastScroll = Date.now(); }, { passive: true, capture: true });
  const idle = window.requestIdleCallback
    ? (cb) => window.requestIdleCallback(cb, { timeout: 1200 })
    : (cb) => setTimeout(cb, 200);

  let appendScheduled = false;
  let pendingItems = null;
  const tryAppend = () => {
    appendScheduled = false;
    if (Date.now() - lastScroll < 200) {
      appendScheduled = true;
      setTimeout(tryAppend, 200);
      return;
    }
    const items = pendingItems;
    pendingItems = null;
    if (items) appendCards(items);
  };
  const scheduleAppend = (items) => {
    pendingItems = pendingItems ? pendingItems.concat(items) : items;
    if (appendScheduled) return;
    appendScheduled = true;
    idle(tryAppend);
  };

  const MAX_CARDS = 200;
  const capGrid = () => {
    const cards = grid.querySelectorAll('.c');
    const excess = cards.length - MAX_CARDS;
    if (excess <= 0) return;
    const heightBefore = grid.getBoundingClientRect().height;
    for (let i = 0; i < excess; i++) {
      cards[i].remove();
    }
    const heightAfter = grid.getBoundingClientRect().height;
    const removedHeight = heightBefore - heightAfter;
    let spacer = grid.querySelector('.spacer');
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.className = 'spacer';
      grid.insertBefore(spacer, grid.firstChild);
    }
    const current = parseFloat(spacer.style.height) || 0;
    spacer.style.height = (current + removedHeight) + 'px';
  };

  const appendCards = (items) => {
    for (const item of items) {
      grid.insertBefore(createCard(item), sentinel);
    }
    capGrid();
  };

  let continuationToken = null;
  let loading = false;
  const loadMore = async () => {
    if (loading || !continuationToken) return;
    loading = true;
    spinner.classList.add('show');
    try {
      const res = await innertube('browse', { continuation: continuationToken });
      if (!res) return;
      const items = extractVideos(res);
      continuationToken = findContinuationToken(res);
      scheduleAppend(items);
    } finally {
      loading = false;
      spinner.classList.remove('show');
    }
  };

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) loadMore();
  }, { rootMargin: '600px' });
  io.observe(sentinel);

  const renderInitial = () => {
    const data = window.ytInitialData;
    if (!data) return;
    const items = extractVideos(data);
    for (const item of items) grid.insertBefore(createCard(item), sentinel);
    continuationToken = findContinuationToken(data);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderInitial, { once: true });
  } else {
    renderInitial();
  }
})();
