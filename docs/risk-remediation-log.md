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
