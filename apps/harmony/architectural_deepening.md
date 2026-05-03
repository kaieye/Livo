Architectural Deepening Opportunities

7. The IndexHome\*Coordinator family is one module split across 12 files

Files: pages/Index.ets (459 lines), plus common/utils/IndexHomeBootstrapCoordinator.ets,
IndexHomeRefreshCoordinator.ets (399), IndexHomePaginationCoordinator.ets (336) +
HomePaginationState.ets, IndexHomeReloadCoordinator.ets, IndexHomeRailCoordinator.ets,
IndexHomeRuntimeCoordinator.ets, IndexRootTabCoordinator.ets, IndexPageLifecycleController.ets,
IndexHomeModeScenePresenter.ets, IndexHomeLoadStateGate.ets, IndexHomeScrollerRegistry.ets,
IndexHomeDiagnosticsLogger.ets, plus the related HomeEntryDataManager.ets,
HomeInlineSearchController.ets, HomeModeController.ets. ~1928 lines of coordinator code
orchestrating one page.

Problem: Each coordinator declares an IndexHomeXxxOwner interface listing the Index @State
fields it reads and writes (e.g. IndexHomeRefreshOwner declares 28 fields + 13 callbacks;
IndexHomePaginationOwner declares 25 fields + 14 callbacks). Coordinators don't own state — they
reach back through this.owner.featuredEntries = …, this.owner.homeLoadMoreInProgress = false,
etc. The Index struct is the single adapter for every Owner interface. By the deletion test,
deleting any one coordinator and inlining its body back into Index would change file count but
not concentrate complexity any worse — the coupling is already total. The Owner interfaces are
hypothetical seams (one adapter), not real ones; the overall interface to the world is bigger
than the implementation behind it. The lifecycle quartet (Bootstrap / Refresh / Reload /
Pagination) is the tightest cluster — they call into each other constantly through Owner
methods (reloadHomeEntriesFromLocal, applyEntriesForMode, setModeHasMoreEntries,
scheduleHomeLoadMorePrefetch, …).

Solution: Introduce a real HomeFeedSession module that owns the home-feed state (mode,
entryGroups, featuredEntries, candidate limits, has-more flags, load-more in-progress,
post-refresh deferral) and exposes a small set of operations: bootstrap(), resume(), refresh(),
loadMoreFor(mode), reload(reason), switchMode(mode). The lifecycle coordinators collapse into
the session. Index becomes a thin reactive presenter that observes the session and forwards UI
gestures. Pure-presentation helpers (IndexHomeModeScenePresenter, IndexHomeLoadStateGate,
IndexHomeRailCoordinator, IndexHomeScrollerRegistry, IndexHomeDiagnosticsLogger) — which
already have small Owner interfaces and own their own data — stay separate.

Benefits: Depth — a single small interface (HomeFeedSession) carries the entire feed lifecycle
behind it; the 4 lifecycle Owner interfaces (~80 fields + ~50 methods total) disappear.
Locality — a bug in "did the deferred reload fire after refresh?" lives in one place instead of
spanning 4 files. The interface becomes the test surface — tests/home-feed-session.test.ts
calls session.refresh() and asserts on observable session state, instead of today's status quo
(almost no test coverage of the lifecycle, because the coupling to @State makes it hard to
test).

---

8. AppPreferenceService is a junk drawer for 5 unrelated Preferences-backed concerns

Files: common/services/AppPreferenceService.ets (462 lines).

Problem: A single static class holds five distinct concerns sharing only a
preferences.Preferences handle:

1. HarmonySettings (load/save 14 keys)
2. AIAssistantSettings (load/save with per-provider apiKey migration)
3. RefreshLogEntry[] (append, load, prune to 60)
4. Home-entry snapshot (clone+normalize+filter+save)
5. Discover avatar cache (normalize+save+evict)

Each concern owns its own cloneX/normalizeX/filterX helpers. Concerns never interact; they
happen to share storage. The interface is "every key any concern touches" — callers reach for
AppPreferenceService.loadAISettings() and AppPreferenceService.appendRefreshLog() from
completely unrelated parts of the app. By the deletion test, deleting AppPreferenceService and
replacing it with five sibling modules would not concentrate any complexity — each call site
already imports only the methods for its concern.

Solution: Split into five modules — one per concern — each behind its own seam, sharing a small
internal preferences accessor. Names should match the domain language: SettingsStore,
AIAssistantSettingsStore, RefreshLogStore, HomeEntrySnapshotStore, DiscoverAvatarCacheStore.
The shared accessor is an internal seam, not exposed externally.

Benefits: Depth — each store has a small focused interface (~3–4 methods), and each store's
normalization rules become local to it instead of being mixed into a 462-line file. Locality —
refresh-log pruning logic and AI-key migration stop sharing a file with home-entry snapshot
normalization. Existing Node tests can target each store individually instead of the catch-all
service.

---

9. HomeReloadPolicy is a single pure function extracted only for testing — production callers
   were rewritten without it

Files: common/utils/HomeReloadPolicy.ets (13 lines, one exported function
shouldRunImmediateHomeTabReload), entry/src/test/HomeReloadPolicy.test.ets.

Problem: Grep shows zero production imports of shouldRunImmediateHomeTabReload. The only
importer is its own test (entry/src/test/HomeReloadPolicy.test.ets). At some point it was
extracted to make a tab-reload condition testable; the production call site has since been
refactored (the equivalent logic now lives in
IndexHomeRefreshCoordinator.shouldRunFinalHomeReloadNow / tryFlushDeferredFeedsChangedReload
with much richer conditions). This is the textbook "extracted for testability, then real bugs
hide in how it's called" failure: the test passes but exercises code no caller runs. By the
deletion test, deleting both the function and its test removes nothing real.

Solution: Delete HomeReloadPolicy.ets and HomeReloadPolicy.test.ets. When HomeFeedSession lands
(candidate 7), test the equivalent condition through the session's interface, not through an
extracted helper.

Benefits: Removes a misleading test (passing tests on dead code is worse than no tests).
Locality — eliminates the temptation to "fix" the unused helper instead of the live conditions
in IndexHomeRefreshCoordinator.

---

10. FeedRepository and EntryRepository static methods each wrap RDB primitives in identical
    try/catch/store/predicates boilerplate

Files: common/repositories/FeedRepository.ets (336 lines, 9 static methods),
common/repositories/EntryRepository.ets (337 lines, ~13 static methods),
common/services/AppDatabaseService.ets (116 lines).

Problem: Every public method follows the same shape:
try { const store = await AppDatabaseService.getStore();
const predicates = new RdbPredicates(table); …
return mapRow(result) }
catch (error) { throw new Error(`X 失败：${error.message}`) }

The Chinese error-message rephrase is duplicated 8 times in FeedRepository alone. The repos are
shallow — the implementation is mostly the same wrapper around different predicates and column
lists; the row-mapping (mapFeed, mapEntry) is the only real value the module adds, and it's a
private helper. A new method = ~15 lines of boilerplate around 2–3 lines of unique logic.

Solution: Two small deepenings:

- A withRdb<T>(operationLabel, fn): Promise<T> helper inside (or alongside) AppDatabaseService
  that opens the store and rephrases errors. Repo methods shrink to the unique part.
- A small Table<Row> helper that pairs a row mapper (mapFeed / mapEntry) with a predicate
  builder, so list-by-X and get-by-X collapse onto one call.

Benefits: Leverage — one helper learned, all 22 repo methods improved. Locality —
error-message format and store-acquisition handling live in one place; today there are ~22
copies of the same try/catch shape. Future repo methods (e.g. starred entries, tag queries)
become 2–3 lines each.

---

11. CLAUDE.md describes architecture that no longer exists; no CONTEXT.md exists for the domain

Files: CLAUDE.md, plus the absence of CONTEXT.md and docs/adr/.

Problem: This isn't a code-shape problem but a navigation problem the deepening review cares
about. CLAUDE.md says "AppRepository singleton is the centralized data facade … coordinates
FeedRepository, EntryRepository, FeedRefreshCoordinator and various services." The file no
longer exists; the facade was deleted (probably in earlier deepening rounds — only
AppRepositoryEntryHelpers.ets remains). Pages and coordinators import FeedRepository /
EntryRepository / AppPreferenceService / FeaturedEntriesQuery directly. CLAUDE.md also
describes the coordinator pattern as if it's a deep-module strategy, which candidate 7
disputes. Future architecture reviews — including future runs of this skill — will be misled.
There is also no shared domain glossary (CONTEXT.md) defining terms like Feed, Entry,
Subscription Mode, Home Feed Session, Discover Candidate, AI Assist, Refresh Log, so each new
module invents its own naming (subscriptionMode, FeedViewType, and RootTabId all cover
overlapping ideas).

Solution: Reconcile CLAUDE.md with current code (drop the AppRepository facade description;
describe the actual current data layer: page → FeaturedEntriesQuery / FeedRepository /
EntryRepository / AppPreferenceService / FeedRefreshCoordinator). Create a CONTEXT.md that
names the load-bearing domain concepts so subsequent deepening conversations have shared
vocabulary.

Benefits: Locality — future explorers (humans and agents) read the docs and the code agreeing
instead of having to do a half-hour audit just to find out AppRepository is gone. Leverage —
once the domain glossary exists, every later candidate can say "the Home Feed Session" or "a
Discover Candidate" and have it mean a precise thing.

---

Highest-leverage pick: 7 (HomeFeedSession) — most changes how the home page is written and
tested going forward. 11 (docs reconciliation) is fast and unblocks every other discussion. 9
is essentially a one-PR delete.
