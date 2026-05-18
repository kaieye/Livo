# Architectural Friction Points




## 3. Static-only service classes prevent test isolation

**Files**: `repositories/FeedRepository.ets`, `repositories/EntryRepository.ets`, `data/FeaturedEntriesQuery.ets`, `data/FeedRefreshCoordinator.ets`, `services/RssFeedService.ets`, `services/ThemeService.ets`, `services/SettingsStore.ets`, and ~10 more

Every repository, service, and query class uses only `static` methods. No instance, no interface, no way to substitute a fake for testing. `FeaturedEntriesQuery` internally hardcodes `FeedRepository.list()` — testing it requires a real RDB. Global mutable caches (`modeEntriesCache`) can't be reset between tests.

**Solution**: Convert static classes to instances behind interfaces. `FeaturedEntriesQuery` would accept `FeedRepository` and `EntryRepository` interfaces in its constructor.

## 4. Tests assert against source-code text, not module behavior

**Files**: `tests/*.test.ts` (24 test files)

Every test uses `readFileSync` + `assert.match` to verify structural patterns in raw ArkTS source. Renaming a property or moving a method breaks tests even if behavior is unchanged. Real bugs (wrong sort order, data loss, race conditions) are invisible.

**Solution**: Once repositories/queries become injectable (problem 3), write behavioral tests with fake data. Retire source-text tests once behavioral equivalents exist.

## 5. `Index.ets` is a god component with ~50 pass-through methods (部分改善)

**Files**: `pages/Index.ets` (~560 lines after problem-1 refactor)

**现状**: 但 `Index` 仍然有大量 thin wrappers 直接转发给协调器（如 `resolveHomeCandidateLimit()` → `this.homeFeedPagination.resolveHomeCandidateLimit()`）。`Index` 依然持有 ~60 个 `@State` 属性。

**Solution**: 考虑用一个 `HomeContext` 对象打包协调器，通过 `@Provide`/`@Consume` 或单个 prop 传递，消除逐方法转发。

## 6. Two parallel "Owner" interface styles coexist

**Files**: `HomeFeedSessionOwner.ets` (monolithic ~80-member interface) vs. `HomeInlineSearchState` + `HomeInlineSearchActions`, `HomeModeState` + `HomeModeActions` (split state/actions pattern)

Some coordinators use a clean `State` + `Actions` split; others use monolithic `Owner` interfaces. The split pattern is strictly better for testability but applied inconsistently.

**Solution**: Convert remaining `Owner` interfaces to the `State` + `Actions` split for consistency and testability.

---

## ADR note

No existing ADRs in this repo (no `docs/adr/` directory). The patterns in `CLAUDE.md` are descriptive, not prescriptive — nothing blocks these refactors.
