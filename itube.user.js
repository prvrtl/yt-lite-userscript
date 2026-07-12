// ==UserScript==
// @name         iTube
// @namespace    yt-us
// @version      3.1.0
// @description  YouTube rebuilt as a native-feeling app. Our UI, YouTube's data.
// @match        https://www.youtube.com/*
// @exclude      https://www.youtube.com/embed/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  if (location.pathname !== '/' && location.pathname !== '/watch') return;

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
    play: () => icon([['path', { fill: 'currentColor', d: 'M4 2.5v11l9-5.5z' }]]),
    pause: () => icon([['path', { fill: 'currentColor', d: 'M4 2h3v12H4zM9 2h3v12H9z' }]]),
    vol: () => icon([
      ['path', { fill: 'currentColor', d: 'M2 6h3l4-3.5v11L5 10H2z' }],
      ['path', { stroke: 'currentColor', 'stroke-width': '1.3', fill: 'none', d: 'M11 5.5a3 3 0 010 5' }],
    ]),
    muted: () => icon([
      ['path', { fill: 'currentColor', d: 'M2 6h3l4-3.5v11L5 10H2z' }],
      ['path', { stroke: 'currentColor', 'stroke-width': '1.3', d: 'M11 6l4 4m0-4l-4 4' }],
    ]),
    pip: () => icon([
      ['rect', { x: '1.5', y: '3', width: '13', height: '10', rx: '1.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.3' }],
      ['rect', { x: '8', y: '8', width: '5', height: '3.5', rx: '0.8', fill: 'currentColor' }],
    ]),
    fs: () => icon([['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', d: 'M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4' }]]),
    prev: () => icon([
      ['path', { fill: 'currentColor', d: 'M4 2.5h1.6v11H4z' }],
      ['path', { fill: 'currentColor', d: 'M13.5 2.5v11L6.5 8z' }],
    ]),
    next: () => icon([
      ['path', { fill: 'currentColor', d: 'M10.4 2.5H12v11h-1.6z' }],
      ['path', { fill: 'currentColor', d: 'M2.5 2.5v11L9.5 8z' }],
    ]),
    more: () => icon([
      ['circle', { cx: '3', cy: '8', r: '1.5', fill: 'currentColor' }],
      ['circle', { cx: '8', cy: '8', r: '1.5', fill: 'currentColor' }],
      ['circle', { cx: '13', cy: '8', r: '1.5', fill: 'currentColor' }],
    ]),
  };

  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const QUALITY_LABELS = {
    highres: '4320p', hd2160: '2160p', hd1440: '1440p', hd1080: '1080p',
    hd720: '720p', large: '480p', medium: '360p', small: '240p', tiny: '144p',
    auto: 'Auto',
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
      color: var(--text);
      text-decoration: none;
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
    #itube .watch {
      display: flex;
      gap: 24px;
      max-width: 1600px;
      margin: 0 auto;
      padding: 24px;
    }
    #itube .watch-left {
      flex: 1;
      min-width: 0;
    }
    #itube .watch-right {
      flex: 0 0 380px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    #itube-stage {
      position: relative;
      overflow: hidden;
      border-radius: var(--r-lg);
      background: #000;
      aspect-ratio: 16 / 9;
      width: 100%;
    }
    #itube-stage video {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
    }
    #itube .watch-title {
      margin: 16px 0 0;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -.02em;
    }
    #itube .watch-channel {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 14px;
    }
    #itube .watch-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      object-fit: cover;
      background: var(--raised);
      flex: none;
    }
    #itube .watch-channel-name {
      font-size: 14px;
      font-weight: 600;
    }
    #itube .watch-subs {
      font-size: 12.5px;
      color: var(--dim);
      margin-top: 2px;
    }
    #itube .watch-desc {
      margin-top: 14px;
      background: var(--surface);
      border-radius: var(--r-md);
      padding: 12px;
      font-size: 13.5px;
      line-height: 1.5;
      color: var(--text);
      white-space: pre-wrap;
    }
    #itube .watch-desc.collapsed {
      max-height: calc(1.5em * 3 + 4px);
      overflow: hidden;
    }
    #itube .watch-more {
      margin-top: 8px;
      background: none;
      border: none;
      color: var(--muted);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
    }
    #itube .rc {
      display: flex;
      gap: 10px;
      text-decoration: none;
      color: var(--text);
    }
    #itube .rc-thumb {
      flex: 0 0 168px;
      width: 168px;
      height: 94px;
      border-radius: var(--r-sm);
      overflow: hidden;
      background: var(--raised);
      position: relative;
    }
    #itube .rc-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      opacity: 0;
    }
    #itube .rc-thumb img.in {
      opacity: 1;
      transition: opacity .18s ease-out;
    }
    #itube .rc-dur {
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
    #itube .rc-body {
      flex: 1;
      min-width: 0;
    }
    #itube .rc-title {
      font-size: 13.5px;
      font-weight: 600;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    #itube .rc-chan {
      margin-top: 4px;
      font-size: 12px;
      color: var(--muted);
    }
    #itube .rc-meta {
      margin-top: 2px;
      font-size: 11.5px;
      color: var(--dim);
    }
    #itube-bar {
      position: absolute;
      left: 50%;
      bottom: 14px;
      transform: translateX(-50%);
      width: min(94%, 920px);
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 22px;
      background: rgba(18, 18, 24, .52);
      backdrop-filter: blur(22px) saturate(1.7);
      -webkit-backdrop-filter: blur(22px) saturate(1.7);
      border: 1px solid rgba(255, 255, 255, .17);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .22), 0 8px 32px rgba(0, 0, 0, .35);
      color: #fff;
      font: 500 12px -apple-system, system-ui, sans-serif;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    #itube-stage.show #itube-bar,
    #itube-bar:focus-within {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
    #itube-bar-left,
    #itube-bar-right {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 0 0 190px;
    }
    #itube-bar-left { justify-content: flex-start; }
    #itube-bar-right { justify-content: flex-end; }
    #itube-bar-center {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 0;
    }
    #itube-bar button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #fff;
      cursor: pointer;
      flex: none;
    }
    #itube-bar button:hover { background: rgba(255, 255, 255, .14); }
    #itube-bar button:active { background: rgba(255, 255, 255, .22); }
    #itube-bar select {
      -webkit-appearance: none;
      appearance: none;
      background: rgba(255, 255, 255, .1);
      color: #fff;
      font: 500 11px -apple-system, system-ui, sans-serif;
      border: 1px solid rgba(255, 255, 255, .14);
      border-radius: 999px;
      padding: 3px 9px;
      cursor: pointer;
      flex: none;
      text-align: center;
    }
    #itube-bar .itube-time {
      flex: none;
      opacity: .85;
      font-variant-numeric: tabular-nums;
    }
    #itube-bar input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      height: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, .18);
      cursor: pointer;
      margin: 0;
    }
    #itube-bar input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #fff;
      border: none;
    }
    #itube-seekwrap {
      position: relative;
      flex: 1;
      display: flex;
      align-items: center;
      min-width: 60px;
    }
    #itube-seek { width: 100%; }
    .itube-tick {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 2px;
      height: 8px;
      border-radius: 1px;
      background: rgba(10, 10, 14, .55);
      pointer-events: none;
    }
    #itube-vol { width: 56px; flex: none; }
    #itube-preview {
      position: absolute;
      bottom: 24px;
      transform: translateX(-50%);
      display: none;
      pointer-events: none;
      z-index: 21;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, .25);
      overflow: hidden;
      background-color: #000;
      background-repeat: no-repeat;
    }
    #itube-preview .itube-ptime {
      position: absolute;
      bottom: 4px;
      left: 50%;
      transform: translateX(-50%);
      font: 600 11px -apple-system, system-ui, sans-serif;
      color: #fff;
      background: rgba(0, 0, 0, .6);
      padding: 1px 6px;
      border-radius: 6px;
    }
    #itube-live {
      width: auto !important;
      border-radius: 999px !important;
      padding: 0 10px !important;
      font-weight: 600;
    }
    #itube-live::before {
      content: '';
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #f33;
      margin-right: 5px;
    }
    #itube-live.behind { opacity: .55; }
    #itube-live.behind::before { background: #999; }
    #itube-menu {
      position: absolute;
      right: 10px;
      bottom: 100%;
      display: none;
      min-width: 208px;
      padding: 6px;
      z-index: 22;
      border-radius: 16px;
      background: rgba(18, 18, 24, .72);
      backdrop-filter: blur(22px) saturate(1.7);
      -webkit-backdrop-filter: blur(22px) saturate(1.7);
      border: 1px solid rgba(255, 255, 255, .17);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .22), 0 8px 32px rgba(0, 0, 0, .35);
    }
    .itube-menu-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 5px 8px;
      border-radius: 10px;
    }
    .itube-menu-row:hover { background: rgba(255, 255, 255, .08); }
    .itube-menu-row > span { opacity: .7; }
    #itube-menu select { min-width: 96px; }
    #itube-menu #itube-auto {
      width: auto;
      height: 22px;
      padding: 0 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, .12);
      font: 500 11px -apple-system, system-ui, sans-serif;
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

  const findNode = (root, pred) => {
    let found = null;
    walk(root, (node) => { if (!found && pred(node)) found = node; });
    return found;
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
  const extractVideos = (root, seen = seenVideoIds) => {
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

  const fmt = (s) => {
    if (!isFinite(s)) return 'LIVE';
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const mm = h ? String(m).padStart(2, '0') : m;
    return (h ? h + ':' : '') + mm + ':' + String(sec).padStart(2, '0');
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

  const createCompactCard = (item) => {
    const a = document.createElement('a');
    a.className = 'rc';
    a.href = '/watch?v=' + encodeURIComponent(item.id);
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'rc-thumb';
    const img = document.createElement('img');
    img.addEventListener('load', () => img.classList.add('in'), { once: true });
    img.addEventListener('error', () => img.classList.add('in'), { once: true });
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.src = item.thumb;
    thumbWrap.appendChild(img);
    if (item.duration) {
      const dur = document.createElement('span');
      dur.className = 'rc-dur';
      dur.textContent = item.duration;
      thumbWrap.appendChild(dur);
    }
    const body = document.createElement('div');
    body.className = 'rc-body';
    const title = document.createElement('h4');
    title.className = 'rc-title';
    title.textContent = item.title;
    const chan = document.createElement('div');
    chan.className = 'rc-chan';
    chan.textContent = item.channel || '';
    const meta = document.createElement('div');
    meta.className = 'rc-meta';
    meta.textContent = [item.views, item.published].filter(Boolean).join(' · ');
    body.append(title, chan, meta);
    a.append(thumbWrap, body);
    return a;
  };

  const root = document.createElement('div');
  root.id = 'itube';

  const header = document.createElement('header');
  header.className = 'hd';
  const wordmark = document.createElement('a');
  wordmark.className = 'wordmark';
  wordmark.href = '/';
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
    { key: 'home', label: 'Home', href: '/' },
    { key: 'subs', label: 'Subscriptions', href: '/feed/subscriptions' },
    { key: 'later', label: 'Watch later', href: '/playlist?list=WL' },
    { key: 'history', label: 'History', href: '/feed/history' },
  ];
  const navRows = {};
  for (const item of NAV_ITEMS) {
    const row = document.createElement('a');
    row.className = 'nav-row';
    row.href = item.href;
    const label = document.createElement('span');
    label.textContent = item.label;
    row.append(ICONS[item.key](), label);
    nav.appendChild(row);
    navRows[item.key] = row;
  }
  const syncNav = () => {
    navRows.home.classList.toggle('active', location.pathname === '/');
  };

  const content = document.createElement('div');
  content.className = 'content';
  const view = document.createElement('div');
  content.appendChild(view);

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

  const mountHome = () => {
    const grid = document.createElement('div');
    grid.className = 'grid';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.textContent = 'Loading…';
    const sentinel = document.createElement('div');
    sentinel.className = 'sentinel';
    grid.append(sentinel);

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

    view.replaceChildren(grid, spinner);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderInitial, { once: true });
    } else {
      renderInitial();
    }

    return () => { io.disconnect(); };
  };

  const player = () => document.getElementById('movie_player');

  const adoptVideo = (stage) => {
    const v = document.querySelector('#movie_player video');
    if (!v || v.parentElement === stage) return;
    stage.insertBefore(v, stage.firstChild);
    v.style.width = '100%';
    v.style.height = '100%';
    v.style.display = 'block';
    v.style.objectFit = 'contain';
  };

  const parseChapters = (data) => {
    try {
      for (const ep of data?.engagementPanels || []) {
        const c = ep.engagementPanelSectionListRenderer;
        if (!/macro|chapter/i.test(c?.targetId || '')) continue;
        const items = c.content?.macroMarkersListRenderer?.contents || [];
        return items.map((i) => {
          const t = i.macroMarkersListItemRenderer?.timeDescription?.simpleText || '';
          const parts = t.split(':').map(Number);
          return parts.length && !parts.some(isNaN)
            ? parts.reduce((a, b) => a * 60 + b, 0)
            : null;
        }).filter((v) => v !== null);
      }
    } catch (e) {}
    return [];
  };

  const parseStoryboard = (p) => {
    try {
      const spec = p.getPlayerResponse?.()?.storyboards?.playerStoryboardSpecRenderer?.spec;
      if (!spec) return null;
      const parts = spec.split('|');
      if (parts.length < 2) return null;
      const L = parts.length - 1;
      const sp = parts[L].split('#');
      if (sp.length < 8) return null;
      const [w, h, count, rows, cols, interval] = sp.slice(0, 6).map(Number);
      if (!w || !h || !count || !rows || !cols) return null;
      const url = parts[0].replace('$L', String(L - 1)).replace('$N', sp[6])
        + '&sigh=' + encodeURIComponent(sp[7]);
      return { url, w, h, count, rows, cols, interval };
    } catch (e) {
      return null;
    }
  };

  const el = (tag, id, child) => {
    const e = document.createElement(tag);
    if (id) e.id = id;
    if (typeof child === 'string') e.textContent = child;
    else if (child) e.appendChild(child);
    return e;
  };

  const buildBar = (stage) => {
    const bar = el('div', 'itube-bar');
    const prev = el('button', 'itube-prev', ICONS.prev());
    const next = el('button', 'itube-next', ICONS.next());
    const play = el('button', 'itube-play', ICONS.pause());
    const timeCur = el('span', null); timeCur.className = 'itube-time';
    const seek = el('input', 'itube-seek'); seek.type = 'range'; seek.min = 0; seek.max = 1000; seek.value = 0;
    const timeDur = el('span', null); timeDur.className = 'itube-time';
    const mute = el('button', 'itube-mute', ICONS.vol());
    const vol = el('input', 'itube-vol'); vol.type = 'range'; vol.min = 0; vol.max = 100;
    const speed = el('select', 'itube-speed');
    for (const s of SPEEDS) {
      const o = document.createElement('option');
      o.value = s; o.textContent = s + '×';
      speed.appendChild(o);
    }
    const quality = el('select', 'itube-quality');
    const cc = el('select', 'itube-cc');
    cc.appendChild(new Option('CC', ''));
    const auto = el('button', 'itube-auto', 'Auto');
    const pip = el('button', 'itube-pip', ICONS.pip());
    const fs = el('button', 'itube-fs', ICONS.fs());
    const seekwrap = el('div', 'itube-seekwrap');
    seekwrap.appendChild(seek);
    const preview = el('div', 'itube-preview');
    const ptime = el('span', null); ptime.className = 'itube-ptime';
    preview.appendChild(ptime);
    seekwrap.appendChild(preview);
    const live = el('button', 'itube-live', 'LIVE');
    live.style.display = 'none';
    const more = el('button', 'itube-more', ICONS.more());
    const menu = el('div', 'itube-menu');
    const left = el('div', 'itube-bar-left');
    const center = el('div', 'itube-bar-center');
    const right = el('div', 'itube-bar-right');
    const row = (label, control) => {
      const r = el('div');
      r.className = 'itube-menu-row';
      const s = el('span', null, label);
      r.append(s, control);
      return r;
    };
    menu.append(row('Speed', speed), row('Quality', quality), row('Captions', cc), row('Autoplay', auto));
    left.append(prev, play, next);
    center.append(timeCur, seekwrap, timeDur, live);
    right.append(mute, vol, more, pip, fs);
    bar.append(left, center, right, menu);
    stage.appendChild(bar);
    return {
      bar, prev, next, play, timeCur, seek, seekwrap, preview, ptime, timeDur, live, mute, vol,
      speed, quality, cc, auto, pip, fs, more, menu, left, right, scrubbing: false, isLive: false,
    };
  };

  const mountWatch = () => {
    const stage = el('div', 'itube-stage');
    const watch = document.createElement('div');
    watch.className = 'watch';
    const watchLeft = document.createElement('div');
    watchLeft.className = 'watch-left';
    const watchRight = document.createElement('div');
    watchRight.className = 'watch-right';

    const title = document.createElement('h1');
    title.className = 'watch-title';
    const channelRow = document.createElement('div');
    channelRow.className = 'watch-channel';
    const avatar = document.createElement('img');
    avatar.className = 'watch-avatar';
    const channelMeta = document.createElement('div');
    const channelName = document.createElement('div');
    channelName.className = 'watch-channel-name';
    const subs = document.createElement('div');
    subs.className = 'watch-subs';
    channelMeta.append(channelName, subs);
    channelRow.append(avatar, channelMeta);
    const desc = document.createElement('div');
    desc.className = 'watch-desc collapsed';
    const more = document.createElement('button');
    more.className = 'watch-more';
    more.textContent = 'more';
    let expanded = false;
    more.addEventListener('click', () => {
      expanded = !expanded;
      desc.classList.toggle('collapsed', !expanded);
      more.textContent = expanded ? 'less' : 'more';
    });

    watchLeft.append(stage, title, channelRow, desc, more);
    watch.append(watchLeft, watchRight);

    view.replaceChildren(watch);

    const renderMeta = () => {
      const data = window.ytInitialData;
      const details = window.ytInitialPlayerResponse?.videoDetails;
      title.textContent = details?.title || '';
      const primary = findNode(data, (n) => n?.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer;
      const secondary = findNode(data, (n) => n?.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer;
      const owner = secondary?.owner?.videoOwnerRenderer;
      channelName.textContent = owner?.title?.runs?.[0]?.text || details?.author || '';
      subs.textContent = owner?.subscriberCountText?.simpleText
        || owner?.subscriberCountText?.accessibility?.accessibilityData?.label
        || '';
      const avatarUrl = getThumb(owner);
      if (avatarUrl) avatar.src = avatarUrl;
      const viewsText = primary?.viewCount?.videoViewCountRenderer?.viewCount?.simpleText
        || (details?.viewCount ? details.viewCount + ' views' : '');
      const dateText = primary?.dateText?.simpleText || '';
      const descRuns = secondary?.attributedDescription?.content
        ? secondary.attributedDescription.content
        : (secondary?.description?.runs || []).map((r) => r?.text || '').join('');
      desc.textContent = [viewsText, dateText].filter(Boolean).join(' · ') + (descRuns ? '\n\n' + descRuns : '') || details?.shortDescription || '';

      const related = extractVideos(data, new Set());
      watchRight.replaceChildren();
      for (const item of related) watchRight.appendChild(createCompactCard(item));
    };
    renderMeta();

    let chapterSecs = parseChapters(window.ytInitialData);
    let storyboard = null;
    let ui = null;
    let wired = null;
    let lastVideoId = null;

    const renderTicks = () => {
      if (!ui) return;
      const video = wired;
      const dur = video?.duration;
      for (const t of ui.seekwrap.querySelectorAll('.itube-tick')) t.remove();
      if (!isFinite(dur) || !dur || chapterSecs.length < 2) return;
      for (const s of chapterSecs) {
        if (!s) continue;
        const t = document.createElement('div');
        t.className = 'itube-tick';
        t.style.left = (s / dur * 100) + '%';
        ui.seekwrap.appendChild(t);
      }
    };

    const updatePreview = (frac) => {
      const sb = storyboard;
      if (!sb || !ui || !wired || !isFinite(wired.duration) || !wired.duration) return;
      const t = frac * wired.duration;
      const per = sb.interval > 0 ? sb.interval : (wired.duration * 1000) / sb.count;
      const idx = Math.min(sb.count - 1, Math.floor((t * 1000) / per));
      const perSprite = sb.rows * sb.cols;
      const within = idx % perSprite;
      const src = sb.url.replace('$M', String(Math.floor(idx / perSprite)));
      if (ui.preview.dataset.src !== src) {
        ui.preview.dataset.src = src;
        ui.preview.style.backgroundImage = 'url("' + src + '")';
      }
      ui.preview.style.backgroundPosition =
        (-(within % sb.cols) * sb.w) + 'px ' + (-Math.floor(within / sb.cols) * sb.h) + 'px';
      ui.preview.style.left = (frac * 100) + '%';
      ui.ptime.textContent = fmt(t);
    };

    const paintSeek = (video) => {
      if (!ui || !isFinite(video.duration) || !video.duration) return;
      const played = video.currentTime / video.duration * 100;
      let buffered = 0;
      const b = video.buffered;
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) <= video.currentTime && video.currentTime <= b.end(i)) {
          buffered = b.end(i) / video.duration * 100;
          break;
        }
      }
      ui.seek.style.background = `linear-gradient(to right, rgba(255,255,255,.95) ${played}%, rgba(255,255,255,.4) ${played}%, rgba(255,255,255,.4) ${buffered}%, rgba(255,255,255,.16) ${buffered}%)`;
    };

    const populateQuality = (p) => {
      if (!ui) return;
      const levels = p.getAvailableQualityLevels?.() || [];
      const current = p.getPlaybackQuality?.();
      ui.quality.textContent = '';
      for (const q of levels) {
        const o = document.createElement('option');
        o.value = q;
        o.textContent = QUALITY_LABELS[q] || q;
        if (q === current) o.selected = true;
        ui.quality.appendChild(o);
      }
    };

    const populateTracks = (p) => {
      if (!ui || ui.cc.options.length > 1) return;
      const wasOn = p.isSubtitlesOn?.();
      if (!wasOn) p.toggleSubtitles?.();
      const tracks = p.getOption?.('captions', 'tracklist') || [];
      const cur = p.getOption?.('captions', 'track')?.languageCode || '';
      ui.cc.replaceChildren(new Option('CC off', ''));
      for (const t of tracks) {
        const o = new Option(t.displayName, t.languageCode, false, t.languageCode === cur);
        ui.cc.appendChild(o);
      }
      if (!wasOn) p.toggleSubtitles?.();
    };

    const wireBar = (p, video) => {
      const setMenu = (open) => { ui.menu.style.display = open ? 'block' : 'none'; };
      ui.menu.style.display = 'none';
      ui.more.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = ui.menu.style.display !== 'block';
        if (open) { populateQuality(p); populateTracks(p); ui.syncAuto?.(); }
        setMenu(open);
      });
      ui.menu.addEventListener('change', () => setMenu(false));
      ui.bar.addEventListener('mouseleave', (e) => {
        if (!ui.menu.contains(e.relatedTarget)) setMenu(false);
      });
      ui.live.addEventListener('click', () => {
        if (p.seekToLiveHead) p.seekToLiveHead();
        else if (isFinite(video.duration)) video.currentTime = video.duration - 2;
      });
      ui.syncAuto = () => {
        const b = document.querySelector('#movie_player .ytp-autonav-toggle-button');
        const r = ui.auto.closest('.itube-menu-row');
        if (r) r.style.display = b ? 'flex' : 'none';
        ui.auto.style.opacity = b?.getAttribute('aria-checked') === 'true' ? '1' : '.45';
      };
      ui.auto.addEventListener('click', () => {
        document.querySelector('#movie_player .ytp-autonav-toggle-button')?.click();
        setTimeout(ui.syncAuto, 300);
      });
      ui.syncAuto();

      ui.seekwrap.addEventListener('pointerenter', () => {
        if (storyboard && !ui.isLive) ui.preview.style.display = 'block';
      });
      ui.seekwrap.addEventListener('pointerleave', () => { ui.preview.style.display = 'none'; });
      ui.seekwrap.addEventListener('pointermove', (e) => {
        if (ui.preview.style.display === 'none') return;
        const rect = ui.seekwrap.getBoundingClientRect();
        updatePreview(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
      });

      ui.prev.addEventListener('click', () => p.previousVideo?.());
      ui.next.addEventListener('click', () => p.nextVideo?.());
      ui.play.addEventListener('click', () => { video.paused ? video.play() : video.pause(); });
      ui.seek.addEventListener('pointerdown', () => { ui.scrubbing = true; });
      ui.seek.addEventListener('change', () => {
        if (isFinite(video.duration)) video.currentTime = video.duration * ui.seek.value / 1000;
        ui.scrubbing = false;
      });
      ui.mute.addEventListener('click', () => { video.muted = !video.muted; });
      ui.vol.addEventListener('input', () => { video.muted = false; video.volume = ui.vol.value / 100; });
      ui.speed.addEventListener('change', () => { p.setPlaybackRate?.(Number(ui.speed.value)); });
      ui.quality.addEventListener('mousedown', () => populateQuality(p));
      ui.quality.addEventListener('change', () => {
        p.setPlaybackQualityRange?.(ui.quality.value, ui.quality.value);
        localStorage.setItem('itube-quality', ui.quality.value);
      });
      ui.cc.addEventListener('mousedown', () => populateTracks(p));
      ui.cc.addEventListener('change', () => {
        const on = p.isSubtitlesOn?.();
        if (!ui.cc.value) {
          if (on) p.toggleSubtitles?.();
          return;
        }
        if (!on) p.toggleSubtitles?.();
        setTimeout(() => p.setOption?.('captions', 'track', { languageCode: ui.cc.value }), 150);
      });
      ui.pip.addEventListener('click', () => {
        if (video.webkitSetPresentationMode) {
          video.webkitSetPresentationMode(video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
        } else if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        } else {
          video.requestPictureInPicture?.();
        }
      });
      ui.fs.addEventListener('click', () => {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage);
        }
      });

      let hideTimer = null;
      const showBar = () => {
        stage.classList.add('show');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          if (!video.paused && !ui.bar.matches(':hover') && ui.menu.style.display !== 'block') stage.classList.remove('show');
        }, 2800);
      };
      stage.addEventListener('mousemove', showBar, { passive: true });
      stage.addEventListener('mouseleave', () => {
        clearTimeout(hideTimer);
        if (!video.paused && ui.menu.style.display !== 'block') stage.classList.remove('show');
      }, { passive: true });

      video.addEventListener('play', () => { ui.play.replaceChildren(ICONS.pause()); showBar(); });
      video.addEventListener('pause', () => { ui.play.replaceChildren(ICONS.play()); showBar(); });
      video.addEventListener('timeupdate', () => {
        ui.timeCur.textContent = fmt(video.currentTime);
        if (!ui.scrubbing && isFinite(video.duration) && video.duration > 0) {
          ui.seek.value = Math.round(video.currentTime / video.duration * 1000);
        }
        if (ui.isLive) {
          ui.live.classList.toggle('behind', video.duration - video.currentTime > 12);
        }
        paintSeek(video);
      });
      video.addEventListener('durationchange', () => {
        ui.timeDur.textContent = fmt(video.duration);
        renderTicks();
      });
      video.addEventListener('progress', () => paintSeek(video));
      ui.play.replaceChildren(video.paused ? ICONS.play() : ICONS.pause());
      ui.timeCur.textContent = fmt(video.currentTime);
      ui.timeDur.textContent = fmt(video.duration);
      ui.vol.value = video.muted ? 0 : Math.round(video.volume * 100);
      populateQuality(p);
    };

    const onNavigateFinish = (e) => {
      const data = e.detail?.response?.response || e.detail?.response || window.ytInitialData;
      chapterSecs = parseChapters(data);
      renderMeta();
      renderTicks();
    };
    window.addEventListener('yt-navigate-finish', onNavigateFinish);

    const tick = () => {
      const video = document.querySelector('#movie_player video');
      const p = player();
      if (!video || !p) return;
      if (video.hasAttribute('controls')) video.removeAttribute('controls');
      if (video.disablePictureInPicture) video.disablePictureInPicture = false;
      adoptVideo(stage);
      if (!ui) {
        ui = buildBar(stage);
        wireBar(p, video);
      }

      const vid = p.getVideoData?.()?.video_id;
      if (vid && vid !== lastVideoId) {
        lastVideoId = vid;
        const saved = localStorage.getItem('itube-quality');
        if (saved && saved !== 'auto') p.setPlaybackQualityRange?.(saved, saved);
        populateQuality(p);
        if (saved) ui.quality.value = saved;
        ui.speed.value = String(p.getPlaybackRate?.() || 1);
        ui.prev.style.display = p.getPlaylist?.()?.length ? '' : 'none';
        ui.cc.replaceChildren(new Option('CC', ''));
        ui.syncAuto?.();
        ui.isLive = !!p.getVideoData?.()?.isLive;
        ui.live.style.display = ui.isLive ? '' : 'none';
        ui.timeDur.style.display = ui.isLive ? 'none' : '';
        storyboard = parseStoryboard(p);
        ui.preview.style.display = 'none';
        ui.preview.dataset.src = '';
        ui.menu.style.display = 'none';
        if (storyboard) {
          ui.preview.style.width = storyboard.w + 'px';
          ui.preview.style.height = storyboard.h + 'px';
        }
        renderTicks();
      }

      if (wired === video) return;
      wired = video;

      let ratio = 1;
      let syncTimer = null;
      let syncing = false;
      const measure = () => {
        const pv = p.getVolume?.();
        const ev = video.volume * 100;
        if (pv > 0 && ev > 1) ratio = ev / pv;
      };
      measure();
      video.addEventListener('volumechange', () => {
        if (ui) {
          ui.vol.value = video.muted ? 0 : Math.round(video.volume * 100);
          ui.mute.replaceChildren(video.muted ? ICONS.muted() : ICONS.vol());
        }
        if (syncing) return;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
          if (typeof p.setVolume !== 'function') return;
          syncing = true;
          const elVol = Math.round(video.volume * 100);
          try {
            if (video.muted) {
              p.mute?.();
              setTimeout(() => { syncing = false; }, 400);
              return;
            }
            p.unMute?.();
            p.setVolume(Math.max(1, Math.min(100, Math.round(elVol / ratio))));
            setTimeout(() => { measure(); syncing = false; }, 400);
          } catch (e) { syncing = false; }
        }, 300);
      });
    };
    tick();
    const timer = setInterval(tick, 500);

    const onKeydown = (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const video = wired;
      if (!video) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case 'j':
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'l':
          if (isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case 'ArrowLeft':
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'ArrowRight':
          if (isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.muted = false;
          video.volume = Math.min(1, video.volume + 0.05);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.muted = false;
          video.volume = Math.max(0, video.volume - 0.05);
          break;
        case 'm':
          video.muted = !video.muted;
          break;
        case 'f':
          ui?.fs.click();
          break;
        case 'c': {
          const p = player();
          p?.toggleSubtitles?.();
          break;
        }
        default:
          break;
      }
    };
    document.addEventListener('keydown', onKeydown);

    return () => {
      clearInterval(timer);
      document.removeEventListener('keydown', onKeydown);
      window.removeEventListener('yt-navigate-finish', onNavigateFinish);
    };
  };

  let cleanup = null;
  let currentRoute = null;
  const route = () => {
    const path = location.pathname;
    const next = path === '/watch' ? 'watch' : (path === '/' ? 'home' : null);
    if (!next || next === currentRoute) { syncNav(); return; }
    if (cleanup) { cleanup(); cleanup = null; }
    currentRoute = next;
    syncNav();
    cleanup = next === 'watch' ? mountWatch() : mountHome();
  };

  window.addEventListener('yt-navigate-finish', route);
  route();
})();
