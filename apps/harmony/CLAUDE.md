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
│   ├── data/           # FeaturedEntriesQuery, AppRepositoryEntryHelpers, FeedRefreshCoordinator, SeedData
│   ├── repositories/   # FeedRepository, EntryRepository — RDB persistence layer
│   ├── services/       # Business logic — RSS, discover, AI assist, accounts, theme, etc.
│   ├── models/         # Domain types (LivoTypes.ets), mapper functions (LivoModels.ets)
│   ├── navigation/     # AppRouter — route constants and typed navigation helpers
│   ├── components/     # Reusable ArkUI @Component widgets, organized by feature
│   ├── utils/          # Coordinators, policies, controllers, parsers, helpers
│   └── ui/             # Design tokens (UiTokens.ets, AIPanelTokens.ets, Motion.ets)
```

### Key Architectural Patterns

**Data access** — pages and coordinators import repositories and services directly. There is no centralized data facade. The main access paths are:

- `FeedRepository` / `EntryRepository` (`common/repositories/`) — RDB persistence via `@ohos.data.relationalStore` (`AppDatabaseService.ets`). Two tables: `feeds` and `entries`. A generic `RdbTable<T>` helper (`common/repositories/RdbTable.ets`) reduces boilerplate.
- `FeaturedEntriesQuery` (`common/data/`) — builds balanced, mode-aware home feed entry lists by combining FeedRepository + EntryRepository results.
- `AppRepositoryEntryHelpers` (`common/data/`) — pure helper functions (card mapping, feed sorting, mode grouping) shared across the home feed and subscriptions.
- `FeedRefreshCoordinator` (`common/data/`) — orchestrates background feed fetching and notifies the UI via `AppStorage` change signals.

**Preferences storage** — `AppPreferenceService.ets` wraps `@ohos.data.preferences` for low-level key-value persistence. Focused store classes provide typed access to specific domains: `SettingsStore` (app settings), `AIAssistantSettingsStore` (AI config), `HomeEntrySnapshotStore` (home entry snapshots), `RefreshLogStore` (refresh history), `DiscoverAvatarCacheStore` (avatar cache), `PreferenceStoreAccessor` (shared preferences helper).

**HomeFeedSession** (`common/utils/HomeFeedSession.ets`) is the central orchestrator for the `Index` home tab. It owns the home feed lifecycle: startup data loading, refresh, pagination, mode switching, search, and scroll state. It delegates to focused collaborators: `HomeFeedRefresh`, `HomeFeedPagination`, `HomeEntryDataManager`, `HomeInlineSearchController`, `HomeScrollIntentTracker`, `IndexHomeRailCoordinator`, `IndexHomeRuntimeCoordinator`, `IndexRootTabCoordinator`.

**Delegate pattern** — `HomeFeedSession` implements `HomeFeedSessionOwner` so collaborators can read/write shared session state without back-references to the page component.

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

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Livo** (1963 symbols, 3373 relationships, 131 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource                              | Use for                                  |
| ------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/Livo/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/Livo/clusters`       | All functional areas                     |
| `gitnexus://repo/Livo/processes`      | All execution flows                      |
| `gitnexus://repo/Livo/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
