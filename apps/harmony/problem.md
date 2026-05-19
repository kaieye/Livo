## 5. Dead Code: `shouldUseLeanLoadMoreApply` Always Returns `true`

**Files**: `common/utils/home/HomeFeedPagination.ets`

**Problem**: The method `shouldUseLeanLoadMoreApply(mode)` returns `true` for all four modes (`'articles'`, `'social'`, `'pictures'`, `'videos'`). There are no other `SubscriptionMode` values. The method and its call site form dead logic — the "lean apply" path is always taken, making the non-lean branch unreachable.

```typescript
// HomeFeedPagination.ets, ~line 58
private shouldUseLeanLoadMoreApply(mode: SubscriptionMode): boolean {
  return mode === 'articles' || mode === 'social' || mode === 'pictures' || mode === 'videos'
}
```

**Solution**: Remove the method and inline `true` at the call site, or remove the conditional entirely. If the non-lean path was intentionally preserved as a fallback, document it with a comment and a feature flag.

**Benefits**: Removes a false choice from the code — a reader sees a conditional and assumes both branches matter, wasting understanding effort.

---

## 6. Duplicate Merge-Deduplication Logic in Paginator and Prefetcher

**Files**: `HomeFeedPagination.ets` (~lines 85-100), `HomeFeedLoadMorePrefetch.ets` (~lines 78-92)

**Problem**: Both `HomeFeedPagination.appendFeaturedEntriesFromLocalFast()` and `HomeFeedLoadMorePrefetch.run()` contain near-identical entry deduplication logic:

1. Iterate `previousEntries`
2. Build a `Set<string>` of composite keys (`${id}|${feedId}|${articleUrl}`)
3. Merge new entries, skipping duplicates
4. Slice to a target limit

The implementations differ slightly (the paginator slices at the end, the prefetcher slices during construction). This is a copy-paste with drift.

**Solution**: Extract a shared `mergeUniqueEntries(previous: EntryCardModel[], next: EntryCardModel[], limit: number): EntryCardModel[]` in `HomeEntryUtils.ets`. Both callers use it.

**Benefits**: **Locality** — the merge algorithm lives in one place. A bug in dedup logic (e.g., the key format changes) is fixed once.

---

## 7. Mode Map Helpers Are a Code Generation Candidate

**Files**: `common/utils/home/HomeModeMapHelpers.ets`, and 8 map types in `components/HomeRootConfig`

**Problem**: Every state dimension that varies by mode (candidate limits, visible limits, has-more flags, loaded/loading flags, no-progress counts, scroll offsets, timestamps, pending flags) has its own:

- Map type alias (e.g. `HomeModeCandidateLimitMap`, `HomeModeHasMoreMap`)
- Value reader (e.g. `homeCandidateLimitValue`)
- Immutable-update function (e.g. `withHomeCandidateLimitValue`)
- Factory (e.g. `createHomeCandidateLimitMap`)

This is 32 nearly-identical functions across 8 dimensions. Adding a new per-mode dimension requires copy-pasting the pattern a fourth time.

**Solution**: Extract a generic `PerModeMap<T>` type with `get(mode): T` and `set(mode, value): PerModeMap<T>`. This collapses 8 map types into one generic, and 32 helper functions into 2 (`perModeGet`, `perModeSet`). The domain is ArkTS, which supports generics.

**Benefits**: Adding a new per-mode state field becomes a one-liner instead of 3 functions + a type alias. The generic implementation is trivially testable with a pure-function test.

---
