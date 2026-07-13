# iTube

A userscript that rebuilds YouTube as a fast, native-feeling app in Safari.

iTube does not restyle YouTube. It renders **its own UI from YouTube's data** —
its own feed, watch page, search, channel, comments and player bar — and borrows
YouTube's player purely as a headless playback engine, moving the `<video>` into
its own stage. YouTube's own interface is parked offscreen and never rendered.

Single file. No build step, no dependencies, no tracking. It talks to YouTube's
own API (InnerTube) and nothing else.

## Install

**Safari**

1. Install [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) from the Mac App Store (free).
2. Safari → Settings → Extensions → enable it, and allow it on `youtube.com`.
3. Open the extension, set a scripts folder, and save the script below into it as
   a file ending in `.user.js`.

**Chrome, Edge, Firefox**

1. Install [Tampermonkey](https://www.tampermonkey.net/) or Violentmonkey.
2. Open the raw script — the manager offers to install it:

   https://raw.githubusercontent.com/prvrtl/yt-lite-userscript/refs/heads/main/itube.user.js

Updates are automatic: the script carries an `@updateURL`.

## What it does

**Speed.** Because iTube renders its own UI, YouTube's components are never
scrolled, hovered or brought into view — so they never lazy-render the comments,
related rail and feed rows that make up the bulk of a watch page. The work simply
never happens.

Measured on a live watch page, median of 3 runs: **DOM nodes 22,107 → 6,865
(−69%)**; frame time p95 **20.6 ms → 8.0 ms**; janky frames **9 → 0**. Method,
repro script, and the metrics deliberately *not* claimed: [PERF.md](PERF.md).

**Design.** System typeface, macOS focus rings, glass surfaces, a custom icon
set, flat cards. A Liquid Glass player bar with seek preview, quality, speed,
captions, PiP and fullscreen.

**No functionality lost.** This is the hard part and it is done: quality up to
4320p, playback speed, caption languages, chapters, seek-preview thumbnails,
playlists and queue, autoplay-next, PiP, live and DVR scrubbing, search filters,
comments and replies, and every keyboard shortcut.

**Shorts.** A `/shorts/<id>` link redirects to the normal watch page, where you
get a real scrubber.

## Configuration

There is no feature-flag system. A handful of caps are plain `const`s at the top
of `itube.user.js` (`MAX_COMMENTS`, `MAX_REPLIES`, …). Edit and save.

## Development

`itube.user.js` is the whole app. `youtube-lite.user.js` is the legacy v2.9 skin,
kept only so existing installs keep auto-updating — don't develop against it.

```
cd tests && npm install
cd tests && npm test          # Playwright suite, runs against live youtube.com
cd tests && node bench.js     # the repro script behind PERF.md
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for why the app is shaped this way.

## Notes

Verified against Chrome and Safari on the desktop site. YouTube changes its data
shapes often — if a view suddenly renders zero items, that is the first thing to
check (see the `lockupViewModel` notes in ARCHITECTURE.md). Open an issue.

Not affiliated with YouTube or Google.
