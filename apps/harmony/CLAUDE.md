# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Context

This is `apps/harmony` within the Livo monorepo (pnpm workspace + Turborepo). The root `AGENTS.md` covers workspace-wide conventions. Other apps: `apps/desktop` (Electron/React). Shared packages: `packages/models`, `packages/shared`, `packages/utils`.

## Build & Development Commands

All commands run from `apps/harmony/`:

```bash
pnpm run doctor          # Diagnose DevEco Studio, SDK, and toolchain setup
pnpm run studio          # Open project in DevEco Studio
pnpm run build:debug     # Compile debug HAP via hvigor
pnpm run build:release   # Compile release HAP via hvigor
pnpm run install:debug   # Install debug HAP to connected device via hdc
pnpm run run:debug       # Launch EntryAbility on device via hdc
```

Or from workspace root:

```bash
pnpm dev:harmony          # Same as pnpm run studio
pnpm build:harmony:debug
pnpm install:harmony:debug
pnpm run:harmony:debug
```

## Tests

**Node regression tests** (`tests/*.test.ts`) — run directly with Node:

```bash
node --import tsx --test tests/article-detail-content.test.ts
node --import tsx --test "tests/*.test.ts"   # Run all
```

These import from `entry/src/main/ets/common/utils/*.ts` and test pure-logic exports.

**HarmonyOS local unit tests** (`entry/src/test/`) — ArkTS tests using @ohos/hypium, run inside DevEco Studio.

**HarmonyOS UI tests** (`entry/src/ohosTest/`) — on-device integration tests, also via DevEco Studio.

## Architecture

This is a **HarmonyOS NEXT Stage Model** app targeting API 6.1 (SDK 23), device type: phone.

### Layer Organization

```
entry/src/main/ets/
├── entryability/       # EntryAbility — app entry, window init, bootstrap
├── entrybackupability/ # Backup extension
├── stage/              # LivoAbilityStage — app-level lifecycle
├── pages/              # Top-level @Entry pages (Index, Subscriptions, Discover, etc.)
├── common/
│   ├── data/           # AppRepository (facade), ArrayLazyDataSource, FeedRefreshCoordinator, SeedData
│   ├── repositories/   # FeedRepository, EntryRepository — RDB persistence layer
│   ├── services/       # Business logic — RSS, discover, AI assist, accounts, theme, etc.
│   ├── models/         # Domain types (LivoTypes.ets), mapper functions (LivoModels.ets)
│   ├── navigation/     # AppRouter — route constants and typed navigation helpers
│   ├── components/     # Reusable ArkUI @Component widgets, organized by feature
│   ├── utils/          # Coordinators, policies, controllers, parsers, helpers
│   └── ui/             # Design tokens (UiTokens.ets, AIPanelTokens.ets, Motion.ets)
```

### Key Architectural Patterns

**AppRepository singleton** (`common/data/AppRepository.ets`) is the centralized data facade. All pages and coordinators read/write through it — it coordinates FeedRepository, EntryRepository, FeedRefreshCoordinator, and various services.

**RDB persistence** via `@ohos.data.relationalStore` (`AppDatabaseService.ets`). Two tables: `feeds` and `entries`. Repositories (`FeedRepository.ets`, `EntryRepository.ets`) handle SQL and row mapping.

**Preferences storage** via `@ohos.data.preferences` (`AppPreferenceService.ets`) for app settings, AI config, refresh logs, and home entry snapshots.

**Coordinator pattern** — the `Index` page is complex and delegates to focused coordinator classes: `IndexHomeBootstrapCoordinator`, `IndexHomeRefreshCoordinator`, `IndexHomePaginationCoordinator`, `IndexHomeRailCoordinator`, `IndexHomeRuntimeCoordinator`, `IndexRootTabCoordinator`, etc. Each receives the page component instance and manages a specific concern.

**Delegate pattern** — pages implement delegate interfaces (`IndexHomeEntryDataDelegate`, `IndexHomeModeDelegate`, `IndexHomeInlineSearchDelegate`) so coordinators can call back into the page without tight coupling.

**Reactive state** — `@State`, `@Prop`, `@StorageProp`/`@StorageLink`, `@Watch` drive ArkUI reactivity. `AppStorage` holds global keys like `WindowClass`, `topAvoidArea`, `feedsChangedAt`.

### Routing

- `common/navigation/AppRouter.ets` defines `ROUTES` constants mapping names to page paths
- Navigation uses `UIContext.getRouter()` with string-keyed params
- Route params passed as class instances (serialized by the framework)
- Root tabs: home, subscriptions, discover, settings — managed via `IndexRootTabCoordinator`
- `RootTabRouteParams.rootTab` drives which tab is active on Index page load

### Feed View Types

Four `FeedViewType` values: `Articles` (0), `SocialMedia` (1), `Videos` (2), `Pictures` (3). This drives which home mode rail is shown, how content blocks are built, and how entry cards are presented.

### HarmonyOS-Specific Notes

- **oh_modules** (not node_modules) — HarmonyOS native dependencies defined in `oh-package.json5`
- **hvigor** — HarmonyOS build system invoked via `hvigorw.bat` (wrapped by `scripts/harmony-cli.mjs`)
- **hdc** — HarmonyOS Device Connector (ADB equivalent) for install/run
- The build currently requires DevEco Studio SDK components to be fully installed
- No npm packages can be imported in ArkTS source files — only HarmonyOS SDK modules (`@ohos.*`, `@kit.*`) and oh_modules
