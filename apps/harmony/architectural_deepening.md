Architectural Deepening Opportunities

1. AppRepository pass-through bloat — 72% delegation, zero added logic  


Files: common/data/AppRepository.ets, 14 imported modules

Problem: Of 47 public methods, 34 are pure pass-throughs — await bootstrap() then delegate with identical arguments and return. There's a dead RssFeedService import. The real depth lives in
FeedRefreshCoordinator and FeaturedEntriesQuery, not here. AppRepository is a shallow namespace-on-statics, yet every page and coordinator couples to it directly. The deletion test confirms value in
only 13 of 47 methods — the rest are indirection that could vanish.

Solution: Keep the 13 orchestration methods that earn their keep (bootstrap, feed-card enrichment, multi-step create/update/remove, etc.). Let callers import deep modules (FeedRefreshCoordinator,
FeaturedEntriesQuery, AppPreferenceService) directly for the rest. This turns AppRepository from a 437-line facade into a ~200-line orchestration module with real locality.

Benefits: Callers see what they actually depend on instead of one opaque class. The deep modules (FeedRefreshCoordinator, FeaturedEntriesQuery) become independently testable. Dead imports vanish.
The interface shrinks from 47 methods to ~13, each with real leverage.

---

2. Index page coordinator tight-coupling — 7 coordinators, 0 independently testable

Files: pages/Index.ets, 10 coordinator/delegate files in common/utils/

Problem: Every coordinator accepts the full Index component as a constructor parameter via an owner interface that mirrors Index's entire surface (~25 properties + 15 methods each). Coordinators use
only ~30% of what they receive. This prevents unit testing, ties all coordinators to Index's evolution, and means the interface is not the test surface — you can't test coordinator logic without a
real Index instance or a sprawling mock.

Three files are pure wiring with zero branching logic and fail the deletion test: IndexHomeStateFactory.ets, IndexHomeDelegates.ets, IndexHomeRootContentCallbacksFactory.ets — combined ~190 lines of
typed-object constructors and pass-through arrow functions.

Solution: Narrow each coordinator's owner interface to the subset it actually uses. Extract state into a shared struct that coordinators read/write rather than bouncing through the Index component.
This creates a real seam: the coordinator's interface becomes its public methods + the struct, and both are testable without ArkUI.

Benefits: Coordinators become independently testable (real locality). The 3 wiring files can be deleted — their content inlines into component builders. Index.ets shrinks as coordinators own their
state directly.

---

3. Duplicated cross-cutting concerns across pages — showToast, theme loading, error handling

Files: pages/ArticleDetail.ets, pages/DiscoverPreview.ets, pages/FeedDetail.ets, pages/DiscoverSubscribeConfig.ets, pages/AccountLogin.ets

Problem: showToast is defined identically in ArticleDetail, DiscoverPreview, and Index — same try/catch wrapping getUIContext().getPromptAction().showToast(). Theme loading is a repeated two-line
pattern across FeedDetail and DiscoverSubscribeConfig. Error handling follows no shared convention. These are shallow duplications that spread maintenance cost across pages.

Solution: A single page-level utility module with showToast(context, message, duration?) and resolveCurrentTheme(settings) functions. These have a tiny interface (one argument each) and concentrate
a cross-cutting concern at one locality.

Benefits: Fix once, fixed everywhere. Pages lose 4-6 lines each of duplicated boilerplate. Future pages don't need to rediscover the toast pattern.

---

4. IndexHomeModeScenePresenter — 4 near-identical methods, one function's worth of logic

Files: common/utils/IndexHomeModeScenePresenter.ets

Problem: 4 of 5 public methods construct identical argument objects, call the same private resolver, and extract different fields from the result. This is a single function returning a record, split
across 4 methods for call-site convenience at the cost of shallowness — the interface is 4 methods when 1 would suffice.

Solution: Collapse into getSceneProps(mode): ModeSceneRenderState returning a record. Let callers destructure what they need. The interface shrinks from 5 methods to 1, and the implementation is the
same resolver called once.

Benefits: 4 methods become 1. Callers add one destructure line but lose 3 method references. Real depth: one call produces all scene state.

---

5. Three identical shell pages — same 15-line file, different tab ID

Files: pages/Subscriptions.ets, pages/Discover.ets, pages/Settings.ets

Problem: Three structurally identical files — each is a 15-line @Entry @Component struct whose aboutToAppear calls openRootTab('subscriptions' | 'discover' | 'settings'). These exist because ArkUI
requires @Entry pages in the page registry, but they contain zero unique logic. A deletion test says each could be a single configuration entry with a generic shell.

Solution: A single parameterized RootTabShell page that reads the target tab from route params. Or, if ArkUI's page registration requires discrete files, extract the shared struct and let each file
be a one-line subclass.

Benefits: 45 lines across 3 files collapse into 1 generic page + 3 config entries. Change the shell behavior once instead of 3 times.

---

6. DiscoverService is a pure re-export barrel — zero logic

Files: common/services/DiscoverService.ets

Problem: This module contains zero implementation — it re-exports types and functions from 7 discover/ submodules. It's a pass-through by definition. The deletion test says deleting it changes
import paths but removes no complexity.

Solution: Delete it. Let callers import from the discover/ submodules directly. The import paths get slightly longer (../services/discover/DiscoverTypes instead of ../services/DiscoverService) but
no logic changes.

Benefits: One less file. No re-export maintenance. Callers see exactly which discover submodule they depend on.

---
