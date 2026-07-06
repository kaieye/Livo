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
