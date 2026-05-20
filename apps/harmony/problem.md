# Livo Harmony - Architectural Regressions & Problems

We discovered exactly 5 test failures in the regression test suite. These represent architectural mismatches between the test expectations and the deepened modules (Dependency Injection and centralized `HomeFeedGuard`).

Below is the list of problems, their causes, and a todo list to resolve them.

---

## 1. SyntaxError: Type Stripper throws on Value Import of Interface

- **Files**: [home-article-entry-card-source.test.ts](file:///d:/project/Livo/apps/harmony/tests/home-article-entry-card-source.test.ts)
- **Problem**: In Node.js native TypeScript loader/compiler (with `--experimental-strip-types`), `export interface` has no runtime value. Importing `InlineHighlightSegment` without the `type` keyword causes a runtime `SyntaxError` because the stripped JavaScript file has no value export.
- **Solution**: Use `type InlineHighlightSegment` in the import list to inform the compiler it is a type-only import.
- **Benefits**: Locality of type definitions is preserved, and tests can execute without runtime compiler errors.

## 2. Omission of Lean Apply Helper in Pagination

- **Files**: [HomeFeedPagination.ets](file:///d:/project/Livo/apps/harmony/entry/src/main/ets/common/utils/home/HomeFeedPagination.ets)
- **Problem**: The pagination coordinator hardcoded `true` inside `applyEntriesForLoadMore` instead of using the helper method `shouldUseLeanLoadMoreApply` verified by the tests.
- **Solution**: Reintroduce the private helper `shouldUseLeanLoadMoreApply(mode)` and map it as `leanApply` in `applyEntriesForLoadMore`.
- **Benefits**: Locality of pagination rules is restored to a single configurable method, matching test assertions.

## 3. Prefetch Scroll Check Seam Mismatch

- **Files**: [HomeFeedLoadMorePrefetch.ets](file:///d:/project/Livo/apps/harmony/entry/src/main/ets/common/utils/home/HomeFeedLoadMorePrefetch.ets), [HomeFeedGuard.ets](file:///d:/project/Livo/apps/harmony/entry/src/main/ets/common/utils/home/HomeFeedGuard.ets)
- **Problem**: The scroll interaction check `!this.state.homeScrollIntent.isInteracting` was moved to `HomeFeedGuard.ets` (a deeper module), but the prefetch regression test still expects it inside `HomeFeedLoadMorePrefetch.ets`.
- **Solution**: Update the prefetch test to read both `HomeFeedLoadMorePrefetch.ets` and `HomeFeedGuard.ets` to verify that the check is executed at prefetch time.
- **Benefits**: Validates that prefetching continues to be safely guarded while respecting the new deep seam.

## 4. Outdated Dependency Injection Reference in Bounded Reload Test

- **Files**: [HomeFeedSession.ets](file:///d:/project/Livo/apps/harmony/entry/src/main/ets/common/utils/home/HomeFeedSession.ets), [home-mode-safe-window-source.test.ts](file:///d:/project/Livo/apps/harmony/tests/home-mode-safe-window-source.test.ts)
- **Problem**: `HomeFeedSession` was refactored to use injected `this.featuredEntriesQuery` instead of direct references to `FeaturedEntriesQuery.default`. The regression test was never updated and still asserts direct calls to `FeaturedEntriesQuery.default`.
- **Solution**: Update test assertions to match the new injected `this.featuredEntriesQuery`.
- **Benefits**: Correctly verifies that `HomeFeedSession` operates on the injected query abstraction.

## 5. Outdated Dependency Injection Reference in Prefetch Test

- **Files**: [HomeFeedLoadMorePrefetch.ets](file:///d:/project/Livo/apps/harmony/entry/src/main/ets/common/utils/home/HomeFeedLoadMorePrefetch.ets), [problem-regressions-source.test.ts](file:///d:/project/Livo/apps/harmony/tests/problem-regressions-source.test.ts)
- **Problem**: `HomeFeedLoadMorePrefetch` was refactored to use injected `this.featuredEntriesQuery` instead of `FeaturedEntriesQuery.default`. The regression test still asserts direct calls to `FeaturedEntriesQuery.default`.
- **Solution**: Update test assertions to match the new injected `this.featuredEntriesQuery`.
- **Benefits**: Correctly verifies that prefetching operates on the injected query abstraction.

---

## Todo List

- [x] Fix Type Stripper Value Import in `tests/home-article-entry-card-source.test.ts`
- [x] Implement `shouldUseLeanLoadMoreApply` in `HomeFeedPagination.ets`
- [x] Update Prefetch Scroll Check Seam assertions in `tests/home-load-more-prefetch-source.test.ts`
- [x] Update Dependency Injection assertions in `tests/home-mode-safe-window-source.test.ts`
- [x] Update Dependency Injection assertions in `tests/problem-regressions-source.test.ts`
