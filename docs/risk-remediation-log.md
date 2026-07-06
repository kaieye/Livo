# Risk Remediation Log

## 2026-07-07 - Main process shutdown lifecycle

### Review inputs

- Lifecycle review sub-agent inspected `AppManager`, Electron quit events, and database-backed background jobs.
- Security review sub-agent inspected main/preload IPC, remote windows, URL fetches, and privileged handlers.
- Renderer review sub-agent inspected React state and async data-flow race risks.
- GitNexus index was refreshed before final impact analysis.

### Fixed in this batch

- `AppManager.handleWindowAllClosed()` now preserves the database when the last macOS window closes, matching native macOS app lifecycle expectations.
- Explicit quit paths now stop database-backed background jobs before closing SQLite:
  - startup delayed background timer
  - Fever auto sync
  - feed auto refresh
  - aggregator warmup jobs
  - cache maintenance interval
- Database close is now guarded by `databaseReady` and `databaseClosed`, so early window close before database initialization does not touch an uninitialized adapter, and duplicate Electron quit events close SQLite only once.
- `AppManager.onReady()` skips scheduling startup background jobs if quitting began while database initialization was still in flight.

### Impact analysis

- `AppManager`: LOW risk. Direct upstream importer: `src/main/index.ts`; no GitNexus execution flows reported.
- `handleBeforeQuit`: LOW risk. No direct upstream callers reported by GitNexus.
- `handleWindowAllClosed`: LOW risk. No direct upstream callers reported by GitNexus.
- `stopDatabaseBackedBackgroundJobs`: LOW risk. Direct callers are `handleBeforeQuit` and `handleWindowAllClosed`.
- `stopAutoRefresh` and `stopAggregatorJobs`: LOW risk. They previously had no upstream callers reported by GitNexus and are now centralized in the shutdown path.

Manual review raised the effective lifecycle risk from LOW to MEDIUM before the fix because Electron event registration is not represented in the GitNexus call graph, and the earlier patch did not stop all database-backed timers.

Pre-commit `detect_changes --scope compare --base-ref main` reported HIGH risk because `AppManager.onReady()` participates in 10 startup execution flows. The intentional behavior change is limited to the quit-in-progress branch after database initialization: startup background jobs are not scheduled if the app already began quitting.

### Verification

- `pnpm test -- src/main/app-manager.test.ts`
  - Vitest ran the full configured suite.
  - Result: 143 passed test files, 806 passed tests, 13 skipped tests.
- `pnpm lint -- src/main/app-manager.ts src/main/app-manager.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.

### Deferred findings

Security review findings to handle in later batches:

- Harden remote login windows with provider origin allowlists, stricter popup handling, navigation guards, and permission denial defaults.
- Restrict `video:open-in-app` to supported/safe URL classes, sandbox the window, and deny arbitrary popups.
- Revisit private-network and localhost fetch allowances for readability and feed parsing to reduce SSRF-style exposure.
- Align Agent external-opening tools with `allowExternal` policy rather than only `allowNavigate`.
- Add stricter validation and resource limits for privileged IPC such as save, download, report error, read logs, and OPML import.

Renderer review findings to handle in later batches:

- Guard URL-based entry selection against stale async requests.
- Guard quick search results against stale IPC responses.
- Flush pending reading progress on entry switch or unmount.
- Add stale-request protection to non-snapshot pagination.
- Prevent stale search results from replacing a restored normal entry list.
- Roll back optimistic settings updates when persistence fails.

## 2026-07-07 - Agent external media link permissions

### Review inputs

- Agent policy review sub-agent confirmed `open_video_player` and `open_image_viewer` were previously classified as `navigate`, so `allowNavigate=true` and `allowExternal=false` still exposed tools that ultimately opened external URLs.
- Renderer navigation review sub-agent traced the media-open path from Agent tool execution through `agent:navigate`, `useAgentNavigate`, `openExternalUrlSafe`, `APP_OPEN_EXTERNAL`, and `WindowManager.safeOpenExternal`.
- Existing deferred security finding: align Agent external-opening tools with `allowExternal` policy rather than only `allowNavigate`.

### Fixed in this batch

- `open_video_player` and `open_image_viewer` are now `external` tools and require confirmation before execution.
- Tool descriptions, success messages, and AI tool labels now describe opening external media links instead of implying an in-app player/viewer for arbitrary media URLs.
- Renderer Agent media navigation now uses `openExternalUrlSafe()` instead of calling `window.api.app.openExternal()` directly.
- Video and image viewer "open original" actions now reuse `openExternalUrlSafe()` instead of raw `window.open()`.
- Inline `VideoPlayer` browser fallbacks now reuse `openExternalUrlSafe()` for unsupported video or click-through cases.

### Impact analysis

- `buildOpenVideoPlayerTool`: LOW risk. Direct upstream caller: `buildAllAgentTools`.
- `buildOpenImageViewerTool`: LOW risk. Direct upstream caller: `buildAllAgentTools`.
- `useAgentNavigate`: LOW risk. Direct upstream caller: `AppRuntime`.
- `VideoPlayerPage`: LOW risk. No upstream callers reported by GitNexus.
- `ImageViewerPage`: LOW risk. No upstream callers reported by GitNexus.
- `VideoPlayer` in `components/ui`: ambiguous symbol lookup, but the matching renderer UI player candidate reported maximum LOW risk with four direct callers.
- `aiChatToolLabelOf`: LOW risk. Direct callers are AI chat trace/status display code; behavior change is limited to two display labels.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported MEDIUM risk across 9 files and 16 symbols. Affected flows were `ImageViewerPage → NormalizeImageMetadata` and `SendMessage → AiChatToolLabelOf`, matching this batch's media external-link and tool-label changes.

### Verification

- `pnpm test -- src/main/agent/tools/schema-boundaries.test.ts src/renderer/src/hooks/useAgentNavigate.test.ts`
  - Vitest ran the full configured suite.
  - Result: 143 passed test files, 809 passed tests, 13 skipped tests.
- `pnpm typecheck`
  - Result: passed.

### Deferred findings

- Remaining direct `window.open` and raw `window.api.app.openExternal` callers in entry/article/settings surfaces should be unified behind `openExternalUrlSafe()` in a later batch.
- Remote login window hardening, private-network fetch policy, and privileged IPC resource limits remain open from the security review.

## 2026-07-07 - App IPC resource limits

### Review inputs

- High-privilege app IPC review sub-agent inspected app, download, log, and context-menu handlers and flagged shallow validation on privileged renderer-controlled payloads.
- OPML import review sub-agent inspected desktop OPML import and found separate size, extension, synchronous read, and feed-count limit issues. Those findings are deferred to keep this batch scoped to app IPC handlers.
- Existing deferred security finding: add stricter validation and resource limits for privileged IPC such as save, download, report error, read logs, and OPML import.

### Fixed in this batch

- `APP_REPORT_ERROR`, `APP_SAVE_TEXT_FILE`, `APP_DOWNLOAD_URL`, `APP_READ_RECENT_LOGS`, `APP_OPEN_EXTERNAL`, and `MENU_SHOW_CONTEXT` now enforce deeper shared IPC validation before handlers run.
- Renderer error reports are routed through `reportRendererError()` and truncated before writing to the main-process log.
- Recent log reads now clamp requested line counts and tail-read at most 2 MiB instead of reading an unbounded log file into memory.
- Text-file export rejects content over 10 MiB before showing a save dialog.
- URL downloads now enforce a 60 second fetch timeout, reject oversized `Content-Length` values before prompting, stream responses with a 100 MiB byte limit, and delete partial files when the streaming limit is exceeded.
- Suggested download/export file names are capped to a bounded length while preserving extensions.
- Native context-menu item payloads now have bounded item counts, id/label lengths, and boolean field validation.

### Impact analysis

- `registerAppHandlers`: LOW risk. Direct upstream caller: `AppManager.onReady`; affected startup app-handler registration flows only.
- `saveTextFile`: LOW risk for the main `src/main/services/system/download.ts` symbol. Direct caller: `registerAppHandlers`.
- `downloadUrlToFile`: LOW risk. Direct caller: `registerAppHandlers`.
- `readRecentLogs`: LOW risk for the main `src/main/services/system/logger.ts` symbol. Direct caller: `registerAppHandlers`.
- `reportRendererError`: LOW risk. No upstream callers reported before this batch.
- `validateIpcArgs`: LOW risk. No upstream callers reported by symbol-level impact before this batch.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported CRITICAL risk across 11 files, 37 symbols, and 18 execution flows. The high effective scope is expected because shared IPC validation and logger helpers participate in many handler registration and logging flows. The changed behavior is intentionally limited to rejecting malformed or oversized privileged app IPC payloads and bounding log/download resource use.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/shared/ipc-contracts.ts src/shared/ipc-contracts.test.ts src/main/ipc/register-channel.test.ts src/main/handlers/app-handlers.ts src/main/services/system/download.ts src/main/services/system/download.test.ts src/main/services/system/logger.ts src/main/services/system/logger.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/shared/ipc-contracts.test.ts src/main/ipc/register-channel.test.ts src/main/services/system/download.test.ts src/main/services/system/logger.test.ts`
  - Vitest ran the full configured suite.
  - Result: 144 passed test files, 817 passed tests, 13 skipped tests.

### Deferred findings

- Harden desktop OPML import: restrict selectable file types, avoid synchronous unbounded reads, add file-size limits, and bound imported feed/token counts.
- Harden remote login windows with provider origin allowlists, stricter popup handling, navigation guards, and permission denial defaults.
- Revisit private-network and localhost fetch allowances for readability and feed parsing to reduce SSRF-style exposure.
- Remaining direct `window.open` and raw `window.api.app.openExternal` callers in entry/article/settings surfaces should be unified behind `openExternalUrlSafe()` in a later batch.

## 2026-07-07 - OPML import resource limits

### Review inputs

- OPML import review sub-agent inspected desktop import, parser behavior, bulk feed fetching, and imported-feed refresh IPC.
- Confirmed risks: synchronous unbounded file read, no parser feed/token limits, broad file picker, bulk private/loopback fetches, and unbounded `FEED_REFRESH_IMPORTED` string arrays.

### Fixed in this batch

- Desktop OPML import now offers only `.opml` and `.xml` files and validates the selected path extension before reading.
- OPML files over 5 MiB are rejected before reading content into memory, and import reads now use async `fs/promises` instead of `readFileSync()` in the main-process handler.
- `parseOPML()` now streams regex matches without building an intermediate token array and enforces feed count, outline tag count, category depth, and attribute text limits.
- OPML import now caps parsed feeds at 1000.
- Newly imported OPML feed URLs are checked with the strict network fetch policy before queueing fetch work, so loopback, private-network, credentialed, malformed, and unsupported-protocol URLs are skipped during bulk import.
- OPML import error collection is capped to avoid returning an unbounded error list.
- `FEED_REFRESH_IMPORTED` now rejects more than 100 feed IDs or overlong/empty IDs at IPC validation time; the handler also caps the deduped work list defensively.

### Impact analysis

- `registerFeedHandlers`: LOW risk by symbol impact. No direct upstream callers reported, though GitNexus execution flows show it participates in app startup handler registration.
- `parseOPML`: LOW risk. Direct upstream caller: `registerFeedHandlers`; affected processes include `registerFeedHandlers` and `onReady`.
- `getAttr`: LOW risk. Direct upstream caller: `parseOPML`; indirect caller: `registerFeedHandlers`.
- `validateIpcArgs`: LOW risk. No upstream callers reported by symbol-level impact.
- `assertStringArray`: CRITICAL risk if changed because it is shared by multiple IPC contracts and handler flows. This batch avoids changing that helper and instead adds a narrower bounded string-array validator for `FEED_REFRESH_IMPORTED`.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported CRITICAL risk across 7 files, 20 symbols, and 18 execution flows. The high effective scope is expected because `registerFeedHandlers` is a broad IPC registration function; changed behavior is limited to OPML import, OPML parser limits, and imported-feed refresh ID validation.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/handlers/feed-handlers.ts src/main/handlers/feed-handlers.test.ts src/main/services/feed/opml-parser.ts src/main/services/feed/opml-parser.test.ts src/shared/ipc-contracts.ts src/shared/ipc-contracts.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/main/handlers/feed-handlers.test.ts src/main/services/feed/opml-parser.test.ts src/shared/ipc-contracts.test.ts`
  - Vitest ran the full configured suite.
  - Result: 145 passed test files, 822 passed tests, 13 skipped tests.

### Deferred findings

- Remote login window hardening remains open: provider origin allowlists, stricter popup handling, navigation guards, and permission denial defaults.
- The general feed/readability private-network policy still allows loopback/private fetches in non-OPML paths and should be reviewed separately because manual local feeds may be an intentional use case.
- Remaining direct `window.open` and raw `window.api.app.openExternal` callers in entry/article/settings surfaces should be unified behind `openExternalUrlSafe()` in a later batch.

## 2026-07-07 - Login window navigation hardening

### Review inputs

- Account login window review sub-agent inspected cookie-account linking, legacy YouTube login IPC, backend OAuth popups, WeChat MP login, session permissions, and token storage.
- Renderer external-link review sub-agent inspected remaining raw `window.open`, raw `window.api.app.openExternal`, and `_blank` anchor paths. Those findings are deferred to keep this batch scoped to login windows.
- Network policy review sub-agent inspected private-network fetch and DNS/redirect risks outside OPML. Those findings are deferred to a separate network-policy batch.

### Fixed in this batch

- Added a shared login-window URL policy that accepts only HTTPS URLs without credentials and only provider allowlisted origins or host suffixes.
- Cookie-account login windows now use provider-specific navigation allowlists for YouTube/Google, X/Twitter, Instagram, and Bilibili.
- Cookie-account popup attempts are no longer allowed as new windows; allowed provider URLs are loaded in the same login window and all other popup URLs are denied.
- Backend OAuth popups now validate the initial backend-supplied URL against the configured backend origin or expected provider OAuth hosts before loading.
- Backend OAuth popups now deny unknown popup URLs and block main-frame navigation outside the backend/provider allowlist.
- WeChat MP login windows now deny unknown popup URLs and block main-frame navigation outside WeChat/QQ allowlisted login origins.
- Default Electron session and the WeChat MP persistent login partition now install deny-by-default permission request/check handlers.
- Legacy `VIDEO_YT_LOGIN`, `VIDEO_YT_STATUS`, and `VIDEO_YT_LOGOUT` IPC handlers now route through the hardened account-linking service's YouTube provider instead of creating a second unsandboxed Google login window.
- Added focused tests for URL policy rules, account login provider allowlists, backend OAuth allowlists, WeChat MP navigation rules, session permission denial, and legacy YouTube IPC routing.

### Impact analysis

- `linkAccount`: HIGH risk before the fix. Direct callers include `registerAccountHandlers` and the account Agent tool; affected processes include `registerAccountHandlers`, `registerIpcHandlers`, and `onReady`.
- `isCookieProviderLoginUrlAllowed`: HIGH risk after introduction because it sits directly in `linkAccount`; affected processes include account handler registration and startup IPC registration flows.
- `createAuthPopup`: LOW risk. Direct callers are `runOAuthLogin` and `bindProvider`; affected processes include `registerIpcHandlers` and `onReady`.
- `registerWechatMpHandlers`: LOW risk. Direct upstream caller: `AppManager.registerIpcHandlers`; affected processes include `registerIpcHandlers` and `onReady`.
- `registerSessionPolicies`: LOW risk. After GitNexus refresh, no upstream callers were reported by symbol-level impact, but source inspection confirms it is invoked from `AppManager.onReady`.
- `registerVideoHandlers`: LOW risk. After GitNexus refresh, no upstream callers were reported by symbol-level impact, but source inspection confirms it is invoked from `AppManager.registerIpcHandlers`.
- GitNexus index was refreshed before final impact analysis. The refresh updated AGENTS/CLAUDE index counts to 7,882 nodes, 20,966 edges, 656 clusters, and 300 flows.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported MEDIUM risk across 15 files, 32 symbols, and 2 affected execution flows. The affected flows were `RegisterAccountHandlers → GetGoogleOAuthClientId` and `RegisterAccountHandlers → Base64Url`, matching the intentional YouTube/account login hardening path.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/services/auth/login-window-policy.ts src/main/services/auth/login-window-policy.test.ts src/main/handlers/auth-handlers.ts src/main/handlers/auth-handlers.test.ts src/main/services/account/account-auth.ts src/main/services/account/account-auth.test.ts src/main/handlers/wechat-mp-handlers.ts src/main/handlers/wechat-mp-handlers.test.ts src/main/services/system/session-policies.ts src/main/services/system/session-policies.test.ts src/main/handlers/video-handlers.ts src/main/handlers/video-handlers.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/main/services/auth/login-window-policy.test.ts src/main/handlers/auth-handlers.test.ts src/main/services/account/account-auth.test.ts src/main/handlers/wechat-mp-handlers.test.ts src/main/services/system/session-policies.test.ts src/main/handlers/video-handlers.test.ts`
  - Vitest ran the full configured suite.
  - Result: 150 passed test files, 830 passed tests, 13 skipped tests.

### Deferred findings

- App auth bearer tokens are still stored through the existing `session-store` path and should be moved to `safeStorage` or OS keychain-backed storage in a separate migration batch.
- `VIDEO_OPEN_IN_APP` still creates a general video BrowserWindow and should get its own URL/navigation/popup hardening batch.
- Remaining renderer/web raw external-open paths should be unified behind `openExternalUrlSafe()`, especially `EntryContent`, `ArticleDetailPage`, discovery/settings anchors, and web API stubs.
- General feed/readability/discovery/video fetch paths still need a broader private-network, redirect, and DNS-rebinding policy pass outside the already-hardened OPML path.

## 2026-07-07 - Renderer/web external link hardening

### Review inputs

- Renderer external-link review sub-agent inspected `EntryContent`, `EntryBodyContent`, and `ArticleDetailPage`.
- Confirmed high-risk direct external opens in article body click handling, toolbar/command browser opens, fallback "read in browser" links, article context menus, and video fallback links.
- Web API review sub-agent did not return before the batch was ready to commit and was closed while still running, so no additional findings were incorporated from that review.

### Fixed in this batch

- `EntryContent` article links, toolbar browser opens, and `entry:open-browser` command handling now route through `openExternalUrlSafe()` instead of raw `window.open()`.
- `EntryBodyContent` fallback "read in browser" links now route through `openExternalUrlSafe()`.
- `ArticleDetailPage` context-menu browser opens and video fallback links now route through `openExternalUrlSafe()`.
- `openExternalUrlSafe()` now reclassifies the confirmed URL immediately before opening and uses the normalized policy URL for IPC and web fallbacks.
- Web fallback API methods `app.openExternal()` and `video.openInApp()` now reuse the shared external URL policy, reject blocked and suspicious URLs, and open only normalized safe URLs.

### Impact analysis

- `EntryContent`: HIGH risk. Direct upstream callers are `DiscoverPanel`, `ArticleDetailPage`, and `DiscoverPreviewPage`; affected processes include `ArticleDetailPage` and `DiscoverPreviewPage`.
- `EntryBodyContent`: HIGH risk. Direct upstream caller is `EntryContent`; indirect affected callers include `ArticleDetailPage` and `DiscoverPreviewPage`.
- `ArticleDetailPage`: LOW risk by symbol impact. No upstream callers reported by GitNexus.
- `openExternalUrlSafe`: CRITICAL risk for broad helper changes, with 31 impacted symbols, 17 direct callers, and 9 affected processes. This batch keeps the helper change narrowly limited to reclassifying and normalizing the already-confirmed URL before open.
- `createExternalUrlWarning`: LOW risk from the removed local warning path in `EntryContent`.
- `src/web/web-api.ts` `openExternal` and `openInApp`: LOW risk by symbol impact. No upstream callers reported.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported CRITICAL risk across 8 files, 10 symbols, and 19 affected execution flows. The high effective scope is expected because shared reading surfaces and `openExternalUrlSafe()` participate in multiple article, image, and video open flows; changed behavior is limited to routing external opens through shared URL policy and normalizing safe URLs before opening.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/renderer/src/components/entry/EntryContent.tsx src/renderer/src/components/entry/entry-content/EntryBodyContent.tsx src/renderer/src/pages/ArticleDetailPage.tsx src/renderer/src/services/external-url.ts src/renderer/src/services/external-url.test.ts src/web/web-api.ts src/web/web-api-contract.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/renderer/src/services/external-url.test.ts src/web/web-api-contract.test.ts`
  - Vitest ran the full configured suite.
  - Result: 150 passed test files, 834 passed tests, 13 skipped tests.

### Deferred findings

- Discovery/settings/profile/social anchors still need a separate pass to remove remaining raw `_blank` and external-open paths.
- `FeedsSettings` external link behavior should be reviewed with the broader settings-link pass.
- General feed/readability/discovery/video fetch paths still need a broader private-network, redirect, and DNS-rebinding policy pass outside the already-hardened OPML path.

## 2026-07-07 - Video window navigation hardening

### Review inputs

- Existing deferred finding: `VIDEO_OPEN_IN_APP` created a general video `BrowserWindow` and needed URL, navigation, popup, and sandbox hardening.
- Local review confirmed the handler only checked an `http(s)` prefix, loaded the raw URL, allowed HTTP(S) popups, and created the child window with `sandbox: false`.
- A video-window review sub-agent did not return before the batch was ready to commit and was closed while still running, so no additional findings were incorporated from that review.

### Fixed in this batch

- `VIDEO_OPEN_IN_APP` now validates requested URLs with the shared external URL policy before creating a window.
- Blocked or suspicious URLs are rejected before any `BrowserWindow` is created.
- Safe URLs are normalized before `loadURL()`.
- The video child window now runs with Electron sandboxing enabled.
- Popups from the video window are denied.
- Main-frame navigation is allowed only when the next URL passes the same policy and stays on the original origin.

### Impact analysis

- `registerVideoHandlers`: LOW risk by GitNexus symbol impact. No direct upstream callers or affected processes were reported, though source inspection confirms it is invoked during IPC handler registration.
- `classifyExternalUrl`: CRITICAL risk if changed broadly, with 45 impacted symbols, 7 direct callers, and 9 affected processes. This batch does not change the shared classifier; it only reuses the existing policy from the video handler.
- `validateIpcArgs`: LOW risk by symbol impact. No upstream callers or affected processes were reported; this batch does not change IPC argument validation.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported LOW risk across 3 files, 1 symbol, and 0 affected execution flows. The changed behavior is limited to `VIDEO_OPEN_IN_APP` URL admission and video child-window navigation controls.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/handlers/video-handlers.ts src/main/handlers/video-handlers.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/main/handlers/video-handlers.test.ts`
  - Vitest ran the full configured suite.
  - Result: 150 passed test files, 837 passed tests, 13 skipped tests.

### Deferred findings

- Renderer/settings/discovery/profile/social anchors still need the separate safe-opener pass identified by the renderer link review.
- General feed/readability/discovery/video fetch paths still need a broader private-network, redirect, and DNS-rebinding policy pass outside the already-hardened OPML path.

## 2026-07-07 - Renderer anchor safe-opener sweep

### Review inputs

- Renderer/web external-open review sub-agent inspected remaining direct external-open and `_blank` anchor paths after the article-link hardening batch.
- Confirmed high-risk bypasses in `FeedsSettings`, discovery result/source links, recommended-feed source links, and `WideViewContent` video modal original links.
- Confirmed medium-risk bypasses in WeChat RSS result links and social profile links, plus a low-risk static GitHub link in About settings.

### Fixed in this batch

- `FeedsSettings` feed website buttons now route feed metadata URLs through `openExternalUrlSafe()`.
- Discovery source links in `DiscoverResultRow`, `DiscoverPanel`, and `RecommendedFeedsDrawer` now prevent native `_blank` opening and route the same targets through `openExternalUrlSafe()`.
- `WideViewContent` video modal original-entry links now route through `openExternalUrlSafe()`.
- WeChat RSS search result links now route RSS URLs through `openExternalUrlSafe()`.
- `SocialMediaItem` now computes a single social profile URL and routes profile clicks through `openExternalUrlSafe()` while preserving the rendered `href`.
- The static About settings GitHub link now routes through `openExternalUrlSafe()` for consistency.

### Impact analysis

- `FeedsSettings`: LOW risk by symbol impact. No upstream callers or affected processes reported.
- `DiscoverResultRow`: LOW risk. Direct upstream caller: `DiscoverPanel`.
- `DiscoverPanel`: LOW risk. No upstream callers or affected processes reported.
- `CuratedFeedRow`: LOW risk. Direct upstream callers: `DiscoverPanel` and `RecommendedFeedsDrawer`.
- `VideoModal`: LOW risk. Direct upstream caller: `WideViewContent`; affected process: `WideViewContent`.
- `ResultRow` in `WechatRssSearchSection`: LOW risk. Direct upstream caller: `WechatRssSearchSection`; indirect caller: `WechatRssPage`.
- `SocialMediaItem`: HIGH risk after UID disambiguation. Direct upstream callers are `TimelineEntryCard` and `SocialLayout`; affected process: `EntryList`.
- `AboutSettings`: LOW risk. No upstream callers or affected processes reported.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported HIGH risk across 9 files, 14 symbols, and 10 affected execution flows. The high effective scope is expected because `SocialMediaItem` participates in the entry list rendering path; changed behavior is limited to intercepting external-link clicks and routing the same URLs through the shared safe opener.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/renderer/src/components/settings/FeedsSettings.tsx src/renderer/src/components/discover/DiscoverResultRow.tsx src/renderer/src/components/discover/DiscoverPanel.tsx src/renderer/src/components/discover/RecommendedFeedsDrawer.tsx src/renderer/src/components/entry/WideViewContent.tsx src/renderer/src/components/wechat-rss/WechatRssSearchSection.tsx src/renderer/src/components/entry/entry-list/items/SocialMediaItem.tsx src/renderer/src/components/settings/AboutSettings.tsx`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/renderer/src/lib/social-url.test.ts src/renderer/src/lib/discover-search.test.ts src/renderer/src/lib/discover-avatar.test.ts`
  - Vitest ran the full configured suite.
  - Result: 150 passed test files, 837 passed tests, 13 skipped tests.

### Deferred findings

- `AIChatMarkdown` still has a `_blank` markdown-link path and should be reviewed separately to confirm whether it already routes through the safe opener at click time.
- General feed/readability/discovery/video fetch paths still need a broader private-network, redirect, and DNS-rebinding policy pass outside the already-hardened OPML path.

## 2026-07-07 - AI markdown link hardening

### Review inputs

- AI markdown link review sub-agent confirmed normal left-clicks already called `openExternalUrlSafe()`.
- The same review found a native-navigation bypass: rendered markdown links still had `href` plus `target="_blank"`, so middle-click or context-menu "open link" could open AI-generated URLs without the safe opener.
- The review also flagged the `{...props}` spread after controlled link props as a low-risk future robustness issue.

### Fixed in this batch

- AI markdown links now render as link-styled buttons instead of native anchors.
- AI-generated markdown URLs no longer expose native `href` or `target="_blank"` navigation affordances.
- Button activation routes the markdown URL through `openExternalUrlSafe()`.
- The anchor props spread was removed from the custom link renderer, so future markdown props cannot override controlled navigation behavior.

### Impact analysis

- `AIChatMarkdown`: LOW risk. Direct upstream callers are `AIChatMessageList` and `DigestContent`; one affected process, `AIChatPanel`, was reported by initial impact analysis.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported LOW risk across 3 files, 3 symbols, and 0 affected execution flows.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/renderer/src/components/ai/AIChatMarkdown.tsx`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/renderer/src/lib/ai-summary-session-model.test.ts src/renderer/src/lib/agent-trace-panel-model.test.ts`
  - Vitest ran the full configured suite.
  - Result: 150 passed test files, 837 passed tests, 13 skipped tests.

### Deferred findings

- General feed/readability/discovery/video fetch paths still need a broader private-network, redirect, and DNS-rebinding policy pass outside the already-hardened OPML path.

## 2026-07-07 - Readability private-network hardening

### Review inputs

- Network policy review sub-agent inspected feed, readability, discovery, video, enrichment, and web fetch paths.
- Confirmed high-risk readability/full-text behavior: `fetchReadableContent()` allowed loopback and private-network targets from feed-controlled entry URLs before fetching article HTML.
- The same review identified broader DNS-rebinding, redirect, feed-parser, discovery, avatar/title, video media, and web-proxy follow-up slices; those are deferred below.

### Fixed in this batch

- `fetchReadableContent()` now uses the strict default `assertNetworkFetchUrl()` policy.
- Loopback and private-network article URLs are rejected before the main-process readability fetch is attempted.
- Added a regression test that loopback article fetches are blocked before `fetch()` is called.

### Impact analysis

- `fetchReadableContent`: LOW risk. Direct upstream callers are `fetchAndPersistReadableContent` and `fetchReadability`; no affected processes were reported.
- `fetchFeedText` and `fetchWithConditional` were reviewed but not changed. GitNexus reports CRITICAL risk for those feed parser paths because they participate in subscription, refresh, discovery preview, and Agent feed-tool flows.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported LOW risk across 3 files, 1 symbol, and 0 affected execution flows.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/services/entry/readability.ts src/main/services/entry/readability.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/main/services/entry/readability.test.ts`
  - Vitest ran the full configured suite.
  - Result: 150 passed test files, 838 passed tests, 13 skipped tests.

### Deferred findings

- Shared network policy should cover IPv4-mapped IPv6 private/loopback addresses and eventually handle DNS rebinding beyond preflight lookup.
- Feed fetching remains intentionally permissive for local RSSHub, LAN, dev, and intranet feeds; it needs an explicit public/private policy mode before changing shared parser behavior.
- Discovery public fetches still need redirect-aware public-only fetch handling, and discovery preview/direct URL probes should be moved onto a public policy mode.
- Feed avatar/title enrichment should classify and skip blocked URLs before best-effort fetches.
- Video duration/proxy/media paths need redirect caps and final media URL classification.
- Web build proxy paths can only apply basic URL classification client-side; trusted proxy-side network enforcement should be documented separately.

## 2026-07-07 - Network URL IPv4-mapped IPv6 hardening

### Review inputs

- Network policy review sub-agent found that `isPrivateNetworkAddress()` did not cover IPv4-mapped IPv6 addresses such as `::ffff:127.0.0.1`.
- Existing network policy tests covered direct IPv4 and IPv6 loopback/private literals, but not mapped IPv6 forms.

### Fixed in this batch

- Added IPv4-mapped IPv6 normalization for both dotted and hex forms.
- Loopback checks now treat mapped IPv4 loopback addresses as loopback.
- Private-network checks now treat mapped IPv4 private addresses as private-network addresses.
- Added regression coverage for mapped loopback, mapped RFC1918 dotted IPv4, and mapped RFC1918 hex IPv4.

### Impact analysis

- `isPrivateNetworkAddress`: LOW risk by symbol impact. No upstream callers or affected processes were reported.
- `isLoopbackAddress`: LOW risk. Direct upstream caller: `isPrivateNetworkAddress`.
- `classifyNetworkFetchUrl`: LOW risk by symbol impact. No upstream callers or affected processes were reported.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported MEDIUM risk across 3 files, 4 symbols, and 1 affected execution flow: `SearchYouTubeChannelsByKeyword → NormalizeHostnameForNetworkPolicy`. The changed behavior is limited to classifying mapped IPv6 forms with the existing IPv4 private/loopback policy.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/services/system/network-url-policy.ts src/main/services/system/network-url-policy.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/main/services/system/network-url-policy.test.ts`
  - Vitest ran the full configured suite.
  - Result: 150 passed test files, 841 passed tests, 13 skipped tests.

### Deferred findings

- DNS rebinding remains only partially mitigated by preflight lookup; socket-level pinning or redirect-aware fetch helpers need separate design.
- Feed fetching remains intentionally permissive for local RSSHub, LAN, dev, and intranet feeds; it needs an explicit public/private policy mode before changing shared parser behavior.
- Discovery public fetches still need redirect-aware public-only fetch handling.
- Feed avatar/title enrichment should classify and skip blocked URLs before best-effort fetches.
- Video duration/proxy/media paths need redirect caps and final media URL classification.

## 2026-07-07 - Video duration redirect cap

### Review inputs

- Network policy review sub-agent found that video duration API/page fetches preflight URLs with the strict network guard, but duration redirects could recurse without a maximum cap.
- Local impact analysis confirmed `fetchText` in `video-duration.ts` is LOW risk, with direct callers `fetchYouTubeDuration`, `fetchBilibiliDuration`, and the request callback helper.

### Fixed in this batch

- Added a maximum redirect depth for video duration fetches.
- Redirect targets still recurse through `fetchText()`, so each hop continues to pass through `assertNetworkFetchUrl()`.
- Added tests for over-limit redirects and for a bounded redirect that successfully parses the final duration response.

### Impact analysis

- `fetchText`: LOW risk. Direct upstream callers are `fetchYouTubeDuration`, `fetchBilibiliDuration`, and the request callback helper; indirect duration enrichment callers remain unchanged.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported LOW risk across 3 files, 5 symbols, and 0 affected execution flows.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/services/video/video-duration.ts src/main/services/video/video-duration-task.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/main/services/video/video-duration-task.test.ts`
  - Vitest ran the full configured suite.
  - Result: 150 passed test files, 843 passed tests, 13 skipped tests.

### Deferred findings

- `resolveVideoUrl()` should classify selected resolver stream URLs before returning them.
- Renderer media-source loading still needs a central policy for private/loopback media URLs.
- Discovery public fetches still need redirect-aware public-only fetch handling.
- Feed avatar/title enrichment should classify and skip blocked URLs before best-effort fetches.

## 2026-07-07 - Video resolver stream URL classification

### Review inputs

- Network policy review sub-agent found that `resolveVideoUrl()` validated resolver API requests but returned selected Invidious/Piped stream URLs without classifying the final media URL.
- Local impact analysis reported `resolveVideoUrl` as LOW risk with no upstream callers or affected processes.

### Fixed in this batch

- Selected Invidious stream URLs now pass through `assertNetworkFetchUrl()` before being returned.
- Selected Piped stream URLs now pass through `assertNetworkFetchUrl()` before being returned.
- If a resolver instance returns a blocked stream URL, that instance is treated as failed and the resolver tries the next available instance.
- Added a regression test that skips a loopback/private selected stream and succeeds with the next safe stream.

### Impact analysis

- `resolveVideoUrl`: LOW risk by symbol impact. No upstream callers or affected processes were reported.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported LOW risk across 2 files, 3 symbols, and 0 affected execution flows.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/services/video/video-proxy.ts src/main/services/video/video-proxy.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/main/services/video/video-proxy.test.ts`
  - Vitest ran the full configured suite.
  - Result: 150 passed test files, 844 passed tests, 13 skipped tests.

### Deferred findings

- Renderer media-source loading still needs a central policy for private/loopback media URLs.
- Discovery public fetches still need redirect-aware public-only fetch handling.
- Feed avatar/title enrichment should classify and skip blocked URLs before best-effort fetches.

## 2026-07-07 - Discovery fetch redirect hardening

### Review inputs

- Network policy review sub-agent found that discovery public fetches validated the initial URL but relied on automatic fetch redirects, so a public discovery endpoint could redirect to a private or loopback target after the policy check.
- Feed enrichment review sub-agent separately confirmed related private-network gaps in avatar/title fetchers; those broader feed enrichment findings are deferred below.
- Discovery redirect review sub-agent did not return before the batch was ready and was closed while still running, so no additional findings were incorporated from that review.

### Fixed in this batch

- `discoveryFetch()` now sends `redirect: 'manual'` for discovery probe fetches.
- Discovery redirects are followed explicitly with a maximum depth of 5.
- Every redirect hop is resolved against the already-validated response URL and re-enters `assertPublicDiscoveryUrl()` before any fetch is attempted.
- Redirect targets rejected by the public discovery policy now preserve the existing best-effort probe behavior by returning `undefined` instead of throwing.
- Added regression coverage for manual redirect mode, per-hop policy validation, blocked redirect targets, and redirect-depth caps.

### Impact analysis

- `discoveryFetch`: HIGH risk. Direct upstream callers are `probeBilibiliUsersByKeyword`, `probeInstagramUsersByKeyword`, `fetchXAvatarByUsername`, `probeXUsersByKeyword`, `fetchYouTubeFollowersByChannelPath`, and `searchYouTubeChannelsByKeyword`. Affected processes include `registerDiscoverHandlers`, `registerIpcHandlers`, `onReady`, and `searchYouTubeChannelsByKeyword`.
- `assertPublicDiscoveryUrl`: HIGH risk. Direct upstream callers include Bilibili, Instagram, X, YouTube profile, discovery preview, and shared discovery fetch helpers. Affected processes include `registerDiscoverHandlers`, `searchYouTubeChannelsByKeyword`, `registerIpcHandlers`, and `onReady`.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported MEDIUM risk across 3 files, 9 symbols, and 4 affected execution flows. The affected flows were `SearchYouTubeChannelsByKeyword → ParseUrl`, `SearchYouTubeChannelsByKeyword → HasCredentials`, `SearchYouTubeChannelsByKeyword → IsSuspiciousHttpUrl`, and `SearchYouTubeChannelsByKeyword → NormalizeHostnameForNetworkPolicy`; the changed production behavior is limited to manual redirect handling inside `discoveryFetch()`.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/services/discovery/platform-search.ts src/main/services/discovery/platform-search.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/main/services/discovery/platform-search.test.ts`
  - Vitest ran the full configured suite.
  - Result: 150 passed test files, 847 passed tests, 13 skipped tests.

### Deferred findings

- Feed avatar/title enrichment should add network-policy wrappers, redirect handling, and image byte limits.
- Discovery preview/direct URL probes still flow through permissive feed parser behavior until public/private feed policy modes are designed.
- Feed parser policy modes should preserve local RSSHub, LAN, dev, and intranet compatibility while allowing stricter public discovery paths.
- Renderer media-source loading still needs a central policy for private/loopback media URLs.

## 2026-07-07 - Feed avatar fetch hardening

### Review inputs

- Feed enrichment review sub-agent found that feed avatar enrichment fetched site pages and avatar images directly without the shared network URL policy, redirect revalidation, or body-size limits.
- Local review found the same risk pattern in Instagram profile avatar fetches and Bilibili avatar API fetches inside `feed-avatar.ts`.
- Feed title resolver review sub-agent confirmed a separate title-enrichment fetch path with direct Electron fetches, no network policy, no redirect cap, and unbounded body reads; that path is deferred below.

### Fixed in this batch

- Feed avatar enrichment now routes site, Instagram, Bilibili, and image fetches through a local guarded helper backed by `assertNetworkFetchUrl()`.
- Avatar enrichment fetches now use `redirect: 'manual'`, follow at most 5 redirects, and re-run network policy checks on each redirect target before fetching it.
- Site/profile HTML reads are capped at 2 MiB.
- Avatar image reads are capped at 2 MiB before inlining as data URIs.
- Bilibili API JSON reads are capped at 512 KiB instead of using unbounded `response.json()`.
- Bilibili face URLs are classified with `assertNetworkFetchUrl()` before being returned.
- Added regression coverage for loopback site URLs, redirects to loopback, and oversized avatar images.

### Impact analysis

- `fetchSiteAvatar`: CRITICAL risk before the fix. Direct upstream caller: `resolveFeedAvatar`; affected processes include `registerDiscoverHandlers`, `runRefreshSingleFeed`, `processFeed`, `subscribeFeed`, `registerFeedHandlers`, `registerIpcHandlers`, Agent feed-tool `execute`, and `onReady`.
- `tryConvertImageUrlToDataUri`: CRITICAL risk before the fix. Direct upstream callers are `fetchSiteAvatar` and `fetchInstagramAvatar`; affected processes include `registerDiscoverHandlers`, `processFeed`, `runRefreshSingleFeed`, `subscribeFeed`, `registerFeedHandlers`, and Agent feed-tool `execute`.
- `fetchInstagramAvatar` and `fetchBilibiliAvatar`: CRITICAL risk before the fix. Each is called by `resolveFeedAvatar` and reaches the same feed subscription, refresh, discovery preview, feed handler, Agent feed-tool, and startup registration paths.
- `resolveFeedAvatar`: CRITICAL risk by upstream impact, with direct callers in discovery handlers, feed processing, discovery preview, feed refresh, and subscription flows.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported LOW risk across 3 files, 9 symbols, and 0 affected execution flows. The changed production behavior is limited to blocking unsafe avatar enrichment fetches and bounding enrichment response bodies while preserving existing fallback behavior.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/services/feed/feed-avatar.ts src/main/services/feed/feed-avatar.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/main/services/feed/feed-avatar.test.ts`
  - Vitest ran the full configured suite.
  - Result: 150 passed test files, 850 passed tests, 13 skipped tests.

### Deferred findings

- Feed title enrichment should add guarded fetch helpers for `fetchText()` and `fetchJson()`, manual redirect revalidation, timeouts, and response byte limits.
- Feed title fallback may need narrower caller conditions so arbitrary deferred subscription URLs are not fetched only to improve display titles.
- Feed parser policy modes should preserve local RSSHub, LAN, dev, and intranet compatibility while allowing stricter public discovery paths.
- Renderer media-source loading still needs a central policy for private/loopback media URLs.

## 2026-07-07 - Feed title fetch hardening

### Review inputs

- Feed title resolver review sub-agent inspected `feed-title-resolver.ts` and found direct Electron fetches in `fetchText()` and `fetchJson()` without the shared network policy, explicit redirect handling, timeouts, or response byte limits.
- The same review identified `resolveFeedTitleFallback()` as the broadest path because refresh and deferred subscription flows can call it with stored feed URLs.
- GitNexus was refreshed before impact analysis because the index was stale after the previous remediation commits.

### Fixed in this batch

- `fetchText()` and `fetchJson()` now use a resolver-local guarded fetch helper backed by `assertNetworkFetchUrl()`.
- Feed title enrichment fetches now use `redirect: 'manual'`, follow at most 5 redirects, and re-run network policy checks on every redirect target before fetching it.
- Title XML/text reads are capped at 1 MiB.
- Bilibili JSON reads are capped at 512 KiB and parsed from bounded text instead of using unbounded `response.json()`.
- Title fetches now use an 8 second timeout.
- Added regression coverage for generic RSS title resolution, loopback block-before-fetch, redirect-to-loopback blocking, oversized title responses, and Bilibili JSON title resolution.
- Refreshed GitNexus metadata counts in `AGENTS.md` and `CLAUDE.md` from 7,882 symbols / 20,966 relationships to 7,897 symbols / 21,043 relationships.

### Impact analysis

- `fetchText`: HIGH risk. Direct upstream callers are `resolveTwitterNameByUsername`, `resolveInstagramNameByUsername`, and `resolveFeedTitleFallback`; affected processes include `runRefreshSingleFeed`, `registerFeedHandlers`, `subscribeFeed`, and Agent feed-tool `execute`.
- `fetchJson`: HIGH risk. Direct upstream caller is `resolveBilibiliNameByUid`; affected processes include `runRefreshSingleFeed`, `subscribeFeed`, Agent feed-tool `execute`, and `registerFeedHandlers`.
- `resolveFeedTitleFallback`: CRITICAL risk. Direct upstream callers are `runRefreshSingleFeed` and `subscribeFeed`; affected processes include `registerFeedHandlers`, Agent feed-tool `execute`, `runRefreshSingleFeed`, `subscribeFeed`, `onReady`, and `registerFeedSyncHandlers`.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported LOW risk across 5 files, 12 symbols, and 0 affected execution flows. The changed production behavior is limited to guarded title-enrichment network fetches and bounded response reads.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/services/feed/feed-title-resolver.ts src/main/services/feed/feed-title-resolver.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/main/services/feed/feed-title-resolver.test.ts`
  - Vitest ran the full configured suite.
  - Result: 151 passed test files, 855 passed tests, 13 skipped tests.

### Deferred findings

- Feed title fallback may still need narrower caller conditions so arbitrary deferred subscription URLs are not fetched only to improve display titles.
- Feed parser policy modes should preserve local RSSHub, LAN, dev, and intranet compatibility while allowing stricter public discovery paths.
- Renderer media-source loading still needs a central policy for private/loopback media URLs.

## 2026-07-07 - Renderer playback media-source hardening

### Review inputs

- Renderer media-source review sub-agent found that feed-controlled media URLs are assigned directly to renderer `src` and `poster` attributes, including video players, audio playback, image viewers, cached images, featured images, and sanitized article HTML.
- Local review scoped this batch to passive audio/video playback sinks so old cached direct media URLs cannot trigger loopback or private-network playback loads.
- Broader feed-ingestion, sanitized HTML, and image rendering findings are deferred below to avoid mixing parser/storage and renderer rendering changes in one batch.

### Fixed in this batch

- Added a renderer media-source policy for passive playback URLs.
- Playback media policy blocks unsupported schemes, credentialed URLs, `localhost`, loopback, link-local, RFC1918 IPv4, IPv6 loopback/ULA/link-local, and IPv4-mapped IPv6 private/loopback literals.
- `AudioPlaybackService.load()` now refuses blocked media URLs before assigning `el.src`.
- The current inline `components/ui/VideoPlayer` now filters direct `<video src>`, preview candidates, and video posters through the playback media policy.
- The legacy `components/media/MediaPlayer` direct-video path now filters `<video src>`, YouTube direct playback URLs, and video posters through the playback media policy.
- Added regression coverage for the playback media URL policy and blocked audio-source assignment.

### Impact analysis

- `VideoPlayer` in `components/ui`: CRITICAL risk. Direct callers include social media item rendering, article detail, overlay gallery, and video player page; affected processes include `SocialMediaItem`, `ArticleDetailPage`, `SocialOverlayView`, `VideoPlayerPage`, and `DiscoverPreviewPage`.
- `buildPreviewCandidates`: LOW risk. Direct upstream caller is the UI video player's preview candidate derivation.
- `AudioPlaybackService.load`: LOW risk. Direct upstream caller is player-store `activate`; indirect callers include queue playback, next, previous, and play actions.
- `VideoPlayer` in `components/media`: HIGH risk. Direct upstream caller is `EntryContent`; affected processes include `EntryContent`, `ArticleDetailPage`, and `DiscoverPreviewPage`.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported LOW risk across 7 files, 10 symbols, and 0 affected execution flows. The changed production behavior is limited to blocking unsafe passive audio/video playback sources and posters/previews.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/renderer/src/lib/media-source-policy.ts src/renderer/src/lib/media-source-policy.test.ts src/renderer/src/lib/audio-playback.ts src/renderer/src/lib/audio-playback.test.ts src/renderer/src/components/ui/VideoPlayer.tsx src/renderer/src/components/media/MediaPlayer.tsx`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/renderer/src/lib/media-source-policy.test.ts src/renderer/src/lib/audio-playback.test.ts`
  - Vitest ran the full configured suite.
  - Result: 152 passed test files, 866 passed tests, 13 skipped tests.

### Deferred findings

- Feed ingestion should filter private/loopback media URLs before storing `Entry.media` and `Entry.imageUrl`.
- Sanitized article HTML should validate `src`, `srcset`, and `poster` with the media-source policy rather than only the external-link policy.
- Image rendering sinks such as `ImageViewerPage`, `CachedImage`, `QueuedImage`, `EntryFeaturedImage`, and feed/avatar images still need safe media-src fallbacks for old cached entries.
- External-open policy still treats private IPs as suspicious rather than blocked; that is separate from passive media loading and should be reviewed explicitly.

## 2026-07-07 - Sanitized HTML media-source hardening

### Review inputs

- Renderer media-source review sub-agent found that sanitized article HTML still permitted private and loopback media loads through `img`, `video`, `audio`, `source`, `srcset`, and `poster` attributes because sanitizer URL checks only used the external-link HTML policy.
- Sanitizer review sub-agent confirmed the intended working-tree behavior is stricter than the previous image policy: article media attributes now require absolute public HTTP(S) URLs and no credentials.
- GitNexus was refreshed before impact analysis because new media-source policy symbols from the previous batch were not yet indexed.

### Fixed in this batch

- `sanitizeHTML()` now applies the renderer media-source policy to media `src` attributes on `img`, `video`, `audio`, and `source`.
- `sanitizeHTML()` now applies the same policy to `video poster`.
- Added `isAllowedPlaybackMediaSrcset()` and use it for media `srcset` validation.
- Sanitized article HTML now strips relative, data, unsupported-scheme, credentialed, localhost, loopback, link-local, and private-network media loads from article content.
- Added sanitizer integration tests using a local `linkedom` DOM harness plus direct `srcset` policy tests.
- Refreshed GitNexus metadata counts in `AGENTS.md` and `CLAUDE.md` from 7,897 symbols / 21,043 relationships to 7,916 symbols / 21,101 relationships.

### Impact analysis

- `sanitizeHTML`: LOW risk. Direct upstream callers are entry content sanitized content/readable content, wide-view description, and social text cleanup; no affected execution flows were reported.
- `sanitizeNode`: LOW risk by sanitizer review. Direct upstream caller is `sanitizeHTML`; no affected execution flows were reported.
- `isAllowedPlaybackMediaUrl`: CRITICAL risk if changed directly because it gates playback paths across entry, article, social, video page, and discovery preview flows. This batch reuses its existing semantics and adds only `srcset` validation on top.
- Pre-commit `detect_changes --scope compare --base-ref origin/main` reported LOW risk across 7 files, 5 symbols, and 0 affected execution flows. The changed production behavior is limited to stripping unsafe passive media attributes from sanitized article HTML.

### Verification

- `pnpm format:check`
  - Result: passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/renderer/src/utils/sanitize.ts src/renderer/src/utils/sanitize.test.ts src/renderer/src/lib/media-source-policy.ts src/renderer/src/lib/media-source-policy.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm test -- src/renderer/src/utils/sanitize.test.ts src/renderer/src/lib/media-source-policy.test.ts`
  - Vitest ran the full configured suite.
  - Result: 153 passed test files, 870 passed tests, 13 skipped tests.

### Deferred findings

- Feed ingestion should filter private/loopback media URLs before storing `Entry.media` and `Entry.imageUrl`.
- Image rendering sinks outside sanitized article HTML still need safe media-src fallbacks for old cached entries.
- External-open policy still treats private IPs as suspicious rather than blocked; that should be reviewed separately from passive media loading.

## 2026-07-07 - Feed media persistence hardening

### Review inputs

- Feed media ingestion sub-agent reviewed `feed-utils`, entry building, entry persistence, and merge paths.
- The review found that feed-controlled media URLs could be stored in `Entry.media` and `Entry.imageUrl` from RSS enclosures, Atom enclosures, Media RSS nodes, HTML media tags, posters, iTunes images, and thumbnails without a storage-time URL policy.
- The review also confirmed that `normalizeKnownMediaUrl()` is only a URL normalizer and must not be treated as a security policy, especially for mirror URLs that unwrap nested `url=` or `o=` targets.

### Fixed in this batch

- Added a shared stored-media URL policy in `src/shared/media-url-policy.ts`.
- The shared policy blocks unsupported schemes, malformed and relative URLs, credentialed URLs, localhost, loopback, link-local, RFC1918 IPv4, IPv6 loopback/ULA/link-local, and IPv4-mapped private/loopback literals.
- `extractMedia()` now filters extracted media before returning it, so unsafe feed-controlled URLs do not become persisted `Entry.media` values.
- `deriveImageUrl()` now skips unsafe image candidates and falls through to later safe candidates instead of persisting blocked primary images.
- Mirror URLs that unwrap to blocked nested targets are dropped; mirror URLs that unwrap to public media are preserved with the public media URL as the primary URL and the mirror URL as the preview fallback.
- Renderer playback policy now re-exports the shared stored-media policy under the existing playback names, keeping renderer imports stable while sharing the same passive media boundary.
- Added regression coverage for unsafe feed media extraction, mirror-unwrapped private targets, safe fallback image selection, blocked audio fallback content, and the shared media URL policy.

### Impact analysis

- `extractMedia`: CRITICAL risk. Direct upstream callers are `buildSingleEntry` and `collectParsedItemImageKeys`; affected processes include `processFeed`, `runRefreshSingleFeed`, `subscribeFeed`, `registerFeedHandlers`, and Agent feed-tool `execute`.
- `deriveImageUrl`: CRITICAL risk. Direct upstream callers are `buildSingleEntry` and `collectParsedItemImageKeys`; affected processes include `processFeed`, `runRefreshSingleFeed`, `subscribeFeed`, `registerFeedHandlers`, and Agent feed-tool `execute`.
- `isAllowedPlaybackMediaUrl`: CRITICAL risk if changed semantically because it gates renderer playback paths across entry, article, social, video page, and discovery preview flows. This batch preserves the existing renderer API and moves the same policy to shared code.
- `classifyExternalUrl`: CRITICAL risk across URL-opening, fetch, renderer, and web flows. This batch reuses it without changing its behavior.
- Pre-commit `detect_changes --scope staged` reported LOW risk across 8 files, 7 symbols, and 0 affected execution flows.

### Verification

- `pnpm test -- src/main/services/feed/feed-utils.test.ts src/main/services/entry/entry-builder.test.ts src/shared/media-url-policy.test.ts src/renderer/src/lib/media-source-policy.test.ts`
  - Vitest ran the full configured suite.
  - Result: 154 passed test files, 885 passed tests, 13 skipped tests.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/services/feed/feed-utils.ts src/main/services/feed/feed-utils.test.ts src/main/services/entry/entry-builder.test.ts src/shared/media-url-policy.ts src/shared/media-url-policy.test.ts src/renderer/src/lib/media-source-policy.ts src/renderer/src/lib/media-source-policy.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm format:check`
  - Result: passed.

### Deferred findings

- Entry merge policy should be reviewed separately for defense in depth against unsafe `Entry.media` or `Entry.imageUrl` values constructed outside the normal feed-builder path.
- Image rendering sinks outside sanitized article HTML still need safe media-src fallbacks for old cached entries.
- External-open policy still treats private IPs as suspicious rather than blocked; that should be reviewed separately from passive media loading.

## 2026-07-07 - Renderer image primitive hardening

### Review inputs

- Local renderer sink review found that old cached `Entry.imageUrl`, `Entry.media[].url`, `Entry.media[].previewUrl`, feed avatars, and author avatars could still reach reusable image primitives even after new feed ingestion and sanitized HTML were hardened.
- GitNexus was refreshed after the feed media commit; metadata counts changed from 7,916 symbols / 21,101 relationships to 7,927 symbols / 21,150 relationships.
- This batch intentionally targets reusable image primitives and direct featured/avatar primitives; broader bespoke direct `<img>` surfaces are deferred below.

### Fixed in this batch

- Added `getSafeImageSrc()` in `src/renderer/src/lib/safe-image-source.ts` as the renderer image-src wrapper around the shared stored-media URL policy.
- `CachedImage` now strips blocked image URLs before assigning `img.src` or remembering image metadata.
- `QueuedImage` now strips blocked image URLs before eager loads, intersection-observed queued loads, or queue activation.
- `EntryFeaturedImage` now renders nothing for blocked image URLs instead of assigning them to `img.src`.
- `FeedAvatar` and entry-list `EntryAvatar` now fall back to their existing non-image placeholders when the image URL is blocked.
- Added pure regression coverage for public image preservation and blocked loopback, localhost, private, link-local, credentialed, unsupported-scheme, data, and relative image sources.

### Impact analysis

- `CachedImage`: HIGH risk. Direct callers include `OverlayMediaGallery`, `PictureMasonry`, `SocialAuthorHeader`, and `ImageViewerPage`; affected processes include `ArticleDetailPage`, `SocialOverlayView`, `ImageViewerPage`, and `DiscoverPreviewPage`.
- `EntryFeaturedImage`: HIGH risk. Direct caller is `EntryContent`; affected processes include `EntryContent`, `ArticleDetailPage`, and `DiscoverPreviewPage`.
- `QueuedImage`: LOW risk. Direct upstream caller is `EntryCard`; no affected execution flows were reported.
- `FeedAvatar`: LOW risk. Direct callers are Discover panel/config surfaces and `DiscoverPreviewPage`; affected process is `DiscoverPreviewPage`.
- `EntryAvatar`: LOW risk. Direct callers are `GridCard` and `SocialMediaItem`; affected process is `SocialMediaItem`.
- Pre-commit `detect_changes --scope staged` reported MEDIUM risk across 10 files, 15 symbols, and 1 affected execution flow: `SocialOverlayView → NormalizeImageMetadata`.

### Verification

- `pnpm test -- src/renderer/src/lib/safe-image-source.test.ts src/shared/media-url-policy.test.ts`
  - Vitest ran the full configured suite.
  - Result: 155 passed test files, 894 passed tests, 13 skipped tests.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/renderer/src/lib/safe-image-source.ts src/renderer/src/lib/safe-image-source.test.ts src/renderer/src/components/ui/CachedImage.tsx src/renderer/src/components/ui/QueuedImage.tsx src/renderer/src/components/entry/entry-content/EntryFeaturedImage.tsx src/renderer/src/components/feed/FeedAvatar.tsx src/renderer/src/components/entry/entry-list/components/EntryAvatar.tsx`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm format:check`
  - Result: passed after formatting `AGENTS.md`, `CLAUDE.md`, and the new safe-image helper.

### Deferred findings

- Bespoke direct image tags in social galleries, Discover preview cards/panels, Sidebar feed icons, settings feed rows, audio mini-bar cover art, and similar surfaces still need a follow-up pass.
- Context menu image download/open paths should be reviewed separately because they use selected image URLs as IPC/download inputs rather than passive image element sources.
- Entry merge policy should still be reviewed for defense in depth against unsafe `Entry.media` or `Entry.imageUrl` values constructed outside the normal feed-builder path.

## 2026-07-07 - Renderer media decision fallback hardening

### Review inputs

- Renderer image-sink review sub-agent found that several paths still bypassed the newly hardened image primitives by computing direct `src` candidates or assigning fallback/probe URLs imperatively.
- Key remaining sinks were `SocialMediaGallery.getInitialSrc`, `advanceCardImageFallback`, `resolveGridCardMedia`, and `probeImageMetadata`.

### Fixed in this batch

- `buildMediaFallbackCandidates()` now drops unsafe candidate URLs before fallback lists can reach imperative `img.src` assignment.
- `advanceCardImageFallback()` now filters raw decoded and preview-derived fallback URLs before retrying them.
- Remembered social media image sources now ignore unsafe old localStorage values and refuse to persist unsafe newly resolved values.
- `resolveGridCardMedia()` now excludes unsafe `Entry.media` and `Entry.imageUrl` values before returning grid card `photoCovers` or `coverUrl`.
- Related social-entry fallback image selection and social media decision photo lists now skip unsafe images from old cached entries.
- Video preview fallback selection now refuses unsafe image preview URLs.
- `SocialMediaGallery.getInitialSrc()` now validates preview URLs before using them as initial media sources.
- `probeImageMetadata()` now filters unsafe URLs before creating `new Image()` probes.
- Added regression coverage for unsafe fallback candidates, grid media selection, social media decision images/previews, and metadata probes.

### Impact analysis

- `SocialMediaGallery`: LOW risk. Direct upstream caller is `SocialMediaItem`; affected process is `SocialMediaItem`.
- `advanceCardImageFallback`: LOW risk. Direct callers are `SocialMediaGallery`, `EntryCard`, and `GridCard`; affected process is `SocialMediaItem`.
- `buildMediaFallbackCandidates`: LOW risk. Direct upstream caller is `advanceCardImageFallback`; no affected execution flows were reported.
- `getRememberedMediaSrc`: LOW risk. Direct upstream caller is `SocialMediaGallery.getInitialSrc`; affected process is `SocialMediaItem`.
- `rememberMediaSrc`: LOW risk. Direct upstream caller is `SocialMediaGallery.rememberLoadedSrc`; affected process is `SocialMediaItem`.
- `resolveGridCardMedia`: LOW risk. Direct upstream caller is `GridCard`; no affected execution flows were reported.
- `resolveSocialEntryMediaDecision`: LOW risk. Direct upstream caller is `SocialMediaItem`; affected process is `SocialMediaItem`.
- `probeImageMetadata`: LOW risk. Direct upstream caller is `probeMasonryCardDimensions`; affected process is `WideViewContent`.
- Pre-commit `detect_changes --scope staged` reported MEDIUM risk across 6 files, 14 symbols, and 5 affected `SocialMediaItem` execution flows.

### Verification

- `pnpm test -- src/renderer/src/lib/entry-media-decision.test.ts src/renderer/src/lib/image-metadata.test.ts src/renderer/src/lib/safe-image-source.test.ts`
  - Vitest ran the full configured suite.
  - Result: 155 passed test files, 898 passed tests, 13 skipped tests.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/renderer/src/components/entry/SocialMediaGallery.tsx src/renderer/src/lib/entry-media-decision.ts src/renderer/src/lib/entry-media-decision.test.ts src/renderer/src/lib/image-metadata.ts src/renderer/src/lib/image-metadata.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm format:check`
  - Result: passed.

### Deferred findings

- Bespoke direct image tags in Discover preview rows, Discover panel rows, Sidebar feed icons, QuickSearch, FeedsSettings, EntryArticleHeader, and AudioMiniBar still need a follow-up pass.
- Context menu image download/open paths should be reviewed separately because they use selected image URLs as IPC/download inputs rather than passive image element sources.
- Entry merge policy should still be reviewed for defense in depth against unsafe `Entry.media` or `Entry.imageUrl` values constructed outside the normal feed-builder path.

## 2026-07-07 - Renderer direct image tag hardening

### Review inputs

- Renderer image-sink review sub-agent identified direct `<img>` assignments and Discover avatar preloads that did not pass through `CachedImage`, `QueuedImage`, `FeedAvatar`, or media-decision helpers.
- This batch covers smaller direct image surfaces and leaves Sidebar feed icons plus IPC/download URL usage for separate review.

### Fixed in this batch

- `EntryArticleHeader` now filters `authorAvatarUrl` before rendering the author avatar and falls back to the existing user icon when blocked.
- `AudioMiniBar` now filters audio cover images before assigning `img.src` and falls back to the existing music icon when blocked.
- `QuickSearchPanel` now filters feed result images before rendering feed icons.
- `FeedsSettings` now filters user and recommended feed images before rendering settings rows.
- Discover preview rows in `DiscoverPreviewPage` and embedded `DiscoverPanel` now filter entry preview images and fall back to the existing RSS placeholder when blocked.
- `DiscoverResultRow` now filters external avatar candidates before `new Image()` preload, avatar fallback traversal, and rendered avatar `src`. The internally generated Instagram placeholder remains allowed.

### Impact analysis

- `EntryArticleHeader`: HIGH risk. Direct caller is `EntryContent`; affected processes include `EntryContent`, `ArticleDetailPage`, and `DiscoverPreviewPage`.
- `AudioMiniBar`: LOW risk. GitNexus reported no direct upstream callers or affected processes.
- `QuickSearchPanel`: LOW risk. GitNexus reported no direct upstream callers or affected processes.
- `FeedsSettings`: LOW risk. GitNexus reported no direct upstream callers or affected processes.
- `DiscoverResultRow`: LOW risk. Direct upstream caller is `DiscoverPanel`.
- `PreviewEntryRow`: LOW risk. Direct upstream caller is `DiscoverPreviewPage`; affected process is `DiscoverPreviewPage`.
- `PreviewEntryInline`: LOW risk. Direct upstream caller is `DiscoverPanel`.
- Pre-commit `detect_changes --scope staged` reported MEDIUM risk across 8 files, 11 symbols, and 5 affected execution flows: `FeedsSettings` settings flows plus `QuickSearchPanel → BuildScopeState`.

### Verification

- `pnpm test -- src/renderer/src/lib/safe-image-source.test.ts`
  - Vitest ran the full configured suite.
  - Result: 155 passed test files, 898 passed tests, 13 skipped tests.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/renderer/src/components/entry/entry-content/EntryArticleHeader.tsx src/renderer/src/components/media/AudioMiniBar.tsx src/renderer/src/components/search/QuickSearch.tsx src/renderer/src/components/settings/FeedsSettings.tsx src/renderer/src/pages/DiscoverPreviewPage.tsx src/renderer/src/components/discover/DiscoverPanel.tsx src/renderer/src/components/discover/DiscoverResultRow.tsx`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm format:check`
  - Result: passed.

### Deferred findings

- Sidebar `FeedIcon` still needs a focused pass because it has both direct `<img src={imageUrl}>` and imperative fallback assignment to `img.src = origin`.
- Context menu image download/open paths should be reviewed separately because they use selected image URLs as IPC/download inputs rather than passive image element sources.
- Entry merge policy should still be reviewed for defense in depth against unsafe `Entry.media` or `Entry.imageUrl` values constructed outside the normal feed-builder path.

## 2026-07-07 - Sidebar feed icon source hardening

### Review inputs

- Deferred renderer image-sink review identified `Sidebar.FeedIcon` as the remaining passive image surface with both direct `imageUrl` rendering and imperative mirror fallback assignment.
- This batch focuses only on Sidebar feed icons; context-menu image IPC/download paths and entry merge policy remain separate remediation slices.

### Fixed in this batch

- `FeedIcon` now filters feed image URLs, Twitter/X unavatar URLs, Instagram unavatar branch checks, favicon URLs, and generated initials avatar URLs through `getSafeImageSrc()` before any rendered `<img src>`.
- `extractMirrorOrigin()` now validates decoded mirror-origin candidates through the same stored-media policy before returning them.
- The `onError` mirror fallback now receives a sanitized base image URL and can only assign a sanitized decoded origin to `img.src`.

### Impact analysis

- `FeedIcon`: LOW risk. Direct callers are `renderFeedRow` and `RecommendedSection`; affected processes are `Sidebar` and `HomePage`.
- `extractMirrorOrigin`: LOW risk. Direct upstream caller is `FeedIcon`; affected process is `Sidebar`.
- Pre-commit `detect_changes --scope staged` reported LOW risk across 2 files, 3 symbols, and 0 affected processes.

### Verification

- `pnpm test -- src/renderer/src/lib/safe-image-source.test.ts`
  - Vitest ran the full configured suite.
  - Result: 155 passed test files, 898 passed tests, 13 skipped tests.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/renderer/src/components/layout/Sidebar.tsx`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm format:check`
  - Result: passed.

### Deferred findings

- Context menu image download/open paths should be reviewed separately because they use selected image URLs as IPC/download inputs rather than passive image element sources.
- Entry merge policy should still be reviewed for defense in depth against unsafe `Entry.media` or `Entry.imageUrl` values constructed outside the normal feed-builder path.

## 2026-07-07 - Context menu media action hardening

### Review inputs

- Deferred renderer review identified context-menu image/media actions as a separate sink because they send selected entry media URLs to clipboard and download IPC paths rather than passive `<img>` rendering.
- Local call-chain review confirmed `downloadUrlToFile()` already enforces `assertNetworkFetchUrl()` in the main process, including redirect validation, but the renderer still enabled save/copy actions for unsafe stored entry media URLs.

### Fixed in this batch

- `inferEntryImageUrl()` now filters photo previews, photo URLs, and `entry.imageUrl` through the shared stored-media URL policy before exposing them to context-menu actions.
- `inferEntryMediaUrl()` now filters video URLs and video previews through the same policy before falling back to the safe image inference path.
- Context-menu save/copy media actions now become disabled when entries only contain unsafe local, private, credentialed, unsupported-scheme, malformed, or empty media URLs.
- Added pure regression coverage for safe preview preference, unsafe preview fallback, unsafe entry image blocking, safe video preference, and unsafe video fallback.

### Impact analysis

- `inferEntryImageUrl`: HIGH risk. Direct callers are `inferEntryMediaUrl` and `useEntryContextActions`; affected processes include `EntryList` and `WideViewContent`.
- `inferEntryMediaUrl`: HIGH risk. Direct caller is `useEntryContextActions`; affected processes include `EntryList` and `WideViewContent`.
- `useEntryContextActions`: HIGH risk. Direct caller is `EntryContextMenuWrapper`; affected processes include `EntryList`, `WideViewContent`, and `HomePage`.
- Pre-commit `detect_changes --scope staged` reported LOW risk across 3 files, 2 symbols, and 0 affected processes.

### Verification

- `pnpm test -- src/renderer/src/components/ui/ContextMenu.test.ts`
  - Vitest ran the full configured suite.
  - Result: 156 passed test files, 903 passed tests, 13 skipped tests.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/renderer/src/components/ui/ContextMenu.tsx src/renderer/src/components/ui/ContextMenu.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm format:check`
  - Result: passed.

### Deferred findings

- Entry merge policy should still be reviewed for defense in depth against unsafe `Entry.media` or `Entry.imageUrl` values constructed outside the normal feed-builder path.
- External-open policy still treats private IP HTTP(S) links as suspicious rather than blocked; that remains separate from download/fetch hardening.
- Image viewer and overlay gallery save/open affordances should derive from the same sanitized selected image URLs as rendering.
- Download fetch policy still has a DNS rebinding gap between preflight DNS resolution and Electron session fetch connection time.

## 2026-07-07 - Entry merge media boundary hardening

### Review inputs

- Entry merge policy review found that `mergeEntryData()` trusted prebuilt incoming `Entry.media` and `Entry.imageUrl` even though normal feed-builder paths already sanitize derived media.
- GitNexus was refreshed before edits; metadata counts changed from 7,927 symbols / 21,150 relationships to 7,942 symbols / 21,242 relationships.

### Fixed in this batch

- `mergeEntryData()` now sanitizes incoming media items with the shared stored-media URL policy before comparing signatures or replacing existing media.
- Incoming media items whose primary `url` is unsafe are dropped at the merge boundary.
- Incoming media `previewUrl` values are trimmed and retained only when safe; unsafe previews are removed before storage.
- Incoming `imageUrl` values are trimmed and only overwrite existing images when the shared stored-media URL policy allows them.
- Added regression coverage for unsafe media replacement blocking, unsafe preview stripping, unsafe image URL ignoring, and safe public media/image merging.

### Impact analysis

- `mergeEntryData`: LOW risk. Direct callers are `mergeEntriesForReadDisplay`, `dedupeEntriesForRead`, and `applyMerge`; no affected execution flows were reported.
- Pre-commit `detect_changes --scope staged` reported LOW risk across 5 files, 6 symbols, and 0 affected processes.

### Verification

- `pnpm test -- src/main/services/entry/entry-merge-policy.test.ts src/shared/media-url-policy.test.ts`
  - Vitest ran the full configured suite.
  - Result: 156 passed test files, 907 passed tests, 13 skipped tests.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/services/entry/entry-merge-policy.ts src/main/services/entry/entry-merge-policy.test.ts src/shared/media-url-policy.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm format:check`
  - Result: passed.

### Deferred findings

- Image viewer and overlay gallery save/open affordances should derive from the same sanitized selected image URLs as rendering.
- Download fetch policy still has a DNS rebinding gap between preflight DNS resolution and Electron session fetch connection time.

## 2026-07-07 - Image viewer save/open affordance hardening

### Review inputs

- Context-menu/download review found that `ImageViewerPage` and `OverlayMediaGallery` rendered images through sanitized primitives but still used raw selected image URLs for save/open affordances.
- This batch focuses on renderer affordance consistency; the main download DNS rebinding gap remains a separate network-layer follow-up.

### Fixed in this batch

- `ImageViewerPage` now resolves the active image source through `getSafeImageSrc()` before rendering, saving, or using it as the image fallback external URL.
- `ImageViewerPage` still prefers the article URL for external open, but blocks unsafe image URLs when no article URL is available.
- `OverlayMediaGallery` now resolves the lightbox save URL through `getSafeImageSrc()` and hides the save button when neither full-size nor preview URL is safe.
- Added pure regression coverage for unsafe primary fallback to safe previews, unsafe image external fallback blocking, article URL preference, overlay save URL preference, and unsafe overlay save blocking.

### Impact analysis

- `ImageViewerPage`: LOW risk. GitNexus reported no upstream callers or affected processes.
- `OverlayMediaGallery`: HIGH risk. Direct callers are `SocialDetailView` and `SocialOverlayView`; affected processes include `ArticleDetailPage`, `SocialOverlayView`, and `DiscoverPreviewPage`.
- Pre-commit `detect_changes --scope staged` reported MEDIUM risk across 5 files, 4 symbols, and 3 affected `ImageViewerPage` URL-policy flows: `ParseUrl`, `HasCredentials`, and `IsSuspiciousHttpUrl`.

### Verification

- `pnpm test -- src/renderer/src/pages/ImageViewerPage.test.ts src/renderer/src/components/entry/OverlayMediaGallery.test.ts src/renderer/src/lib/safe-image-source.test.ts`
  - Vitest ran the full configured suite.
  - Result: 158 passed test files, 913 passed tests, 13 skipped tests.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/renderer/src/pages/ImageViewerPage.tsx src/renderer/src/pages/ImageViewerPage.test.ts src/renderer/src/components/entry/OverlayMediaGallery.tsx src/renderer/src/components/entry/OverlayMediaGallery.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm format:check`
  - Result: passed after formatting `ImageViewerPage.tsx`.

### Deferred findings

- Download fetch policy still has a DNS rebinding gap between preflight DNS resolution and Electron session fetch connection time.
- External-open policy still treats private IP HTTP(S) article links as suspicious rather than blocked; avoid broad changes without a dedicated impact review.

## 2026-07-07 - Download DNS pinning hardening

### Review inputs

- Download/network review confirmed a DNS rebinding gap between `assertNetworkFetchUrl()` preflight DNS resolution and the later `session.defaultSession.fetch()` connection resolution.
- Follow-up review recommended Node `http`/`https.request` with a pinned `lookup` over another preflight because Electron `session.fetch()` cannot bind an approved DNS answer to the later socket connection.
- External-open review separately found private/loopback HTTP(S) external-open policy gaps; those are deferred below and intentionally not mixed into this download transport batch.

### Fixed in this batch

- Added `assertNetworkFetchTarget()` in `network-url-policy.ts` to return the normalized URL, resolved addresses, and a selected `pinnedAddress` only after the existing network fetch policy allows the target.
- `downloadUrlToFile()` now uses Node `http`/`https.request` with a custom pinned `lookup` instead of Electron `session.defaultSession.fetch()`, closing the direct DNS preflight-to-connect TOCTOU for downloads.
- HTTPS downloads preserve the original hostname for SNI/certificate verification while connecting through the pinned address.
- Redirects continue to be handled manually; each redirected URL is resolved and pinned independently by the same target policy.
- Redirect, non-2xx, oversized `content-length`, canceled save-dialog, and streaming-limit paths now drain or destroy the response as appropriate.
- Added regression coverage for pinned HTTP lookup, pinned HTTPS lookup plus SNI, canceled save-dialog draining, public pinned target selection, mixed public/private DNS blocking, and empty DNS result blocking.

### Impact analysis

- `downloadUrlToFile`: LOW risk. Direct caller is `registerAppHandlers`; affected processes include `registerAppHandlers` and `onReady`.
- `downloadUrlToFileWithRedirectDepth`: LOW risk. Direct caller is `downloadUrlToFile`; affected processes include `registerAppHandlers` and `onReady`.
- `writeResponseToFileWithLimit`: LOW risk. Direct caller is `downloadUrlToFileWithRedirectDepth`; affected process is `registerAppHandlers`.
- `assertNetworkFetchUrl` and existing shared network policy semantics were not changed; the new pinned target helper is opt-in for downloads.
- Pre-commit `detect_changes --scope staged` reported LOW risk across 5 files, 9 symbols, and 0 affected processes.

### Verification

- `pnpm test -- src/main/services/system/download.test.ts src/main/services/system/network-url-policy.test.ts`
  - Vitest ran the full configured suite.
  - Result: 158 passed test files, 919 passed tests, 13 skipped tests.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/services/system/download.ts src/main/services/system/download.test.ts src/main/services/system/network-url-policy.ts src/main/services/system/network-url-policy.test.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm format:check`
  - Result: passed.

### Deferred findings

- External-open policy still permits private/loopback HTTP(S) links through `classifyExternalUrl()`/`WindowManager.safeOpenExternal`; address this in a dedicated batch because relevant symbols have HIGH/CRITICAL impact.
- Feed/article/media/video fallback open paths should be reviewed against the external-open policy once a narrower untrusted external URL policy is available.

## 2026-07-07 - Main external-open private URL hardening

### Review inputs

- External-open review found that renderer confirmation was not a sufficient boundary because direct IPC or blocked navigation paths could still reach `WindowManager.safeOpenExternal()`.
- The review also found that `classifyExternalUrl()` has broad CRITICAL impact and still treats some private HTTP(S) targets as suspicious rather than blocked, so this batch keeps the fix at the narrower main-process external-open boundary.

### Fixed in this batch

- `WindowManager.safeOpenExternal()` now returns a real `{ success, error? }` result and awaits `shell.openExternal()` failures instead of fire-and-forget logging.
- Before opening HTTP(S) URLs, the main process now applies `classifyNetworkFetchUrl()` and blocks loopback/private/reserved DNS results at the final external-open boundary.
- The `APP_OPEN_EXTERNAL` IPC handler now returns the main-process result instead of always reporting success.
- Window-open and navigation interception call sites remain fire-and-forget but now share the stricter main-process validation.
- Added regression coverage for public URL opening, direct loopback blocking, and hostnames resolving to private addresses.

### Impact analysis

- `WindowManager.safeOpenExternal`: HIGH risk. Direct callers include `registerAppHandlers` and `bindWindowEvents`; affected processes include `onReady`, `handleActivate`, `registerAppHandlers`, and `bindWindowEvents`.
- `registerAppHandlers`: LOW risk.
- `classifyExternalUrl`: CRITICAL risk across 129 impacted symbols and 21 processes. It was intentionally not edited in this batch.
- Pre-commit `detect_changes --scope staged` reported HIGH risk across 8 files, 13 symbols, and 15 affected processes, including `RegisterAppHandlers` URL-policy flows and `BindWindowEvents`/`HandleActivate` window flows.

### Verification

- `pnpm test -- src/main/window-manager.test.ts src/main/services/system/network-url-policy.test.ts src/shared/url-policy.test.ts src/renderer/src/services/external-url.test.ts`
  - Vitest ran the full configured suite.
  - Result: 159 passed test files, 922 passed tests, 13 skipped tests.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/window-manager.ts src/main/window-manager.test.ts src/main/handlers/app-handlers.ts src/preload/index.ts src/renderer/src/env.d.ts src/main/services/system/network-url-policy.ts src/shared/url-policy.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.
- `pnpm format:check`
  - Result: passed.

### Deferred findings

- `safeOpenExternal()` now performs DNS resolution before opening HTTP(S) URLs. That closes the private/loopback bypass at the main boundary but can make external opening fail closed when DNS resolution fails.
- Renderer-specific untrusted external-open policies remain a follow-up, including media/video fallback paths that can open raw source URLs.
- Plaintext token/settings secret storage and renderer broadcast exposure remain deferred high-risk findings.

## 2026-07-07 - Auth bearer token renderer and persistence hardening

### Review inputs

- Auth/session review confirmed that backend bearer tokens were persisted by `electron-store` as plaintext session data and returned to renderer code from login/current-user IPC responses.
- Settings-secret and WebSocket identity reviews returned separate valid findings; they are intentionally deferred so this batch only changes auth bearer storage and renderer exposure.

### Fixed in this batch

- `SessionStore` now persists session metadata without a plaintext token and stores the bearer as `safeStorage`-encrypted base64 when OS encryption is available.
- Legacy plaintext `session.token` data is migrated on read: the token is loaded into main-process memory and the persisted session is rewritten without plaintext token material.
- If `safeStorage` encryption is unavailable, newly saved tokens remain memory-only for the current runtime instead of being written back as plaintext.
- OAuth login and current-user IPC responses no longer include `token`; renderer auth state now tracks the authenticated user only.
- Login pages, login modal, settings login card, and hydration state no longer require or clear a renderer-side bearer token.
- Added regression coverage for encrypted persistence, legacy plaintext migration, memory-only fallback, and auth IPC token redaction.

### Impact analysis

- `SessionStore`: MEDIUM risk. GitNexus reported 10 direct importers and 24 impacted nodes.
- `SessionStore.saveSession`: LOW risk. Direct callers include `getValidatedSession`, `saveLoginSession`, and `refreshStoredUser`; affected processes include `registerIpcHandlers` and `onReady`.
- `SessionStore.getSession`: CRITICAL risk. Direct callers include auth/session validation plus feed sync, RAG, reading activity, notification, and app handler paths; affected processes include `registerFeedSyncHandlers`, `onReady`, `registerFeedHandlers`, `registerAppHandlers`, and agent feed tool execution.
- `runOAuthLogin`: HIGH risk. Direct caller is `registerAuthHandlers`; affected processes include `registerIpcHandlers` and `onReady`.
- `registerAuthHandlers`: LOW risk. Direct caller is `AppManager.registerIpcHandlers`; affected processes include `registerIpcHandlers` and `onReady`.
- `useAuthStore`: HIGH risk. Direct callers include auth guard/login UI, settings, notification provider, and discover UI; affected process includes `UserSettings`.
- Pre-commit `detect_changes --scope staged` reported MEDIUM risk across 10 files, 24 symbols, and 3 affected processes: `RegisterFeedSyncHandlers -> GetSession`, `RegisterIpcHandlers -> GetSession`, and `RegisterFeedSyncHandlers -> ClearSession`.

### Verification

- `pnpm test -- src/main/services/auth/session-store.test.ts src/main/handlers/auth-handlers.test.ts src/main/services/auth/session-validation.test.ts`
  - Vitest ran the full configured suite.
  - Result: 160 passed test files, 927 passed tests, 13 skipped tests.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint -- src/main/services/auth/session-store.ts src/main/services/auth/session-store.test.ts src/main/handlers/auth-handlers.ts src/main/handlers/auth-handlers.test.ts src/renderer/src/store/auth-store.ts src/renderer/src/pages/AuthLoginPage.tsx src/renderer/src/components/auth/LoginModal.tsx src/renderer/src/components/settings/UserSettings.tsx src/renderer/src/initialize/hydrate.ts`
  - Result: 0 errors.
  - Existing unrelated warnings remain in `DiscoverPanel.tsx` and `DiscoverPreviewPage.tsx`.

### Deferred findings

- Existing users on platforms without available `safeStorage` encryption will need to log in again after app restart because tokens are intentionally not persisted plaintext.
- Settings secrets are still persisted/broadcast/cached in plaintext and need a separate redaction/secret-store batch.
- WebSocket connect still accepts renderer-supplied `userId`; fix by deriving socket identity from main-process session state in a separate batch.
