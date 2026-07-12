// ==UserScript==
// @name         YouTube Lite — fast, simple rendering
// @namespace    yt-us
// @version      2.7.0
// @description  Strips YouTube's heavy UI, deep DOM pruning, custom liquid-glass video player with full YouTube integration.
// @updateURL    https://raw.githubusercontent.com/prvrtl/yt-lite-userscript/main/youtube-lite.user.js
// @downloadURL  https://raw.githubusercontent.com/prvrtl/yt-lite-userscript/main/youtube-lite.user.js
// @match        https://www.youtube.com/*
// @exclude      https://www.youtube.com/embed/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const HIDE_SHORTS_SHELVES = true;
  const DISABLE_HOVER_PREVIEWS = true;
  const DISABLE_AMBIENT_MODE = true;
  const PRUNE_HIDDEN_PANELS = true;
  const PRUNE_LEGACY_ICONSETS = true;
  const PRUNE_PLAYER_OVERLAYS = true;
  const MAX_RELATED = 10;
  const MAX_COMMENT_THREADS = 10;
  const MAX_REPLIES = 10;
  const GRID_MIN_WIDTH = 240;
  const REMOVE_SHORTS = true;
  const CLEAN_SIDEBAR = true;
  const GLASS_PLAYER = true;
  const GLASS_UI = true;
  const FORCE_DARK = true;
  const REDIRECT_SHORTS = true;
  const NATIVE_ICONS = true;
  const HIDE_CHIP_BAR = true;
  const MINIMAL_SIDEBAR = true;
  const ITUBE_LOGO = true;
  const LEAN_CARDS = true;
  const LEAN_SIDEBAR = true;

  const shortsToWatch = () => {
    const m = location.pathname.match(/^\/shorts\/([\w-]{5,})/);
    if (m) location.replace('/watch?v=' + m[1]);
    return !!m;
  };
  if (REDIRECT_SHORTS && shortsToWatch()) return;

  const PANEL_KEEP = new Set(['engagement-panel-structured-description']);
  const RELATED_TAGS = new Set(['YT-LOCKUP-VIEW-MODEL', 'YTD-COMPACT-VIDEO-RENDERER']);
  const COMMENT_TAGS = new Set(['YTD-COMMENT-THREAD-RENDERER']);
  const REPLY_TAGS = new Set(['YTD-COMMENT-VIEW-MODEL', 'YTD-COMMENT-RENDERER']);
  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const QUALITY_LABELS = {
    highres: '4320p', hd2160: '2160p', hd1440: '1440p', hd1080: '1080p',
    hd720: '720p', large: '480p', medium: '360p', small: '240p', tiny: '144p',
    auto: 'Auto',
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  const icon = (nodes) => {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('width', '15');
    s.setAttribute('height', '15');
    for (const [tag, attrs] of nodes) {
      const n = document.createElementNS(SVGNS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      s.appendChild(n);
    }
    return s;
  };
  const ICONS = {
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
    home: () => icon([['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linejoin': 'round', d: 'M2.2 7.2 8 2.6l5.8 4.6V13a.9.9 0 0 1-.9.9H3.1a.9.9 0 0 1-.9-.9z' }]]),
    subs: () => icon([
      ['rect', { x: '1.6', y: '3.4', width: '12.8', height: '9.2', rx: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }],
      ['path', { fill: 'currentColor', d: 'M6.7 5.9 10.6 8l-3.9 2.1z' }],
    ]),
    history: () => icon([
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', d: 'M2.6 6.2A5.8 5.8 0 1 1 2.2 8' }],
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M1.2 3.6v2.8h2.8' }],
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M8 5.1V8l2.1 1.3' }],
    ]),
    later: () => icon([
      ['circle', { cx: '8', cy: '8', r: '5.9', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }],
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M8 4.6V8l2.4 1.5' }],
    ]),
    playlist: () => icon([
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', d: 'M2 4.2h9M2 7.6h9M2 11h5.4' }],
      ['path', { fill: 'currentColor', d: 'M10.6 8.6 14 10.7l-3.4 2.1z' }],
    ]),
    liked: () => icon([
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linejoin': 'round', d: 'M5.6 13.9V6.9l2.7-4.8.9.5a1.7 1.7 0 0 1 .8 1.9l-.6 1.9h3.2a1.2 1.2 0 0 1 1.2 1.5l-1.1 4.6a1.7 1.7 0 0 1-1.6 1.4z' }],
      ['rect', { x: '1.7', y: '6.9', width: '2.6', height: '7', rx: '.6', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }],
    ]),
    videos: () => icon([
      ['rect', { x: '1.6', y: '3.4', width: '12.8', height: '9.2', rx: '1.6', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }],
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', d: 'M4.6 3.4v9.2M11.4 3.4v9.2' }],
    ]),
    download: () => icon([['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M8 2.4v7.2M5.2 6.9 8 9.7l2.8-2.8M2.6 13.2h10.8' }]]),
    person: () => icon([
      ['circle', { cx: '8', cy: '5.4', r: '2.7', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }],
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', d: 'M2.9 13.6a5.1 5.1 0 0 1 10.2 0' }],
    ]),
    menu: () => icon([['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', d: 'M2.2 4.2h11.6M2.2 8h11.6M2.2 11.8h11.6' }]]),
    search: () => icon([
      ['circle', { cx: '7', cy: '7', r: '4.6', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }],
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', d: 'M10.4 10.4 14 14' }],
    ]),
    bell: () => icon([
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linejoin': 'round', d: 'M8 2.1a3.8 3.8 0 0 0-3.8 3.8v2.5L3 10.7h10L11.8 8.4V5.9A3.8 3.8 0 0 0 8 2.1z' }],
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', d: 'M6.6 12.4a1.5 1.5 0 0 0 2.8 0' }],
    ]),
    plus: () => icon([['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', d: 'M8 3.2v9.6M3.2 8h9.6' }]]),
    share: () => icon([
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M4.2 7.6v5.3a1 1 0 0 0 1 1h5.6a1 1 0 0 0 1-1V7.6' }],
      ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M8 10V2.2M5.2 5 8 2.2 10.8 5' }],
    ]),
    save: () => icon([['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linejoin': 'round', d: 'M4 2.6h8v11l-4-2.7-4 2.7z' }]]),
  };

  const KILL = [
    'tp-yt-paper-tooltip',
    'yt-touch-feedback-shape',
    'yt-interaction',
    'ytd-miniplayer',
    'ytd-merch-shelf-renderer',
    'yt-mealbar-promo-renderer',
    'ytd-mealbar-promo-renderer',
    DISABLE_HOVER_PREVIEWS && 'ytd-video-preview',
    DISABLE_HOVER_PREVIEWS && 'ytd-rich-item-renderer video',
    DISABLE_HOVER_PREVIEWS && 'yt-lockup-view-model video',
    DISABLE_HOVER_PREVIEWS && 'ytd-video-renderer video',
    DISABLE_HOVER_PREVIEWS && 'ytd-compact-video-renderer video',
    REMOVE_SHORTS && 'ytm-shorts-lockup-view-model',
    REMOVE_SHORTS && 'ytd-reel-shelf-renderer',
    REMOVE_SHORTS && 'ytd-reel-item-renderer',
    DISABLE_AMBIENT_MODE && '#cinematics canvas',
    PRUNE_LEGACY_ICONSETS && 'iron-iconset-svg',
    PRUNE_PLAYER_OVERLAYS && '.ytp-ce-element',
    PRUNE_PLAYER_OVERLAYS && '.ytp-cards-teaser',
    PRUNE_PLAYER_OVERLAYS && '.ytp-paid-content-overlay',
    PRUNE_PLAYER_OVERLAYS && '.ytp-iv-video-content',
  ].filter(Boolean).join(',');

  const CARD_JUNK = [
    LEAN_CARDS && 'ytd-rich-item-renderer yt-decorated-avatar-view-model',
    LEAN_CARDS && 'ytd-rich-item-renderer yt-touch-feedback-shape',
    LEAN_CARDS && 'ytd-rich-item-renderer yt-thumbnail-overlay-toggle-button-view-model',
  ].filter(Boolean).join(',');

  const CSS = `
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
    * {
      box-shadow: none !important;
      text-shadow: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    ytd-rich-item-renderer { content-visibility: auto; contain-intrinsic-size: 0 230px; }
    ytd-comment-thread-renderer { content-visibility: auto; contain-intrinsic-size: 0 120px; }
    #related yt-lockup-view-model,
    #related ytd-compact-video-renderer { content-visibility: auto; contain-intrinsic-size: 0 100px; }
    ytd-video-renderer, ytd-playlist-video-renderer { content-visibility: auto; contain-intrinsic-size: 0 140px; }
    ${DISABLE_AMBIENT_MODE ? '#cinematics,' : ''}
    ${DISABLE_HOVER_PREVIEWS ? 'ytd-video-preview, yt-thumbnail-view-model video, a#thumbnail video, ytd-thumbnail-overlay-loading-preview-renderer,' : ''}
    ${HIDE_SHORTS_SHELVES ? 'ytd-rich-section-renderer, ytd-reel-shelf-renderer,' : ''}
    ytd-miniplayer,
    ytd-merch-shelf-renderer,
    yt-mealbar-promo-renderer,
    ytd-mealbar-promo-renderer,
    #clarify-box,
    tp-yt-paper-tooltip,
    yt-interaction,
    yt-touch-feedback-shape { display: none !important; }

    ${GLASS_PLAYER ? `
    #movie_player .ytp-chrome-top,
    #movie_player .ytp-chrome-bottom,
    #movie_player .ytp-gradient-top,
    #movie_player .ytp-gradient-bottom,
    #movie_player .ytp-tooltip,
    #movie_player .ytp-bezel,
    #movie_player .ytp-bezel-text-wrapper,
    #movie_player .ytp-pause-overlay { display: none !important; }
    #movie_player .ytp-caption-window-container { pointer-events: none !important; }
    #ytl-bar {
      position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%);
      width: min(94%, 920px); z-index: 10000;
      display: flex; align-items: center; gap: 12px;
      padding: 8px 12px; border-radius: 22px;
      background: rgba(18, 18, 24, .52);
      backdrop-filter: blur(22px) saturate(1.7) !important;
      -webkit-backdrop-filter: blur(22px) saturate(1.7) !important;
      border: 1px solid rgba(255, 255, 255, .17);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .22), 0 8px 32px rgba(0, 0, 0, .35) !important;
      color: #fff; font: 500 12px -apple-system, system-ui, sans-serif;
      opacity: 0; visibility: hidden; pointer-events: none;
    }
    #ytl-left, #ytl-right { display: flex; align-items: center; gap: 4px; flex: 0 0 190px; }
    #ytl-left { justify-content: flex-start; }
    #ytl-right { justify-content: flex-end; }
    #ytl-center { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    #ytl-menu {
      position: absolute; right: 10px; bottom: 100%;
      display: none; min-width: 208px; padding: 6px; z-index: 10002;
      border-radius: 16px;
      background: rgba(18, 18, 24, .72);
      backdrop-filter: blur(22px) saturate(1.7) !important;
      -webkit-backdrop-filter: blur(22px) saturate(1.7) !important;
      border: 1px solid rgba(255, 255, 255, .17);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .22), 0 8px 32px rgba(0, 0, 0, .35) !important;
    }
    .ytl-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 5px 8px; border-radius: 10px; }
    .ytl-row:hover { background: rgba(255, 255, 255, .08); }
    .ytl-row > span { opacity: .7; }
    #ytl-menu select { min-width: 96px; }
    #ytl-menu #ytl-auto { width: auto; height: 22px; padding: 0 12px; border-radius: 999px; background: rgba(255, 255, 255, .12); font: 500 11px -apple-system, system-ui, sans-serif; }
    #movie_player.ytl-show #ytl-bar, #ytl-bar:focus-within {
      opacity: 1; visibility: visible; pointer-events: auto;
    }
    #ytl-bar button {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; padding: 0; border: none; border-radius: 50%;
      background: transparent; color: #fff; cursor: pointer; flex: none;
    }
    #ytl-bar button:hover { background: rgba(255, 255, 255, .14); }
    #ytl-bar button:active { background: rgba(255, 255, 255, .22); }
    #ytl-bar select {
      -webkit-appearance: none; appearance: none;
      background: rgba(255, 255, 255, .1); color: #fff;
      font: 500 11px -apple-system, system-ui, sans-serif;
      border: 1px solid rgba(255, 255, 255, .14); border-radius: 999px;
      padding: 3px 9px; cursor: pointer; flex: none; text-align: center;
    }
    #ytl-bar .ytl-time { flex: none; opacity: .85; font-variant-numeric: tabular-nums; }
    #ytl-bar input[type="range"] {
      -webkit-appearance: none; appearance: none;
      height: 4px; border-radius: 2px; background: rgba(255, 255, 255, .18);
      cursor: pointer; margin: 0;
    }
    #ytl-bar input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 12px; height: 12px; border-radius: 50%; background: #fff; border: none;
    }
    #ytl-seekwrap { position: relative; flex: 1; display: flex; align-items: center; min-width: 60px; }
    #ytl-seek { width: 100%; }
    .ytl-tick {
      position: absolute; top: 50%; transform: translate(-50%, -50%);
      width: 2px; height: 8px; border-radius: 1px;
      background: rgba(10, 10, 14, .55); pointer-events: none;
    }
    #ytl-vol { width: 56px; flex: none; }
    #ytl-preview {
      position: absolute; bottom: 24px; transform: translateX(-50%);
      display: none; pointer-events: none; z-index: 10001;
      border-radius: 10px; border: 1px solid rgba(255, 255, 255, .25);
      overflow: hidden; background-color: #000; background-repeat: no-repeat;
    }
    #ytl-preview .ytl-ptime {
      position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
      font: 600 11px -apple-system, system-ui, sans-serif; color: #fff;
      background: rgba(0, 0, 0, .6); padding: 1px 6px; border-radius: 6px;
    }
    #ytl-live { width: auto !important; border-radius: 999px !important; padding: 0 10px !important; font-weight: 600; }
    #ytl-live::before {
      content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%;
      background: #f33; margin-right: 5px;
    }
    #ytl-live.ytl-behind { opacity: .55; }
    #ytl-live.ytl-behind::before { background: #999; }
    ` : ''}

    ${GLASS_UI ? `
    html, ytd-app {
      --yt-sys-color-baseline--base-background: #0b0c10 !important;
      --yt-sys-color-baseline--raised-background: #16181f !important;
      --yt-sys-color-baseline--text-primary: #f2f3f5 !important;
      --yt-sys-color-baseline--text-secondary: #969aa6 !important;
      --yt-sys-color-baseline--call-to-action: #0a84ff !important;
      --yt-sys-color-baseline--outline: rgba(255, 255, 255, .11) !important;
      --yt-sys-color-baseline--tonal-rim: rgba(255, 255, 255, .11) !important;
      --yt-sys-color-baseline--additive-background: rgba(255, 255, 255, .07) !important;
    }
    ytd-app { background: #0b0c10 !important; }
    ytd-masthead, ytd-masthead #background {
      background: rgba(12, 12, 18, .62) !important;
      backdrop-filter: blur(24px) saturate(1.8) !important;
      -webkit-backdrop-filter: blur(24px) saturate(1.8) !important;
    }
    ytd-masthead { border-bottom: 1px solid rgba(255, 255, 255, .06) !important; }
    html { --ytd-masthead-height: 52px !important; }
    ytd-masthead #container.ytd-masthead { padding: 0 16px !important; }
    ytd-masthead #end, ytd-masthead #buttons { gap: 4px !important; }
    #ytl-brand {
      font: 600 19px -apple-system, system-ui, sans-serif;
      letter-spacing: -.02em; color: #f2f3f5;
    }
    ${HIDE_CHIP_BAR ? `
    ytd-feed-filter-chip-bar-renderer,
    ytd-rich-grid-renderer #header,
    ytd-rich-grid-renderer #chips-wrapper { display: none !important; }
    ` : ''}
    ${LEAN_CARDS ? `
    ytd-rich-item-renderer .ytLockupViewModelMetadata { padding: 10px 4px 4px !important; }
    ytd-rich-item-renderer .ytLockupMetadataViewModelAvatar { display: none !important; }
    ytd-rich-item-renderer .ytLockupMetadataViewModelHost,
    ytd-rich-item-renderer yt-lockup-metadata-view-model { display: block !important; }
    ytd-rich-item-renderer button.ytSpecButtonShapeNextHost[aria-label="More actions"] { opacity: 0 !important; }
    ytd-rich-item-renderer:hover button.ytSpecButtonShapeNextHost[aria-label="More actions"],
    ytd-rich-item-renderer button.ytSpecButtonShapeNextHost[aria-label="More actions"]:focus-visible { opacity: 1 !important; }
    ` : ''}
    ytd-thumbnail-overlay-resume-playback-renderer #progress,
    .ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment { background: #0a84ff !important; }
    ytd-searchbox #container, .ytSearchboxComponentInputBox {
      background: rgba(255, 255, 255, .07) !important;
      border: 1px solid rgba(255, 255, 255, .15) !important;
      border-right: none !important;
      border-radius: 999px 0 0 999px !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .1) !important;
    }
    button.ytSearchboxComponentSearchButton, ytd-searchbox #search-icon-legacy {
      background: rgba(255, 255, 255, .07) !important;
      border: 1px solid rgba(255, 255, 255, .15) !important;
      border-left: none !important;
      border-radius: 0 999px 999px 0 !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .1) !important;
    }
    button.ytSearchboxComponentSearchButton:hover, ytd-searchbox #search-icon-legacy:hover {
      background: rgba(255, 255, 255, .12) !important;
    }
    yt-chip-cloud-chip-renderer, chip-shape button, .ytChipShapeChip {
      background: rgba(255, 255, 255, .08) !important;
      border: 1px solid rgba(255, 255, 255, .13) !important;
      border-radius: 999px !important;
    }
    yt-chip-cloud-chip-renderer[selected], .ytChipShapeActive {
      background: #0a84ff !important;
      border-color: transparent !important;
    }
    yt-chip-cloud-chip-renderer[selected] *, .ytChipShapeActive * { color: #fff !important; }
    .yt-spec-button-shape-next--tonal, .ytSpecButtonShapeNextTonal {
      background: rgba(255, 255, 255, .09) !important;
      border: 1px solid rgba(255, 255, 255, .12) !important;
    }
    .yt-spec-button-shape-next--filled, .ytSpecButtonShapeNextFilled {
      background: #0a84ff !important;
      border: none !important;
    }
    .yt-spec-button-shape-next--filled .yt-spec-button-shape-next__button-text-content,
    .ytSpecButtonShapeNextFilled .ytSpecButtonShapeNextButtonTextContent {
      color: #fff !important;
    }
    ytd-thumbnail, yt-thumbnail-view-model, yt-thumbnail-view-model img, ytd-thumbnail img {
      border-radius: 12px !important; overflow: hidden;
    }
    #movie_player, ytd-watch-flexy #ytd-player {
      border-radius: 18px !important; overflow: hidden;
    }
    ${REMOVE_SHORTS ? `
    ytd-guide-entry-renderer:has(a[title="Shorts"]),
    ytd-mini-guide-entry-renderer:has(a[title="Shorts"]),
    yt-tab-shape[tab-title="Shorts"],
    ytm-shorts-lockup-view-model,
    ytd-reel-shelf-renderer { display: none !important; }
    ` : ''}
    ${CLEAN_SIDEBAR ? `
    ytd-guide-renderer, tp-yt-app-drawer #contentContainer { background: transparent !important; }
    ytd-guide-renderer #footer { display: none !important; }
    ${LEAN_SIDEBAR ? `
    ytd-guide-collapsible-entry-renderer,
    ytd-guide-entry-renderer #newness-dot,
    ytd-guide-entry-renderer yt-icon-badge-shape,
    ytd-guide-section-renderer #guide-section-title yt-icon,
    ytd-guide-collapsible-section-entry-renderer { display: none !important; }
    ` : ''}
    ${MINIMAL_SIDEBAR ? `
    ytd-guide-signin-promo-renderer, #guide-links-primary, #guide-links-secondary,
    ytd-guide-renderer #footer { display: none !important; }
    ` : ''}
    ytd-guide-section-renderer {
      padding: 10px 0 !important;
      border-top: 1px solid rgba(255, 255, 255, .08) !important;
    }
    ytd-guide-section-renderer:first-of-type { border-top: none !important; }
    #guide-section-title.ytd-guide-section-renderer {
      font-size: 11px !important; font-weight: 600 !important;
      letter-spacing: .08em !important; text-transform: uppercase !important;
      color: #6d717c !important; padding: 4px 12px 6px 20px !important;
    }
    ytd-guide-entry-renderer tp-yt-paper-item {
      height: 38px !important; min-height: 38px !important;
      margin: 1px 8px !important; padding: 0 12px !important;
      border-radius: 10px !important;
    }
    ytd-guide-entry-renderer yt-formatted-string { font-size: 14px !important; }
    ytd-guide-entry-renderer[active] tp-yt-paper-item {
      background: rgba(10, 132, 255, .16) !important;
    }
    ytd-guide-entry-renderer[active] yt-formatted-string,
    ytd-guide-entry-renderer[active] yt-icon { color: #0a84ff !important; }
    ytd-guide-entry-renderer[active] yt-icon svg { fill: #0a84ff !important; }
    ` : ''}
    ytd-guide-entry-renderer tp-yt-paper-item:hover, ytd-mini-guide-entry-renderer:hover {
      background: rgba(255, 255, 255, .08) !important; border-radius: 10px !important;
    }
    ytd-watch-metadata #description {
      background: rgba(255, 255, 255, .05) !important;
      border: none !important;
      border-radius: 12px !important;
    }
    ytd-comment-thread-renderer {
      background: transparent !important;
      border: none !important;
      border-radius: 0 !important;
      padding: 10px 0 !important;
      margin-bottom: 0 !important;
      border-bottom: 1px solid rgba(255, 255, 255, .07) !important;
    }
    #related yt-lockup-view-model, #related ytd-compact-video-renderer {
      border-radius: 16px !important; padding: 6px !important;
    }
    ytd-rich-item-renderer:hover, ytd-video-renderer:hover, ytd-playlist-video-renderer:hover,
    #related yt-lockup-view-model:hover, #related ytd-compact-video-renderer:hover {
      background: rgba(255, 255, 255, .05) !important;
    }
    #video-title, .yt-lockup-metadata-view-model__title {
      font-weight: 600 !important; letter-spacing: -.012em !important;
    }
    #metadata-line, ytd-video-meta-block, ytd-thumbnail-overlay-time-status-renderer {
      font-variant-numeric: tabular-nums !important;
    }
    ytd-rich-grid-renderer {
      --ytd-rich-grid-item-min-width: ${GRID_MIN_WIDTH}px !important;
      --ytd-rich-grid-item-max-width: 100% !important;
      --ytd-rich-grid-item-margin: 12px !important;
      --ytd-rich-grid-content-max-width: 100% !important;
      --ytd-rich-grid-gutter-margin: 12px !important;
    }
    ytd-rich-grid-renderer #contents.ytd-rich-grid-renderer {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(${GRID_MIN_WIDTH}px, 1fr)) !important;
      gap: 14px 12px !important;
    }
    ytd-rich-grid-renderer #contents ytd-rich-item-renderer {
      width: auto !important; max-width: none !important; margin: 0 !important;
    }
    ytd-rich-item-renderer #details, ytd-rich-item-renderer #meta { min-width: 0 !important; }
    ytd-rich-item-renderer {
      border-radius: 12px; padding: 6px !important; overflow: hidden !important;
    }
    ytd-rich-item-renderer a.ytLockupViewModelContentImage {
      width: 100% !important; padding-bottom: 0 !important;
    }
    ytd-rich-item-renderer .ytLockupViewModelMetadata,
    ytd-rich-item-renderer #details { padding: 10px 4px 4px !important; }
    ytd-video-renderer, ytd-playlist-renderer, ytd-channel-renderer, ytd-playlist-video-renderer {
      border-radius: 16px !important;
    }
    ytd-video-renderer:hover, ytd-channel-renderer:hover, ytd-playlist-video-renderer:hover {
      background: rgba(255, 255, 255, .05) !important;
    }
    ytd-menu-popup-renderer,
    tp-yt-paper-dialog,
    yt-sheet-view-model,
    yt-contextual-sheet-layout,
    ytd-multi-page-menu-renderer {
      background: rgba(24, 24, 30, .82) !important;
      backdrop-filter: blur(20px) saturate(1.6) !important;
      -webkit-backdrop-filter: blur(20px) saturate(1.6) !important;
      border: 1px solid rgba(255, 255, 255, .14) !important;
      border-radius: 16px !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .12), 0 12px 40px rgba(0, 0, 0, .5) !important;
    }
    ytd-popup-container tp-yt-iron-dropdown { border-radius: 16px !important; overflow: hidden; }
    ytd-menu-popup-renderer tp-yt-paper-listbox,
    ytd-menu-popup-renderer yt-list-view-model,
    tp-yt-paper-dialog > *:first-child {
      background: transparent !important;
    }
    ytd-menu-service-item-renderer:hover, ytd-menu-navigation-item-renderer:hover {
      background: rgba(255, 255, 255, .09) !important;
    }
    ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer {
      min-height: 40px !important; border-radius: 10px !important; margin: 2px 6px !important;
    }
    ytd-menu-popup-renderer tp-yt-paper-listbox { padding: 6px 0 !important; }
    ytd-app *:not(.ytp-caption-segment):not(.ytp-caption-segment *) { font-family: -apple-system, system-ui, sans-serif !important; }
    ytd-thumbnail-overlay-time-status-renderer { font-variant-numeric: tabular-nums; }
    ::selection { background: rgba(10, 132, 255, .4); }
    ytd-app :focus-visible, ytd-masthead :focus-visible { outline: 2px solid #0a84ff !important; outline-offset: 2px; }
    ytd-mini-guide-entry-renderer[active] {
      background: rgba(10, 132, 255, .16) !important; border-radius: 10px !important;
    }
    ytd-guide-section-renderer { content-visibility: auto; contain-intrinsic-size: 0 280px; }
    .yt-spec-button-shape-next--tonal:active, .ytSpecButtonShapeNextTonal:active {
      background: rgba(255, 255, 255, .14) !important;
    }
    .yt-spec-button-shape-next--filled:active, .ytSpecButtonShapeNextFilled:active {
      background: #d8d8d8 !important;
    }
    ytd-playlist-panel-renderer#playlist {
      background: rgba(255, 255, 255, .045) !important;
      border: 1px solid rgba(255, 255, 255, .08) !important;
      border-radius: 16px !important;
      overflow: hidden;
    }
    ytd-playlist-panel-renderer#playlist .header { background: transparent !important; }
    #playlist ytd-playlist-panel-video-renderer { content-visibility: auto; contain-intrinsic-size: 0 80px; }
    #playlist ytd-playlist-panel-video-renderer:hover { background: rgba(255, 255, 255, .06) !important; }
    #related ytd-item-section-renderer #contents { display: flex; flex-direction: column; gap: 4px !important; }
    #playlist ytd-playlist-panel-video-renderer { padding: 2px 4px !important; border-radius: 12px !important; }
    ytd-playlist-panel-renderer#playlist #header { padding: 10px 14px !important; }
    ytd-comment-view-model { content-visibility: auto; contain-intrinsic-size: 0 90px; }
    html:not([dark]), html:not([dark]) ytd-app {
      --yt-sys-color-baseline--base-background: #f6f7f9 !important;
      --yt-sys-color-baseline--raised-background: #ffffff !important;
      --yt-sys-color-baseline--text-primary: #14161c !important;
      --yt-sys-color-baseline--text-secondary: #5c6169 !important;
      --yt-sys-color-baseline--call-to-action: #007aff !important;
      --yt-sys-color-baseline--outline: rgba(15, 17, 22, .11) !important;
      --yt-sys-color-baseline--tonal-rim: rgba(15, 17, 22, .11) !important;
      --yt-sys-color-baseline--additive-background: rgba(15, 17, 22, .06) !important;
    }
    html:not([dark]) ytd-app { background: #f6f7f9 !important; }
    html:not([dark]) yt-chip-cloud-chip-renderer[selected],
    html:not([dark]) .ytChipShapeActive {
      background: #007aff !important;
    }
    html:not([dark]) .yt-spec-button-shape-next--filled,
    html:not([dark]) .ytSpecButtonShapeNextFilled {
      background: #007aff !important;
    }
    html:not([dark]) .yt-spec-button-shape-next--filled .yt-spec-button-shape-next__button-text-content,
    html:not([dark]) .ytSpecButtonShapeNextFilled .ytSpecButtonShapeNextButtonTextContent {
      color: #fff !important;
    }
    html:not([dark]) ytd-masthead, html:not([dark]) ytd-masthead #background {
      background: rgba(250, 250, 253, .65) !important;
    }
    html:not([dark]) ytd-masthead { border-bottom: 1px solid rgba(15, 17, 22, .06) !important; }
    html:not([dark]) ytd-searchbox #container, html:not([dark]) .ytSearchboxComponentInputBox {
      background: rgba(0, 0, 0, .04) !important;
      border: 1px solid rgba(0, 0, 0, .12) !important;
      border-right: none !important;
      box-shadow: none !important;
    }
    html:not([dark]) button.ytSearchboxComponentSearchButton, html:not([dark]) ytd-searchbox #search-icon-legacy {
      background: rgba(0, 0, 0, .04) !important;
      border: 1px solid rgba(0, 0, 0, .12) !important;
      border-left: none !important;
      box-shadow: none !important;
    }
    html:not([dark]) button.ytSearchboxComponentSearchButton:hover, html:not([dark]) ytd-searchbox #search-icon-legacy:hover {
      background: rgba(0, 0, 0, .08) !important;
    }
    html:not([dark]) yt-chip-cloud-chip-renderer, html:not([dark]) chip-shape button, html:not([dark]) .ytChipShapeChip {
      background: rgba(0, 0, 0, .05) !important;
      border: 1px solid rgba(0, 0, 0, .10) !important;
    }
    html:not([dark]) yt-chip-cloud-chip-renderer[selected] *, html:not([dark]) .ytChipShapeActive * {
      color: #fff !important;
    }
    html:not([dark]) .yt-spec-button-shape-next--tonal, html:not([dark]) .ytSpecButtonShapeNextTonal {
      background: rgba(0, 0, 0, .05) !important;
      border: 1px solid rgba(0, 0, 0, .09) !important;
    }
    html:not([dark]) .yt-spec-button-shape-next--filled, html:not([dark]) .ytSpecButtonShapeNextFilled {
      background: #0f0f0f !important;
    }
    html:not([dark]) .yt-spec-button-shape-next--filled .yt-spec-button-shape-next__button-text-content,
    html:not([dark]) .ytSpecButtonShapeNextFilled .ytSpecButtonShapeNextButtonTextContent {
      color: #fff !important;
    }
    html:not([dark]) ytd-watch-metadata #description {
      background: rgba(15, 17, 22, .04) !important;
      border: none !important;
    }
    html:not([dark]) ytd-comment-thread-renderer {
      background: transparent !important;
      border: none !important;
      border-bottom: 1px solid rgba(15, 17, 22, .08) !important;
    }
    html:not([dark]) ytd-rich-item-renderer:hover,
    html:not([dark]) #related yt-lockup-view-model:hover,
    html:not([dark]) #related ytd-compact-video-renderer:hover,
    html:not([dark]) ytd-video-renderer:hover,
    html:not([dark]) ytd-channel-renderer:hover,
    html:not([dark]) ytd-playlist-video-renderer:hover {
      background: rgba(15, 17, 22, .04) !important;
    }
    html:not([dark]) ytd-menu-popup-renderer,
    html:not([dark]) tp-yt-paper-dialog,
    html:not([dark]) yt-sheet-view-model,
    html:not([dark]) yt-contextual-sheet-layout,
    html:not([dark]) ytd-multi-page-menu-renderer {
      background: rgba(250, 250, 253, .8) !important;
      border: 1px solid rgba(0, 0, 0, .10) !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .6), 0 12px 40px rgba(0, 0, 0, .18) !important;
    }
    html:not([dark]) ytd-menu-service-item-renderer:hover,
    html:not([dark]) ytd-menu-navigation-item-renderer:hover {
      background: rgba(0, 0, 0, .06) !important;
    }
    html:not([dark]) ::selection { background: rgba(0, 122, 255, .3); }
    html:not([dark]) ytd-app :focus-visible, html:not([dark]) ytd-masthead :focus-visible { outline-color: #007aff !important; }
    html:not([dark]) ytd-guide-entry-renderer[active] tp-yt-paper-item,
    html:not([dark]) ytd-mini-guide-entry-renderer[active] {
      background: rgba(0, 122, 255, .12) !important;
    }
    html:not([dark]) ytd-guide-entry-renderer[active] yt-formatted-string,
    html:not([dark]) ytd-guide-entry-renderer[active] yt-icon { color: #007aff !important; }
    html:not([dark]) ytd-guide-entry-renderer[active] yt-icon svg { fill: #007aff !important; }
    html:not([dark]) ytd-guide-section-renderer { border-top: 1px solid rgba(15, 17, 22, .08) !important; }
    html:not([dark]) #guide-section-title.ytd-guide-section-renderer { color: #868b95 !important; }
    html:not([dark]) .yt-spec-button-shape-next--tonal:active, html:not([dark]) .ytSpecButtonShapeNextTonal:active {
      background: rgba(0, 0, 0, .09) !important;
    }
    html:not([dark]) .yt-spec-button-shape-next--filled:active, html:not([dark]) .ytSpecButtonShapeNextFilled:active {
      background: #333 !important;
    }
    html:not([dark]) ytd-playlist-panel-renderer#playlist {
      background: rgba(0, 0, 0, .035) !important;
      border: 1px solid rgba(0, 0, 0, .08) !important;
    }
    html:not([dark]) #playlist ytd-playlist-panel-video-renderer:hover { background: rgba(0, 0, 0, .04) !important; }
    html:not([dark]) #ytl-brand { color: #14161c; }
    html:not([dark]) ytd-thumbnail-overlay-resume-playback-renderer #progress,
    html:not([dark]) .ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment { background: #007aff !important; }
    ` : ''}
  `;

  const style = document.createElement('style');
  style.id = 'yt-lite-style';
  style.textContent = CSS;
  const mountStyle = () => {
    const root = document.documentElement;
    if (!root) return setTimeout(mountStyle, 0);
    if (style.parentNode !== root) root.appendChild(style);
  };
  mountStyle();

  let flagTries = 0;
  const patchFlags = () => {
    try {
      const flags = window.ytcfg?.data_?.EXPERIMENT_FLAGS;
      if (flags) {
        if (DISABLE_AMBIENT_MODE) flags.kevlar_watch_cinematics = false;
        flags.web_animated_like = false;
        flags.smartimation_background = false;
        return;
      }
    } catch (e) {}
    if (++flagTries < 20) setTimeout(patchFlags, 250);
  };
  patchFlags();

  const prunePanels = () => {
    for (const p of document.querySelectorAll('ytd-engagement-panel-section-list-renderer')) {
      if (!PANEL_KEEP.has(p.getAttribute('target-id') || '')) p.remove();
    }
  };

  const pruneShorts = () => {
    for (const a of document.querySelectorAll('a[title="Shorts"]')) {
      const entry = a.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
      if (entry) entry.remove();
    }
    for (const t of document.querySelectorAll('yt-tab-shape')) {
      if (t.getAttribute('tab-title') === 'Shorts') t.remove();
    }
  };

  const GUIDE_DROP = /^\/(premium|music|movies|gaming|live|fashion|sport|learning|podcasts|feed\/storefront|reporthistory|account)|^https?:\/\/(music|kids|tv)\.youtube\.com|^https?:\/\/(www\.)?youtubekids\.com/i;

  const pruneGuide = () => {
    for (const s of document.querySelectorAll('ytd-guide-section-renderer:not([data-ytl])')) {
      const links = [...s.querySelectorAll('a[href]')];
      if (!links.length) continue;
      s.setAttribute('data-ytl', '1');
      const title = s.querySelector('#guide-section-title');
      if (title && (title.textContent || '').trim()) {
        s.remove();
        continue;
      }
      if (links.every((a) => GUIDE_DROP.test(a.getAttribute('href') || ''))) s.remove();
    }
  };

  const ICON_BY_LABEL = {
    home: 'home', subscriptions: 'subs', history: 'history', playlists: 'playlist',
    'watch later': 'later', 'liked videos': 'liked', 'your videos': 'videos',
    downloads: 'download', 'your channel': 'person', guide: 'menu', search: 'search',
    notifications: 'bell', create: 'plus',
  };

  const swapIcons = () => {
    for (const root of document.querySelectorAll('ytd-guide-renderer, ytd-mini-guide-renderer, ytd-masthead')) {
      for (const host of root.querySelectorAll('yt-icon:not([data-ytl]), .ytIconWrapperHost:not([data-ytl])')) {
        const entry = host.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
        const label = entry
          ? (entry.querySelector('a')?.getAttribute('title') || entry.textContent || '').trim()
          : (host.closest('button, a')?.getAttribute('aria-label') || '').trim();
        if (!label) continue;
        host.setAttribute('data-ytl', '1');
        const key = ICON_BY_LABEL[label.toLowerCase()];
        if (!key || !ICONS[key]) continue;
        const svg = ICONS[key]();
        svg.setAttribute('width', '22');
        svg.setAttribute('height', '22');
        host.replaceChildren(svg);
      }
    }
  };

  const brandLogo = () => {
    const logo = document.querySelector('ytd-topbar-logo-renderer a#logo:not([data-ytl])');
    if (!logo) return;
    logo.setAttribute('data-ytl', '1');
    const mark = document.createElement('span');
    mark.id = 'ytl-brand';
    mark.textContent = 'iTube';
    logo.replaceChildren(mark);
  };

  const capList = (containerSel, tags, max) => {
    if (!max) return;
    for (const c of document.querySelectorAll(containerSel)) {
      let kept = 0;
      for (const el of [...c.children]) {
        if (tags.has(el.tagName) && ++kept > max) el.remove();
      }
      if (kept >= max) {
        for (const e of c.querySelectorAll(':scope > ytd-continuation-item-renderer')) e.remove();
      }
    }
  };

  const forceDark = () => {
    const root = document.documentElement;
    if (root && !root.hasAttribute('dark')) root.setAttribute('dark', '');
  };
  if (FORCE_DARK) forceDark();

  const idle = window.requestIdleCallback
    ? (cb) => window.requestIdleCallback(cb, { timeout: 1200 })
    : (cb) => setTimeout(cb, 200);
  let sweepScheduled = false;
  const sweep = () => {
    sweepScheduled = false;
    if (REDIRECT_SHORTS && shortsToWatch()) return;
    if (FORCE_DARK) forceDark();
    mountStyle();
    for (const n of document.querySelectorAll(KILL)) n.remove();
    if (LEAN_CARDS && CARD_JUNK) {
      for (const n of document.querySelectorAll(CARD_JUNK)) n.remove();
      for (const b of document.querySelectorAll('ytd-rich-item-renderer yt-thumbnail-badge-view-model')) {
        if (!b.closest('yt-thumbnail-bottom-overlay-view-model')) b.remove();
      }
    }
    if (PRUNE_HIDDEN_PANELS) prunePanels();
    if (REMOVE_SHORTS) pruneShorts();
    if (MINIMAL_SIDEBAR) pruneGuide();
    if (NATIVE_ICONS) swapIcons();
    if (ITUBE_LOGO && GLASS_UI) brandLogo();
    capList('#related ytd-item-section-renderer #contents', RELATED_TAGS, MAX_RELATED);
    capList('ytd-comments ytd-item-section-renderer > #contents', COMMENT_TAGS, MAX_COMMENT_THREADS);
    capList('ytd-comment-replies-renderer #expander-contents > #contents', REPLY_TAGS, MAX_REPLIES);
  };
  const scheduleSweep = () => {
    if (sweepScheduled) return;
    sweepScheduled = true;
    idle(sweep);
  };

  const fmt = (s) => {
    if (!isFinite(s)) return 'LIVE';
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const mm = h ? String(m).padStart(2, '0') : m;
    return (h ? h + ':' : '') + mm + ':' + String(sec).padStart(2, '0');
  };

  const startGlassPlayer = () => {
    let wired = null;
    let lastVideoId = null;
    let ui = null;
    let chapterSecs = [];

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

    const renderTicks = () => {
      if (!ui) return;
      const dur = wired?.duration;
      for (const t of ui.seekwrap.querySelectorAll('.ytl-tick')) t.remove();
      if (!isFinite(dur) || !dur || chapterSecs.length < 2) return;
      for (const s of chapterSecs) {
        if (!s) continue;
        const t = document.createElement('div');
        t.className = 'ytl-tick';
        t.style.left = (s / dur * 100) + '%';
        ui.seekwrap.appendChild(t);
      }
    };

    window.addEventListener('yt-navigate-finish', (e) => {
      chapterSecs = parseChapters(e.detail?.response?.response || e.detail?.response || window.ytInitialData);
      renderTicks();
    });
    chapterSecs = parseChapters(window.ytInitialData);

    let storyboard = null;
    const parseStoryboard = (player) => {
      storyboard = null;
      try {
        const spec = player.getPlayerResponse?.()?.storyboards?.playerStoryboardSpecRenderer?.spec;
        if (!spec) return;
        const parts = spec.split('|');
        if (parts.length < 2) return;
        const L = parts.length - 1;
        const p = parts[L].split('#');
        if (p.length < 8) return;
        const [w, h, count, rows, cols, interval] = p.slice(0, 6).map(Number);
        if (!w || !h || !count || !rows || !cols) return;
        const url = parts[0].replace('$L', String(L - 1)).replace('$N', p[6])
          + '&sigh=' + encodeURIComponent(p[7]);
        storyboard = { url, w, h, count, rows, cols, interval };
      } catch (e) {}
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

    const el = (tag, id, child) => {
      const e = document.createElement(tag);
      if (id) e.id = id;
      if (typeof child === 'string') e.textContent = child;
      else if (child) e.appendChild(child);
      return e;
    };

    const buildBar = (player, video) => {
      if (document.getElementById('ytl-bar')) return;
      const bar = el('div', 'ytl-bar');
      const prev = el('button', 'ytl-prev', ICONS.prev());
      const next = el('button', 'ytl-next', ICONS.next());
      const play = el('button', 'ytl-play', ICONS.pause());
      const timeCur = el('span', null); timeCur.className = 'ytl-time';
      const seek = el('input', 'ytl-seek'); seek.type = 'range'; seek.min = 0; seek.max = 1000; seek.value = 0;
      const timeDur = el('span', null); timeDur.className = 'ytl-time';
      const mute = el('button', 'ytl-mute', ICONS.vol());
      const vol = el('input', 'ytl-vol'); vol.type = 'range'; vol.min = 0; vol.max = 100;
      const speed = el('select', 'ytl-speed');
      for (const s of SPEEDS) {
        const o = document.createElement('option');
        o.value = s; o.textContent = s + '×';
        speed.appendChild(o);
      }
      const quality = el('select', 'ytl-quality');
      const cc = el('select', 'ytl-cc');
      cc.appendChild(new Option('CC', ''));
      const auto = el('button', 'ytl-auto', 'Auto');
      const pip = el('button', 'ytl-pip', ICONS.pip());
      const fs = el('button', 'ytl-fs', ICONS.fs());
      const seekwrap = el('div', 'ytl-seekwrap');
      seekwrap.appendChild(seek);
      const preview = el('div', 'ytl-preview');
      const ptime = el('span', null); ptime.className = 'ytl-ptime';
      preview.appendChild(ptime);
      seekwrap.appendChild(preview);
      seekwrap.addEventListener('pointerenter', () => {
        if (storyboard && !ui.isLive) preview.style.display = 'block';
      });
      seekwrap.addEventListener('pointerleave', () => { preview.style.display = 'none'; });
      seekwrap.addEventListener('pointermove', (e) => {
        if (preview.style.display === 'none') return;
        const rect = seekwrap.getBoundingClientRect();
        updatePreview(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
      });
      const live = el('button', 'ytl-live', 'LIVE');
      live.style.display = 'none';
      const more = el('button', 'ytl-more', ICONS.more());
      const menu = el('div', 'ytl-menu');
      const left = el('div', 'ytl-left');
      const center = el('div', 'ytl-center');
      const right = el('div', 'ytl-right');
      const row = (label, control) => {
        const r = el('div');
        r.className = 'ytl-row';
        const s = el('span', null, label);
        r.append(s, control);
        return r;
      };
      menu.append(row('Speed', speed), row('Quality', quality), row('Captions', cc), row('Autoplay', auto));
      left.append(prev, play, next);
      center.append(timeCur, seekwrap, timeDur, live);
      right.append(mute, vol, more, pip, fs);
      bar.append(left, center, right, menu);
      player.appendChild(bar);
      ui = { bar, prev, next, play, timeCur, seek, seekwrap, preview, ptime, timeDur, live, mute, vol, speed, quality, cc, auto, pip, fs, scrubbing: false, isLive: false, more, menu, left, right };
      const setMenu = (open) => { menu.style.display = open ? 'block' : 'none'; };
      menu.style.display = 'none';
      more.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = menu.style.display !== 'block';
        if (open) { populateQuality(player); populateTracks(player); ui.syncAuto?.(); }
        setMenu(open);
      });
      menu.addEventListener('change', () => setMenu(false));
      bar.addEventListener('mouseleave', (e) => {
        if (!menu.contains(e.relatedTarget)) setMenu(false);
      });
      live.addEventListener('click', () => {
        if (player.seekToLiveHead) player.seekToLiveHead();
        else if (isFinite(video.duration)) video.currentTime = video.duration - 2;
      });
      ui.syncAuto = () => {
        const b = document.querySelector('#movie_player .ytp-autonav-toggle-button');
        const r = auto.closest('.ytl-row');
        if (r) r.style.display = b ? 'flex' : 'none';
        auto.style.opacity = b?.getAttribute('aria-checked') === 'true' ? '1' : '.45';
      };
      auto.addEventListener('click', () => {
        document.querySelector('#movie_player .ytp-autonav-toggle-button')?.click();
        setTimeout(ui.syncAuto, 300);
      });
      ui.syncAuto();

      prev.addEventListener('click', () => player.previousVideo?.());
      next.addEventListener('click', () => player.nextVideo?.());
      play.addEventListener('click', () => { video.paused ? video.play() : video.pause(); });
      seek.addEventListener('pointerdown', () => { ui.scrubbing = true; });
      seek.addEventListener('change', () => {
        if (isFinite(video.duration)) video.currentTime = video.duration * seek.value / 1000;
        ui.scrubbing = false;
      });
      mute.addEventListener('click', () => { video.muted = !video.muted; });
      vol.addEventListener('input', () => { video.muted = false; video.volume = vol.value / 100; });
      speed.addEventListener('change', () => { player.setPlaybackRate?.(Number(speed.value)); });
      quality.addEventListener('mousedown', () => populateQuality(player));
      quality.addEventListener('change', () => {
        player.setPlaybackQualityRange?.(quality.value, quality.value);
        localStorage.setItem('yt-lite-quality', quality.value);
      });
      cc.addEventListener('mousedown', () => populateTracks(player));
      cc.addEventListener('change', () => {
        const on = player.isSubtitlesOn?.();
        if (!cc.value) {
          if (on) player.toggleSubtitles?.();
          return;
        }
        if (!on) player.toggleSubtitles?.();
        setTimeout(() => player.setOption?.('captions', 'track', { languageCode: cc.value }), 150);
      });
      pip.addEventListener('click', () => {
        if (video.webkitSetPresentationMode) {
          video.webkitSetPresentationMode(video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
        } else if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        } else {
          video.requestPictureInPicture?.();
        }
      });
      fs.addEventListener('click', () => {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          (player.requestFullscreen || player.webkitRequestFullscreen).call(player);
        }
      });

      let hideTimer = null;
      const showBar = () => {
        player.classList.add('ytl-show');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          if (!video.paused && !ui.bar.matches(':hover') && ui.menu.style.display !== 'block') player.classList.remove('ytl-show');
        }, 2800);
      };
      const listen = EventTarget.prototype.addEventListener;
      listen.call(player, 'mousemove', showBar, { passive: true });
      listen.call(player, 'mouseleave', () => {
        clearTimeout(hideTimer);
        if (!video.paused && ui.menu.style.display !== 'block') player.classList.remove('ytl-show');
      }, { passive: true });

      video.addEventListener('play', () => { ui.play.replaceChildren(ICONS.pause()); showBar(); });
      video.addEventListener('pause', () => { ui.play.replaceChildren(ICONS.play()); showBar(); });
      video.addEventListener('timeupdate', () => {
        ui.timeCur.textContent = fmt(video.currentTime);
        if (!ui.scrubbing && isFinite(video.duration) && video.duration > 0) {
          ui.seek.value = Math.round(video.currentTime / video.duration * 1000);
        }
        if (ui.isLive) {
          ui.live.classList.toggle('ytl-behind', video.duration - video.currentTime > 12);
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
      vol.value = video.muted ? 0 : Math.round(video.volume * 100);
      populateQuality(player);
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

    const populateTracks = (player) => {
      if (!ui || ui.cc.options.length > 1) return;
      const wasOn = player.isSubtitlesOn?.();
      if (!wasOn) player.toggleSubtitles?.();
      const tracks = player.getOption?.('captions', 'tracklist') || [];
      const cur = player.getOption?.('captions', 'track')?.languageCode || '';
      ui.cc.replaceChildren(new Option('CC off', ''));
      for (const t of tracks) {
        const o = new Option(t.displayName, t.languageCode, false, t.languageCode === cur);
        ui.cc.appendChild(o);
      }
      if (!wasOn) player.toggleSubtitles?.();
    };

    const populateQuality = (player) => {
      if (!ui) return;
      const levels = player.getAvailableQualityLevels?.() || [];
      const current = player.getPlaybackQuality?.();
      ui.quality.textContent = '';
      for (const q of levels) {
        const o = document.createElement('option');
        o.value = q;
        o.textContent = QUALITY_LABELS[q] || q;
        if (q === current) o.selected = true;
        ui.quality.appendChild(o);
      }
    };

    const wire = () => {
      const video = document.querySelector('#movie_player video.html5-main-video');
      const player = document.getElementById('movie_player');
      if (!video || !player) return;
      if (video.hasAttribute('controls')) video.removeAttribute('controls');
      if (video.disablePictureInPicture) video.disablePictureInPicture = false;
      buildBar(player, video);

      const vid = player.getVideoData?.()?.video_id;
      if (vid && vid !== lastVideoId) {
        lastVideoId = vid;
        const saved = localStorage.getItem('yt-lite-quality');
        if (saved && saved !== 'auto') player.setPlaybackQualityRange?.(saved, saved);
        populateQuality(player);
        if (saved) ui.quality.value = saved;
        ui.speed.value = String(player.getPlaybackRate?.() || 1);
        ui.prev.style.display = player.getPlaylist?.()?.length ? '' : 'none';
        ui.cc.replaceChildren(new Option('CC', ''));
        ui.syncAuto?.();
        ui.isLive = !!player.getVideoData?.()?.isLive;
        ui.live.style.display = ui.isLive ? '' : 'none';
        ui.timeDur.style.display = ui.isLive ? 'none' : '';
        parseStoryboard(player);
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
        const pv = player.getVolume?.();
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
          if (typeof player.setVolume !== 'function') return;
          syncing = true;
          const elVol = Math.round(video.volume * 100);
          try {
            if (video.muted) {
              player.mute?.();
              setTimeout(() => { syncing = false; }, 400);
              return;
            }
            player.unMute?.();
            player.setVolume(Math.max(1, Math.min(100, Math.round(elVol / ratio))));
            setTimeout(() => { measure(); syncing = false; }, 400);
          } catch (e) { syncing = false; }
        }, 300);
      });
    };
    wire();
    setInterval(wire, 500);
  };

  const start = () => {
    const root = document.documentElement;
    if (!root) return setTimeout(start, 0);
    mountStyle();
    new MutationObserver(scheduleSweep).observe(root, { childList: true, subtree: true });
    scheduleSweep();
    if (GLASS_PLAYER) startGlassPlayer();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
