// ==UserScript==
// @name         iTube
// @name:en      iTube
// @namespace    https://github.com/prvrtl/yt-lite-userscript
// @version      4.4.0
// @description  YouTube rebuilt as a native-feeling Mac app — our own UI and player, YouTube's data. Faster, calmer, no clutter.
// @description:en YouTube rebuilt as a native-feeling Mac app — our own UI and player, YouTube's data. Faster, calmer, no clutter.
// @author       prvrtl
// @license      MIT
// @homepageURL  https://prvrtl.github.io/yt-lite-userscript/
// @supportURL   https://github.com/prvrtl/yt-lite-userscript/issues
// @updateURL    https://raw.githubusercontent.com/prvrtl/yt-lite-userscript/main/itube.user.js
// @downloadURL  https://raw.githubusercontent.com/prvrtl/yt-lite-userscript/main/itube.user.js
// @icon         data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2214%22%20fill%3D%22%230a84ff%22%2F%3E%3Cpath%20d%3D%22M25%2020.5v23l19-11.5z%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fsvg%3E
// @match        https://www.youtube.com/*
// @exclude      https://www.youtube.com/embed/*
// @exclude      https://www.youtube.com/live_chat*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const CHANNEL_PATH_RE = /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)(?:\/.*)?$/;
  const FEED_BROWSE = {
    '/feed/subscriptions': { browseId: 'FEsubscriptions', heading: 'Subscriptions' },
    '/feed/history': { browseId: 'FEhistory', heading: 'Watch history' },
    '/feed/library': { browseId: 'FElibrary', heading: 'Library' },
    '/feed/playlists': { browseId: 'FEplaylists', heading: 'Playlists' },
    '/feed/trending': { browseId: 'FEtrending', heading: 'Trending' },
  };

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
  const THUMB_D = 'M6 13h4.6c.66 0 1.22-.47 1.33-1.12l.82-4.6A1.2 1.2 0 0 0 11.58 6H8.2l.46-2.62a1.1 1.1 0 0 0-1.98-.85L4.6 6.1V12a1 1 0 0 0 1 1z';
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
    seekFwd: () => icon([
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', d: 'M3.4 8a4.6 4.6 0 1 1 1.3 3.2' }],
      ['path', { fill: 'currentColor', d: 'M5.4 12.6 3.6 10.4 2 12.3z' }],
    ]),
    seekBack: () => icon([
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', d: 'M3.4 8a4.6 4.6 0 1 1 1.3 3.2', transform: 'translate(16,0) scale(-1,1)' }],
      ['path', { fill: 'currentColor', d: 'M5.4 12.6 3.6 10.4 2 12.3z', transform: 'translate(16,0) scale(-1,1)' }],
    ]),
    speed: () => icon([
      ['circle', { cx: '8', cy: '8', r: '5.9', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }],
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', d: 'M8 8 10.6 5.4' }],
    ]),
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
    chevron: () => icon([
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M4.5 6.2 8 9.7l3.5-3.5' }],
    ]),
    explore: () => icon([
      ['circle', { cx: '8', cy: '8', r: '5.9', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }],
      ['path', { fill: 'currentColor', d: 'M10.6 5.4 9.1 9.1 5.4 10.6 6.9 6.9z' }],
    ]),
    thumbsUp: () => icon([
      ['rect', { x: '1.6', y: '6', width: '2.2', height: '6.4', rx: '1', fill: 'currentColor' }],
      ['path', { fill: 'currentColor', d: THUMB_D }],
    ]),
    thumbsDown: () => icon([
      ['rect', { x: '1.6', y: '6', width: '2.2', height: '6.4', rx: '1', fill: 'currentColor', transform: 'translate(0,16) scale(1,-1)' }],
      ['path', { fill: 'currentColor', d: THUMB_D, transform: 'translate(0,16) scale(1,-1)' }],
    ]),
    save: () => icon([
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linejoin': 'round', d: 'M4 2.6h8v10.8l-4-2.8-4 2.8z' }],
    ]),
    share: () => icon([
      ['circle', { cx: '12', cy: '3.6', r: '1.7', fill: 'currentColor' }],
      ['circle', { cx: '12', cy: '12.4', r: '1.7', fill: 'currentColor' }],
      ['circle', { cx: '4', cy: '8', r: '1.7', fill: 'currentColor' }],
      ['path', { stroke: 'currentColor', 'stroke-width': '1.3', fill: 'none', d: 'M5.5 7.1 10.5 4.3M5.5 8.9l5 2.8' }],
    ]),
    check: () => icon([
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M3 8.3 6.3 11.6 13 4.5' }],
    ]),
  };

  const pillButton = (iconFn, label, className) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    if (className) btn.className = className;
    const iconEl = iconFn ? iconFn() : null;
    if (iconEl) btn.appendChild(iconEl);
    const labelEl = label === null ? null : document.createElement('span');
    if (labelEl) {
      labelEl.textContent = label;
      btn.appendChild(labelEl);
    }
    return { btn, icon: iconEl, label: labelEl };
  };

  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const MAX_COMMENTS = 50;
  const COMMENTS_PAGE = 20;
  const MAX_REPLIES = 10;
  const MAX_STORYBOARD_TRIES = 40;
  const WATCH_BOOT_TIMEOUT = 3000;
  const WATCH_LOAD_RETRY = 3000;
  const WATCH_RESUME_MS = 6000;
  const AD_BLANK_MAX_MS = 30000;
  const AD_RESTORE_MS = 8000;
  const QUALITY_LABELS = {
    highres: '4320p', hd2160: '2160p', hd1440: '1440p', hd1080: '1080p',
    hd720: '720p', large: '480p', medium: '360p', small: '240p', tiny: '144p',
    auto: 'Auto',
  };

  const CSS = `
    #itube {
      position: fixed;
      inset: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--ink);
      color: var(--text);
      font-family: -apple-system, system-ui, sans-serif;
      z-index: 9999;
      --ink: #0b0c10;
      --raised: #16181f;
      --text: #f2f3f5;
      --muted: #a2a7b3;
      --dim: #8b90a0;
      --accent: #0a84ff;
      --accent-solid: #0b6bd8;
      --hairline: rgba(255, 255, 255, .11);
      --surface: rgba(255, 255, 255, .045);
      --hover: rgba(255, 255, 255, .045);
      --r-xs: 8px;
      --r-sm: 12px;
      --r-md: 14px;
      --r-lg: 18px;
      --r-pill: 999px;
    }
    #itube a:focus-visible:not(.c):not(.row),
    #itube button:focus-visible,
    #itube input:focus-visible,
    #itube select:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    #itube .sidebar,
    #itube .content,
    #itube .watch-right {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, .18) transparent;
    }
    #itube .hd {
      flex: none;
      height: 52px;
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 0 24px;
      background: rgba(12, 12, 18, .72);
      backdrop-filter: blur(24px) saturate(1.7);
      -webkit-backdrop-filter: blur(24px) saturate(1.7);
      border-bottom: 1px solid var(--hairline);
    }
    #itube .hd-left {
      flex: 0 0 200px;
      display: flex;
      align-items: center;
    }
    #itube .search-wrap {
      position: relative;
      flex: 1 1 auto;
      max-width: 560px;
      margin: 0 auto;
    }
    #itube .search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--muted);
      pointer-events: none;
    }
    #itube .search {
      width: 100%;
      height: 34px;
      border-radius: var(--r-xs);
      background: var(--surface);
      border: 1px solid var(--hairline);
      color: var(--text);
      padding: 0 16px 0 40px;
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
    }
    #itube .search:focus {
      border: 2px solid var(--accent);
    }
    #itube .hd-right {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 96px;
      justify-content: flex-end;
    }
    #itube .hd-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--raised);
      flex: none;
    }
    #itube .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 38px;
      text-decoration: none;
      color: var(--text);
    }
    #itube .brand-tile {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
    }
    #itube .brand-word {
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -.01em;
    }
    #itube .body {
      display: flex;
      width: 100%;
      height: calc(100vh - 52px);
      box-sizing: border-box;
    }
    #itube .sidebar {
      width: 200px;
      flex: none;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 4px;
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      padding: 12px 8px 16px 12px;
    }
    #itube .nav-row {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 40px;
      flex: none;
      padding: 0 12px;
      border-radius: var(--r-xs);
      color: var(--text);
      text-decoration: none;
      font-size: 14px;
    }
    #itube .nav-row:hover {
      background: var(--hover);
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
    #itube .nav-section-label {
      flex: none;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--dim);
      margin: 20px 12px 8px;
    }
    #itube .nav-chan {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 32px;
      flex: none;
      padding: 4px 12px;
      border-radius: var(--r-xs);
      color: var(--text);
      text-decoration: none;
      font-size: 13px;
    }
    #itube .nav-chan span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #itube .nav-chan:hover {
      background: var(--hover);
    }
    #itube .nav-chan-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      object-fit: cover;
      background: var(--raised);
      flex: none;
    }
    #itube .content {
      flex: 1;
      min-width: 0;
      height: 100%;
      box-sizing: border-box;
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      padding: 24px;
    }
    #itube .content > * {
      width: 100%;
    }
    #itube .section-heading {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -.01em;
      margin: 0 0 16px;
    }
    #itube .page-heading {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -.02em;
      margin: 0 0 20px;
    }
    #itube .search-label {
      font-size: 13px;
      color: var(--dim);
      margin-bottom: 2px;
    }
    #itube .search-query {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -.02em;
      margin: 0 0 20px;
    }
    #itube .search-filters {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0 0 16px;
    }
    #itube .search-filter-select {
      -webkit-appearance: none;
      appearance: none;
      height: 32px;
      padding: 0 12px;
      border-radius: var(--r-pill);
      background: var(--surface);
      border: 1px solid var(--hairline);
      color: var(--text);
      font: 500 13px -apple-system, system-ui, sans-serif;
      cursor: pointer;
    }
    #itube .unhandled {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 16px;
      padding: 48px 24px;
      min-height: 60vh;
      color: var(--muted);
      font-size: 15px;
    }
    #itube .unhandled-home {
      background: var(--accent-solid);
      color: #fff;
      border-radius: 10px;
      padding: 8px 20px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
    }
    #itube .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 24px 16px;
      align-items: start;
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
      position: relative;
      color: var(--text);
      text-decoration: none;
      content-visibility: auto;
      contain-intrinsic-size: auto 250px;
      contain: layout paint style;
      padding: 8px;
      margin: -8px;
      border-radius: 14px;
    }
    #itube .c:hover {
      background: var(--hover);
    }
    #itube .c-link,
    #itube .rc-link,
    #itube .row-link {
      position: absolute;
      inset: 0;
      z-index: 1;
    }
    #itube a.c-chan,
    #itube a.rc-chan,
    #itube a.row-chan {
      text-decoration: none;
      cursor: pointer;
    }
    #itube .c-chan,
    #itube .rc-chan,
    #itube .row-chan {
      position: relative;
      z-index: 2;
      width: fit-content;
      max-width: 100%;
    }
    #itube a.c-chan:hover,
    #itube a.rc-chan:hover,
    #itube a.row-chan:hover {
      color: var(--text);
    }
    #itube a.comment-author,
    #itube .comment-avatar-link {
      color: inherit;
      text-decoration: none;
      cursor: pointer;
    }
    #itube .comment-avatar-link {
      display: block;
      flex: none;
      border-radius: 50%;
    }
    #itube a.comment-author:hover {
      color: var(--accent);
    }
    #itube .c:hover .c-thumb img {
      filter: brightness(1.06);
    }
    #itube .c-thumb {
      aspect-ratio: 16 / 9;
      border-radius: var(--r-sm);
      overflow: hidden;
      background: var(--raised);
      position: relative;
    }
    #itube .c-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      opacity: 0;
    }
    #itube .c-thumb img.in,
    #itube .rc-thumb img.in,
    #itube .row-thumb img.in,
    #itube .comment-avatar.in,
    #itube .ch-banner.in,
    #itube .ch-avatar.in {
      opacity: 1;
      transition: opacity .18s ease-out;
    }
    #itube .c-progress {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 3px;
      background: rgba(255, 255, 255, .25);
    }
    #itube .c-progress-fill {
      height: 100%;
      background: var(--accent);
    }
    #itube .c-dur,
    #itube .rc-dur,
    #itube .row-dur {
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
      display: grid;
      grid-template-columns: minmax(0, 1fr) clamp(340px, 24vw, 460px);
      gap: 24px;
      align-items: start;
    }
    #itube .watch-left {
      min-width: 0;
    }
    #itube .watch-right {
      position: sticky;
      top: 0;
      max-height: calc(100vh - 100px);
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    #itube .watch-right > *,
    #itube .queue-wrap > *,
    #itube .related-wrap > * {
      max-width: 100%;
      box-sizing: border-box;
    }
    #itube .watch-right::-webkit-scrollbar {
      width: 6px;
    }
    #itube .watch-right::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, .15);
      border-radius: 3px;
    }
    #itube .queue-wrap,
    #itube .related-wrap {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    #itube .queue-wrap:empty,
    #itube .related-wrap:empty {
      display: none;
    }
    #itube .queue-panel {
      background: var(--surface);
      border-radius: var(--r-md);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    #itube .queue-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    #itube .queue-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -.01em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #itube .queue-count {
      flex: none;
      font-size: 12.5px;
      color: var(--dim);
      font-variant-numeric: tabular-nums;
    }
    #itube .queue-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 360px;
      overflow-y: auto;
    }
    #itube .queue-item.current {
      box-shadow: inset 3px 0 0 var(--accent);
    }
    #itube .queue-item.current .rc-title {
      color: var(--accent);
    }
    #itube-stage {
      position: relative;
      overflow: hidden;
      border-radius: var(--r-lg);
      background: #000;
      aspect-ratio: 16 / 9;
      width: 100%;
    }
    #itube-stage.ad video {
      opacity: 0;
    }
    #itube-stage video {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      height: 100% !important;
      display: block !important;
      object-fit: contain !important;
      max-width: none !important;
    }
    #itube-stage .ytp-caption-window-container {
      position: absolute !important;
      left: 0 !important;
      right: 0 !important;
      top: auto !important;
      bottom: 76px !important;
      width: auto !important;
      height: auto !important;
      display: flex !important;
      justify-content: center !important;
      padding: 0 24px;
      pointer-events: none !important;
      z-index: 10;
    }
    #itube-stage .caption-window {
      position: static !important;
      transform: none !important;
      width: auto !important;
      height: auto !important;
      max-width: 84% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: none !important;
      text-align: center;
    }
    #itube-stage .ytp-caption-segment {
      display: inline !important;
      background: rgba(10, 10, 14, .74) !important;
      color: #fff !important;
      font: 600 clamp(14px, 1.5vw, 21px)/1.55 -apple-system, system-ui, sans-serif !important;
      text-shadow: none !important;
      padding: 3px 8px !important;
      border-radius: 7px !important;
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
    }
    #itube .watch-title {
      margin: 16px 0 0;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -.02em;
    }
    #itube .watch-meta {
      margin-top: 14px;
      background: var(--surface);
      border-radius: var(--r-md);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    #itube .watch-channel {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    #itube .watch-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      background: var(--raised);
      flex: none;
      display: block;
    }
    #itube .watch-avatar-link {
      flex: none;
      display: block;
      border-radius: 50%;
    }
    #itube .watch-channel-info {
      flex: none;
      min-width: 0;
    }
    #itube .watch-channel-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      text-decoration: none;
      display: block;
      width: fit-content;
    }
    #itube a.watch-channel-name[href]:hover {
      color: var(--accent);
    }
    #itube a.watch-avatar-link[href],
    #itube a.watch-channel-name[href] {
      cursor: pointer;
    }
    #itube .watch-subs {
      font-size: 12.5px;
      color: var(--dim);
      margin-top: 2px;
    }
    #itube .watch-channel-spacer {
      flex: 1;
      min-width: 12px;
    }
    #itube .watch-actions {
      display: flex;
      align-items: center;
      flex: none;
      gap: 8px;
    }
    #itube .watch-action-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 14px;
      background: var(--surface);
      border: 1px solid var(--hairline);
      border-radius: var(--r-pill);
      color: var(--text);
      font: 500 13px -apple-system, system-ui, sans-serif;
      cursor: pointer;
    }
    #itube .watch-action-btn:hover {
      background: rgba(255, 255, 255, .08);
    }
    #itube .watch-action-btn:disabled {
      opacity: .4;
      cursor: default;
    }
    #itube .watch-action-btn:disabled:hover {
      background: var(--surface);
    }
    #itube .watch-action-btn.active {
      background: rgba(10, 132, 255, .16);
      border-color: transparent;
      color: var(--accent);
    }
    #itube .watch-likes {
      display: flex;
      align-items: center;
      height: 34px;
      background: var(--surface);
      border: 1px solid var(--hairline);
      border-radius: var(--r-pill);
      overflow: hidden;
    }
    #itube .watch-like-btn,
    #itube .watch-dislike-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 100%;
      padding: 0 14px;
      background: none;
      border: none;
      color: var(--text);
      font: 500 13px -apple-system, system-ui, sans-serif;
      cursor: pointer;
    }
    #itube .watch-like-btn:hover,
    #itube .watch-dislike-btn:hover {
      background: rgba(255, 255, 255, .08);
    }
    #itube .watch-like-btn:disabled,
    #itube .watch-dislike-btn:disabled {
      opacity: .4;
      cursor: default;
    }
    #itube .watch-like-btn.active,
    #itube .watch-dislike-btn.active {
      background: rgba(10, 132, 255, .16);
      color: var(--accent);
    }
    #itube .watch-like-divider {
      width: 1px;
      height: 18px;
      background: var(--hairline);
      flex: none;
    }
    #itube .watch-subscribe {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 16px;
      background: var(--accent-solid);
      border: none;
      border-radius: var(--r-pill);
      color: #fff;
      font: 600 13px -apple-system, system-ui, sans-serif;
      cursor: pointer;
    }
    #itube .watch-subscribe:disabled {
      opacity: .4;
      cursor: default;
    }
    #itube .watch-subscribe.subscribed {
      background: var(--surface);
      border: 1px solid var(--hairline);
      color: var(--text);
    }
    #itube .watch-subscribe.subscribed:hover {
      background: rgba(255, 255, 255, .08);
    }
    #itube .watch-meta-divider {
      height: 1px;
      background: rgba(255, 255, 255, .08);
    }
    #itube .watch-stats {
      font-size: 13px;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    #itube .watch-description {
      font-size: 14px;
      line-height: 1.5;
      color: var(--text);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    #itube .watch-description.expanded {
      display: block;
      -webkit-line-clamp: unset;
      overflow: visible;
    }
    #itube .watch-desc-link {
      color: var(--accent);
    }
    #itube .watch-desc-toggle {
      align-self: flex-start;
      background: none;
      border: none;
      color: var(--accent);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
    }
    #itube .comments {
      margin-top: 24px;
    }
    #itube .comments-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    #itube .comments-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
      background: none;
      border: none;
      color: var(--text);
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -.01em;
      padding: 0;
      cursor: pointer;
      text-align: left;
    }
    #itube .comments-toggle:disabled {
      cursor: default;
      color: var(--muted);
    }
    #itube .comments-toggle svg {
      flex: none;
      color: var(--muted);
    }
    #itube .comments-toggle svg.open {
      transform: rotate(180deg);
    }
    #itube .comments-sort {
      display: none;
      align-items: center;
      gap: 6px;
      flex: none;
    }
    #itube .comments-sort-btn {
      height: 28px;
      padding: 0 12px;
      border-radius: var(--r-pill);
      background: var(--surface);
      border: 1px solid var(--hairline);
      color: var(--muted);
      font: 500 12.5px -apple-system, system-ui, sans-serif;
      cursor: pointer;
    }
    #itube .comments-sort-btn.active {
      background: rgba(10, 132, 255, .16);
      border-color: transparent;
      color: var(--accent);
    }
    #itube .comments-body {
      margin-top: 12px;
    }
    #itube .comments-body.collapsed {
      display: none;
    }
    #itube .comments-list {
      display: flex;
      flex-direction: column;
    }
    #itube .comment-row {
      display: flex;
      gap: 12px;
      padding: 14px 0;
      content-visibility: auto;
      contain-intrinsic-size: auto 90px;
      contain: layout paint style;
    }
    #itube .comment-row + .comment-row {
      border-top: 1px solid rgba(255, 255, 255, .07);
    }
    #itube .comment-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      background: var(--raised);
      flex: none;
      opacity: 0;
    }
    #itube .comment-body {
      flex: 1;
      min-width: 0;
    }
    #itube .comment-head {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    #itube .comment-author {
      font-size: 13px;
      font-weight: 600;
    }
    #itube .comment-time {
      font-size: 12.5px;
      color: var(--dim);
    }
    #itube .comment-text {
      margin-top: 4px;
      font-size: 14px;
      line-height: 1.4;
      white-space: pre-wrap;
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    #itube .comment-text.expanded {
      display: block;
      -webkit-line-clamp: unset;
    }
    #itube .comment-showmore {
      display: none;
      margin-top: 4px;
      background: none;
      border: none;
      color: var(--muted);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
    }
    #itube .comment-likes {
      margin-top: 6px;
      font-size: 12.5px;
      color: var(--dim);
    }
    #itube .comment-replies-btn {
      display: block;
      margin-top: 8px;
      background: none;
      border: none;
      color: var(--accent);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
    }
    #itube .comment-replies {
      margin-top: 10px;
      margin-left: 24px;
      display: flex;
      flex-direction: column;
    }
    #itube .comments-more {
      display: block;
      margin-top: 4px;
      background: none;
      border: none;
      color: var(--muted);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      padding: 12px 0 0;
    }
    #itube .comments-spinner {
      display: none;
      justify-content: center;
      padding: 16px 0;
      color: var(--muted);
      font-size: 13px;
    }
    #itube .comments-spinner.show {
      display: flex;
    }
    #itube .comments-empty {
      color: var(--muted);
      text-align: center;
      padding: 24px 0;
      font-size: 14px;
    }
    #itube .rc {
      display: flex;
      position: relative;
      gap: 10px;
      text-decoration: none;
      color: var(--text);
      padding: 6px;
      border-radius: var(--r-sm);
    }
    #itube .rc:hover {
      background: var(--hover);
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
    #itube .list {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    #itube .row {
      display: flex;
      position: relative;
      gap: 16px;
      color: var(--text);
      text-decoration: none;
      content-visibility: auto;
      contain-intrinsic-size: auto 138px;
      contain: layout paint style;
      padding: 8px;
      margin: -8px;
      border-radius: 14px;
    }
    #itube .row:hover {
      background: var(--hover);
    }
    #itube .row:hover .row-thumb img {
      filter: brightness(1.06);
    }
    #itube .c-link:focus-visible ~ .c-thumb,
    #itube .row-link:focus-visible ~ .row-thumb {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    #itube .row-thumb {
      width: 246px;
      height: 138px;
      flex: 0 0 246px;
      border-radius: 12px;
      overflow: hidden;
      background: var(--raised);
      position: relative;
    }
    #itube .row-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      opacity: 0;
    }
    #itube .row-body {
      flex: 1;
      min-width: 0;
    }
    #itube .row-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -.01em;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    #itube .row-chan {
      margin-top: 6px;
      font-size: 13px;
      color: var(--muted);
    }
    #itube .row-meta {
      margin-top: 2px;
      font-size: 12.5px;
      color: var(--dim);
      font-variant-numeric: tabular-nums;
    }
    #itube .row-desc {
      margin-top: 8px;
      font-size: 13px;
      color: var(--dim);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    #itube .empty {
      grid-column: 1 / -1;
      color: var(--muted);
      text-align: center;
      padding: 48px 0;
      font-size: 14px;
    }
    #itube .signin-state {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px 16px;
      text-align: center;
    }
    #itube .signin-title {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -.01em;
      color: var(--text);
    }
    #itube .signin-message {
      font-size: 14px;
      color: var(--muted);
      max-width: 420px;
    }
    #itube .signin-btn {
      display: flex;
      align-items: center;
      height: 34px;
      padding: 0 16px;
      border-radius: var(--r-pill);
      background: rgba(10, 132, 255, .16);
      color: var(--accent);
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }
    #itube .signin-btn:hover {
      background: rgba(10, 132, 255, .24);
    }
    #itube .hd-signin {
      display: flex;
      align-items: center;
      height: 28px;
      padding: 0 12px;
      border-radius: var(--r-pill);
      background: rgba(10, 132, 255, .16);
      color: var(--accent);
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      flex: none;
    }
    #itube .hd-signin:hover {
      background: rgba(10, 132, 255, .24);
    }
    #itube .watch-signin-hint {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: var(--muted);
    }
    #itube .ch-header {
      margin-bottom: 24px;
    }
    #itube .ch-banner {
      display: block;
      width: 100%;
      height: 160px;
      object-fit: cover;
      border-radius: var(--r-md);
      opacity: 0;
    }
    #itube .ch-avatar {
      width: 80px;
      height: 80px;
      border-radius: var(--r-lg);
      object-fit: cover;
      background: var(--raised);
      border: 3px solid var(--ink);
      margin-top: -24px;
      opacity: 0;
      position: relative;
    }
    #itube .ch-title-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    #itube .ch-title-col {
      flex: 1;
      min-width: 0;
    }
    #itube .ch-name {
      margin: 12px 0 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -.02em;
    }
    #itube .ch-meta {
      margin-top: 4px;
      font-size: 13px;
      color: var(--muted);
    }
    #itube .ch-tabs {
      display: flex;
      gap: 20px;
      margin-top: 20px;
      border-bottom: 1px solid var(--hairline);
    }
    #itube .ch-tab {
      background: none;
      border: none;
      color: var(--muted);
      font-size: 14px;
      font-weight: 500;
      padding: 0 2px 10px;
      cursor: pointer;
      position: relative;
    }
    #itube .ch-tab.active {
      color: var(--text);
      font-weight: 600;
    }
    #itube .ch-tab.active::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 2px;
      background: var(--accent);
      border-radius: var(--r-pill);
    }
    #itube-bar {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      box-sizing: border-box;
      z-index: 20;
      display: grid;
      grid-template-areas: 'seek seek seek' 'left center right';
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 8px 12px;
      padding: 12px 16px 14px;
      border-radius: 0 0 var(--r-lg) var(--r-lg);
      background: linear-gradient(to top, rgba(10, 10, 14, .78), rgba(10, 10, 14, .40) 62%, rgba(10, 10, 14, 0));
      backdrop-filter: blur(14px) saturate(1.4);
      -webkit-backdrop-filter: blur(14px) saturate(1.4);
      border: none;
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
    #itube-cue {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      min-width: 64px;
      border-radius: 16px;
      background: rgba(18, 18, 24, .62);
      backdrop-filter: blur(16px) saturate(1.5);
      -webkit-backdrop-filter: blur(16px) saturate(1.5);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px 16px;
      color: #fff;
      font: 600 14px -apple-system, system-ui, sans-serif;
      z-index: 25;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    #itube-cue.show {
      opacity: 1;
      visibility: visible;
    }
    #itube-cue svg {
      width: 22px;
      height: 22px;
    }
    #itube-bar-left,
    #itube-bar-right {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    #itube-bar-left { grid-area: left; justify-content: flex-start; }
    #itube-bar-right { grid-area: right; justify-content: flex-end; }
    #itube-bar-center {
      grid-area: center;
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    #itube-seekwrap {
      grid-area: seek;
      width: 100%;
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
    #itube-menu #itube-auto.active {
      background: rgba(10, 132, 255, .3);
      color: #fff;
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

  const loggedOut = () => cfg()?.LOGGED_IN === false;

  const sapisidHash = async () => {
    const m = document.cookie.match(/(?:^|;\s*)(?:__Secure-3PAPISID|SAPISID)=([^;]+)/);
    if (!m) return null;
    const ts = Math.floor(Date.now() / 1000);
    const origin = 'https://www.youtube.com';
    const data = ts + ' ' + m[1] + ' ' + origin;
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(data));
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return 'SAPISIDHASH ' + ts + '_' + hex;
  };

  const innertube = async (endpoint, body) => {
    const c = cfg();
    if (!c?.INNERTUBE_API_KEY) {
      console.warn('[itube] no INNERTUBE_API_KEY for', endpoint);
      return null;
    }
    try {
      const headers = {
        'content-type': 'application/json',
        'x-origin': 'https://www.youtube.com',
        'x-goog-authuser': '0',
      };
      const auth = await sapisidHash();
      if (auth) headers.authorization = auth;
      const res = await fetch('/youtubei/v1/' + endpoint + '?key=' + c.INNERTUBE_API_KEY + '&prettyPrint=false', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ context: c.INNERTUBE_CONTEXT, ...body }),
      });
      if (!res.ok) {
        console.warn('[itube] innertube ' + endpoint + ' failed: HTTP ' + res.status);
        return null;
      }
      return await res.json();
    } catch (e) {
      console.warn('[itube] innertube ' + endpoint + ' threw', e);
      return null;
    }
  };

  const AD_KEYS = new Set([
    'searchPyvRenderer',
    'promotedSparklesWebRenderer',
    'promotedSparklesTextSearchRenderer',
    'promotedVideoRenderer',
    'compactPromotedVideoRenderer',
    'compactPromotedItemRenderer',
    'displayAdRenderer',
    'statementBannerRenderer',
    'bannerPromoRenderer',
    'bannerPromoRendererWithContext',
    'carouselAdRenderer',
    'brandVideoShelfRenderer',
    'brandVideoSingletonRenderer',
    'mastheadAdRenderer',
    'mastheadAdV3Renderer',
    'videoMastheadAdV3Renderer',
    'primetimePromoRenderer',
    'playerLegacyDesktopWatchAdsRenderer',
    'featuredProductsCarouselViewModel',
  ]);

  const AD_KEY_RE = /^(ads?|promoted)[A-Z]|Ad(Slot|Layout|Break|Placement)|AdRenderer$|PyvRenderer$/;

  const isAdKey = (key) => AD_KEYS.has(key) || AD_KEY_RE.test(key);

  const walk = (node, visit) => {
    if (!node || typeof node !== 'object') return;
    visit(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, visit);
    } else {
      for (const key in node) {
        if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
        if (isAdKey(key)) continue;
        walk(node[key], visit);
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

  const channelHrefFrom = (endpoint) => {
    const cmd = endpoint?.innertubeCommand || endpoint;
    const browse = cmd?.browseEndpoint;
    if (!browse) return null;
    const base = browse.canonicalBaseUrl;
    if (typeof base === 'string' && base.startsWith('/')) return base;
    const url = cmd?.commandMetadata?.webCommandMetadata?.url;
    if (typeof url === 'string' && url.startsWith('/')) return url;
    const id = browse.browseId;
    return typeof id === 'string' && id.startsWith('UC') ? '/channel/' + id : null;
  };

  const getChannelHref = (node) => channelHrefFrom(
    node?.longBylineText?.runs?.[0]?.navigationEndpoint
    || node?.shortBylineText?.runs?.[0]?.navigationEndpoint
    || node?.ownerText?.runs?.[0]?.navigationEndpoint
    || node?.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.navigationEndpoint
  );

  const handleFromHref = (href) => (typeof href === 'string' && href.startsWith('/@') ? href.slice(1) : '');

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

  const resolveVideoId = () => (
    new URLSearchParams(location.search).get('v')
    || player()?.getVideoData?.()?.video_id
    || null
  );

  const seekPlayerTo = (seconds) => {
    const p = player();
    if (p?.seekTo) {
      p.seekTo(seconds, true);
      return true;
    }
    const video = document.querySelector('#movie_player video');
    if (video) {
      video.currentTime = seconds;
      return true;
    }
    return false;
  };

  const resolveOwnerChannelId = (data, details) => {
    const owner = findNode(data, (n) => n?.videoOwnerRenderer)?.videoOwnerRenderer;
    const fromOwner = owner?.navigationEndpoint?.browseEndpoint?.browseId;
    if (fromOwner) return fromOwner;
    return details?.channelId || null;
  };

  const readLikeState = (data) => {
    const seg = findNode(data, (n) => n?.segmentedLikeDislikeButtonViewModel)?.segmentedLikeDislikeButtonViewModel;
    if (seg) {
      const likeVM = seg.likeButtonViewModel?.likeButtonViewModel?.toggleButtonViewModel?.toggleButtonViewModel;
      const dislikeVM = seg.dislikeButtonViewModel?.dislikeButtonViewModel?.toggleButtonViewModel?.toggleButtonViewModel;
      const liked = !!likeVM?.isToggled;
      const disliked = !!dislikeVM?.isToggled;
      const likeCountText = likeVM?.defaultButtonViewModel?.buttonViewModel?.title || null;
      return { liked, disliked, likeCountText };
    }
    const buttons = findNode(data, (n) => Array.isArray(n?.topLevelButtons))?.topLevelButtons;
    let liked = false;
    let disliked = false;
    let likeCountText = null;
    if (Array.isArray(buttons)) {
      for (const b of buttons) {
        const t = b?.toggleButtonRenderer;
        if (!t) continue;
        const iconType = t?.icon?.iconType || '';
        const label = t?.defaultText?.accessibility?.accessibilityData?.label || t?.defaultText?.simpleText || '';
        const isDislike = iconType === 'DISLIKE' || /dislike/i.test(label);
        const isLike = !isDislike && (iconType === 'LIKE' || /like/i.test(label));
        if (isDislike) {
          disliked = !!t.isToggled;
        } else if (isLike) {
          liked = !!t.isToggled;
          likeCountText = t?.defaultText?.simpleText || null;
        }
      }
    }
    return { liked, disliked, likeCountText };
  };

  const runsText = (node) => (
    node?.simpleText
    || (Array.isArray(node?.runs) ? node.runs.map((r) => r?.text || '').join('') : '')
    || node?.content
    || ''
  );

  const needsSignIn = (node) => !!findNode(node, (n) => n.signInEndpoint || n.openPopupAction);

  const feedSignInPrompt = (res) => {
    if (!res) return null;
    const promo = findNode(res, (n) => n?.backgroundPromoRenderer)?.backgroundPromoRenderer;
    if (promo && needsSignIn(promo)) {
      return { title: runsText(promo.title), message: runsText(promo.bodyText) };
    }
    const message = findNode(res, (n) => n?.messageRenderer)?.messageRenderer;
    if (message && needsSignIn(message)) {
      return { title: runsText(message.text), message: '' };
    }
    return null;
  };

  const feedNudgePrompt = (res) => {
    const nudge = findNode(res, (n) => n?.feedNudgeRenderer)?.feedNudgeRenderer;
    if (!nudge) return null;
    return { title: runsText(nudge.title), message: runsText(nudge.subtitle) };
  };

  const mutationConfirmed = (res, check) => {
    if (!res || res.error) return false;
    let blocked = false;
    let ok = false;
    walk(res, (n) => {
      if (n.openPopupAction || n.signInEndpoint || n.signalServiceEndpoint?.signal === 'CLIENT_SIGNAL') blocked = true;
      if (check(n)) ok = true;
    });
    return ok && !blocked;
  };

  const likeConfirmed = (res) => mutationConfirmed(res, () => true);

  const subscribeConfirmed = (res, want) => mutationConfirmed(res, (n) => {
    const u = n.updateSubscribeButtonAction;
    return !!u && typeof u.subscribed === 'boolean' && u.subscribed === want;
  });

  const playlistEditConfirmed = (res) => !!res && !res.error && res.status === 'STATUS_SUCCEEDED';

  const readSubscribedState = (data) => {
    const legacy = findNode(data, (n) => n?.subscribeButtonRenderer)?.subscribeButtonRenderer;
    if (legacy) return !!legacy.subscribed;
    const vm = findNode(data, (n) => n?.subscribeButtonViewModel)?.subscribeButtonViewModel;
    if (vm) return !!vm.subscribed;
    return false;
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

  const getSnippet = (node) => (
    node?.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r) => r?.text || '').join('')
    || node?.descriptionSnippet?.runs?.map((r) => r?.text || '').join('')
    || null
  );

  const lockupItem = (node, seen) => {
    const lk = node.lockupViewModel;
    if (!lk || lk.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO') return null;
    const id = lk.contentId;
    if (typeof id !== 'string' || !id || seen.has(id)) return null;
    const meta = lk.metadata?.lockupMetadataViewModel;
    const title = meta?.title?.content;
    const img = lk.contentImage?.thumbnailViewModel;
    const sources = img?.image?.sources || [];
    const thumb = sources.length ? sources[sources.length - 1].url : null;
    if (!title || !thumb) return null;
    const texts = [];
    walk(img?.overlays, (n) => {
      if (typeof n.text === 'string') texts.push(n.text);
    });
    const rows = [];
    walk(meta?.metadata, (n) => {
      if (typeof n.content === 'string') rows.push(n.content);
    });
    const rest = rows.filter((t) => t !== title);
    seen.add(id);
    return {
      id,
      title,
      channel: rest.find((t) => !/views?|ago|watching/i.test(t)) || '',
      channelHref: channelHrefFrom(meta?.image?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap)
        || channelHrefFrom(findNode(meta?.image?.avatarStackViewModel, (n) => n?.browseEndpoint)),
      thumb,
      duration: texts.find((t) => /^\d+:\d\d/.test(t)) || '',
      views: rest.find((t) => /views?|watching/i.test(t)) || '',
      published: rest.find((t) => /ago/i.test(t)) || '',
      snippet: '',
    };
  };

  const extractVideos = (root, seen) => {
    const out = [];
    walk(root, (node) => {
      const lk = lockupItem(node, seen);
      if (lk) {
        out.push(lk);
        return;
      }
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
        channelHref: getChannelHref(node),
        thumb,
        duration: getDuration(node),
        views: getViews(node),
        published: getPublished(node),
        snippet: getSnippet(node),
      });
    });
    return out;
  };

  const getResumePercent = (node) => {
    const overlays = node?.thumbnailOverlays;
    if (Array.isArray(overlays)) {
      for (const o of overlays) {
        const p = o?.thumbnailOverlayResumePlaybackRenderer?.percentDurationWatched;
        if (typeof p === 'number') return p;
      }
    }
    return null;
  };

  const extractResumeItems = (root, seen) => {
    const out = [];
    walk(root, (node) => {
      if (typeof node.videoId !== 'string' || !node.videoId || seen.has(node.videoId)) return;
      const percent = getResumePercent(node);
      if (percent == null) return;
      const title = getTitle(node);
      if (!title) return;
      const thumb = getThumb(node);
      if (!thumb) return;
      seen.add(node.videoId);
      out.push({
        id: node.videoId,
        title,
        channel: getChannel(node),
        channelHref: getChannelHref(node),
        thumb,
        duration: getDuration(node),
        views: getViews(node),
        published: getPublished(node),
        snippet: getSnippet(node),
        percent,
      });
    });
    return out;
  };

  const extractPlaylists = (root, seen) => {
    const out = [];
    walk(root, (node) => {
      const lk = node.lockupViewModel;
      if (lk && lk.contentType === 'LOCKUP_CONTENT_TYPE_PLAYLIST') {
        const id = lk.contentId;
        if (typeof id !== 'string' || !id || seen.has(id)) return;
        const meta = lk.metadata?.lockupMetadataViewModel;
        const title = meta?.title?.content;
        const img = lk.contentImage?.thumbnailViewModel || lk.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel;
        const sources = img?.image?.sources || [];
        const thumb = sources.length ? sources[sources.length - 1].url : null;
        if (!title || !thumb) return;
        seen.add(id);
        out.push({ id, type: 'playlist', title, channel: '', channelHref: null, thumb, duration: '', views: '', published: '', snippet: '' });
        return;
      }
      const legacy = node.playlistRenderer || node.gridPlaylistRenderer || node.compactPlaylistRenderer;
      if (!legacy) return;
      const id = legacy.playlistId;
      if (typeof id !== 'string' || !id || seen.has(id)) return;
      const title = getTitle(legacy);
      if (!title) return;
      const thumb = getThumb(legacy) || getThumb(legacy.thumbnailRenderer?.playlistVideoThumbnailRenderer);
      if (!thumb) return;
      const count = legacy.videoCount
        || (Array.isArray(legacy.videoCountText?.runs) ? legacy.videoCountText.runs.map((r) => r?.text || '').join('') : null)
        || legacy.videoCountText?.simpleText
        || null;
      seen.add(id);
      out.push({ id, type: 'playlist', title, channel: '', channelHref: null, thumb, duration: '', views: count ? count + ' videos' : '', published: '', snippet: '' });
    });
    return out;
  };

  const extractPlaylistPanel = (root) => {
    const wrap = findNode(root, (n) => n?.playlist?.playlistId && Array.isArray(n?.playlist?.contents))?.playlist;
    if (!wrap) return null;
    const items = [];
    for (const c of wrap.contents) {
      const r = c?.playlistPanelVideoRenderer;
      if (!r || typeof r.videoId !== 'string') continue;
      items.push({
        id: r.videoId,
        title: getTitle(r) || '',
        channel: getChannel(r) || '',
        channelHref: getChannelHref(r),
        thumb: getThumb(r),
        duration: r.lengthText?.simpleText
          || (Array.isArray(r.lengthText?.runs) ? r.lengthText.runs.map((x) => x?.text || '').join('') : ''),
      });
    }
    if (!items.length) return null;
    const title = typeof wrap.title === 'string' ? wrap.title
      : (wrap.titleText?.simpleText
        || (Array.isArray(wrap.titleText?.runs) ? wrap.titleText.runs.map((r) => r?.text || '').join('') : ''))
      || '';
    return { id: wrap.playlistId, title, items };
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

  const findAnyContinuationToken = (root) => {
    let token = null;
    walk(root, (node) => {
      if (token) return;
      const t = node?.continuationCommand?.token;
      if (typeof t === 'string' && t) token = t;
    });
    return token;
  };

  const findAllContinuationTokens = (root) => {
    const tokens = [];
    walk(root, (node) => {
      const t = node?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (typeof t === 'string' && t) tokens.push(t);
    });
    return tokens;
  };

  const findCommentsToken = (root) => {
    const section = findNode(root, (n) => n?.itemSectionRenderer?.sectionIdentifier === 'comment-item-section')?.itemSectionRenderer;
    if (section) {
      const t = findContinuationToken(section);
      if (t) return t;
    }
    const tokens = findAllContinuationTokens(root);
    return tokens.length ? tokens[tokens.length - 1] : null;
  };

  const shortSortLabel = (title) => {
    const t = (title || '').toLowerCase();
    if (t.includes('top') || t.includes('beliebt')) return 'Top';
    if (t.includes('new') || t.includes('neu')) return 'Newest';
    return title;
  };

  const findCommentsSortOptions = (root) => {
    const node = findNode(root, (n) => n?.sortFilterSubMenuRenderer)?.sortFilterSubMenuRenderer;
    const items = node?.subMenuItems;
    if (!Array.isArray(items)) return [];
    return items
      .map((it) => ({
        label: shortSortLabel(it?.title),
        token: it?.serviceEndpoint?.continuationCommand?.token || null,
      }))
      .filter((o) => o.label && o.token);
  };

  const commentEntityMap = (root) => {
    const map = new Map();
    walk(root, (node) => {
      const muts = node?.frameworkUpdates?.entityBatchUpdate?.mutations;
      if (!Array.isArray(muts)) return;
      for (const m of muts) {
        const payload = m?.payload?.commentEntityPayload;
        const key = m?.entityKey || payload?.key;
        if (payload && key) map.set(key, payload);
      }
    });
    return map;
  };

  const buildRunsSegments = (runs) => {
    if (!Array.isArray(runs) || !runs.length) return null;
    return runs.map((r) => {
      const watch = r?.navigationEndpoint?.watchEndpoint;
      return {
        text: r?.text || '',
        url: r?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || null,
        seconds: typeof watch?.startTimeSeconds === 'number' ? watch.startTimeSeconds : null,
        videoId: watch?.videoId || null,
      };
    });
  };

  const buildAttributedSegments = (attributed) => {
    const content = attributed?.content;
    if (typeof content !== 'string' || !content) return null;
    const commandRuns = (attributed.commandRuns || [])
      .filter((r) => typeof r?.startIndex === 'number' && typeof r?.length === 'number' && r?.onTap?.innertubeCommand)
      .sort((a, b) => a.startIndex - b.startIndex);
    const segments = [];
    let cursor = 0;
    for (const run of commandRuns) {
      if (run.startIndex > cursor) segments.push({ text: content.slice(cursor, run.startIndex), url: null, seconds: null, videoId: null });
      const cmd = run.onTap.innertubeCommand;
      const watch = cmd?.watchEndpoint;
      segments.push({
        text: content.slice(run.startIndex, run.startIndex + run.length),
        url: cmd?.commandMetadata?.webCommandMetadata?.url || null,
        seconds: typeof watch?.startTimeSeconds === 'number' ? watch.startTimeSeconds : null,
        videoId: watch?.videoId || null,
      });
      cursor = run.startIndex + run.length;
    }
    if (cursor < content.length) segments.push({ text: content.slice(cursor), url: null, seconds: null, videoId: null });
    return segments;
  };

  const getCommentAvatar = (legacy, author) => (
    (Array.isArray(legacy?.authorThumbnail?.thumbnails) && legacy.authorThumbnail.thumbnails.length
      ? legacy.authorThumbnail.thumbnails[legacy.authorThumbnail.thumbnails.length - 1]?.url
      : null)
    || author?.avatarThumbnailUrl
    || author?.avatar?.thumbnails?.[0]?.url
    || null
  );

  const extractComment = (thread, entityMap) => {
    const legacy = thread?.comment?.commentRenderer || thread?.commentRenderer;
    if (legacy) {
      const runs = legacy.contentText?.runs;
      const text = (runs || []).map((r) => r?.text || '').join('') || legacy.contentText?.simpleText || '';
      const replyToken = findContinuationToken(thread?.replies) || findAnyContinuationToken(thread?.replies);
      const replyCount = Number(legacy.replyCount) || (replyToken ? 1 : 0);
      return {
        id: legacy.commentId || null,
        author: legacy.authorText?.simpleText || legacy.authorText?.runs?.[0]?.text || '',
        authorHref: channelHrefFrom(legacy.authorEndpoint),
        avatar: getCommentAvatar(legacy, null),
        text,
        textSegments: buildRunsSegments(runs),
        published: legacy.publishedTimeText?.runs?.[0]?.text || legacy.publishedTimeText?.simpleText || '',
        likes: legacy.voteCount?.simpleText || legacy.voteCount?.accessibility?.accessibilityData?.label || '',
        replyCount,
        replyToken,
      };
    }
    const vm = thread?.commentViewModel?.commentViewModel || thread?.commentViewModel || thread?.comment?.commentViewModel;
    if (!vm) return null;
    const key = vm.commentKey || vm.key || vm.commentId;
    const payload = key ? entityMap.get(key) : null;
    const props = payload?.properties || vm.properties;
    if (!props) return null;
    const author = payload?.author || vm.author;
    const toolbar = payload?.toolbar || vm.toolbar;
    const replyToken = findContinuationToken(thread?.replies) || findAnyContinuationToken(thread?.replies);
    const replyCount = Number(toolbar?.replyCount) || Number(props.replyCount) || (replyToken ? 1 : 0);
    return {
      id: props.commentId || payload?.key || key || null,
      author: author?.displayName || '',
      authorHref: channelHrefFrom(author?.channelCommand)
        || (typeof author?.channelId === 'string' && author.channelId ? '/channel/' + author.channelId : null),
      avatar: getCommentAvatar(null, author),
      text: props.content?.content || '',
      textSegments: buildAttributedSegments(props.content),
      published: props.publishedTime || '',
      likes: toolbar?.likeCountA11y || toolbar?.likeCountNotliked || toolbar?.likeCountLiked || '',
      replyCount,
      replyToken,
    };
  };

  const extractComments = (root, entityMap, seen) => {
    const out = [];
    walk(root, (node) => {
      let thread = null;
      if (node.commentThreadRenderer) thread = node.commentThreadRenderer;
      else if (node.commentRenderer || node.commentViewModel) thread = node;
      else return;
      const c = extractComment(thread, entityMap);
      if (!c || !c.id || seen.has(c.id)) return;
      seen.add(c.id);
      out.push(c);
    });
    return out;
  };

  const getCommentsCount = (root) => {
    const t = findNode(root, (n) => n?.commentsHeaderRenderer)?.commentsHeaderRenderer?.countText;
    if (!t) return null;
    return t.simpleText || (Array.isArray(t.runs) ? t.runs.map((r) => r?.text || '').join('') : null);
  };

  const fmt = (s) => {
    if (!isFinite(s)) return 'LIVE';
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const mm = h ? String(m).padStart(2, '0') : m;
    return (h ? h + ':' : '') + mm + ':' + String(sec).padStart(2, '0');
  };

  const itemHref = (item) => (item.type === 'playlist'
    ? '/playlist?list=' + encodeURIComponent(item.id)
    : '/watch?v=' + encodeURIComponent(item.id) + (item.listId ? '&list=' + encodeURIComponent(item.listId) : ''));

  const createItemLink = (item, cls) => {
    const link = document.createElement('a');
    link.className = cls;
    link.href = itemHref(item);
    link.setAttribute('aria-label', item.title || '');
    return link;
  };

  const createChannelLink = (item, cls) => {
    const href = item.channelHref || null;
    const el = document.createElement(href ? 'a' : 'div');
    el.className = cls;
    if (href) el.href = href;
    el.textContent = item.channel || handleFromHref(href);
    return el;
  };

  const createCard = (item) => {
    const a = document.createElement('div');
    a.className = 'c';
    const link = createItemLink(item, 'c-link');
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
    if (typeof item.percent === 'number') {
      const bar = document.createElement('div');
      bar.className = 'c-progress';
      const fill = document.createElement('div');
      fill.className = 'c-progress-fill';
      fill.style.width = Math.max(0, Math.min(100, item.percent)) + '%';
      bar.appendChild(fill);
      thumbWrap.appendChild(bar);
    }
    const title = document.createElement('h3');
    title.className = 'c-title';
    title.textContent = item.title;
    const chan = createChannelLink(item, 'c-chan');
    const meta = document.createElement('div');
    meta.className = 'c-meta';
    meta.textContent = [item.views, item.published].filter(Boolean).join(' · ');
    a.append(link, thumbWrap, title, chan, meta);
    return a;
  };

  const createCompactCard = (item) => {
    const a = document.createElement('div');
    a.className = 'rc';
    const link = createItemLink(item, 'rc-link');
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
    const chan = createChannelLink(item, 'rc-chan');
    const meta = document.createElement('div');
    meta.className = 'rc-meta';
    meta.textContent = [item.views, item.published].filter(Boolean).join(' · ');
    body.append(title, chan, meta);
    a.append(link, thumbWrap, body);
    return a;
  };

  const createRowCard = (item) => {
    const a = document.createElement('div');
    a.className = 'row';
    const link = createItemLink(item, 'row-link');
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'row-thumb';
    const img = document.createElement('img');
    img.addEventListener('load', () => img.classList.add('in'), { once: true });
    img.addEventListener('error', () => img.classList.add('in'), { once: true });
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.src = item.thumb;
    thumbWrap.appendChild(img);
    if (item.duration) {
      const dur = document.createElement('span');
      dur.className = 'row-dur';
      dur.textContent = item.duration;
      thumbWrap.appendChild(dur);
    }
    const body = document.createElement('div');
    body.className = 'row-body';
    const title = document.createElement('h3');
    title.className = 'row-title';
    title.textContent = item.title;
    const chan = createChannelLink(item, 'row-chan');
    const meta = document.createElement('div');
    meta.className = 'row-meta';
    meta.textContent = [item.views, item.published].filter(Boolean).join(' · ');
    body.append(title, chan, meta);
    if (item.snippet) {
      const desc = document.createElement('div');
      desc.className = 'row-desc';
      desc.textContent = item.snippet;
      body.appendChild(desc);
    }
    a.append(link, thumbWrap, body);
    return a;
  };

  const createCommentRow = (item) => {
    const row = document.createElement('div');
    row.className = 'comment-row';
    const avatar = document.createElement('img');
    avatar.className = 'comment-avatar';
    avatar.addEventListener('load', () => avatar.classList.add('in'), { once: true });
    avatar.addEventListener('error', () => avatar.classList.add('in'), { once: true });
    avatar.setAttribute('loading', 'lazy');
    avatar.setAttribute('decoding', 'async');
    if (item.avatar) avatar.src = item.avatar;
    let avatarEl = avatar;
    if (item.authorHref) {
      const avatarLink = document.createElement('a');
      avatarLink.className = 'comment-avatar-link';
      avatarLink.href = item.authorHref;
      avatarLink.setAttribute('aria-label', item.author || '');
      avatarLink.appendChild(avatar);
      avatarEl = avatarLink;
    }

    const bodyEl = document.createElement('div');
    bodyEl.className = 'comment-body';

    const head = document.createElement('div');
    head.className = 'comment-head';
    const author = document.createElement(item.authorHref ? 'a' : 'span');
    author.className = 'comment-author';
    if (item.authorHref) author.href = item.authorHref;
    author.textContent = item.author || '';
    const time = document.createElement('span');
    time.className = 'comment-time';
    time.textContent = item.published || '';
    head.append(author, time);

    const text = document.createElement('div');
    text.className = 'comment-text';
    if (item.textSegments && item.textSegments.length) {
      const currentId = resolveVideoId();
      for (const seg of item.textSegments) {
        if (!seg.text) continue;
        if (seg.url) {
          const a = document.createElement('a');
          a.className = 'comment-link';
          a.href = seg.url;
          a.textContent = seg.text;
          if (seg.seconds != null && (!seg.videoId || seg.videoId === currentId)) {
            a.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              seekPlayerTo(seg.seconds);
            });
          }
          text.appendChild(a);
        } else {
          text.appendChild(document.createTextNode(seg.text));
        }
      }
    } else {
      text.textContent = item.text || '';
    }

    const showMore = document.createElement('button');
    showMore.className = 'comment-showmore';
    showMore.textContent = 'Show more';
    showMore.addEventListener('click', () => {
      const expanded = text.classList.toggle('expanded');
      showMore.textContent = expanded ? 'Show less' : 'Show more';
    });
    requestAnimationFrame(() => {
      if (text.scrollHeight > text.clientHeight + 1) showMore.style.display = '';
    });

    const likes = document.createElement('div');
    likes.className = 'comment-likes';
    likes.textContent = item.likes || '';

    bodyEl.append(head, text, showMore, likes);

    if (item.replyToken) {
      const repliesBtn = document.createElement('button');
      repliesBtn.className = 'comment-replies-btn';
      const n = Number(item.replyCount);
      repliesBtn.textContent = n > 1
        ? n + ' replies'
        : (n === 1 ? '1 reply' : 'View replies');
      let loaded = false;
      repliesBtn.addEventListener('click', async () => {
        if (loaded) return;
        loaded = true;
        repliesBtn.textContent = 'Loading…';
        const res = await innertube('next', { continuation: item.replyToken });
        if (!res) { repliesBtn.remove(); return; }
        const entityMap = commentEntityMap(res);
        const replies = extractComments(res, entityMap, new Set()).slice(0, MAX_REPLIES);
        repliesBtn.remove();
        if (!replies.length) return;
        const wrap = document.createElement('div');
        wrap.className = 'comment-replies';
        for (const r of replies) wrap.appendChild(createCommentRow(r));
        bodyEl.appendChild(wrap);
      });
      bodyEl.appendChild(repliesBtn);
    }

    row.append(avatarEl, bodyEl);
    return row;
  };

  const createSignInBlock = (prompt) => {
    const wrap = document.createElement('div');
    wrap.className = 'signin-state';
    if (prompt.title) {
      const heading = document.createElement('div');
      heading.className = 'signin-title';
      heading.textContent = prompt.title;
      wrap.appendChild(heading);
    }
    if (prompt.message) {
      const message = document.createElement('div');
      message.className = 'signin-message';
      message.textContent = prompt.message;
      wrap.appendChild(message);
    }
    const btn = document.createElement('a');
    btn.className = 'signin-btn';
    btn.href = '/signin';
    btn.textContent = 'Sign in';
    wrap.appendChild(btn);
    return wrap;
  };

  const root = document.createElement('div');
  root.id = 'itube';

  const header = document.createElement('header');
  header.className = 'hd';
  const hdLeft = document.createElement('div');
  hdLeft.className = 'hd-left';
  const searchWrap = document.createElement('div');
  searchWrap.className = 'search-wrap';
  const searchIcon = icon([
    ['circle', { cx: '6.2', cy: '6.2', r: '4.4', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }],
    ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', d: 'M9.6 9.6 13 13' }],
  ]);
  searchIcon.classList.add('search-icon');
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'search';
  search.placeholder = 'Search';
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = search.value.trim();
    if (!q) return;
    e.preventDefault();
    search.blur();
    history.pushState({}, '', '/results?search_query=' + encodeURIComponent(q));
    spaRoute();
  });
  searchWrap.append(searchIcon, search);
  const hdRight = document.createElement('div');
  hdRight.className = 'hd-right';
  const hdSignIn = document.createElement('a');
  hdSignIn.className = 'hd-signin';
  hdSignIn.href = '/signin';
  hdSignIn.textContent = 'Sign in';
  hdSignIn.style.display = 'none';
  const avatar = document.createElement('div');
  avatar.className = 'hd-avatar';
  hdRight.append(hdSignIn, avatar);
  header.append(hdLeft, searchWrap, hdRight);

  const syncAccount = () => {
    const out = loggedOut();
    hdSignIn.style.display = out ? '' : 'none';
    avatar.style.display = out ? 'none' : '';
  };

  const nav = document.createElement('nav');
  nav.className = 'sidebar';
  const brand = document.createElement('a');
  brand.className = 'brand';
  brand.href = '/';
  const brandTile = document.createElement('div');
  brandTile.className = 'brand-tile';
  const triangle = document.createElementNS(SVGNS, 'svg');
  triangle.setAttribute('viewBox', '0 0 16 16');
  triangle.setAttribute('width', '13');
  triangle.setAttribute('height', '13');
  const tri = document.createElementNS(SVGNS, 'path');
  tri.setAttribute('fill', '#fff');
  tri.setAttribute('d', 'M4 2.5v11l9-5.5z');
  triangle.appendChild(tri);
  brandTile.appendChild(triangle);
  const brandWord = document.createElement('span');
  brandWord.className = 'brand-word';
  brandWord.textContent = 'iTube';
  brand.append(brandTile, brandWord);
  hdLeft.appendChild(brand);
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
  const collectGuideChannels = (root) => {
    const out = [];
    const seenIds = new Set();
    walk(root, (node) => {
      const g = node?.guideEntryRenderer;
      if (!g) return;
      const browseId = g.navigationEndpoint?.browseEndpoint?.browseId;
      if (typeof browseId !== 'string' || !browseId.startsWith('UC') || seenIds.has(browseId)) return;
      const title = g.formattedTitle?.simpleText || g.formattedTitle?.runs?.[0]?.text || g.title?.simpleText;
      const thumbs = g.thumbnail?.thumbnails;
      const avatarUrl = Array.isArray(thumbs) && thumbs.length ? thumbs[thumbs.length - 1]?.url : null;
      if (!title || !avatarUrl) return;
      seenIds.add(browseId);
      out.push({ browseId, title, avatar: avatarUrl });
    });
    return out;
  };

  const fetchGuideChannels = async () => {
    const fromPage = collectGuideChannels(window.ytInitialGuideData);
    if (fromPage.length) return fromPage;
    const res = await innertube('guide', {});
    if (!res) return null;
    return collectGuideChannels(res);
  };
  const subsSection = document.createElement('div');
  subsSection.className = 'nav-subs';
  nav.appendChild(subsSection);
  const idle = window.requestIdleCallback
    ? (cb) => window.requestIdleCallback(cb, { timeout: 1500 })
    : (cb) => setTimeout(cb, 200);
  const MAX_GUIDE_CHANNELS = 30;
  const GUIDE_POLL_MS = 200;
  const GUIDE_MAX_WAIT = 15000;
  const GUIDE_RETRY_MS = 600;
  const GUIDE_MAX_ATTEMPTS = 3;
  let guideChannelsCache = null;
  let guideChannelsPromise = null;
  let guideChannelsScheduled = false;
  let guideAttempts = 0;
  const guideWaitStart = Date.now();
  const paintGuideChannels = () => {
    const channels = guideChannelsCache || [];
    if (!channels.length) { subsSection.replaceChildren(); return; }
    const label = document.createElement('div');
    label.className = 'nav-section-label';
    label.textContent = 'SUBSCRIPTIONS';
    const rows = [label];
    for (const ch of channels.slice(0, MAX_GUIDE_CHANNELS)) {
      const row = document.createElement('a');
      row.className = 'nav-chan';
      row.href = '/channel/' + encodeURIComponent(ch.browseId);
      const av = document.createElement('img');
      av.className = 'nav-chan-avatar';
      av.src = ch.avatar;
      av.setAttribute('loading', 'lazy');
      const name = document.createElement('span');
      name.textContent = ch.title;
      row.append(av, name);
      rows.push(row);
    }
    subsSection.replaceChildren(...rows);
  };
  const guideRetry = (delay) => {
    if (guideAttempts >= GUIDE_MAX_ATTEMPTS) {
      console.warn('[itube] guide channels unavailable after ' + guideAttempts + ' attempts');
      guideChannelsCache = [];
      return;
    }
    guideAttempts++;
    setTimeout(startGuideChannelsFetch, delay);
  };
  const startGuideChannelsFetch = () => {
    if (guideChannelsPromise || guideChannelsCache) return;
    if (!cfg()?.INNERTUBE_API_KEY && !collectGuideChannels(window.ytInitialGuideData).length) {
      if (Date.now() - guideWaitStart > GUIDE_MAX_WAIT) {
        console.warn('[itube] no INNERTUBE_API_KEY for guide after ' + GUIDE_MAX_WAIT + 'ms');
        guideChannelsCache = [];
        return;
      }
      setTimeout(startGuideChannelsFetch, GUIDE_POLL_MS);
      return;
    }
    guideChannelsPromise = fetchGuideChannels()
      .then((channels) => {
        guideChannelsPromise = null;
        if (!channels) { guideRetry(GUIDE_RETRY_MS * guideAttempts + GUIDE_RETRY_MS); return; }
        guideChannelsCache = channels;
        paintGuideChannels();
      })
      .catch((e) => {
        guideChannelsPromise = null;
        console.warn('[itube] guide channels fetch failed', e);
        guideRetry(GUIDE_RETRY_MS * guideAttempts + GUIDE_RETRY_MS);
      });
  };
  const renderGuideChannels = () => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderGuideChannels, { once: true });
      return;
    }
    if (guideChannelsCache) { paintGuideChannels(); return; }
    if (guideChannelsScheduled) return;
    guideChannelsScheduled = true;
    idle(startGuideChannelsFetch);
  };
  renderGuideChannels();
  const syncNav = () => {
    for (const item of NAV_ITEMS) {
      const row = navRows[item.key];
      if (!row) continue;
      let active = false;
      try {
        const url = new URL(item.href || '/', location.origin);
        active = location.pathname === url.pathname
          && (url.search === '' || new URLSearchParams(location.search).get('list') === new URLSearchParams(url.search).get('list'));
      } catch (e) {
        active = false;
      }
      row.classList.toggle('active', active);
    }
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
  content.addEventListener('scroll', () => { lastScroll = Date.now(); }, { passive: true });
  let spaNav = false;

  const createListView = ({ itemClass, containerClass, renderItem, fetchInitial, fetchMore, emptyMessage }) => {
    const container = document.createElement('div');
    container.className = containerClass;
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.textContent = 'Loading…';
    const sentinel = document.createElement('div');
    sentinel.className = 'sentinel';
    container.append(sentinel);

    const seen = new Set();
    let token = null;
    let loading = false;
    let appendScheduled = false;
    let pendingItems = null;
    let generation = 0;

    const MAX_ITEMS = 200;
    const cap = () => {
      const items = container.querySelectorAll('.' + itemClass);
      const excess = items.length - MAX_ITEMS;
      if (excess <= 0) return;
      const heightBefore = container.getBoundingClientRect().height;
      for (let i = 0; i < excess; i++) items[i].remove();
      const heightAfter = container.getBoundingClientRect().height;
      const removedHeight = heightBefore - heightAfter;
      let spacer = container.querySelector('.spacer');
      if (!spacer) {
        spacer = document.createElement('div');
        spacer.className = 'spacer';
        container.insertBefore(spacer, container.firstChild);
      }
      const current = parseFloat(spacer.style.height) || 0;
      spacer.style.height = (current + removedHeight) + 'px';
    };

    const appendItems = (items) => {
      for (const item of items) container.insertBefore(renderItem(item), sentinel);
      cap();
    };

    const tryAppend = () => {
      appendScheduled = false;
      if (Date.now() - lastScroll < 200) {
        appendScheduled = true;
        setTimeout(tryAppend, 200);
        return;
      }
      const items = pendingItems;
      pendingItems = null;
      if (items) appendItems(items);
    };
    const scheduleAppend = (items) => {
      pendingItems = pendingItems ? pendingItems.concat(items) : items;
      if (appendScheduled) return;
      appendScheduled = true;
      idle(tryAppend);
    };

    const showEmpty = (msg) => {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = msg;
      container.replaceChildren(empty);
    };

    const clear = () => {
      for (const n of container.querySelectorAll('.' + itemClass)) n.remove();
      const spacer = container.querySelector('.spacer');
      if (spacer) spacer.remove();
      for (const n of container.querySelectorAll('.empty')) n.remove();
      pendingItems = null;
      if (sentinel.parentNode !== container || sentinel !== container.lastChild) container.append(sentinel);
    };

    const loadMore = async () => {
      if (loading || !token) return;
      const gen = generation;
      loading = true;
      spinner.classList.add('show');
      try {
        const res = await fetchMore(token, seen);
        if (gen !== generation) return;
        if (!res) return;
        token = res.token;
        scheduleAppend(res.items);
      } finally {
        if (gen === generation) {
          loading = false;
          spinner.classList.remove('show');
        }
      }
    };

    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    }, { root: content, rootMargin: '600px' });
    io.observe(sentinel);

    const load = async (fetchFn) => {
      const gen = ++generation;
      seen.clear();
      token = null;
      clear();
      loading = true;
      spinner.classList.add('show');
      try {
        const res = await fetchFn(seen);
        if (gen !== generation) return;
        if (res && res.signIn) {
          container.replaceChildren(createSignInBlock(res.signIn));
          return;
        }
        if (!res || (res.items.length === 0 && !res.token)) {
          showEmpty((res && res.message) || emptyMessage);
          return;
        }
        token = res.token;
        for (const item of res.items) container.insertBefore(renderItem(item), sentinel);
      } finally {
        if (gen === generation) {
          loading = false;
          spinner.classList.remove('show');
        }
      }
    };

    const loadInitial = () => load(fetchInitial);

    return { container, spinner, seen, loadInitial, load, showEmpty, cleanup: () => io.disconnect() };
  };

  const HOME_SIGNED_OUT = { title: 'Try searching to get started', message: 'Sign in to build a feed of videos you’ll love.' };
  const WATCH_LATER_SIGNED_OUT = { title: 'Enjoy your favorite videos', message: 'Sign in to access videos that you’ve saved to Watch later.' };

  const mountHome = () => {
    const heading = document.createElement('h2');
    heading.className = 'section-heading';
    heading.textContent = 'Recommended';
    heading.style.display = 'none';

    const list = createListView({
      itemClass: 'c',
      containerClass: 'grid',
      renderItem: createCard,
      fetchMore: async (token, seen) => {
        const res = await innertube('browse', { continuation: token });
        if (!res) return null;
        return { items: extractVideos(res, seen), token: findContinuationToken(res) };
      },
      fetchInitial: async (seen) => {
        let data = spaNav ? null : window.ytInitialData;
        if (!data) data = await innertube('browse', { browseId: 'FEwhat_to_watch' });
        if (!data) return null;
        const resumeItems = extractResumeItems(data, new Set());
        for (const it of resumeItems) seen.add(it.id);
        if (resumeItems.length) {
          const cwHeading = document.createElement('h2');
          cwHeading.className = 'section-heading';
          cwHeading.textContent = 'Continue watching';
          const cwGrid = document.createElement('div');
          cwGrid.className = 'grid';
          for (const it of resumeItems) cwGrid.appendChild(createCard(it));
          view.insertBefore(cwHeading, heading);
          view.insertBefore(cwGrid, heading);
        }
        const items = extractVideos(data, seen);
        heading.style.display = items.length ? '' : 'none';
        if (!items.length && !resumeItems.length && loggedOut()) {
          const prompt = feedSignInPrompt(data) || feedNudgePrompt(data) || HOME_SIGNED_OUT;
          return { items: [], token: null, signIn: prompt };
        }
        return { items, token: findContinuationToken(data) };
      },
      emptyMessage: 'Nothing here yet.',
    });

    view.replaceChildren(heading, list.container, list.spinner);
    const run = () => list.loadInitial();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }

    return list.cleanup;
  };

  const SEARCH_SORT_OPTIONS = [
    ['', 'Sort by: Relevance'],
    ['CAISAhAB', 'Sort by: Upload date'],
    ['CAMSAhAB', 'Sort by: View count'],
    ['CAESAhAB', 'Sort by: Rating'],
  ];
  const SEARCH_DATE_OPTIONS = [
    ['', 'Upload date: Any'],
    ['EgQIARAB', 'Upload date: Last hour'],
    ['EgQIAhAB', 'Upload date: Today'],
    ['EgQIAxAB', 'Upload date: This week'],
    ['EgQIBBAB', 'Upload date: This month'],
    ['EgQIBRAB', 'Upload date: This year'],
  ];
  const SEARCH_DURATION_OPTIONS = [
    ['', 'Duration: Any'],
    ['EgQQARgB', 'Duration: Under 4 min'],
    ['EgQQARgD', 'Duration: 4-20 min'],
    ['EgQQARgC', 'Duration: Over 20 min'],
  ];

  const mountSearch = () => {
    const query = new URLSearchParams(location.search).get('search_query') || '';
    search.value = query;

    let activeFilter = null;

    const spParam = new URLSearchParams(location.search).get('sp') || '';

    const fetchSearch = async (seen) => {
      if (!query) return { items: [], token: null, message: 'Type something to search.' };
      const body = activeFilter ? { query, params: activeFilter.value } : { query };
      const res = await innertube('search', body);
      if (!res) return { items: [], token: null, message: 'Something went wrong.' };
      return { items: extractVideos(res, seen), token: findContinuationToken(res), message: 'No results for "' + query + '"' };
    };

    const list = createListView({
      itemClass: 'row',
      containerClass: 'list',
      renderItem: createRowCard,
      fetchInitial: fetchSearch,
      fetchMore: async (token, seen) => {
        const res = await innertube('search', { continuation: token });
        if (!res) return null;
        return { items: extractVideos(res, seen), token: findContinuationToken(res) };
      },
    });

    const makeFilterSelect = (options) => {
      const sel = document.createElement('select');
      sel.className = 'search-filter-select';
      for (const [value, label] of options) sel.appendChild(new Option(label, value));
      return sel;
    };
    const sortSelect = makeFilterSelect(SEARCH_SORT_OPTIONS);
    const dateSelect = makeFilterSelect(SEARCH_DATE_OPTIONS);
    const durSelect = makeFilterSelect(SEARCH_DURATION_OPTIONS);
    const filterRow = document.createElement('div');
    filterRow.className = 'search-filters';
    filterRow.append(sortSelect, dateSelect, durSelect);

    if (spParam) {
      for (const [select, options] of [[sortSelect, SEARCH_SORT_OPTIONS], [dateSelect, SEARCH_DATE_OPTIONS], [durSelect, SEARCH_DURATION_OPTIONS]]) {
        if (options.some(([value]) => value === spParam)) {
          select.value = spParam;
          activeFilter = { select, value: spParam };
          break;
        }
      }
    }

    const onFilterChange = (select) => {
      if (select.value === '') {
        if (activeFilter?.select === select) activeFilter = null;
      } else {
        activeFilter = { select, value: select.value };
        for (const s of [sortSelect, dateSelect, durSelect]) if (s !== select) s.value = '';
      }
      const params = new URLSearchParams(location.search);
      if (activeFilter) params.set('sp', activeFilter.value);
      else params.delete('sp');
      const qs = params.toString();
      history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : ''));
      currentKey = keyFor('search', location.pathname, location.search);
      list.load(fetchSearch);
    };
    sortSelect.addEventListener('change', () => onFilterChange(sortSelect));
    dateSelect.addEventListener('change', () => onFilterChange(dateSelect));
    durSelect.addEventListener('change', () => onFilterChange(durSelect));

    if (query) {
      const label = document.createElement('div');
      label.className = 'search-label';
      label.textContent = 'Results for';
      const queryHeading = document.createElement('h1');
      queryHeading.className = 'search-query';
      queryHeading.textContent = query;
      view.replaceChildren(label, queryHeading, filterRow, list.container, list.spinner);
    } else {
      view.replaceChildren(list.container, list.spinner);
    }

    const run = () => list.loadInitial();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }

    return list.cleanup;
  };

  const mountChannel = () => {
    const CHANNEL_ID_IN_PATH_RE = /^\/channel\/([^/]+)/;
    const resolveBrowseId = async () => {
      const m = location.pathname.match(CHANNEL_ID_IN_PATH_RE);
      if (m) return m[1];
      if (!spaNav) {
        const data = window.ytInitialData;
        const metaNode = findNode(data, (n) => typeof n?.metadata?.channelMetadataRenderer?.externalId === 'string');
        if (metaNode) return metaNode.metadata.channelMetadataRenderer.externalId;
        const idNode = findNode(data, (n) => typeof n?.browseId === 'string' && n.browseId.startsWith('UC'));
        if (idNode) return idNode.browseId;
      }
      const resolved = await innertube('navigation/resolve_url', { url: location.href });
      return resolved?.endpoint?.browseEndpoint?.browseId || null;
    };

    const showEmpty = (msg) => {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = msg;
      view.replaceChildren(empty);
    };

    const header = document.createElement('div');
    header.className = 'ch-header';

    const thumbFrom = (node) => {
      const thumbs = node?.thumbnails;
      if (Array.isArray(thumbs) && thumbs.length) return thumbs[thumbs.length - 1]?.url || null;
      return getThumb(node);
    };

    const decodeParams = (p) => {
      try {
        return atob(String(p).replace(/-/g, '+').replace(/_/g, '/'));
      } catch (e) {
        console.warn('[itube] channel tab params decode failed', e);
        return '';
      }
    };

    let browseId = null;
    const tabParams = (want) => {
      const found = [];
      const walkEp = (o, d) => {
        if (!o || typeof o !== 'object' || d > 16) return;
        if (Array.isArray(o)) {
          for (const x of o) walkEp(x, d + 1);
          return;
        }
        const p = o.browseEndpoint?.params;
        if (typeof p === 'string') found.push(p);
        for (const k in o) walkEp(o[k], d + 1);
      };
      walkEp(window.ytInitialData, 0);
      for (const p of found) {
        if (decodeParams(p).includes(want)) return p;
      }
      return null;
    };

    const CHANNEL_TABS = ['videos', 'playlists'];
    const tabFromPath = () => {
      const seg = location.pathname.replace(/\/+$/, '').split('/').pop();
      return CHANNEL_TABS.includes(seg) ? seg : 'videos';
    };
    const channelBase = () => {
      const m = location.pathname.match(/^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+)/);
      return m ? m[0] : location.pathname;
    };

    let activeTab = tabFromPath();
    const tabBtns = {};

    let ownerName = '';
    const fillOwner = (items) => {
      for (const item of items) {
        if (item.channelHref) continue;
        item.channelHref = channelBase();
        if (!item.channel) item.channel = ownerName;
      }
      return items;
    };

    const list = createListView({
      itemClass: 'c',
      containerClass: 'grid',
      renderItem: createCard,
      fetchMore: async (token, seen) => {
        const res = await innertube('browse', { continuation: token });
        if (!res) return null;
        const extractor = activeTab === 'playlists' ? extractPlaylists : extractVideos;
        return { items: fillOwner(extractor(res, seen)), token: findContinuationToken(res) };
      },
      fetchInitial: async (seen) => {
        const params = tabParams(activeTab);
        const res = await innertube('browse', params ? { browseId, params } : { browseId });
        if (!res) return null;
        paintHeader(res);
        const extractor = activeTab === 'playlists' ? extractPlaylists : extractVideos;
        return { items: fillOwner(extractor(res, seen)), token: findContinuationToken(res) };
      },
      emptyMessage: "Couldn't load this channel.",
    });

    let tabSwitching = false;
    const makeTabBtn = (key, label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ch-tab';
      btn.textContent = label;
      btn.addEventListener('click', async () => {
        if (activeTab === key || tabSwitching) return;
        activeTab = key;
        for (const k in tabBtns) tabBtns[k].classList.toggle('active', k === key);
        const href = channelBase() + (key === 'videos' ? '/videos' : '/' + key);
        history.pushState({}, '', href);
        setCurrentKey();
        tabSwitching = true;
        try {
          await list.loadInitial();
        } finally {
          tabSwitching = false;
        }
      });
      tabBtns[key] = btn;
      return btn;
    };

    let headerBuilt = false;
    const paintHeader = (res) => {
      if (headerBuilt) return;
      const getHeaderRenderer = (data) => (
        findNode(data, (n) => n?.c4TabbedHeaderRenderer)?.c4TabbedHeaderRenderer
        || findNode(data, (n) => n?.pageHeaderRenderer)?.pageHeaderRenderer
        || null
      );
      const h = getHeaderRenderer(res);
      if (!h) return;
      headerBuilt = true;
      const imgFrom = (node) => {
        let best = null;
        walk(node, (n) => {
          if (best) return;
          const thumbs = Array.isArray(n.sources) ? n.sources : (Array.isArray(n.thumbnails) ? n.thumbnails : null);
          if (thumbs && thumbs.length) {
            const u = thumbs[thumbs.length - 1]?.url;
            if (u) best = u;
          }
        });
        return best;
      };
      const vm = h?.content?.pageHeaderViewModel;
      const metaTexts = [];
      walk(vm?.metadata, (n) => {
        if (typeof n.content === 'string' && n.content && n.content.length < 40) metaTexts.push(n.content);
      });
      const name = (typeof h?.title === 'string' ? h.title : null)
        || h?.title?.runs?.[0]?.text || h?.title?.simpleText
        || vm?.title?.dynamicTextViewModel?.text?.content || null;
      if (name) ownerName = name;
      const handle = h?.channelHandleText?.runs?.[0]?.text || h?.channelHandleText?.simpleText
        || metaTexts.find((t) => t.startsWith('@')) || null;
      const avatarUrl = thumbFrom(h?.avatar) || imgFrom(vm?.image);
      const subCount = h?.subscriberCountText?.simpleText || h?.subscriberCountText?.runs?.[0]?.text
        || metaTexts.find((t) => /subscriber/i.test(t)) || null;
      const videoCount = (h?.videosCountText?.runs || []).map((r) => r?.text || '').join('')
        || h?.videosCountText?.simpleText
        || metaTexts.find((t) => /video/i.test(t)) || null;
      const bannerUrl = thumbFrom(h?.banner) || imgFrom(vm?.banner);

      if (bannerUrl) {
        const banner = document.createElement('img');
        banner.className = 'ch-banner';
        banner.addEventListener('load', () => banner.classList.add('in'), { once: true });
        banner.addEventListener('error', () => banner.classList.add('in'), { once: true });
        banner.setAttribute('loading', 'lazy');
        banner.setAttribute('decoding', 'async');
        banner.src = bannerUrl;
        header.appendChild(banner);
      }
      if (avatarUrl) {
        const avatar = document.createElement('img');
        avatar.className = 'ch-avatar';
        avatar.addEventListener('load', () => avatar.classList.add('in'), { once: true });
        avatar.addEventListener('error', () => avatar.classList.add('in'), { once: true });
        avatar.setAttribute('loading', 'lazy');
        avatar.setAttribute('decoding', 'async');
        avatar.src = avatarUrl;
        header.appendChild(avatar);
      }
      const nameEl = document.createElement('h1');
      nameEl.className = 'ch-name';
      nameEl.textContent = name || '';
      if (name) setTitle(name);
      const meta = document.createElement('div');
      meta.className = 'ch-meta';
      meta.textContent = [handle, subCount, videoCount].filter(Boolean).join(' · ');

      const titleRow = document.createElement('div');
      titleRow.className = 'ch-title-row';
      const titleCol = document.createElement('div');
      titleCol.className = 'ch-title-col';
      titleCol.append(nameEl, meta);

      const { btn: chSubscribeBtn, label: chSubscribeLabel } = pillButton(null, '', 'watch-subscribe');
      let chSubscribed = readSubscribedState(res);
      let chSubscribeBusy = false;
      const setChSubscribeUI = () => {
        chSubscribeBtn.replaceChildren();
        if (chSubscribed) chSubscribeBtn.appendChild(ICONS.check());
        chSubscribeBtn.appendChild(chSubscribeLabel);
        chSubscribeBtn.classList.toggle('subscribed', chSubscribed);
        chSubscribeBtn.setAttribute('aria-pressed', String(chSubscribed));
        chSubscribeLabel.textContent = chSubscribed ? 'Subscribed' : 'Subscribe';
      };
      chSubscribeBtn.disabled = !browseId;
      setChSubscribeUI();
      chSubscribeBtn.addEventListener('click', async () => {
        if (chSubscribeBtn.disabled || chSubscribeBusy || !browseId) return;
        chSubscribeBusy = true;
        const prevSubscribed = chSubscribed;
        chSubscribed = !prevSubscribed;
        setChSubscribeUI();
        const subRes = chSubscribed
          ? await innertube('subscription/subscribe', { channelIds: [browseId], params: 'EgIIAg%3D%3D' })
          : await innertube('subscription/unsubscribe', { channelIds: [browseId], params: 'CgIIAg%3D%3D' });
        if (!subscribeConfirmed(subRes, chSubscribed)) {
          chSubscribed = prevSubscribed;
          setChSubscribeUI();
        }
        chSubscribeBusy = false;
      });

      titleRow.append(titleCol, chSubscribeBtn);
      header.appendChild(titleRow);

      const tabsEl = document.createElement('div');
      tabsEl.className = 'ch-tabs';
      tabsEl.appendChild(makeTabBtn('videos', 'Videos'));
      if (tabParams('playlists') || activeTab === 'playlists') tabsEl.appendChild(makeTabBtn('playlists', 'Playlists'));
      (tabBtns[activeTab] || tabBtns.videos).classList.add('active');
      header.appendChild(tabsEl);
    };

    const run = async () => {
      browseId = await resolveBrowseId();
      if (!browseId) {
        showEmpty("Couldn't load this channel.");
        return;
      }
      view.replaceChildren(header, list.container, list.spinner);
      await list.loadInitial();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }

    return list.cleanup;
  };

  const mountFeed = (browseIds, heading, opts = {}) => {
    const ids = Array.isArray(browseIds) ? browseIds : [browseIds];
    const useInitialData = !!opts.useInitialData;
    const listId = ids[0] && ids[0].startsWith('VL') ? ids[0].slice(2) : null;

    const headingEl = document.createElement('h1');
    headingEl.className = 'page-heading';
    headingEl.textContent = heading;

    const setPlaylistTitle = (res) => {
      try {
        const node = findNode(res, (n) => n?.playlistHeaderRenderer)?.playlistHeaderRenderer;
        const title = node?.title?.runs?.[0]?.text || node?.title?.simpleText || node?.title?.content;
        if (title) headingEl.textContent = title;
      } catch (e) {
        console.warn('[itube] playlist title parse failed', e);
      }
    };

    const signedOutPrompt = (res) => (loggedOut() ? feedSignInPrompt(res) : null);

    const fetchFromApi = async (seen) => {
      for (const id of ids) {
        const res = await innertube('browse', { browseId: id });
        if (!res) {
          if (id === 'VLWL' && loggedOut()) return { items: [], token: null, signIn: WATCH_LATER_SIGNED_OUT };
          continue;
        }
        const prompt = signedOutPrompt(res);
        if (prompt) return { items: [], token: null, signIn: prompt };
        if (id.startsWith('VL')) setPlaylistTitle(res);
        const items = extractVideos(res, seen);
        const token = findContinuationToken(res);
        if (items.length || token) return { items, token };
      }
      return null;
    };

    const list = createListView({
      itemClass: 'c',
      containerClass: 'grid',
      renderItem: listId ? (item) => createCard({ ...item, listId }) : createCard,
      fetchInitial: async (seen) => {
        if (useInitialData && !spaNav) {
          const pageData = window.ytInitialData;
          const prompt = signedOutPrompt(pageData);
          if (prompt) return { items: [], token: null, signIn: prompt };
          const initialItems = pageData ? extractVideos(pageData, seen) : [];
          if (initialItems.length) {
            if (ids[0].startsWith('VL')) setPlaylistTitle(pageData);
            return { items: initialItems, token: findContinuationToken(pageData) };
          }
        }
        const result = await fetchFromApi(seen);
        return result || { items: [], token: null };
      },
      fetchMore: async (token, seen) => {
        const res = await innertube('browse', { continuation: token });
        if (!res) return null;
        return { items: extractVideos(res, seen), token: findContinuationToken(res) };
      },
      emptyMessage: 'Nothing here yet.',
    });

    view.replaceChildren(headingEl, list.container, list.spinner);
    const run = () => list.loadInitial();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }

    return list.cleanup;
  };

  const mountUnhandled = () => {
    const wrap = document.createElement('div');
    wrap.className = 'unhandled';
    const msg = document.createElement('div');
    msg.textContent = "This page isn't available in iTube yet.";
    const home = document.createElement('a');
    home.className = 'unhandled-home';
    home.href = '/';
    home.textContent = 'Home';
    wrap.append(msg, home);
    view.replaceChildren(wrap);
    return () => {};
  };

  const player = () => document.getElementById('movie_player');

  const playerVolume = () => {
    const p = player();
    if (p && typeof p.getVolume === 'function') return Math.round(p.getVolume());
    const v = document.querySelector('#itube-stage video');
    return v ? Math.round(v.volume * 100) : 100;
  };

  const setPlayerVolume = (value) => {
    const vol = Math.max(0, Math.min(100, Math.round(value)));
    const p = player();
    if (p && typeof p.setVolume === 'function') {
      p.unMute?.();
      p.setVolume(vol);
    } else {
      const v = document.querySelector('#itube-stage video');
      if (v) { v.muted = false; v.volume = vol / 100; }
    }
    return vol;
  };

  const isMuted = () => {
    const p = player();
    if (p && typeof p.isMuted === 'function') return p.isMuted();
    const v = document.querySelector('#itube-stage video');
    return v ? v.muted : false;
  };

  const setMuted = (muted) => {
    const p = player();
    if (p && typeof p.mute === 'function') {
      if (muted) p.mute(); else p.unMute?.();
    }
    const v = document.querySelector('#itube-stage video');
    if (v) v.muted = muted;
  };

  const SKIP_AD_SELECTOR = [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad',
    '.ytp-ad-skip-button-container button',
  ].join(', ');

  const adShowing = () => {
    const p = player();
    if (!p) return false;
    return p.classList.contains('ad-showing') || p.classList.contains('ad-interrupting');
  };

  const clickSkipAd = () => {
    const p = player();
    if (!p) return;
    for (const b of p.querySelectorAll(SKIP_AD_SELECTOR)) {
      if (b.offsetParent !== null) b.click();
    }
  };

  const killAd = (video) => {
    clickSkipAd();
    if (!video || !isFinite(video.duration) || video.duration <= 0) return false;
    if (video.currentTime >= video.duration) return true;
    try {
      video.currentTime = video.duration;
    } catch (e) {
      return false;
    }
    return true;
  };

  const adoptVideo = (stage) => {
    const v = document.querySelector('#movie_player video');
    if (!v || v.parentElement === stage) return;
    stage.insertBefore(v, stage.firstChild);
  };

  const CAPTION_CONTAINER = '.ytp-caption-window-container';

  let ownedCaptions = null;

  const adoptCaptions = (stage) => {
    const fresh = document.querySelector('#movie_player ' + CAPTION_CONTAINER) || ownedCaptions;
    if (!fresh) return;
    const held = stage.querySelector(CAPTION_CONTAINER);
    if (held === fresh) return;
    if (held) {
      const moviePlayer = player();
      if (!moviePlayer) return;
      moviePlayer.appendChild(held);
    }
    ownedCaptions = fresh;
    const video = stage.querySelector('video');
    if (video && video.nextSibling) stage.insertBefore(fresh, video.nextSibling);
    else stage.appendChild(fresh);
  };

  const releaseCaptions = (stage) => {
    const held = stage.querySelector(CAPTION_CONTAINER);
    if (!held) return;
    ownedCaptions = held;
    const moviePlayer = player();
    if (moviePlayer) moviePlayer.appendChild(held);
  };

  const fit = (v) => {
    if (v.style.width !== '100%') v.style.width = '100%';
    if (v.style.height !== '100%') v.style.height = '100%';
    if (v.style.left !== '0px') v.style.left = '0px';
    if (v.style.top !== '0px') v.style.top = '0px';
    if (v.style.position !== 'absolute') v.style.position = 'absolute';
    if (v.style.objectFit !== 'contain') v.style.objectFit = 'contain';
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
    } catch (e) {
      console.warn('[itube] chapter parse failed', e);
    }
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
      console.warn('[itube] storyboard parse failed', e);
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
    const cue = el('div', 'itube-cue');
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
    left.append(prev, play, next, timeCur);
    center.append(live);
    right.append(timeDur, mute, vol, more, pip, fs);
    bar.append(seekwrap, left, center, right, menu);
    stage.appendChild(bar);
    stage.appendChild(cue);
    return {
      bar, prev, next, play, timeCur, seek, seekwrap, preview, ptime, timeDur, live, mute, vol,
      speed, quality, cc, auto, pip, fs, more, menu, left, right, cue, scrubbing: false, isLive: false,
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
    const queueWrap = document.createElement('div');
    queueWrap.className = 'queue-wrap';
    const relatedWrap = document.createElement('div');
    relatedWrap.className = 'related-wrap';
    watchRight.append(queueWrap, relatedWrap);

    const title = document.createElement('h1');
    title.className = 'watch-title';
    const meta = document.createElement('div');
    meta.className = 'watch-meta';
    const channelRow = document.createElement('div');
    channelRow.className = 'watch-channel';
    const avatar = document.createElement('img');
    avatar.className = 'watch-avatar';
    const avatarLink = document.createElement('a');
    avatarLink.className = 'watch-avatar-link';
    avatarLink.appendChild(avatar);
    const channelInfo = document.createElement('div');
    channelInfo.className = 'watch-channel-info';
    const channelName = document.createElement('a');
    channelName.className = 'watch-channel-name';
    const subs = document.createElement('div');
    subs.className = 'watch-subs';
    channelInfo.append(channelName, subs);
    const channelSpacer = document.createElement('div');
    channelSpacer.className = 'watch-channel-spacer';

    const actions = document.createElement('div');
    actions.className = 'watch-actions';

    const likes = document.createElement('div');
    likes.className = 'watch-likes';
    const { btn: likeBtn, label: likeLabel } = pillButton(ICONS.thumbsUp, '', 'watch-like-btn');
    const likeDivider = document.createElement('div');
    likeDivider.className = 'watch-like-divider';
    const { btn: dislikeBtn } = pillButton(ICONS.thumbsDown, null, 'watch-dislike-btn');
    likes.append(likeBtn, likeDivider, dislikeBtn);

    const { btn: saveBtn, label: saveLabel } = pillButton(ICONS.save, '', 'watch-action-btn');
    const { btn: shareBtn, label: shareLabel } = pillButton(ICONS.share, 'Share', 'watch-action-btn');
    const { btn: subscribeBtn, label: subscribeLabel } = pillButton(null, '', 'watch-subscribe');

    actions.append(likes, saveBtn, shareBtn, subscribeBtn);
    channelRow.append(avatarLink, channelInfo, channelSpacer, actions);

    const signInHint = document.createElement('div');
    signInHint.className = 'watch-signin-hint';
    signInHint.style.display = 'none';
    const signInHintText = document.createElement('span');
    const signInHintLink = document.createElement('a');
    signInHintLink.className = 'signin-btn';
    signInHintLink.href = '/signin';
    signInHintLink.textContent = 'Sign in';
    signInHint.append(signInHintText, signInHintLink);

    const requireSignIn = (message) => {
      signInHintText.textContent = message;
      signInHint.style.display = '';
    };

    let actionsVideoId = null;
    let actionsChannelId = null;
    let liked = false;
    let disliked = false;
    let saved = false;
    let subscribed = false;
    let likeBusy = false;
    let saveBusy = false;
    let subscribeBusy = false;
    let shareBusy = false;

    const setLikeUI = () => {
      likeBtn.classList.toggle('active', liked);
      likeBtn.setAttribute('aria-pressed', String(liked));
      dislikeBtn.classList.toggle('active', disliked);
      dislikeBtn.setAttribute('aria-pressed', String(disliked));
    };
    const setSaveUI = () => {
      saveBtn.classList.toggle('active', saved);
      saveBtn.setAttribute('aria-pressed', String(saved));
      saveLabel.textContent = saved ? 'Saved' : 'Save';
    };
    const setSubscribeUI = () => {
      subscribeBtn.replaceChildren();
      if (subscribed) subscribeBtn.appendChild(ICONS.check());
      subscribeBtn.appendChild(subscribeLabel);
      subscribeBtn.classList.toggle('subscribed', subscribed);
      subscribeBtn.setAttribute('aria-pressed', String(subscribed));
      subscribeLabel.textContent = subscribed ? 'Subscribed' : 'Subscribe';
    };

    likeBtn.addEventListener('click', async () => {
      if (likeBtn.disabled || likeBusy || !actionsVideoId) return;
      if (loggedOut()) { requireSignIn('Sign in to like this video.'); return; }
      likeBusy = true;
      const prevLiked = liked;
      const prevDisliked = disliked;
      liked = !prevLiked;
      if (liked) disliked = false;
      setLikeUI();
      const res = await innertube(prevLiked ? 'like/removelike' : 'like/like', { target: { videoId: actionsVideoId } });
      if (!likeConfirmed(res)) {
        liked = prevLiked;
        disliked = prevDisliked;
        setLikeUI();
      }
      likeBusy = false;
    });

    dislikeBtn.addEventListener('click', async () => {
      if (dislikeBtn.disabled || likeBusy || !actionsVideoId) return;
      if (loggedOut()) { requireSignIn('Sign in to dislike this video.'); return; }
      likeBusy = true;
      const prevLiked = liked;
      const prevDisliked = disliked;
      disliked = !prevDisliked;
      if (disliked) liked = false;
      setLikeUI();
      const res = await innertube(prevDisliked ? 'like/removelike' : 'like/dislike', { target: { videoId: actionsVideoId } });
      if (!likeConfirmed(res)) {
        liked = prevLiked;
        disliked = prevDisliked;
        setLikeUI();
      }
      likeBusy = false;
    });

    saveBtn.addEventListener('click', async () => {
      if (saveBtn.disabled || saveBusy || !actionsVideoId) return;
      if (loggedOut()) { requireSignIn('Sign in to add this video to a playlist.'); return; }
      saveBusy = true;
      const prevSaved = saved;
      saved = !prevSaved;
      setSaveUI();
      const action = saved
        ? { action: 'ACTION_ADD_VIDEO', addedVideoId: actionsVideoId }
        : { action: 'ACTION_REMOVE_VIDEO_BY_VIDEO_ID', removedVideoId: actionsVideoId };
      const res = await innertube('browse/edit_playlist', { playlistId: 'WL', actions: [action] });
      if (!playlistEditConfirmed(res)) {
        saved = prevSaved;
        setSaveUI();
      }
      saveBusy = false;
    });

    shareBtn.addEventListener('click', async () => {
      if (shareBtn.disabled || shareBusy || !actionsVideoId) return;
      shareBusy = true;
      try {
        await navigator.clipboard.writeText('https://www.youtube.com/watch?v=' + actionsVideoId);
        shareLabel.textContent = 'Copied';
        setTimeout(() => { shareLabel.textContent = 'Share'; }, 1500);
      } catch (e) {
        console.warn('[itube] copy share link failed', e);
      } finally {
        shareBusy = false;
      }
    });

    subscribeBtn.addEventListener('click', async () => {
      if (subscribeBtn.disabled || subscribeBusy || !actionsChannelId) return;
      if (loggedOut()) { requireSignIn('Sign in to subscribe to this channel.'); return; }
      subscribeBusy = true;
      const prevSubscribed = subscribed;
      subscribed = !prevSubscribed;
      setSubscribeUI();
      const res = subscribed
        ? await innertube('subscription/subscribe', { channelIds: [actionsChannelId], params: 'EgIIAg%3D%3D' })
        : await innertube('subscription/unsubscribe', { channelIds: [actionsChannelId], params: 'CgIIAg%3D%3D' });
      if (!subscribeConfirmed(res, subscribed)) {
        subscribed = prevSubscribed;
        setSubscribeUI();
      }
      subscribeBusy = false;
    });

    const refreshActions = (data, details) => {
      signInHint.style.display = 'none';
      actionsVideoId = resolveVideoId();
      actionsChannelId = resolveOwnerChannelId(data, details);

      const likeState = readLikeState(data);
      liked = likeState.liked;
      disliked = likeState.disliked;
      likeLabel.textContent = likeState.likeCountText || '';
      setLikeUI();

      saved = false;
      setSaveUI();

      subscribed = readSubscribedState(data);
      setSubscribeUI();

      likeBtn.disabled = !actionsVideoId;
      dislikeBtn.disabled = !actionsVideoId;
      saveBtn.disabled = !actionsVideoId;
      shareBtn.disabled = !actionsVideoId;
      subscribeBtn.disabled = !actionsChannelId;
    };

    const metaDivider = document.createElement('div');
    metaDivider.className = 'watch-meta-divider';
    const stats = document.createElement('div');
    stats.className = 'watch-stats';
    const desc = document.createElement('div');
    desc.className = 'watch-description';
    const descToggle = document.createElement('button');
    descToggle.type = 'button';
    descToggle.className = 'watch-desc-toggle';
    descToggle.textContent = 'Show more';
    descToggle.style.display = 'none';
    let descExpanded = false;
    descToggle.addEventListener('click', () => {
      descExpanded = !descExpanded;
      desc.classList.toggle('expanded', descExpanded);
      descToggle.textContent = descExpanded ? 'Show less' : 'Show more';
    });
    const unavailable = document.createElement('div');
    unavailable.className = 'watch-unavailable';
    unavailable.textContent = "This video isn't available.";
    unavailable.style.display = 'none';
    meta.append(unavailable, channelRow, signInHint, metaDivider, stats, desc, descToggle);

    const commentsPanel = document.createElement('div');
    commentsPanel.className = 'comments';
    const commentsHeader = document.createElement('div');
    commentsHeader.className = 'comments-header';
    const { btn: commentsToggle, icon: commentsChevron, label: commentsLabel } = pillButton(ICONS.chevron, 'Comments', 'comments-toggle');
    const commentsSort = document.createElement('div');
    commentsSort.className = 'comments-sort';
    commentsHeader.append(commentsToggle, commentsSort);
    const commentsBody = document.createElement('div');
    commentsBody.className = 'comments-body collapsed';
    const commentsList = document.createElement('div');
    commentsList.className = 'comments-list';
    const commentsSpinner = document.createElement('div');
    commentsSpinner.className = 'comments-spinner';
    commentsSpinner.textContent = 'Loading…';
    const commentsMore = document.createElement('button');
    commentsMore.className = 'comments-more';
    commentsMore.textContent = 'Show more comments';
    commentsMore.style.display = 'none';
    commentsBody.append(commentsList, commentsSpinner, commentsMore);
    commentsPanel.append(commentsHeader, commentsBody);

    watchLeft.append(stage, title, meta, commentsPanel);
    watch.append(watchLeft, watchRight);

    view.replaceChildren(watch);

    const buildDescriptionSegments = (secondary) => {
      try {
        const segs = buildAttributedSegments(secondary?.attributedDescription);
        if (segs) return segs;
        return buildRunsSegments(secondary?.description?.runs);
      } catch (e) {
        console.warn('[itube] description parse failed', e);
      }
      return null;
    };

    const renderDescription = (segments, fallbackText) => {
      desc.replaceChildren();
      if (segments && segments.length) {
        const currentId = resolveVideoId();
        for (const seg of segments) {
          if (!seg.text) continue;
          if (seg.url) {
            const a = document.createElement('a');
            a.className = 'watch-desc-link';
            a.href = seg.url;
            a.textContent = seg.text;
            if (seg.seconds != null && (!seg.videoId || seg.videoId === currentId)) {
              a.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                seekPlayerTo(seg.seconds);
              });
            }
            desc.appendChild(a);
          } else {
            desc.appendChild(document.createTextNode(seg.text));
          }
        }
      } else {
        desc.textContent = fallbackText || '';
      }
    };

    const playabilityStatus = (data) => (
      data?.playabilityStatus?.status
      || (data === window.ytInitialData ? window.ytInitialPlayerResponse?.playabilityStatus?.status : null)
      || null
    );

    const renderMeta = (data = window.ytInitialData) => {
      if (!data) return;
      const details = data === window.ytInitialData ? window.ytInitialPlayerResponse?.videoDetails : null;
      const primary = findNode(data, (n) => n?.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer;
      const secondary = findNode(data, (n) => n?.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer;
      const status = playabilityStatus(data);
      const hasVideo = !!(primary || secondary || details?.title);
      if ((status && status !== 'OK') || !hasVideo) {
        title.textContent = '';
        setTitle(null);
        unavailable.style.display = '';
        channelRow.style.display = 'none';
        metaDivider.style.display = 'none';
        stats.textContent = '';
        renderDescription(null, '');
        descToggle.style.display = 'none';
        relatedWrap.replaceChildren();
        firstRelatedId = null;
        return;
      }
      title.textContent = getTitle(primary) || details?.title || '';
      if (title.textContent) {
        const t = title.textContent;
        setTitle(t);
        setTimeout(() => { if (title.textContent === t) setTitle(t); }, 1500);
      }
      unavailable.style.display = 'none';
      channelRow.style.display = '';
      metaDivider.style.display = '';
      const owner = secondary?.owner?.videoOwnerRenderer;
      channelName.textContent = owner?.title?.runs?.[0]?.text || details?.author || '';
      subs.textContent = owner?.subscriberCountText?.simpleText
        || owner?.subscriberCountText?.accessibility?.accessibilityData?.label
        || '';
      const ownerId = resolveOwnerChannelId(data, details);
      const ownerHref = channelHrefFrom(owner?.navigationEndpoint)
        || channelHrefFrom(owner?.title?.runs?.[0]?.navigationEndpoint)
        || (ownerId ? '/channel/' + ownerId : null);
      for (const el of [avatarLink, channelName]) {
        if (ownerHref) el.href = ownerHref;
        else el.removeAttribute('href');
      }
      avatarLink.setAttribute('aria-label', channelName.textContent);
      const avatarUrl = getThumb(owner);
      if (avatarUrl) avatar.src = avatarUrl;
      refreshActions(data, details);
      const viewsText = primary?.viewCount?.videoViewCountRenderer?.viewCount?.simpleText
        || (details?.viewCount ? details.viewCount + ' views' : '');
      const dateText = primary?.dateText?.simpleText || '';
      stats.textContent = [viewsText, dateText].filter(Boolean).join(' · ');

      renderDescription(buildDescriptionSegments(secondary), details?.shortDescription || '');
      descExpanded = false;
      desc.classList.remove('expanded');
      descToggle.textContent = 'Show more';
      descToggle.style.display = 'none';
      requestAnimationFrame(() => {
        if (desc.scrollHeight > desc.clientHeight + 1) descToggle.style.display = '';
      });

      const related = extractVideos(data, new Set()).slice(0, 20);
      firstRelatedId = related[0]?.id || null;
      relatedWrap.replaceChildren();
      for (const item of related) relatedWrap.appendChild(createCompactCard(item));
    };

    let currentPlaylist = null;
    let firstRelatedId = null;

    const renderQueuePanel = (videoId) => {
      queueWrap.replaceChildren();
      if (!currentPlaylist) return;
      const panel = document.createElement('div');
      panel.className = 'queue-panel';
      const qHeader = document.createElement('div');
      qHeader.className = 'queue-header';
      const qTitle = document.createElement('div');
      qTitle.className = 'queue-title';
      qTitle.textContent = currentPlaylist.title || 'Playlist';
      const qCount = document.createElement('div');
      qCount.className = 'queue-count';
      const idx = currentPlaylist.items.findIndex((it) => it.id === videoId);
      qCount.textContent = (idx === -1 ? 1 : idx + 1) + ' / ' + currentPlaylist.items.length;
      qHeader.append(qTitle, qCount);
      panel.appendChild(qHeader);
      const qList = document.createElement('div');
      qList.className = 'queue-list';
      for (const item of currentPlaylist.items) {
        const card = createCompactCard(item);
        card.classList.add('queue-item');
        const cardLink = card.querySelector('.rc-link');
        if (cardLink) cardLink.href = '/watch?v=' + encodeURIComponent(item.id) + '&list=' + encodeURIComponent(currentPlaylist.id);
        if (item.id === videoId) card.classList.add('current');
        qList.appendChild(card);
      }
      panel.appendChild(qList);
      queueWrap.appendChild(panel);
    };

    const updateQueue = async (videoId) => {
      const listId = new URLSearchParams(location.search).get('list');
      if (!listId) {
        currentPlaylist = null;
        renderQueuePanel(videoId);
        return;
      }
      if (!currentPlaylist || currentPlaylist.id !== listId) {
        const res = await innertube('next', { videoId, playlistId: listId });
        const panel = res ? extractPlaylistPanel(res) : null;
        currentPlaylist = panel ? { id: listId, title: panel.title, items: panel.items } : null;
      }
      renderQueuePanel(videoId);
    };

    const mountedFromSpa = spaNav;
    if (!mountedFromSpa) {
      renderMeta();
      updateQueue(resolveVideoId());
    }

    let commentsToken = null;
    let commentsSeen = new Set();
    let commentsShown = 0;
    let commentsLoading = false;
    let commentsFetched = false;
    let commentsExpanded = false;

    const setChevron = () => {
      commentsChevron.classList.toggle('open', commentsExpanded);
    };

    const showCommentsOff = () => {
      commentsLabel.textContent = 'Comments';
      const empty = document.createElement('div');
      empty.className = 'comments-empty';
      empty.textContent = 'Comments are turned off.';
      commentsList.replaceChildren(empty);
    };

    const fetchComments = async (initial) => {
      if (commentsLoading || !commentsToken || commentsShown >= MAX_COMMENTS) return;
      commentsLoading = true;
      commentsSpinner.classList.add('show');
      commentsMore.style.display = 'none';
      if (initial) commentsList.replaceChildren();
      try {
        const res = await innertube('next', { continuation: commentsToken });
        if (!res) {
          console.warn('[itube] comments fetch failed');
          commentsFetched = false;
          if (commentsShown === 0) {
            const failed = document.createElement('div');
            failed.className = 'comments-empty';
            failed.textContent = "Couldn't load comments.";
            commentsList.replaceChildren(failed);
          }
          commentsMore.style.display = commentsToken ? '' : 'none';
          return;
        }
        if (initial) {
          const count = getCommentsCount(res);
          commentsLabel.textContent = count || 'Comments';
        }
        const entityMap = commentEntityMap(res);
        const items = extractComments(res, entityMap, commentsSeen);
        commentsToken = findCommentsToken(res);
        const page = initial ? COMMENTS_PAGE : (MAX_COMMENTS - commentsShown);
        const room = Math.min(page, MAX_COMMENTS - commentsShown);
        const batch = items.slice(0, Math.max(0, room));
        for (const item of batch) commentsList.appendChild(createCommentRow(item));
        commentsShown += batch.length;
        if (initial && commentsShown === 0 && !commentsToken) {
          showCommentsOff();
          return;
        }
        commentsMore.style.display = (commentsToken && commentsShown < MAX_COMMENTS) ? '' : 'none';
      } finally {
        commentsLoading = false;
        commentsSpinner.classList.remove('show');
      }
    };
    commentsMore.addEventListener('click', () => fetchComments(false));

    let sortOptions = [];
    let activeSortIndex = 0;
    const renderSortPills = () => {
      commentsSort.replaceChildren();
      if (!sortOptions.length) { commentsSort.style.display = 'none'; return; }
      commentsSort.style.display = 'flex';
      sortOptions.forEach((opt, i) => {
        const { btn } = pillButton(null, opt.label, 'comments-sort-btn');
        btn.classList.toggle('active', i === activeSortIndex);
        btn.addEventListener('click', () => {
          if (i === activeSortIndex || commentsLoading) return;
          activeSortIndex = i;
          renderSortPills();
          commentsList.replaceChildren();
          commentsSeen = new Set();
          commentsShown = 0;
          commentsToken = opt.token;
          commentsFetched = true;
          fetchComments(true);
        });
        commentsSort.appendChild(btn);
      });
    };

    const resetComments = (data = window.ytInitialData, fresh = true) => {
      commentsList.replaceChildren();
      commentsSpinner.classList.remove('show');
      commentsMore.style.display = 'none';
      commentsSeen = new Set();
      commentsShown = 0;
      commentsLoading = false;
      commentsFetched = false;
      commentsExpanded = false;
      commentsBody.classList.add('collapsed');
      setChevron();
      commentsToken = findCommentsToken(data);
      const count = getCommentsCount(data);
      commentsLabel.textContent = commentsToken ? (count || 'Comments') : (fresh ? 'Comments are turned off.' : 'Comments');
      commentsToggle.disabled = !commentsToken;
      sortOptions = findCommentsSortOptions(data);
      activeSortIndex = 0;
      renderSortPills();
    };
    commentsToggle.addEventListener('click', () => {
      if (commentsToggle.disabled) return;
      commentsExpanded = !commentsExpanded;
      commentsBody.classList.toggle('collapsed', !commentsExpanded);
      setChevron();
      if (commentsExpanded && !commentsFetched) {
        commentsFetched = true;
        fetchComments(true);
      }
    });
    resetComments(window.ytInitialData, !mountedFromSpa);

    let chapterSecs = parseChapters(window.ytInitialData);
    let storyboard = null;
    let storyboardTries = 0;
    let ui = null;
    let wired = null;
    let lastVideoId = null;
    let adActive = false;
    let adStartedAt = 0;
    let adFrameSeen = false;
    let adFrameFlushed = false;
    let adLastTime = -1;
    let adRestoring = false;
    let adRestoreUntil = 0;
    let adObserver = null;
    let adObserved = null;
    const mountAbort = new AbortController();
    const bound = { signal: mountAbort.signal };
    let autoplayEnabled = localStorage.getItem('itube-autoplay') !== '0';

    const toggleFullscreen = () => {
      const active = document.fullscreenElement || document.webkitFullscreenElement;
      if (active) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage);
      }
      showOSD(ICONS.fs, active ? 'Exit Fullscreen' : 'Fullscreen');
    };

    const togglePiP = (video) => {
      if (video.webkitSetPresentationMode) {
        video.webkitSetPresentationMode(video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
      } else if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
      } else {
        video.requestPictureInPicture?.();
      }
    };

    let osdTimer = null;
    const showOSD = (iconFn, label) => {
      if (!ui) return;
      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      ui.cue.replaceChildren(iconFn(), labelEl);
      ui.cue.classList.add('show');
      clearTimeout(osdTimer);
      osdTimer = setTimeout(() => ui.cue.classList.remove('show'), 700);
    };

    let clickTimer = null;
    stage.addEventListener('click', (e) => {
      if (e.target.closest('#itube-bar') || e.target.closest('#itube-menu')) return;
      if (clickTimer) return;
      clickTimer = setTimeout(() => {
        clickTimer = null;
        const v = document.querySelector('#itube-stage video');
        if (v) {
          v.paused ? v.play() : v.pause();
          showOSD(v.paused ? ICONS.pause : ICONS.play, v.paused ? 'Paused' : 'Playing');
        }
      }, 220);
    });
    stage.addEventListener('dblclick', (e) => {
      if (e.target.closest('#itube-bar') || e.target.closest('#itube-menu')) return;
      clearTimeout(clickTimer);
      clickTimer = null;
      toggleFullscreen();
    });

    const renderTicks = () => {
      if (!ui || adActive) return;
      const video = wired;
      const dur = video?.duration;
      for (const t of ui.seekwrap.querySelectorAll('.itube-tick')) t.remove();
      if (!isFinite(dur) || !dur || chapterSecs.length < 2) return;
      if (chapterSecs[chapterSecs.length - 1] > dur) return;
      for (const s of chapterSecs) {
        if (!s || s >= dur) continue;
        const t = document.createElement('div');
        t.className = 'itube-tick';
        t.style.left = (s / dur * 100) + '%';
        ui.seekwrap.appendChild(t);
      }
    };

    const updatePreview = (frac) => {
      const sb = storyboard;
      if (adActive) return;
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
      if (!ui || adActive || !isFinite(video.duration) || !video.duration) return;
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

    const savedVolume = () => Math.max(0, Math.min(100, Number(localStorage.getItem('itube-volume')) || 100));
    const savedMuted = () => localStorage.getItem('itube-muted') === '1';

    const restoreUserVolume = (p) => {
      const vol = savedVolume();
      const muted = savedMuted();
      if (typeof p.setVolume === 'function') p.setVolume(vol);
      if (muted) p.mute?.(); else p.unMute?.();
      const v = stage.querySelector('video');
      if (v) v.muted = muted;
      if (ui) {
        ui.vol.value = muted ? 0 : vol;
        ui.mute.replaceChildren(muted ? ICONS.muted() : ICONS.vol());
      }
    };

    const syncAdState = () => {
      const p = player();
      if (!p) return;
      const video = stage.querySelector('video') || document.querySelector('#movie_player video');
      if (adShowing()) {
        if (!adActive) {
          adActive = true;
          adStartedAt = Date.now();
          adFrameSeen = false;
          adFrameFlushed = false;
          adLastTime = -1;
          stage.classList.add('ad');
        }
        p.mute?.();
        if (video && !video.muted) video.muted = true;
        killAd(video);
        if (video) {
          if (video.readyState >= 2) adFrameSeen = true;
          else if (adFrameSeen) adFrameFlushed = true;
        }
        const paintable = !!video && video.readyState >= 2 && !adFrameFlushed;
        const now = video ? video.currentTime : 0;
        const advancing = !!video && !video.paused && !video.ended && now > adLastTime + 0.05;
        adLastTime = now;
        const stuck = Date.now() - adStartedAt > AD_BLANK_MAX_MS;
        stage.classList.toggle('ad', !adFrameFlushed && !(stuck && (!paintable || advancing)));
        return;
      }
      if (adActive) {
        adActive = false;
        adFrameSeen = false;
        adFrameFlushed = false;
        adRestoring = true;
        adRestoreUntil = Date.now() + AD_RESTORE_MS;
        stage.classList.remove('ad');
        renderTicks();
        if (video) paintSeek(video);
      }
      if (!adRestoring) return;
      if (Date.now() > adRestoreUntil) {
        adRestoring = false;
        return;
      }
      const vol = savedVolume();
      const muted = savedMuted();
      const liveVol = typeof p.getVolume === 'function' ? Math.round(p.getVolume()) : vol;
      const liveMuted = typeof p.isMuted === 'function' ? p.isMuted() : muted;
      const playing = !!video && video.readyState >= 2 && !video.paused;
      if (liveVol === vol && liveMuted === muted && playing) {
        adRestoring = false;
        return;
      }
      restoreUserVolume(p);
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
        ui.auto.classList.toggle('active', autoplayEnabled);
        ui.auto.setAttribute('aria-pressed', String(autoplayEnabled));
      };
      ui.auto.addEventListener('click', () => {
        autoplayEnabled = !autoplayEnabled;
        localStorage.setItem('itube-autoplay', autoplayEnabled ? '1' : '0');
        ui.syncAuto();
        showOSD(ICONS.next, autoplayEnabled ? 'Autoplay on' : 'Autoplay off');
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
      ui.mute.addEventListener('click', () => { setMuted(!isMuted()); });
      ui.vol.addEventListener('input', () => { setPlayerVolume(Number(ui.vol.value)); });
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
      ui.pip.addEventListener('click', () => togglePiP(video));
      ui.fs.addEventListener('click', () => toggleFullscreen());

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

      video.addEventListener('play', () => { ui.play.replaceChildren(ICONS.pause()); showBar(); }, bound);
      video.addEventListener('pause', () => { ui.play.replaceChildren(ICONS.play()); showBar(); }, bound);
      video.addEventListener('timeupdate', () => {
        if (adActive) { killAd(video); return; }
        ui.timeCur.textContent = fmt(video.currentTime);
        if (!ui.scrubbing && isFinite(video.duration) && video.duration > 0) {
          ui.seek.value = Math.round(video.currentTime / video.duration * 1000);
        }
        if (ui.isLive) {
          ui.live.classList.toggle('behind', video.duration - video.currentTime > 12);
        }
        paintSeek(video);
      }, bound);
      video.addEventListener('durationchange', () => {
        if (adActive) { killAd(video); return; }
        ui.timeDur.textContent = fmt(video.duration);
        renderTicks();
      }, bound);
      video.addEventListener('progress', () => paintSeek(video), bound);
      ui.play.replaceChildren(video.paused ? ICONS.play() : ICONS.pause());
      ui.timeCur.textContent = fmt(video.currentTime);
      ui.timeDur.textContent = fmt(video.duration);
      ui.vol.value = video.muted ? 0 : Math.round(video.volume * 100);
      populateQuality(p);
    };

    const onNavigateFinish = (e) => {
      const data = e.detail?.response?.response || e.detail?.response || window.ytInitialData;
      chapterSecs = parseChapters(data);
      renderMeta(data);
      renderTicks();
      resetComments(data);
      updateQueue(resolveVideoId());
    };
    window.addEventListener('yt-navigate-finish', onNavigateFinish);

    const tick = () => {
      const video = stage.querySelector('video') || document.querySelector('#movie_player video');
      const p = player();
      if (!video || !p) return;
      if (video.hasAttribute('controls')) video.removeAttribute('controls');
      if (video.disablePictureInPicture) video.disablePictureInPicture = false;
      adoptVideo(stage);
      adoptCaptions(stage);
      fit(video);
      if (!ui) {
        ui = buildBar(stage);
        wireBar(p, video);
      }

      if (adObserved !== p) {
        adObserver?.disconnect();
        adObserver = new MutationObserver(syncAdState);
        adObserver.observe(p, { attributes: true, attributeFilter: ['class'] });
        adObserved = p;
      }
      syncAdState();
      resumePlayback();

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
        storyboard = null;
        storyboardTries = 0;
        ui.preview.style.display = 'none';
        ui.preview.dataset.src = '';
        ui.menu.style.display = 'none';
        renderTicks();
      }

      if (!storyboard && storyboardTries < MAX_STORYBOARD_TRIES) {
        storyboardTries++;
        storyboard = parseStoryboard(p);
        if (storyboard) {
          ui.preview.style.width = storyboard.w + 'px';
          ui.preview.style.height = storyboard.h + 'px';
        }
      }

      if (wired === video) return;
      wired = video;

      video.addEventListener('ended', () => {
        if (!autoplayEnabled) return;
        const curId = p.getVideoData?.()?.video_id;
        let nextId = null;
        let listId = null;
        if (currentPlaylist) {
          const idx = currentPlaylist.items.findIndex((it) => it.id === curId);
          if (idx !== -1 && idx + 1 < currentPlaylist.items.length) {
            nextId = currentPlaylist.items[idx + 1].id;
            listId = currentPlaylist.id;
          }
        } else {
          nextId = firstRelatedId;
        }
        if (nextId) watchNav(nextId, listId);
      }, bound);

      let saveTimer = null;
      const storedMuted = savedMuted();
      const initialVol = savedVolume();

      const applyVolume = () => {
        if (typeof p.setVolume !== 'function') return;
        p.setVolume(initialVol);
        if (storedMuted || adActive) p.mute?.(); else p.unMute?.();
      };
      applyVolume();
      setTimeout(applyVolume, 800);

      if (ui) {
        ui.vol.value = storedMuted ? 0 : initialVol;
        ui.mute.replaceChildren(storedMuted ? ICONS.muted() : ICONS.vol());
      }

      video.addEventListener('volumechange', () => {
        if (adActive || adRestoring) return;
        const pv = typeof p.getVolume === 'function' ? Math.round(p.getVolume()) : Math.round(video.volume * 100);
        const muted = typeof p.isMuted === 'function' ? p.isMuted() : video.muted;
        if (ui) {
          ui.vol.value = muted ? 0 : pv;
          ui.mute.replaceChildren(muted ? ICONS.muted() : ICONS.vol());
        }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          localStorage.setItem('itube-muted', muted ? '1' : '0');
          if (!muted && pv > 0) localStorage.setItem('itube-volume', String(pv));
        }, 300);
      }, bound);
    };
    tick();
    const timer = setInterval(tick, 500);

    const HANDLED_KEYS = new Set([' ', 'k', 'j', 'l', 'm', 'f', 'c', 'i', ',', '.', '<', '>', '/', 'Escape',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

    const onKeydown = (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable || (target.tagName === 'BUTTON' && !target.closest('#itube-bar')))) return;
      const video = wired;
      if (!video) return;
      if (HANDLED_KEYS.has(e.key)) e.stopImmediatePropagation();
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          showOSD(video.paused ? ICONS.pause : ICONS.play, video.paused ? 'Paused' : 'Playing');
          break;
        case 'j':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          showOSD(ICONS.seekBack, '⟲ 10s');
          break;
        case 'l':
          e.preventDefault();
          if (isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 10);
          showOSD(ICONS.seekFwd, '⟳ 10s');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          showOSD(ICONS.seekBack, '⟲ 5s');
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 5);
          showOSD(ICONS.seekFwd, '⟳ 5s');
          break;
        case 'ArrowUp': {
          e.preventDefault();
          const nv = setPlayerVolume(playerVolume() + 5);
          showOSD(ICONS.vol, nv + '%');
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const nv = setPlayerVolume(playerVolume() - 5);
          showOSD(ICONS.vol, nv + '%');
          break;
        }
        case 'm': {
          const m = !isMuted();
          setMuted(m);
          showOSD(m ? ICONS.muted : ICONS.vol, m ? 'Muted' : playerVolume() + '%');
          break;
        }
        case 'f':
          toggleFullscreen();
          break;
        case 'c': {
          const p = player();
          p?.toggleSubtitles?.();
          break;
        }
        case 'i':
          togglePiP(video);
          break;
        case '0': case '1': case '2': case '3': case '4':
        case '5': case '6': case '7': case '8': case '9':
          if (isFinite(video.duration)) video.currentTime = video.duration * (Number(e.key) / 10);
          break;
        case ',':
          if (video.paused) video.currentTime = Math.max(0, video.currentTime - 1 / 30);
          break;
        case '.':
          if (video.paused && isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 1 / 30);
          break;
        case '<': {
          const p = player();
          const cur = p?.getPlaybackRate?.() ?? 1;
          const idx = SPEEDS.indexOf(cur);
          const next = SPEEDS[Math.max(0, (idx === -1 ? SPEEDS.indexOf(1) : idx) - 1)];
          p?.setPlaybackRate?.(next);
          if (ui) ui.speed.value = String(next);
          showOSD(ICONS.speed, next + '×');
          break;
        }
        case '>': {
          const p = player();
          const cur = p?.getPlaybackRate?.() ?? 1;
          const idx = SPEEDS.indexOf(cur);
          const next = SPEEDS[Math.min(SPEEDS.length - 1, (idx === -1 ? SPEEDS.indexOf(1) : idx) + 1)];
          p?.setPlaybackRate?.(next);
          if (ui) ui.speed.value = String(next);
          showOSD(ICONS.speed, next + '×');
          break;
        }
        case '/':
          e.preventDefault();
          search.focus();
          break;
        case 'Escape':
          if (ui && ui.menu.style.display === 'block') ui.menu.style.display = 'none';
          break;
        default:
          break;
      }
    };
    document.addEventListener('keydown', onKeydown, true);

    let renderGeneration = 0;
    const renderWatchFor = async (videoId) => {
      const gen = ++renderGeneration;
      const data = await innertube('next', { videoId });
      if (gen !== renderGeneration) return;
      if (!data) return;
      chapterSecs = parseChapters(data);
      renderMeta(data);
      renderTicks();
      resetComments(data);
      updateQueue(videoId);
      content.scrollTop = 0;
    };
    watchApi = { renderWatchFor };

    if (mountedFromSpa) {
      const mountedId = resolveVideoId();
      if (mountedId) renderWatchFor(mountedId);
    }

    return () => {
      clearInterval(timer);
      mountAbort.abort();
      adObserver?.disconnect();
      adObserver = null;
      adObserved = null;
      adActive = false;
      adRestoring = false;
      wired = null;
      const adopted = stage.querySelector('video');
      const moviePlayer = player();
      if (adopted) {
        adopted.pause();
        if (moviePlayer) moviePlayer.appendChild(adopted);
      }
      releaseCaptions(stage);
      document.removeEventListener('keydown', onKeydown, true);
      window.removeEventListener('yt-navigate-finish', onNavigateFinish);
      watchApi = null;
    };
  };

  const watchHref = (videoId, listId) => (listId
    ? '/watch?v=' + videoId + '&list=' + encodeURIComponent(listId)
    : '/watch?v=' + videoId);

  const playable = () => {
    const pl = player();
    return pl && typeof pl.loadVideoById === 'function' ? pl : null;
  };

  const ytNavigate = (videoId, listId) => {
    const app = document.querySelector('ytd-app');
    if (!app) return false;
    const endpoint = {
      commandMetadata: {
        webCommandMetadata: {
          url: watchHref(videoId, listId),
          webPageType: 'WEB_PAGE_TYPE_WATCH',
          rootVe: 3832,
        },
      },
      watchEndpoint: listId ? { videoId, playlistId: listId } : { videoId },
    };
    app.dispatchEvent(new CustomEvent('yt-navigate', {
      detail: { endpoint },
      bubbles: true,
      composed: true,
    }));
    return true;
  };

  let watchBoot = null;
  const stopWatchBoot = () => {
    if (!watchBoot) return;
    clearInterval(watchBoot);
    watchBoot = null;
  };

  const routedTo = (videoId, listId) => {
    if (location.pathname !== '/watch') return false;
    const params = new URLSearchParams(location.search);
    if (params.get('v') === videoId) return true;
    return !!listId && params.get('list') === listId;
  };

  const bootWatch = (videoId, listId) => {
    if (!ytNavigate(videoId, listId)) return false;
    const href = watchHref(videoId, listId);
    const deadline = Date.now() + WATCH_BOOT_TIMEOUT;
    stopWatchBoot();
    watchBoot = setInterval(() => {
      if (routedTo(videoId, listId)) {
        stopWatchBoot();
        spaRoute();
        return;
      }
      if (Date.now() > deadline) {
        stopWatchBoot();
        console.warn('[itube] the router never navigated, falling back to a page load');
        location.assign(href);
      }
    }, 32);
    return true;
  };

  let requestedVideoId = null;
  let requestedAt = 0;
  let resumeVideoId = null;
  let resumeUntil = 0;

  const resumePlayback = () => {
    if (!resumeVideoId) return;
    const pl = playable();
    if (!pl) return;
    if (Date.now() > resumeUntil || pl.getVideoData?.()?.video_id !== resumeVideoId) {
      resumeVideoId = null;
      return;
    }
    const video = document.querySelector('#itube-stage video') || document.querySelector('#movie_player video');
    if (!video) return;
    if (!video.paused) {
      resumeVideoId = null;
      return;
    }
    pl.playVideo?.();
    const started = video.play?.();
    if (started && typeof started.catch === 'function') started.catch(() => {});
  };

  const requestPlayback = (pl, videoId) => {
    requestedVideoId = videoId;
    requestedAt = Date.now();
    resumeVideoId = null;
    pl.loadVideoById(videoId);
  };

  const ensureWatchPlayback = (videoId, listId) => {
    if (!videoId) return;
    const pl = playable();
    if (!pl) {
      if (!watchBoot) bootWatch(videoId, listId);
      return;
    }
    if (pl.getVideoData?.()?.video_id === videoId) {
      requestedVideoId = null;
      resumeVideoId = videoId;
      resumeUntil = Date.now() + WATCH_RESUME_MS;
      resumePlayback();
      return;
    }
    if (requestedVideoId === videoId && Date.now() - requestedAt < WATCH_LOAD_RETRY) return;
    requestPlayback(pl, videoId);
  };

  const watchNav = (videoId, listId) => {
    const pl = playable();
    if (!pl) return bootWatch(videoId, listId);
    history.pushState({}, '', watchHref(videoId, listId));
    requestPlayback(pl, videoId);
    if (watchApi) {
      setCurrentKey();
      syncNav();
      watchApi.renderWatchFor(videoId);
    } else {
      spaRoute();
    }
    return true;
  };

  let cleanup = null;
  let currentKey = null;
  let watchApi = null;
  const setTitle = (name) => {
    document.title = name ? name + ' — iTube' : 'iTube';
  };

  const NATIVE_NAV_RE = /^\/(redirect|signin|logout|upload|create_channel)(\/|$)/;

  const routeInfo = (path, search) => {
    const shorts = path.match(/^\/shorts\/([^/?]+)/);
    if (shorts) return { type: 'shorts', shortsId: shorts[1] };
    if (path === '/watch') return { type: 'watch' };
    if (path === '/') return { type: 'home' };
    if (path === '/results') return { type: 'search' };
    if (CHANNEL_PATH_RE.test(path)) return { type: 'channel' };
    if (path === '/feed/explore') return { type: 'feed', browseId: ['FEexplore', 'FEtrending'], heading: 'Explore' };
    if (FEED_BROWSE[path]) return { type: 'feed', browseId: FEED_BROWSE[path].browseId, heading: FEED_BROWSE[path].heading, useInitialData: true };
    if (path === '/playlist') {
      const listId = new URLSearchParams(search).get('list');
      if (listId) return { type: 'feed', browseId: 'VL' + listId, heading: 'Playlist', useInitialData: true };
    }
    return { type: 'unhandled' };
  };

  const keyFor = (type, path, search) => (
    (type === 'search' || type === 'feed' || type === 'watch') ? path + search : path
  );
  const setCurrentKey = () => {
    const info = routeInfo(location.pathname, location.search);
    currentKey = keyFor(info.type, location.pathname, location.search);
  };

  const route = () => {
    renderGuideChannels();
    syncAccount();
    const path = location.pathname;
    const info = routeInfo(path, location.search);
    if (info.type === 'shorts') { location.replace('/watch?v=' + encodeURIComponent(info.shortsId)); return; }

    const type = info.type;
    const browseId = info.browseId || null;
    const heading = info.heading || null;
    const useInitialData = !!info.useInitialData;

    if (type !== 'watch') stopWatchBoot();

    const key = keyFor(type, path, location.search);
    if (type === 'watch' && watchApi) {
      const wantId = new URLSearchParams(location.search).get('v');
      const playingId = player()?.getVideoData?.()?.video_id;
      if (wantId && playingId && wantId !== playingId) {
        currentKey = key;
        syncNav();
        ensureWatchPlayback(wantId, new URLSearchParams(location.search).get('list'));
        watchApi.renderWatchFor(wantId);
        spaNav = false;
        return;
      }
    }
    if (key === currentKey) { syncNav(); spaNav = false; return; }
    if (cleanup) { cleanup(); cleanup = null; }
    currentKey = key;
    syncNav();
    content.scrollTop = 0;
    setTitle(type === 'search'
      ? new URLSearchParams(location.search).get('search_query')
      : type === 'feed' ? heading
        : type === 'home' ? null
          : type === 'watch' ? null
            : null);
    if (type === 'watch' && spaNav) {
      const params = new URLSearchParams(location.search);
      ensureWatchPlayback(params.get('v'), params.get('list'));
    }
    cleanup = type === 'watch' ? mountWatch()
      : type === 'home' ? mountHome()
      : type === 'search' ? mountSearch()
      : type === 'channel' ? mountChannel()
      : type === 'feed' ? mountFeed(browseId, heading, { useInitialData })
      : mountUnhandled();
    spaNav = false;
  };

  const spaRoute = () => { spaNav = true; route(); };
  root.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a');
    if (!a || a.target === '_blank') return;
    if (a.origin !== location.origin) return;
    if (NATIVE_NAV_RE.test(a.pathname)) return;
    if (a.hasAttribute('download')) return;
    if (a.pathname === '/watch') {
      const videoId = new URLSearchParams(a.search).get('v');
      const listId = new URLSearchParams(a.search).get('list');
      if (videoId && watchNav(videoId, listId)) e.preventDefault();
      return;
    }
    e.preventDefault();
    history.pushState({}, '', a.href);
    spaRoute();
  });
  window.addEventListener('popstate', (e) => {
    e.stopImmediatePropagation();
    stopWatchBoot();
    spaRoute();
  }, true);

  window.addEventListener('yt-navigate-finish', () => {
    if (watchBoot) spaRoute(); else route();
  });
  route();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAccount, { once: true });
  }
})();
