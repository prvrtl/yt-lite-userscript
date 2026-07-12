# iTube

A userscript that makes YouTube fast and native-looking in Safari.

YouTube ships a DOM tuned for Chrome. In Safari it carries thousands of nodes it
never paints, a video element per hovered thumbnail, and animation on everything.
iTube strips the page down, replaces the player chrome with a Liquid Glass bar,
and gives back every feature it removes.

Single file. No build step, no dependencies, no network calls of its own, no
tracking.

## Install

**Safari**

1. Install [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) from the Mac App Store (free).
2. Safari → Settings → Extensions → enable it, and allow it on `youtube.com`.
3. Open the extension, set a scripts folder, and save the script below into it as
   a file ending in `.user.js`.

**Chrome, Edge, Firefox**

1. Install [Tampermonkey](https://www.tampermonkey.net/) or Violentmonkey.
2. Open the raw script — the manager offers to install it:

   https://raw.githubusercontent.com/prvrtl/yt-lite-userscript/refs/heads/main/youtube-lite.user.js

Updates are automatic: the script carries an `@updateURL`.

## What it does

**Speed.** Off-screen comments, feed items and sidebar rows skip layout entirely
(`content-visibility`). Animations, transitions, shadows and large-surface blur
are killed. Hover-preview video players — a real `<video>` with media buffers per
thumbnail — are deleted the moment they spawn. Related, comments and replies are
capped, so a long session can't grow the tab without limit.

Measured on a live watch page: **DOM nodes 10,631 → 3,202 (−70%)** on a healthy
session; player chrome **161 → 33 nodes**. Full numbers, method, and what is
*not* proven: [PERF.md](PERF.md).

**Design.** System typeface, macOS focus rings, glass surfaces, a custom icon
set, flat cards. Dark and light. YouTube's own theme tokens are overridden, so
surfaces the script never touches still inherit the palette.

**No functionality lost.** This is the hard part and it is done: quality, speed,
caption languages, chapters, seek-preview thumbnails, playlists, autoplay, PiP,
live streams and DVR scrubbing, stats-for-nerds, and every keyboard shortcut all
still work.

**Shorts.** Removed from the sidebar, shelves, and search. A `/shorts/<id>` link
redirects to the normal watch page, where you get a real scrubber.

## Configuration

Feature flags are plain `const` booleans at the top of the file. Edit and save:

| Flag | Default | Effect |
|---|---|---|
| `GRID_MIN_WIDTH` | `240` | Feed density. Lower → more columns. |
| `MAX_RELATED` / `MAX_COMMENT_THREADS` / `MAX_REPLIES` | `10` | List caps. |
| `REMOVE_SHORTS` | `true` | Strip Shorts everywhere. |
| `MINIMAL_SIDEBAR` | `true` | Sidebar = Home / Subscriptions / You. |
| `HIDE_CHIP_BAR` | `true` | Remove the home genre bar. |
| `NATIVE_ICONS` / `ITUBE_LOGO` | `true` | Replace YouTube's icons and logo. |
| `GLASS_PLAYER` / `GLASS_UI` | `true` | The custom player bar / the skin. |
| `FORCE_DARK` | `true` | Force dark theme. |

## Notes

Verified against Chrome and Safari on the desktop site. YouTube changes its DOM
often — if something stops being styled, its class names probably changed (this
has happened twice already; both times the fix was one selector). Open an issue.

Not affiliated with YouTube or Google.
