# RECOVERY.md — fixing iTube after YouTube changes something

iTube renders its own UI from YouTube's **data** (`ytInitialData`, InnerTube
`/youtubei/v1/*`, the `#movie_player` object). It therefore breaks whenever
YouTube changes a payload shape, a player method, a DOM hook, an endpoint, or an
event. This file is the map from *"something is broken"* to *"here is the exact
line that depends on the thing YouTube changed, and here is how to re-point it."*

Read `ARCHITECTURE.md` for **why** the app is shaped this way; this file is the
**recovery runbook**. All `file:line` refer to `itube.user.js` unless noted.
Test checks live in `tests/checks/*.js`.

---

## Step 0 — is it actually a YouTube change?

The Playwright suite hits **live youtube.com, logged out**. A red run can be
YouTube serving different data that hour, not a code bug.

1. **Re-run** the failing check in isolation: `cd tests && node run.js --page=<page> --check=<check>`. A failure that clears on re-run was a live-data flake (empty related rail, re-ranked feed, an ad that did/didn't serve). The suite's own comments call these out.
2. If it fails **consistently**, it is a real coupling break — continue below.
3. Reproduce against the real site with the userscript injected before diagnosing shape (see Step 3 for capturing a live payload).

Distinguish the three break classes early, because they live in different places:

| Class | Looks like | Where to look |
|---|---|---|
| **Payload shape** (most common) | A section renders empty / a card is missing a field / an extractor returns `null` | §3 renderer/viewModel keys; the extractor functions |
| **Player API** | Video/controls dead, volume/seek/speed/captions no-op, autoplay stuck | §4 player object |
| **DOM / CSS / event** | Nav does a full reload, ads not blanked, captions unstyled, real YouTube flashes | §5 DOM hooks, §6 events |

---

## Step 1 — triage by symptom (which test is red → which coupling → which function)

| Symptom / red check | Likely coupling that moved | Inspect | Re-map hint |
|---|---|---|---|
| Feed/search/channel cards missing or empty (`snapshot` counts below floor, `checkInfiniteScroll`) | `lockupViewModel` / `videoRenderer` field paths, or the continuation token path | `extractVideos` (~2209), `lockupItem` (~2175), `findContinuationToken` (2340) | §3; capture a `browse`/`search` response, diff the item shape |
| Watch title/owner/stats blank, skeleton never reveals (`runWatchFunctional`, `checkColdLoadSkeleton`) | `videoPrimaryInfoRenderer` / `videoSecondaryInfoRenderer` / `videoOwnerRenderer`, or `ytInitialPlayerResponse.videoDetails` | `renderMeta` (4550+), `resolveOwnerChannelId` (2046) | §3 watch metadata; note reveal is gated on a non-empty owner name (4582) |
| Related rail empty, watch→watch nav broken (`checkWatchToWatchNavigation`) | `next` response shape or `loadVideoById`/`yt-navigate` | `renderWatchFor` (5353), `ytNavigate` (5405) | §1 `next`, §6 events |
| Comments don't load / authors not links (`checkCommentBodyLinks`, `checkCommentsOffCopy`) | `commentEntityPayload` (VM) or `commentRenderer` (legacy), comments continuation | `commentEntityMap` (2397), `extractComment` (2455/2478), `findCommentsToken` (2366) | §3 comments |
| Like/dislike/save/**subscribe** silently revert when signed in | The mutation **confirmation** check no longer matches the response | `mutationConfirmed` (2114), `subscribeConfirmed` (2127), `likeConfirmed` | §1 mutations; YouTube dropped the confirming field — loosen the check (see box below) |
| Channel header/tabs/About blank (`runChannelChecks`, `checkAboutTab`) | `c4TabbedHeaderRenderer`/`pageHeaderRenderer`, `aboutChannelViewModel`, or the `/about` HTML marker | `paintHeader` (3562), `loadAbout`/`fetchAboutPage` (3682) | §3 channel, §7 HTML scrape |
| Nav does a full page reload / real YouTube flashes (`checkFeedToWatchNavigation`, `hardnav`, `checkYtdAppHidden`) | `ytd-app` gone/renamed, `yt-navigate` detail shape, or `#movie_player` id | `ytNavigate` (5405), park CSS (1797), `player` (3911) | §5, §6; watch the `bootWatch` timeout → hard-nav fallback (5451) |
| Ads not skipped/blanked (`checkVideoAds`, `checkAdStateMachine`) | `ad-showing` class or the skip-button selectors | `adShowing` (3960), `clickSkipAd` (3949) | §5 ads; **`getAdState` is deliberately not used** — the class is the signal |
| No API calls at all, everything empty | `window.ytcfg.data_` shape (`INNERTUBE_API_KEY`/`INNERTUBE_CONTEXT`) or the SAPISID cookie | `cfg` (1880), `innertube` (1895), `sapisidHash` (1885) | §2 |
| Sidebar subscriptions empty | `guide` endpoint / `guideEntryRenderer` / `ytInitialGuideData` | `fetchGuideChannels`, `collectGuideChannels` (2980) | §3; **UNGUARDED** — no test catches this |

> **The mutation-confirmation trap.** Optimistic actions (like/dislike/save/
> subscribe) flip the UI, call InnerTube, then **revert unless the response
> confirms**. Two ways this bit us, both making a *successful* action look
> broken: (1) requiring a confirming field YouTube stopped sending
> (`subscribeConfirmed` once demanded `updateSubscribeButtonAction.subscribed`);
> and (2) mis-reading a normal success signal as a failure — a successful
> subscribe response carries an `openPopupAction` (the notification popup) and
> client signals, and the "blocked" detector used to treat ANY
> `openPopupAction`/`CLIENT_SIGNAL` as blocked, so the button flipped then
> snapped back (you'd be subscribed after a refresh). The "blocked" signal is now
> narrowed to **`signInEndpoint` only** (`mutationConfirmed` 2244,
> `subscribeConfirmed` 2257), and `subscribeConfirmed` reverts only on a
> `signInEndpoint` or an *explicitly contradicting* `updateSubscribeButtonAction`.
> Guarded by `checkSubscribeConfirmsOnPopup` (fakes LOGGED_IN + mocks a
> success-with-popup response); the real signed-in network path is still
> otherwise **UNGUARDED** — the suite runs logged out.

---

## Step 2 — the coupling map

Everything iTube depends on in YouTube. A change to any of these can break it.
Verified against the code; spot-check the `file:line` before trusting a row —
line numbers drift as the file changes.

### 2.1 InnerTube endpoints — all via `innertube(endpoint, body)` (1895)
URL: `/youtubei/v1/<endpoint>?key=<INNERTUBE_API_KEY>&prettyPrint=false`, POST,
`credentials:'include'`, body `{ context: INNERTUBE_CONTEXT, ...body }`. Any
failure returns `null` → caller shows empty/error state.

| Endpoint (body keys) | file:line | Consumer | Guarded by |
|---|---|---|---|
| `browse` (`browseId` / `continuation` / `browseId,params`) | 3272, 3845, 3520, 3266, 3879 | home / feed / channel mounts | functional, channels, signedout |
| `search` (`query[,params]` / `continuation`) | 3340, 3351 | `mountSearch` | `checkFiltersInUrl`, `checkSearchSuggestions` |
| `next` (`videoId[,playlistId]` / `continuation`) | 5353, 4663, 4702, 2750 | watch meta+related, queue, comments, replies | `runWatchFunctional`, `checkWatchToWatchNavigation` (replies UNGUARDED) |
| `guide` (`{}`) | 2997 | sidebar subs | **UNGUARDED** |
| `navigation/resolve_url` (`url`) | 3433 | channel handle→UC id | `runChannelChecks` |
| `like/like` · `like/dislike` · `like/removelike` (`target:{videoId}`) | 4296, 4314 | like/dislike | signedout (signed-in UNGUARDED) |
| `subscription/subscribe` · `/unsubscribe` (`channelIds:[id], params`) | 3655, 4363 | subscribe | signedout (signed-in UNGUARDED) |
| `browse/edit_playlist` (`playlistId:'WL', actions:[…]`) | 4333 | Watch Later save | signedout (signed-in UNGUARDED) |

### 2.2 Global objects & cookies
| Thing | file:line | Consumer |
|---|---|---|
| `window.ytcfg.data_` → `INNERTUBE_API_KEY`, `INNERTUBE_CONTEXT`, `LOGGED_IN` | 1880, 1897, 1909, 1913, 1882 | `cfg`, `innertube`, `loggedOut` |
| Cookie `__Secure-3PAPISID` / `SAPISID` → `SAPISIDHASH` auth header | 1885, 1892, 1908 | `sapisidHash` (authed endpoints) |
| `window.ytInitialData` | 3271, 3866, 4550, 4763, 5122, … | cold mounts, watch meta, comments |
| `window.ytInitialPlayerResponse.{playabilityStatus.status, videoDetails.*}` | 4550, 4556–4607 | `renderMeta`, `playabilityStatus` |
| `window.ytInitialGuideData` | 2995, 3050 | guide fast path (UNGUARDED) |

### 2.3 Renderer / viewModel / entityPayload keys
Walked by `walk`/`findNode` (1952), which **skips ad subtrees** (`AD_KEYS` 1926,
`AD_KEY_RE` 1948). Each key is a hard string literal — a rename here silently
drops data.

- **List items:** `lockupViewModel` (video: `.contentId`, `.metadata.lockupMetadataViewModel.title.content`, `.contentImage.thumbnailViewModel.image.sources`, `.metadata.metadataRows`, avatar via `.metadata.image.decoratedAvatarViewModel…onTap` / `.avatarStackViewModel`) — 2175; classic `videoRenderer` fields via `getTitle`/`getChannel`/`getThumb`/`getDuration`/`getViews`/`getPublished` (1972–2168); resume % via `thumbnailOverlayResumePlaybackRenderer.percentDurationWatched` (2242, UNGUARDED).
- **Playlists:** `playlistRenderer`/`gridPlaylistRenderer`/`compactPlaylistRenderer` (2293), `lockupViewModel` playlist variant (2279), queue `playlistPanelVideoRenderer` + `.playlist.playlistId/.contents` (2311).
- **Continuations:** `continuationItemRenderer.continuationEndpoint.continuationCommand.token` (2340); comments section `itemSectionRenderer.sectionIdentifier==='comment-item-section'` (2366); comment sort `sortFilterSubMenuRenderer` (2383, UNGUARDED).
- **Watch meta:** `videoPrimaryInfoRenderer` (4557), `videoSecondaryInfoRenderer.owner.videoOwnerRenderer` (4558/4582), like state `segmentedLikeDislikeButtonViewModel` (2054, legacy `topLevelButtons[].toggleButtonRenderer` 2063), subscribed `subscribeButtonRenderer/ViewModel.subscribed` (2135), chapters `engagementPanels[]…macroMarkersListItemRenderer.timeDescription` (4084).
- **Watch owner is mid-migration to viewModels** — some videos still expose `videoOwnerRenderer.{title.runs, thumbnail, subscriberCountText, navigationEndpoint.browseEndpoint}`; others moved the SAME fields to: name → `owner.attributedTitle.content`, avatar → `owner.avatarStack.avatarStackViewModel.avatars[0].avatarViewModel.image.sources[0].url`, subs → a plain `{content:"@handle • N subscribers"}` node under owner, channel id → a `browseEndpoint.browseId` nested deeper (not on `navigationEndpoint`). `renderMeta` (~4735) and `resolveOwnerChannelId` (~2176) read BOTH shapes with `||` fallbacks, and on a cold load `ytInitialPlayerResponse.videoDetails.{author,channelId}` backstops name/id (but NOT on SPA nav — `details` is null there). Guarded by `checkWatchMetaReveals` against a known new-shape fixture. **The reveal must never gate terminally on the name** — an empty owner reveals anyway on the authoritative (`data !== ytInitialData`) render so the skeleton is never stuck.
- **Comments:** `frameworkUpdates.entityBatchUpdate.mutations[].payload.commentEntityPayload` (2397) + `.properties/.author/.toolbar` (2478); legacy `commentThreadRenderer`/`commentRenderer` (2455); count `commentsHeaderRenderer.countText` (2515).
- **Channel:** `metadata.channelMetadataRenderer.externalId` (3428), `c4TabbedHeaderRenderer`/`pageHeaderRenderer` (3562), tab `browseEndpoint.params` (3471), `aboutChannelViewModel`/`channelAboutFullMetadataRenderer` (3722/3792), `guideEntryRenderer` (2980), `playlistHeaderRenderer.title` (3833, UNGUARDED).
- **Prompts / endpoints:** `backgroundPromoRenderer`/`messageRenderer`/`signInEndpoint`/`openPopupAction` (2093), `feedNudgeRenderer` (2109), `updateSubscribeButtonAction.subscribed` / `CLIENT_SIGNAL` (2119/2128), and navigation endpoints `browseEndpoint.{canonicalBaseUrl,browseId,commandMetadata.webCommandMetadata.url}` / `watchEndpoint.{videoId,startTimeSeconds}` / `urlEndpoint.url` used by `channelHrefFrom` (1991), `buildRunsSegments`/`buildAttributedSegments` (2411).

### 2.4 Third-party: Return YouTube Dislike (estimate only)
`fetchDislikes(videoId)` (2036) hits `GET https://returnyoutubedislikeapi.com/votes?videoId=<id>`,
`credentials:'omit'` (deliberately — a third-party host must never see YouTube
auth cookies), reads the `dislikes` field, `null` on any failure/timeout/
`deleted:true`/non-finite value. Consumed from `refreshActions` (~4520) with a
per-video generation guard (`dislikeCountGeneration`) so a slow response for a
video the user already navigated away from can't paint. Renders into
`dislikeLabel` as `'~' + formatCompact(count)` (2026) with
`dislikeBtn.title = 'Estimated dislikes · Return YouTube Dislike'` — the `~`
and title are the only "this is an estimate" labeling; do not drop them. On
`null` the label is left **empty**, never `0` or `NaN`. This is a genuine
privacy tradeoff (video IDs leave the page to a third party) the user
explicitly accepted; if the endpoint disappears or CSP starts blocking it,
the feature should degrade to no-count, not break the rest of the watch page.
Guarded only by a mocked functional test (`tests/checks/functional.js`); the
real network call against the live RYD service is otherwise UNGUARDED (see
Blind spots).

### 2.5 Player object (`#movie_player`, id at 3911) & `<video>`
Every player call is optional-chained/`typeof`-guarded → a removed method
no-ops or falls back to the raw `<video>`. Key ones: `getVolume`/`setVolume`/
`isMuted`/`mute`/`unMute` (3915–3946), `seekTo` (2035), `getVideoData().{video_id,isLive}`
(2028…), `loadVideoById` (5399 — the SPA-nav gate), `playVideo` (5476),
`get/setPlaybackRate` (5161/5062), `toggleSubtitles`/`getOption('captions',…)`
(4999, UNGUARDED), `seekToLiveHead` (5027, UNGUARDED), `previous/nextVideo`
(5052, UNGUARDED), `getPlayerResponse().storyboards…` (4106, UNGUARDED),
`.classList.contains('ad-showing')` (3960), `getAvailableAudioTracks`/
`getAudioTrack`/`setAudioTrack` (populateAudioTracks, UNGUARDED via optional-
chaining — feeds the Audio row in the player menu, hidden unless the video
exposes more than one track).
`<video>`: `.currentTime/.duration/.paused/.readyState/.volume/.muted/.buffered`
and `.requestVideoFrameCallback` (4071, crossfade).
**Invariant:** `#movie_player` shadows `addEventListener` — bind its (and the
re-parented `<video>`'s crossfade) events via
`EventTarget.prototype.addEventListener.call(...)` (4078) or they no-op.

### 2.6 DOM / CSS hooks into YouTube's markup
`#movie_player` (3911), `ytd-app` (5403; parked `left:-99999px !important`
**not** `display:none` at 1799 — it must keep laying out to decode), `<video>`
re-parented into `#itube-stage` (`adoptVideo` 3983), ad class `ad-showing`
(3960) via a MutationObserver on `#movie_player` (5148), skip-ad selectors
(`.ytp-skip-ad-button, .ytp-ad-skip-button, …` 3949), caption container
`.ytp-caption-window-container` (3989), search suggest host
`suggestqueries-clients6.youtube.com/complete/search?...&xhr=t` (2867).

### 2.7 Events & navigation
Dispatch `yt-navigate` on `ytd-app` with `detail.endpoint.{commandMetadata…webPageType:'WEB_PAGE_TYPE_WATCH', watchEndpoint:{videoId,playlistId}}`
(5405) to boot YouTube's router and construct `#movie_player`; listen
`yt-navigate-finish` (`e.detail.response.response || …`) (5121); capture-phase
`popstate` with `stopImmediatePropagation` (5625); `history.pushState/replaceState`;
link interception gated by `NATIVE_NAV_RE` (5607). Fallback when the boot never
lands: `bootWatch` timeout → `location.assign` hard nav (5451).

### 2.8 HTML scraping (the only one)
About tab: `fetch(channelBase()+'/about')` then extract `ytInitialData` from the
HTML via the marker string `'var ytInitialData = '` + a hand-written balanced-
brace scanner + `JSON.parse` (3682). Breaks if the assignment becomes
`window["ytInitialData"] =` or a differently-quoted literal → returns `null` →
"Couldn't load channel info."

---

## Step 3 — re-mapping a changed data shape

1. **Capture the real payload.** In a normal browser tab on youtube.com (userscript can be off), open DevTools and grab the object iTube reads:
   - Page data: `copy(window.ytInitialData)` / `copy(window.ytInitialPlayerResponse)`.
   - An InnerTube response: in the Network tab, find the `/youtubei/v1/<endpoint>` request iTube makes (same `key`), copy its JSON response. Or replay it: `fetch('/youtubei/v1/next?key='+ytcfg.data_.INNERTUBE_API_KEY+'&prettyPrint=false',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({context:ytcfg.data_.INNERTUBE_CONTEXT, videoId:'<id>'})}).then(r=>r.json()).then(copy)`.
2. **Diff against the documented path.** Find the extractor from §2 and walk the captured object along the same path. The break is usually a **renamed wrapper** (e.g. `videoRenderer` → some `lockupViewModel`) or a **relocated field**. `findNode`/`walk` search the whole tree for a predicate, so a moved-but-same-key node still resolves; a **renamed key** does not.
3. **Fix the extractor**, preserving the fallback chain (new shape first, old shape as `||` fallback — see how `renderMeta` falls back from `videoSecondaryInfoRenderer` to `videoDetails`, or `readLikeState` from `segmentedLikeDislikeButtonViewModel` to `topLevelButtons`). Keep both so older payloads still work. **No `innerHTML`** — build DOM the same way (see invariants).
4. **Re-point, don't restyle.** iTube renders its own DOM; you are only changing which *data path* feeds it. Do not start reading YouTube's rendered DOM instead.
5. **Add/adjust a test.** If the broken coupling was UNGUARDED (§ below), add a check in the matching `tests/checks/*.js` that would have caught it — assert the extractor yields a non-empty value on the live page. Prove it RED against the broken code, GREEN against the fix (the suite's discipline: a check that can't fail is worthless).
6. **Verify:** `cd tests && npm test` (full suite green), `npm run test:selftest` (checks can still fail), `node bench.js` (no perf regression).

---

## Invariants — never violate (these are load-bearing)

1. **No `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`eval`/`new Function`.** youtube.com enforces Trusted Types; any of these throws and kills the view. Build DOM with `createElement`/`textContent`/`replaceChildren`.
2. **`#movie_player` shadows `addEventListener`** — bind its events via `EventTarget.prototype.addEventListener.call(player, …)` or they silently do nothing.
3. **Never cycle `loadModule`/`unloadModule('captions')`** — it stalls the player at `readyState 0`. Toggle captions only via `toggleSubtitles`.
4. **`ytd-app` is parked offscreen (`left:-99999px`), never `display:none`** — the player must keep laying out to decode. `display:none` stops decode.
5. **`ytd-app` must exist** for `yt-navigate` to boot YouTube's router and build `#movie_player`; without it iTube falls back to full page loads.
6. **Volume:** element volume = ratio × player volume (loudness normalization); persist writes debounced ≥300ms or the sliders drift. **Ad mute must not be persisted.**
7. **No per-card work / no per-frame steady-state cost / no animations** except the deliberate thumbnail fade and the watch crossfade/skeleton. Performance is the product; `perf` + `layout` + `bench.js` enforce it.
8. **No code comments in `itube.user.js`** — it must read as human-written. (Comments in `tests/**` are expected.)

---

## Blind spots — couplings NO test will catch

If one of these breaks, the suite stays green and only a human notices. Check
these manually after any large YouTube change, and prefer adding a guard when
you touch them:

- **Sidebar subscriptions** (`guide` endpoint, `guideEntryRenderer`, `ytInitialGuideData`).
- **Comment replies** (`next` reply continuation) and **comment sort** (`sortFilterSubMenuRenderer`).
- **Continue-watching** resume % (`thumbnailOverlayResumePlaybackRenderer`).
- **Player quality & captions menus** (`getAvailableQualityLevels`, `getOption('captions',…)`, `isSubtitlesOn`, `setPlaybackQualityRange`), **prev/next** (`getPlaylist`, `previous/nextVideo`), **live edge** (`seekToLiveHead`), **seek preview** storyboards.
- **Signed-in mutation success** for like/dislike/save/subscribe — only the signed-out prompt is guarded, so a reverting-on-success regression (the subscribe trap above) ships green.
- **Playlist header title**, **caption CSS restyle**, **`video.buffered`** bar.
- **Return YouTube Dislike live network call** — the mocked functional test proves the render path, not that `returnyoutubedislikeapi.com` itself is still reachable/shaped the same; a real outage or schema change just silently empties the dislike count (by design, see 2.4).
