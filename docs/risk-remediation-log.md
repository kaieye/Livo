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
