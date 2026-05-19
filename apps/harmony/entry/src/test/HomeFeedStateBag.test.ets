import { describe, it, expect } from '@ohos/hypium'
import { HomeFeedStateBag } from '../main/ets/common/utils/home/HomeFeedStateBag'
import { FakeHomeFeedActions } from '../main/ets/common/utils/home/FakeHomeFeedActions'
import { HomeFeedState, HomeFeedActions } from '../main/ets/common/utils/home/HomeFeedSessionOwner'

/**
 * Validates that HomeFeedStateBag and FakeHomeFeedActions work as
 * test adapters for the HomeFeedState / HomeFeedActions seams.
 *
 * These are the building blocks for behavioral coordinator tests —
 * instead of needing the full Index ArkUI component, a test can
 * construct a state bag + fake actions and pass them directly into
 * coordinator constructors.
 */
export default function homeFeedStateBagTest() {
  describe('homeFeedStateBagTest', () => {

    // ── HomeFeedStateBag ──

    it('satisfies the HomeFeedState interface', 0, () => {
      const bag: HomeFeedState = new HomeFeedStateBag()
      // If the type system accepts the assignment above, the bag
      // structurally satisfies HomeFeedState.  Verify a few key
      // fields so a future refactor that removes a field is caught.
      expect(bag.mode).assertEqual('articles')
      expect(bag.featuredEntries.length).assertEqual(0)
      expect(bag.isComponentActive).assertEqual(false)
      expect(bag.homeInitialLoadPending).assertEqual(true)
      expect(bag.homeHasMoreEntries).assertEqual(true)
      expect(bag.searchOverlayVisible).assertEqual(false)
    })

    it('has mutable fields — test can configure state', 0, () => {
      const bag = new HomeFeedStateBag()
      bag.isComponentActive = true
      bag.homeInitialLoadPending = false
      bag.mode = 'social'

      expect(bag.isComponentActive).assertEqual(true)
      expect(bag.homeInitialLoadPending).assertEqual(false)
      expect(bag.mode).assertEqual('social')
    })

    it('initialises per-mode maps with sensible defaults', 0, () => {
      const bag = new HomeFeedStateBag()

      // Candidate-limit maps should have a positive initial limit for each mode.
      expect(bag.homeCandidateLimitsByMode.articles).assertLarger(0)
      expect(bag.homeCandidateLimitsByMode.social).assertLarger(0)
      expect(bag.homeCandidateLimitsByMode.pictures).assertLarger(0)
      expect(bag.homeCandidateLimitsByMode.videos).assertLarger(0)

      // Visible-entry limits should match candidate limits initially.
      expect(bag.homeVisibleEntryLimits.articles).assertLarger(0)

      // HasMore should default to true per mode.
      expect(bag.homeHasMoreEntriesByMode.articles).assertEqual(true)
      expect(bag.homeHasMoreEntriesByMode.social).assertEqual(true)

      // No-progress counters should start at 0.
      expect(bag.homeModeNoProgressLoadMoreCount.articles).assertEqual(0)
    })

    it('starts with an empty entry group for every mode', 0, () => {
      const bag = new HomeFeedStateBag()
      expect(bag.entryGroups.articles.length).assertEqual(0)
      expect(bag.entryGroups.social.length).assertEqual(0)
      expect(bag.entryGroups.pictures.length).assertEqual(0)
      expect(bag.entryGroups.videos.length).assertEqual(0)
    })

    it('creates an independent HomeScrollIntentTracker', 0, () => {
      const bag = new HomeFeedStateBag()
      expect(bag.homeScrollIntent.isInteracting).assertEqual(false)
      // Mutating the tracker should not affect other bags.
      const bag2 = new HomeFeedStateBag()
      bag.homeScrollIntent.isInteracting = true
      expect(bag2.homeScrollIntent.isInteracting).assertEqual(false)
    })

    // ── FakeHomeFeedActions ──

    it('satisfies the HomeFeedActions interface', 0, () => {
      const state = new HomeFeedStateBag()
      const actions: HomeFeedActions = new FakeHomeFeedActions(state)
      // If the type system accepts this, FakeHomeFeedActions
      // structurally satisfies HomeFeedActions.
      expect(typeof actions.isHomeRootTab).assertEqual('function')
      expect(typeof actions.logHomePerf).assertEqual('function')
      expect(typeof actions.runManagedTimeout).assertEqual('function')
      expect(typeof actions.reloadFeaturedEntriesFromLocal).assertEqual('function')
    })

    it('returns configurable values for query methods', 0, () => {
      const state = new HomeFeedStateBag()
      const actions = new FakeHomeFeedActions(state)

      // Defaults
      expect(actions.isHomeRootTab()).assertEqual(true)
      expect(actions.hasHomeInlineSearchQuery()).assertEqual(false)
      expect(actions.shouldRenderAllEntriesForMode('articles')).assertEqual(false)

      // Override
      actions.homeRootTab = false
      expect(actions.isHomeRootTab()).assertEqual(false)

      actions.inlineSearchActive = true
      expect(actions.hasHomeInlineSearchQuery()).assertEqual(true)

      actions.renderAllEntries = true
      expect(actions.shouldRenderAllEntriesForMode('articles')).assertEqual(true)
    })

    it('delegates filteredEntriesFor to the state bag entry groups', 0, () => {
      const state = new HomeFeedStateBag()
      const actions = new FakeHomeFeedActions(state)

      // All groups start empty — filteredEntriesFor should return 0 for every mode.
      expect(actions.filteredEntriesFor('articles').length).assertEqual(0)
      expect(actions.filteredEntriesFor('social').length).assertEqual(0)
      expect(actions.filteredEntriesFor('pictures').length).assertEqual(0)
      expect(actions.filteredEntriesFor('videos').length).assertEqual(0)
    })

    it('logs calls to the callLog array', 0, () => {
      const state = new HomeFeedStateBag()
      const actions = new FakeHomeFeedActions(state)

      actions.logHomePerf('test')
      actions.logHomeLoadMore('test')
      actions.invalidateHomeLoadMorePrefetch()
      actions.bumpHomeContentVersion()

      expect(actions.callLog).assertContain('logHomePerf')
      expect(actions.callLog).assertContain('logHomeLoadMore')
      expect(actions.callLog).assertContain('invalidateHomeLoadMorePrefetch')
      expect(actions.callLog).assertContain('bumpHomeContentVersion')
    })

    it('runs managed timeout callbacks synchronously', 0, () => {
      const state = new HomeFeedStateBag()
      const actions = new FakeHomeFeedActions(state)
      let called = false

      actions.runManagedTimeout(() => {
        called = true
      }, 5000)

      // Should have been called immediately, not after 5s.
      expect(called).assertEqual(true)
      expect(actions.callLog).assertContain('runManagedTimeout')
    })

    // ── Combined seam — prove a coordinator can be constructed ──

    it('combined state bag + fake actions satisfy HomeFeedState + HomeFeedActions', 0, () => {
      const state: HomeFeedState = new HomeFeedStateBag()
      const actions: HomeFeedActions = new FakeHomeFeedActions(state)

      // Configure state as a real test would
      state.isComponentActive = true
      state.homeInitialLoadPending = false
      state.mode = 'articles'

      // Verify we can read back through the interface references
      expect(state.isComponentActive).assertEqual(true)
      expect(actions.isHomeRootTab()).assertEqual(true)
    })
  })
}
