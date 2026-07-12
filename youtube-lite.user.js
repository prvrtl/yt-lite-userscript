// ==UserScript==
// @name         YouTube Lite — fast, simple rendering
// @namespace    yt-us
// @version      1.2.0
// @description  Strips YouTube's heavy UI: no animations, no ambient glow, no hover previews, deep DOM pruning, native browser video controls.
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
  const NATIVE_PLAYER = true;

  const PANEL_KEEP = new Set(['engagement-panel-structured-description']);
  const RELATED_TAGS = new Set(['YT-LOCKUP-VIEW-MODEL', 'YTD-COMPACT-VIDEO-RENDERER']);
  const COMMENT_TAGS = new Set(['YTD-COMMENT-THREAD-RENDERER']);

  const KILL = [
    'tp-yt-paper-tooltip',
    'yt-touch-feedback-shape',
    'yt-interaction',
    'ytd-miniplayer',
    'ytd-merch-shelf-renderer',
    'yt-mealbar-promo-renderer',
    'ytd-mealbar-promo-renderer',
    DISABLE_HOVER_PREVIEWS && 'ytd-video-preview',
    DISABLE_AMBIENT_MODE && '#cinematics canvas',
    PRUNE_LEGACY_ICONSETS && 'iron-iconset-svg',
    PRUNE_PLAYER_OVERLAYS && '.ytp-ce-element',
    PRUNE_PLAYER_OVERLAYS && '.ytp-cards-teaser',
    PRUNE_PLAYER_OVERLAYS && '.ytp-paid-content-overlay',
    PRUNE_PLAYER_OVERLAYS && '.ytp-iv-video-content',
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
    ytd-rich-item-renderer { content-visibility: auto; contain-intrinsic-size: 0 320px; }
    ytd-comment-thread-renderer { content-visibility: auto; contain-intrinsic-size: 0 120px; }
    #related yt-lockup-view-model,
    #related ytd-compact-video-renderer { content-visibility: auto; contain-intrinsic-size: 0 100px; }
    ${DISABLE_AMBIENT_MODE ? '#cinematics,' : ''}
    ${DISABLE_HOVER_PREVIEWS ? 'ytd-video-preview, ytd-moving-thumbnail-renderer, ytd-thumbnail-overlay-loading-preview-renderer,' : ''}
    ${HIDE_SHORTS_SHELVES ? 'ytd-rich-section-renderer, ytd-reel-shelf-renderer,' : ''}
    ytd-miniplayer,
    ytd-merch-shelf-renderer,
    yt-mealbar-promo-renderer,
    ytd-mealbar-promo-renderer,
    #clarify-box,
    tp-yt-paper-tooltip,
    yt-interaction,
    yt-touch-feedback-shape { display: none !important; }
    ${NATIVE_PLAYER ? `
    #movie_player .ytp-chrome-top,
    #movie_player .ytp-chrome-bottom,
    #movie_player .ytp-gradient-top,
    #movie_player .ytp-gradient-bottom,
    #movie_player .ytp-tooltip,
    #movie_player .ytp-bezel,
    #movie_player .ytp-bezel-text-wrapper,
    #movie_player .ytp-pause-overlay { display: none !important; }
    #movie_player .ytp-caption-window-container { pointer-events: none !important; }
    ` : ''}
  `;

  const style = document.createElement('style');
  style.id = 'yt-lite-style';
  style.textContent = CSS;
  document.documentElement.appendChild(style);

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

  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
  let sweepScheduled = false;
  const sweep = () => {
    sweepScheduled = false;
    for (const n of document.querySelectorAll(KILL)) n.remove();
    if (PRUNE_HIDDEN_PANELS) prunePanels();
    capList('#related ytd-item-section-renderer #contents', RELATED_TAGS, MAX_RELATED);
    capList('ytd-comments ytd-item-section-renderer > #contents', COMMENT_TAGS, MAX_COMMENT_THREADS);
  };
  const scheduleSweep = () => {
    if (sweepScheduled) return;
    sweepScheduled = true;
    idle(sweep);
  };

  const startNativePlayer = () => {
    let wired = null;
    const wire = () => {
      const video = document.querySelector('#movie_player video.html5-main-video');
      const player = document.getElementById('movie_player');
      if (!video || !player) return;
      if (!video.hasAttribute('controls')) video.setAttribute('controls', '');
      if (video.disablePictureInPicture) video.disablePictureInPicture = false;
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
    new MutationObserver(scheduleSweep)
      .observe(document.documentElement, { childList: true, subtree: true });
    scheduleSweep();
    if (NATIVE_PLAYER) startNativePlayer();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
