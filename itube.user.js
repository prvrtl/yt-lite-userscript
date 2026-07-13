// ==UserScript==
// @name         iTube
// @name:en      iTube
// @namespace    https://github.com/prvrtl/yt-lite-userscript
// @version      3.6.0
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

  const CHANNEL_PATH_RE = /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+)(?:\/.*)?$/;
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
    chevron: () => icon([
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M4.5 6.2 8 9.7l3.5-3.5' }],
    ]),
    explore: () => icon([
      ['circle', { cx: '8', cy: '8', r: '5.9', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }],
      ['path', { fill: 'currentColor', d: 'M10.6 5.4 9.1 9.1 5.4 10.6 6.9 6.9z' }],
    ]),
  };

  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const MAX_COMMENTS = 50;
  const COMMENTS_PAGE = 20;
  const MAX_REPLIES = 10;
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
      --hover: rgba(255, 255, 255, .045);
      --r-xs: 8px;
      --r-sm: 12px;
      --r-md: 14px;
      --r-lg: 18px;
      --r-pill: 999px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, .18) transparent;
    }
    #itube a:focus-visible:not(.c):not(.row),
    #itube button:focus-visible,
    #itube input:focus-visible,
    #itube select:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
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
    #itube .hd-left {
      flex: 0 0 96px;
    }
    #itube .search-wrap {
      position: relative;
      flex: 1 1 auto;
      max-width: 560px;
      margin: 0 auto;
    }
    #itube .search-icon {
      position: absolute;
      left: 12px;
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
      padding: 0 14px 0 34px;
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
    #itube .hd-icon-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: none;
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    #itube .hd-icon-btn:hover {
      background: var(--surface);
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
      margin-bottom: 12px;
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
      border-radius: var(--r-xs);
      color: var(--text);
      text-decoration: none;
      font-size: 13.5px;
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
      font-size: 11px;
      font-weight: 600;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--dim);
      margin: 16px 10px 6px;
    }
    #itube .nav-chan {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 32px;
      padding: 0 10px;
      border-radius: var(--r-xs);
      color: var(--text);
      text-decoration: none;
      font-size: 13px;
    }
    #itube .nav-chan:hover {
      background: var(--hover);
    }
    #itube .nav-chan-avatar {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      object-fit: cover;
      background: var(--raised);
      flex: none;
    }
    #itube .content {
      flex: 1;
      min-width: 0;
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
    #itube .unhandled {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 120px 0;
      color: var(--muted);
      font-size: 15px;
    }
    #itube .unhandled-home {
      background: var(--accent);
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
      padding: 8px;
      margin: -8px;
      border-radius: 14px;
    }
    #itube .c:hover {
      background: var(--hover);
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
    #itube .c-thumb img.in {
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
      display: grid;
      grid-template-columns: minmax(0,1fr) 380px;
      gap: 24px;
      align-items: start;
      max-width: 1600px;
      margin: 0 auto;
      padding: 24px;
    }
    #itube .watch-left {
      min-width: 0;
    }
    #itube .watch-right {
      position: sticky;
      top: 76px;
      max-height: calc(100vh - 96px);
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, .18) transparent;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    #itube .watch-right::-webkit-scrollbar {
      width: 6px;
    }
    #itube .watch-right::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, .15);
      border-radius: 3px;
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
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      height: 100% !important;
      display: block !important;
      object-fit: contain !important;
      max-width: none !important;
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
    }
    #itube .watch-channel-info {
      flex: 1;
      min-width: 0;
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
      margin-top: 28px;
    }
    #itube .comments-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
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
    #itube .comment-avatar.in {
      opacity: 1;
      transition: opacity .18s ease-out;
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
      gap: 10px;
      text-decoration: none;
      color: var(--text);
      padding: 6px;
      margin: -6px;
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
    #itube .list {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    #itube .row {
      display: flex;
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
    #itube .c:focus-visible .c-thumb,
    #itube .row:focus-visible .row-thumb {
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
    #itube .row-thumb img.in {
      opacity: 1;
      transition: opacity .18s ease-out;
    }
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
      padding: 60px 0;
      font-size: 14px;
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
    #itube .ch-banner.in {
      opacity: 1;
      transition: opacity .18s ease-out;
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
    #itube .ch-avatar.in {
      opacity: 1;
      transition: opacity .18s ease-out;
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
      left: 50%;
      bottom: 14px;
      transform: translateX(-50%);
      width: min(94%, 920px);
      z-index: 20;
      display: grid;
      grid-template-areas: 'seek seek seek' 'left center right';
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 6px 12px;
      padding: 10px 14px 8px;
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
    if (!c?.INNERTUBE_API_KEY) return null;
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

  const getSnippet = (node) => (
    node?.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r) => r?.text || '').join('')
    || node?.descriptionSnippet?.runs?.map((r) => r?.text || '').join('')
    || null
  );

  const seenVideoIds = new Set();
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
      thumb,
      duration: texts.find((t) => /^\d+:\d\d/.test(t)) || '',
      views: rest.find((t) => /views?|watching/i.test(t)) || '',
      published: rest.find((t) => /ago/i.test(t)) || '',
      snippet: '',
    };
  };

  const extractVideos = (root, seen = seenVideoIds) => {
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
        out.push({ id, type: 'playlist', title, channel: '', thumb, duration: '', views: '', published: '', snippet: '' });
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
      out.push({ id, type: 'playlist', title, channel: '', thumb, duration: '', views: count ? count + ' videos' : '', published: '', snippet: '' });
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

  const findAllContinuationTokens = (root) => {
    const tokens = [];
    walk(root, (node) => {
      const t = node?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (typeof t === 'string' && t) tokens.push(t);
    });
    return tokens;
  };

  // The comments continuation lives inside the itemSectionRenderer tagged
  // 'comment-item-section'. Several other continuations exist on a watch
  // page (related rail, etc.), so we cannot just take the first token found.
  // If the section identifier is ever renamed, fall back to the last
  // continuation on the page — comments load after everything else.
  const findCommentsToken = (root) => {
    const section = findNode(root, (n) => n?.itemSectionRenderer?.sectionIdentifier === 'comment-item-section')?.itemSectionRenderer;
    if (section) {
      const t = findContinuationToken(section);
      if (t) return t;
    }
    const tokens = findAllContinuationTokens(root);
    return tokens.length ? tokens[tokens.length - 1] : null;
  };

  // Comment view-models keep their text/author/etc in a separate entity
  // batch, keyed by an entityKey that the commentViewModel references.
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

  const getCommentAvatar = (legacy, author) => (
    (Array.isArray(legacy?.authorThumbnail?.thumbnails) && legacy.authorThumbnail.thumbnails.length
      ? legacy.authorThumbnail.thumbnails[legacy.authorThumbnail.thumbnails.length - 1]?.url
      : null)
    || author?.avatarThumbnailUrl
    || author?.avatar?.thumbnails?.[0]?.url
    || null
  );

  // Tolerant comment extractor: handles the legacy commentThreadRenderer →
  // comment.commentRenderer shape AND the newer commentViewModel shape,
  // whose actual data lives in the entity batch (see commentEntityMap).
  const extractComment = (thread, entityMap) => {
    const legacy = thread?.comment?.commentRenderer || thread?.commentRenderer;
    if (legacy) {
      const text = (legacy.contentText?.runs || []).map((r) => r?.text || '').join('') || legacy.contentText?.simpleText || '';
      const replyToken = findContinuationToken(thread?.replies);
      const replyCount = Number(legacy.replyCount) || (replyToken ? 1 : 0);
      return {
        id: legacy.commentId || null,
        author: legacy.authorText?.simpleText || legacy.authorText?.runs?.[0]?.text || '',
        avatar: getCommentAvatar(legacy, null),
        text,
        published: legacy.publishedTimeText?.runs?.[0]?.text || legacy.publishedTimeText?.simpleText || '',
        likes: legacy.voteCount?.simpleText || legacy.voteCount?.accessibility?.accessibilityData?.label || '',
        replyCount,
        replyToken,
      };
    }
    const vm = thread?.commentViewModel;
    if (!vm) return null;
    const key = vm.commentKey || vm.key || vm.commentId;
    const payload = key ? entityMap.get(key) : null;
    const props = payload?.properties || vm.properties;
    if (!props) return null;
    const author = payload?.author || vm.author;
    const toolbar = payload?.toolbar || vm.toolbar;
    const replyToken = findContinuationToken(thread?.replies);
    const replyCount = Number(toolbar?.replyCount) || Number(props.replyCount) || (replyToken ? 1 : 0);
    return {
      id: props.commentId || payload?.key || key || null,
      author: author?.displayName || '',
      avatar: getCommentAvatar(null, author),
      text: props.content?.content || '',
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

  const createCard = (item) => {
    const a = document.createElement('a');
    a.className = 'c';
    a.href = item.type === 'playlist'
      ? '/playlist?list=' + encodeURIComponent(item.id)
      : '/watch?v=' + encodeURIComponent(item.id);
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

  const createRowCard = (item) => {
    const a = document.createElement('a');
    a.className = 'row';
    a.href = '/watch?v=' + encodeURIComponent(item.id);
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
    const chan = document.createElement('div');
    chan.className = 'row-chan';
    chan.textContent = item.channel || '';
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
    a.append(thumbWrap, body);
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

    const bodyEl = document.createElement('div');
    bodyEl.className = 'comment-body';

    const head = document.createElement('div');
    head.className = 'comment-head';
    const author = document.createElement('span');
    author.className = 'comment-author';
    author.textContent = item.author || '';
    const time = document.createElement('span');
    time.className = 'comment-time';
    time.textContent = item.published || '';
    head.append(author, time);

    const text = document.createElement('div');
    text.className = 'comment-text';
    text.textContent = item.text || '';

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

    row.append(avatar, bodyEl);
    return row;
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
    if (q) location.href = '/results?search_query=' + encodeURIComponent(q);
  });
  searchWrap.append(searchIcon, search);
  const hdRight = document.createElement('div');
  hdRight.className = 'hd-right';
  const bell = document.createElement('button');
  bell.className = 'hd-icon-btn';
  bell.type = 'button';
  bell.setAttribute('aria-label', 'Notifications');
  bell.appendChild(icon([
    ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linejoin': 'round', d: 'M4 6.5a4 4 0 0 1 8 0v3l1.3 2H2.7l1.3-2z' }],
    ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', d: 'M6.5 13.5a1.6 1.6 0 0 0 3 0' }],
  ]));
  const avatar = document.createElement('div');
  avatar.className = 'hd-avatar';
  hdRight.append(bell, avatar);
  header.append(hdLeft, searchWrap, hdRight);

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
  nav.appendChild(brand);
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
  const fetchGuideChannels = async () => {
    const res = await innertube('guide', {});
    const out = [];
    const seenIds = new Set();
    walk(res, (node) => {
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
  const subsSection = document.createElement('div');
  subsSection.className = 'nav-subs';
  nav.appendChild(subsSection);
  let guideChannelsCache = null;
  let guideChannelsPromise = null;
  const paintGuideChannels = () => {
    const channels = guideChannelsCache || [];
    if (!channels.length) { subsSection.replaceChildren(); return; }
    const label = document.createElement('div');
    label.className = 'nav-section-label';
    label.textContent = 'SUBSCRIPTIONS';
    const rows = [label];
    for (const ch of channels) {
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
  const renderGuideChannels = () => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderGuideChannels, { once: true });
      return;
    }
    if (guideChannelsCache) { paintGuideChannels(); return; }
    if (guideChannelsPromise) return;
    guideChannelsPromise = fetchGuideChannels()
      .then((channels) => {
        guideChannelsCache = channels;
        paintGuideChannels();
      })
      .catch(() => { guideChannelsCache = []; });
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
      } catch (e) {}
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
      const resumeItems = extractResumeItems(data, new Set());
      for (const it of resumeItems) seenVideoIds.add(it.id);
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
      const items = extractVideos(data);
      for (const item of items) grid.insertBefore(createCard(item), sentinel);
      continuationToken = findContinuationToken(data);
      heading.style.display = grid.querySelector('.c') ? '' : 'none';
    };

    const heading = document.createElement('h2');
    heading.className = 'section-heading';
    heading.textContent = 'Recommended';
    heading.style.display = 'none';
    view.replaceChildren(heading, grid, spinner);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderInitial, { once: true });
    } else {
      renderInitial();
    }

    return () => { io.disconnect(); };
  };

  const mountSearch = () => {
    const query = new URLSearchParams(location.search).get('search_query') || '';
    search.value = query;
    const seen = new Set();

    const list = document.createElement('div');
    list.className = 'list';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.textContent = 'Loading…';
    const sentinel = document.createElement('div');
    sentinel.className = 'sentinel';
    list.append(sentinel);

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
      if (items) appendRows(items);
    };
    const scheduleAppend = (items) => {
      pendingItems = pendingItems ? pendingItems.concat(items) : items;
      if (appendScheduled) return;
      appendScheduled = true;
      idle(tryAppend);
    };

    const MAX_ROWS = 200;
    const capList = () => {
      const rows = list.querySelectorAll('.row');
      const excess = rows.length - MAX_ROWS;
      if (excess <= 0) return;
      const heightBefore = list.getBoundingClientRect().height;
      for (let i = 0; i < excess; i++) {
        rows[i].remove();
      }
      const heightAfter = list.getBoundingClientRect().height;
      const removedHeight = heightBefore - heightAfter;
      let spacer = list.querySelector('.spacer');
      if (!spacer) {
        spacer = document.createElement('div');
        spacer.className = 'spacer';
        list.insertBefore(spacer, list.firstChild);
      }
      const current = parseFloat(spacer.style.height) || 0;
      spacer.style.height = (current + removedHeight) + 'px';
    };

    const appendRows = (items) => {
      for (const item of items) {
        list.insertBefore(createRowCard(item), sentinel);
      }
      capList();
    };

    const showEmpty = (msg) => {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = msg;
      list.replaceChildren(empty);
    };

    let continuationToken = null;
    let loading = false;
    const loadMore = async () => {
      if (loading || !continuationToken) return;
      loading = true;
      spinner.classList.add('show');
      try {
        const res = await innertube('search', { continuation: continuationToken });
        if (!res) return;
        const items = extractVideos(res, seen);
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

    if (query) {
      const label = document.createElement('div');
      label.className = 'search-label';
      label.textContent = 'Results for';
      const queryHeading = document.createElement('h1');
      queryHeading.className = 'search-query';
      queryHeading.textContent = query;
      view.replaceChildren(label, queryHeading, list, spinner);
    } else {
      view.replaceChildren(list, spinner);
    }

    const runInitial = async () => {
      if (!query) {
        showEmpty('Type something to search.');
        return;
      }
      loading = true;
      spinner.classList.add('show');
      try {
        const res = await innertube('search', { query });
        if (!res) {
          showEmpty('Something went wrong.');
          return;
        }
        const items = extractVideos(res, seen);
        continuationToken = findContinuationToken(res);
        if (items.length === 0 && !continuationToken) {
          showEmpty('No results for "' + query + '"');
          return;
        }
        for (const item of items) list.insertBefore(createRowCard(item), sentinel);
      } finally {
        loading = false;
        spinner.classList.remove('show');
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runInitial, { once: true });
    } else {
      runInitial();
    }

    return () => { io.disconnect(); };
  };

  const mountChannel = () => {
    const CHANNEL_ID_IN_PATH_RE = /^\/channel\/([^/]+)/;
    const resolveBrowseId = () => {
      const m = location.pathname.match(CHANNEL_ID_IN_PATH_RE);
      if (m) return m[1];
      const data = window.ytInitialData;
      const metaNode = findNode(data, (n) => typeof n?.metadata?.channelMetadataRenderer?.externalId === 'string');
      if (metaNode) return metaNode.metadata.channelMetadataRenderer.externalId;
      const idNode = findNode(data, (n) => typeof n?.browseId === 'string' && n.browseId.startsWith('UC'));
      return idNode ? idNode.browseId : null;
    };

    const showEmpty = (msg) => {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = msg;
      view.replaceChildren(empty);
    };

    const seen = new Set();

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
    let currentExtractor = extractVideos;
    const loadMore = async () => {
      if (loading || !continuationToken) return;
      loading = true;
      spinner.classList.add('show');
      try {
        const res = await innertube('browse', { continuation: continuationToken });
        if (!res) return;
        const items = currentExtractor(res, seen);
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

    const header = document.createElement('div');
    header.className = 'ch-header';

    const thumbFrom = (node) => {
      const list = node?.thumbnails;
      if (Array.isArray(list) && list.length) return list[list.length - 1]?.url || null;
      return getThumb(node);
    };

    const decodeParams = (p) => {
      try {
        return atob(String(p).replace(/-/g, '+').replace(/_/g, '/'));
      } catch (e) {
        return '';
      }
    };

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

    let browseId = null;
    let activeTab = 'videos';
    const tabBtns = {};

    const clearGrid = () => {
      for (const c of grid.querySelectorAll('.c')) c.remove();
      const spacer = grid.querySelector('.spacer');
      if (spacer) spacer.remove();
    };

    const loadTab = async (tab) => {
      activeTab = tab;
      currentExtractor = tab === 'playlists' ? extractPlaylists : extractVideos;
      seen.clear();
      continuationToken = null;
      clearGrid();
      loading = true;
      spinner.classList.add('show');
      try {
        const params = tabParams(tab);
        const res = await innertube('browse', params ? { browseId, params } : { browseId });
        if (!res) return;
        const items = currentExtractor(res, seen);
        continuationToken = findContinuationToken(res);
        for (const item of items) grid.insertBefore(createCard(item), sentinel);
      } finally {
        loading = false;
        spinner.classList.remove('show');
      }
    };

    const makeTabBtn = (key, label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ch-tab';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (activeTab === key || loading) return;
        for (const k in tabBtns) tabBtns[k].classList.toggle('active', k === key);
        loadTab(key);
      });
      tabBtns[key] = btn;
      return btn;
    };

    const runInitial = async () => {
      browseId = resolveBrowseId();
      if (!browseId) {
        showEmpty("Couldn't load this channel.");
        return;
      }
      view.replaceChildren(header, grid, spinner);
      loading = true;
      spinner.classList.add('show');
      try {
        const params = tabParams('videos');
        const res = await innertube('browse', params ? { browseId, params } : { browseId });
        if (!res) {
          showEmpty("Couldn't load this channel.");
          return;
        }

        const getHeaderRenderer = (data) => (
          findNode(data, (n) => n?.c4TabbedHeaderRenderer)?.c4TabbedHeaderRenderer
          || findNode(data, (n) => n?.pageHeaderRenderer)?.pageHeaderRenderer
          || null
        );
        const h = getHeaderRenderer(res);
        if (h) {
          const imgFrom = (node) => {
            let best = null;
            walk(node, (n) => {
              if (best) return;
              const list = Array.isArray(n.sources) ? n.sources : (Array.isArray(n.thumbnails) ? n.thumbnails : null);
              if (list && list.length) {
                const u = list[list.length - 1]?.url;
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
          const meta = document.createElement('div');
          meta.className = 'ch-meta';
          meta.textContent = [handle, subCount, videoCount].filter(Boolean).join(' · ');
          header.append(nameEl, meta);

          const tabsEl = document.createElement('div');
          tabsEl.className = 'ch-tabs';
          tabsEl.appendChild(makeTabBtn('videos', 'Videos'));
          if (tabParams('playlists')) tabsEl.appendChild(makeTabBtn('playlists', 'Playlists'));
          tabBtns.videos.classList.add('active');
          header.appendChild(tabsEl);
        }

        const items = extractVideos(res, seen);
        continuationToken = findContinuationToken(res);
        for (const item of items) grid.insertBefore(createCard(item), sentinel);
      } finally {
        loading = false;
        spinner.classList.remove('show');
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runInitial, { once: true });
    } else {
      runInitial();
    }

    return () => { io.disconnect(); };
  };

  const mountFeed = (browseIds, heading, opts = {}) => {
    const ids = Array.isArray(browseIds) ? browseIds : [browseIds];
    const useInitialData = !!opts.useInitialData;
    const seen = new Set();

    const headingEl = document.createElement('h1');
    headingEl.className = 'page-heading';
    headingEl.textContent = heading;

    const grid = document.createElement('div');
    grid.className = 'grid';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.textContent = 'Loading…';
    const sentinel = document.createElement('div');
    sentinel.className = 'sentinel';
    grid.append(sentinel);

    const showEmpty = (msg) => {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = msg;
      view.replaceChildren(headingEl, empty);
    };

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
        const items = extractVideos(res, seen);
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

    const setPlaylistTitle = (res) => {
      try {
        const node = findNode(res, (n) => n?.playlistHeaderRenderer)?.playlistHeaderRenderer;
        const title = node?.title?.runs?.[0]?.text || node?.title?.simpleText || node?.title?.content;
        if (title) headingEl.textContent = title;
      } catch (e) {}
    };

    const fetchFromApi = async () => {
      for (const id of ids) {
        const res = await innertube('browse', { browseId: id });
        if (!res) continue;
        if (id.startsWith('VL')) setPlaylistTitle(res);
        const items = extractVideos(res, seen);
        const token = findContinuationToken(res);
        if (items.length || token) return { items, token };
      }
      return null;
    };

    const runInitial = async () => {
      view.replaceChildren(headingEl, grid, spinner);
      loading = true;
      spinner.classList.add('show');
      try {
        if (useInitialData) {
          const pageData = window.ytInitialData;
          const initialItems = pageData ? extractVideos(pageData, seen) : [];
          if (initialItems.length) {
            if (ids[0].startsWith('VL')) setPlaylistTitle(pageData);
            continuationToken = findContinuationToken(pageData);
            for (const item of initialItems) grid.insertBefore(createCard(item), sentinel);
            return;
          }
        }
        const result = await fetchFromApi();
        if (!result) {
          showEmpty('Nothing here yet.');
          return;
        }
        continuationToken = result.token;
        if (result.items.length === 0 && !continuationToken) {
          showEmpty('Nothing here yet.');
          return;
        }
        for (const item of result.items) grid.insertBefore(createCard(item), sentinel);
      } finally {
        loading = false;
        spinner.classList.remove('show');
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runInitial, { once: true });
    } else {
      runInitial();
    }

    return () => { io.disconnect(); };
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

  const adoptVideo = (stage) => {
    const v = document.querySelector('#movie_player video');
    if (!v || v.parentElement === stage) return;
    stage.insertBefore(v, stage.firstChild);
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
    left.append(prev, play, next, timeCur);
    center.append(live);
    right.append(timeDur, mute, vol, more, pip, fs);
    bar.append(seekwrap, left, center, right, menu);
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
    const meta = document.createElement('div');
    meta.className = 'watch-meta';
    const channelRow = document.createElement('div');
    channelRow.className = 'watch-channel';
    const avatar = document.createElement('img');
    avatar.className = 'watch-avatar';
    const channelInfo = document.createElement('div');
    channelInfo.className = 'watch-channel-info';
    const channelName = document.createElement('div');
    channelName.className = 'watch-channel-name';
    const subs = document.createElement('div');
    subs.className = 'watch-subs';
    channelInfo.append(channelName, subs);
    channelRow.append(avatar, channelInfo);
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
    meta.append(channelRow, metaDivider, stats, desc, descToggle);

    const commentsPanel = document.createElement('div');
    commentsPanel.className = 'comments';
    const commentsToggle = document.createElement('button');
    commentsToggle.className = 'comments-toggle';
    const commentsChevron = ICONS.chevron();
    const commentsLabel = document.createElement('span');
    commentsLabel.textContent = 'Comments';
    commentsToggle.append(commentsChevron, commentsLabel);
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
    commentsPanel.append(commentsToggle, commentsBody);

    watchLeft.append(stage, title, meta, commentsPanel);
    watch.append(watchLeft, watchRight);

    view.replaceChildren(watch);

    const buildDescriptionSegments = (secondary) => {
      try {
        const attributed = secondary?.attributedDescription;
        if (attributed?.content) {
          const content = attributed.content;
          const commandRuns = (attributed.commandRuns || [])
            .filter((r) => typeof r?.startIndex === 'number' && typeof r?.length === 'number' && r?.onTap?.innertubeCommand)
            .sort((a, b) => a.startIndex - b.startIndex);
          const segments = [];
          let cursor = 0;
          for (const run of commandRuns) {
            if (run.startIndex > cursor) segments.push({ text: content.slice(cursor, run.startIndex) });
            const url = run.onTap.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || null;
            segments.push({ text: content.slice(run.startIndex, run.startIndex + run.length), url });
            cursor = run.startIndex + run.length;
          }
          if (cursor < content.length) segments.push({ text: content.slice(cursor) });
          return segments;
        }
        const runsArr = secondary?.description?.runs;
        if (Array.isArray(runsArr) && runsArr.length) {
          return runsArr.map((r) => ({
            text: r?.text || '',
            url: r?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || null,
          }));
        }
      } catch (e) {}
      return null;
    };

    const renderDescription = (segments, fallbackText) => {
      desc.replaceChildren();
      if (segments && segments.length) {
        for (const seg of segments) {
          if (!seg.text) continue;
          if (seg.url) {
            const a = document.createElement('a');
            a.className = 'watch-desc-link';
            a.href = seg.url;
            a.textContent = seg.text;
            desc.appendChild(a);
          } else {
            desc.appendChild(document.createTextNode(seg.text));
          }
        }
      } else {
        desc.textContent = fallbackText || '';
      }
    };

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
      watchRight.replaceChildren();
      for (const item of related) watchRight.appendChild(createCompactCard(item));
    };
    renderMeta();

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
      try {
        const res = await innertube('next', { continuation: commentsToken });
        if (!res) return;
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

    const resetComments = () => {
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
      commentsToken = findCommentsToken(window.ytInitialData);
      const count = getCommentsCount(window.ytInitialData);
      commentsLabel.textContent = count || 'Comments';
      commentsToggle.disabled = !commentsToken;
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
    resetComments();

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
      resetComments();
    };
    window.addEventListener('yt-navigate-finish', onNavigateFinish);

    const tick = () => {
      const video = document.querySelector('#movie_player video');
      const p = player();
      if (!video || !p) return;
      if (video.hasAttribute('controls')) video.removeAttribute('controls');
      if (video.disablePictureInPicture) video.disablePictureInPicture = false;
      adoptVideo(stage);
      fit(video);
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
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || (target.tagName === 'BUTTON' && !target.closest('#itube-bar')))) return;
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
  let currentKey = null;
  const route = () => {
    renderGuideChannels();
    const path = location.pathname;
    const shorts = path.match(/^\/shorts\/([^/?]+)/);
    if (shorts) { location.replace('/watch?v=' + encodeURIComponent(shorts[1])); return; }

    let type = null, browseId = null, heading = null, useInitialData = false;
    if (path === '/watch') type = 'watch';
    else if (path === '/') type = 'home';
    else if (path === '/results') type = 'search';
    else if (CHANNEL_PATH_RE.test(path)) type = 'channel';
    else if (path === '/feed/explore') { type = 'feed'; browseId = ['FEexplore', 'FEtrending']; heading = 'Explore'; }
    else if (FEED_BROWSE[path]) { type = 'feed'; browseId = FEED_BROWSE[path].browseId; heading = FEED_BROWSE[path].heading; useInitialData = true; }
    else if (path === '/playlist') {
      const listId = new URLSearchParams(location.search).get('list');
      if (listId) { type = 'feed'; browseId = 'VL' + listId; heading = 'Playlist'; useInitialData = true; }
    }
    if (!type) type = 'unhandled';

    const key = (type === 'search' || type === 'feed') ? path + location.search : path;
    if (key === currentKey) { syncNav(); return; }
    if (cleanup) { cleanup(); cleanup = null; }
    currentKey = key;
    syncNav();
    cleanup = type === 'watch' ? mountWatch()
      : type === 'home' ? mountHome()
      : type === 'search' ? mountSearch()
      : type === 'channel' ? mountChannel()
      : type === 'feed' ? mountFeed(browseId, heading, { useInitialData })
      : mountUnhandled();
  };

  window.addEventListener('yt-navigate-finish', route);
  route();
})();
