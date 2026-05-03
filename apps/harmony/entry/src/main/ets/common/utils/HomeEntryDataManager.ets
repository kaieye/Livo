import { AppPreferenceService } from '../services/AppPreferenceService'
import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'
import { EntryCardModel } from '../models/LivoModels'
import { SubscriptionMode, HomeEntryDataSourceMap, HOME_ENTRY_GROUP_DEFER_DELAY_MS, HOME_FULL_MODE_CANDIDATE_LIMIT } from '../components/HomeRootConfig'
import { HomeEntryGroups, groupHomeEntriesByMode } from './HomeEntryGroups'
import { cloneHomeSnapshotEntry, filterEntriesByMode, resolveEntryMode } from './HomeEntryUtils'

export interface HomeEntryDataState {
  featuredEntries: EntryCardModel[]
  entryGroups: HomeEntryGroups<EntryCardModel>
  mode: SubscriptionMode
  homeEntryDataSources: HomeEntryDataSourceMap
  isComponentActive: boolean
  homeListSwapOpacity: number
  homeListSwapTranslateY: number
  homeListSwapAnimating: boolean
  homeListSwapToken: number
}

export interface HomeEntryDataActions {
  markModeLoaded(mode: SubscriptionMode, loaded: boolean): void
  settleInitialHomeLoadState(force?: boolean): void
  resetTweetPresentationCache(): void
  animateWithUiContext(options: AnimateParam, event: () => void): void
  runManagedTimeout(callback: () => void, delayMs: number): void
}

export class HomeEntryDataManager {
  private readonly state: HomeEntryDataState
  private readonly actions: HomeEntryDataActions
  private entryGroupVersion: number = 0
  private snapshotPersistVersion: number = 0

  constructor(state: HomeEntryDataState, actions: HomeEntryDataActions) {
    this.state = state
    this.actions = actions
  }

  applyHomeEntries(nextEntries: EntryCardModel[], deferredGrouping: boolean = true): void {
    this.actions.resetTweetPresentationCache()
    this.state.featuredEntries = nextEntries
    this.schedulePersistSnapshot(nextEntries)
    this.actions.markModeLoaded(this.state.mode, true)
    this.actions.settleInitialHomeLoadState()

    if (!deferredGrouping) {
      this.state.entryGroups = groupHomeEntriesByMode(nextEntries)
      this.notifyAllReloaded()
      return
    }

    const version = ++this.entryGroupVersion
    this.actions.runManagedTimeout(() => {
      if (this.entryGroupVersion !== version) {
        return
      }
      this.state.entryGroups = groupHomeEntriesByMode(nextEntries)
      this.notifyAllReloaded()
    }, HOME_ENTRY_GROUP_DEFER_DELAY_MS)
  }

  applyEntriesForMode(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    deferredPersist: boolean,
    skipNotify: boolean = false,
    skipMerge: boolean = false,
  ): void {
    const scopedEntries = filterEntriesByMode(mode, entries)
    const groups = this.state.entryGroups
    this.state.entryGroups = {
      articles: mode === 'articles' ? scopedEntries : groups.articles,
      social: mode === 'social' ? scopedEntries : groups.social,
      pictures: mode === 'pictures' ? scopedEntries : groups.pictures,
      videos: mode === 'videos' ? scopedEntries : groups.videos,
    }
    if (!skipMerge) {
      this.state.featuredEntries = this.mergeFeaturedEntriesFromGroups()
    }
    this.actions.markModeLoaded(mode, true)
    this.actions.settleInitialHomeLoadState()
    if (deferredPersist) {
      this.schedulePersistSnapshot(this.state.featuredEntries)
    } else {
      this.persistSnapshotNow()
    }
    if (!skipNotify) {
      this.notifyModeReloaded(mode)
    }
  }

  applyHomeEntriesForAnimatedMode(
    nextEntries: EntryCardModel[],
    mode: SubscriptionMode,
    token: number,
  ): void {
    this.actions.resetTweetPresentationCache()
    this.state.featuredEntries = nextEntries
    this.schedulePersistSnapshot(nextEntries)
    const currentModeEntries = nextEntries.filter((e: EntryCardModel) => resolveEntryMode(e) === mode)
    const groups = this.state.entryGroups
    this.state.entryGroups = {
      articles: mode === 'articles' ? currentModeEntries : groups.articles,
      social: mode === 'social' ? currentModeEntries : groups.social,
      pictures: mode === 'pictures' ? currentModeEntries : groups.pictures,
      videos: mode === 'videos' ? currentModeEntries : groups.videos,
    }
    this.notifyModeReloaded(mode)

    const version = ++this.entryGroupVersion
    this.actions.runManagedTimeout(() => {
      if (this.entryGroupVersion !== version || this.state.homeListSwapToken !== token) {
        return
      }
      const regrouped = groupHomeEntriesByMode(nextEntries)
      this.state.entryGroups = {
        articles: [...regrouped.articles],
        social: [...regrouped.social],
        pictures: [...regrouped.pictures],
        videos: [...regrouped.videos],
      }
      this.notifyAllReloadedExcept(mode)
    }, HOME_ENTRY_GROUP_DEFER_DELAY_MS)
  }

  mergeFeaturedEntriesFromGroups(): EntryCardModel[] {
    const groups = this.state.entryGroups
    const merged = [
      ...groups.articles,
      ...groups.social,
      ...groups.pictures,
      ...groups.videos,
    ]
    merged.sort((a: EntryCardModel, b: EntryCardModel) => (b.publishedAt || 0) - (a.publishedAt || 0))
    return merged
  }

  schedulePersistSnapshot(entries: EntryCardModel[]): void {
    if (entries.length === 0) {
      return
    }
    const snapshotEntries = entries.map((e: EntryCardModel) => cloneHomeSnapshotEntry(e))
    const version = ++this.snapshotPersistVersion
    this.actions.runManagedTimeout(() => {
      if (this.snapshotPersistVersion !== version) {
        return
      }
      void AppPreferenceService.saveHomeEntrySnapshot(snapshotEntries)
    }, 180)
  }

  persistSnapshotNow(): void {
    const entries = this.state.featuredEntries
    if (entries.length === 0) {
      return
    }
    const snapshotEntries = entries.map((e: EntryCardModel) => cloneHomeSnapshotEntry(e))
    void AppPreferenceService.saveHomeEntrySnapshot(snapshotEntries)
  }

  markEntryReadLocally(target: EntryCardModel): void {
    const targetId = (target.id || '').trim()
    const targetUrl = (target.articleUrl || '').trim()
    const targetFeedId = (target.feedId || '').trim()
    const targetTitle = (target.title || '').trim()

    let updated = false
    const updatedEntries = this.state.featuredEntries.map((item: EntryCardModel) => {
      if (item.isRead) {
        return item
      }
      const matchById = !!targetId && (item.id || '').trim() === targetId
      const matchByUrl = !targetId && !!targetUrl && (item.articleUrl || '').trim() === targetUrl
      const matchBySnapshot = !targetId && !targetUrl
        && !!targetFeedId
        && (item.feedId || '').trim() === targetFeedId
        && item.publishedAt === target.publishedAt
        && (item.title || '').trim() === targetTitle

      if (!matchById && !matchByUrl && !matchBySnapshot) {
        return item
      }
      updated = true
      const nextItem: EntryCardModel = cloneHomeSnapshotEntry(item)
      nextItem.isRead = true
      return nextItem
    })

    if (!updated) {
      return
    }

    this.state.featuredEntries = updatedEntries
    this.schedulePersistSnapshot(updatedEntries)
    const regrouped = groupHomeEntriesByMode(updatedEntries)
    this.state.entryGroups = {
      articles: [...regrouped.articles],
      social: [...regrouped.social],
      pictures: [...regrouped.pictures],
      videos: [...regrouped.videos],
    }
  }

  playListSwapTransition(
    nextEntries: EntryCardModel[],
    mode: SubscriptionMode,
    swapToken: number,
    listSwapEntryMinOpacity: number,
    listSwapEntryOffsetY: number,
    listSwapEnterDuration: number,
    animationEnabled: boolean,
  ): void {
    if (!this.state.isComponentActive) {
      this.applyHomeEntries(nextEntries)
      return
    }

    if (this.state.homeListSwapAnimating || this.state.featuredEntries.length === 0) {
      this.applyHomeEntries(nextEntries)
      this.state.homeListSwapOpacity = 1
      this.state.homeListSwapTranslateY = 0
      return
    }

    this.state.homeListSwapAnimating = true
    this.applyHomeEntries(nextEntries, false)

    if (!animationEnabled) {
      this.state.homeListSwapOpacity = 1
      this.state.homeListSwapTranslateY = 0
      this.state.homeListSwapAnimating = false
      return
    }

    this.state.homeListSwapOpacity = listSwapEntryMinOpacity
    this.state.homeListSwapTranslateY = listSwapEntryOffsetY

    this.actions.animateWithUiContext({
      duration: listSwapEnterDuration,
      curve: Curve.EaseOut,
      onFinish: () => {
        if (this.state.homeListSwapToken !== swapToken) {
          return
        }
        this.state.homeListSwapOpacity = 1
        this.state.homeListSwapTranslateY = 0
        this.state.homeListSwapAnimating = false
      },
    }, () => {
      this.state.homeListSwapOpacity = 1
      this.state.homeListSwapTranslateY = 0
    })
  }

  notifyAllReloaded(): void {
    const sources = this.state.homeEntryDataSources
    sources.articles.notifyDataReloaded()
    sources.social.notifyDataReloaded()
    sources.pictures.notifyDataReloaded()
    sources.videos.notifyDataReloaded()
  }

  notifyModeReloaded(mode: SubscriptionMode): void {
    this.dataSourceFor(mode).notifyDataReloaded()
  }

  notifyAllReloadedExcept(mode: SubscriptionMode): void {
    const sources = this.state.homeEntryDataSources
    if (mode !== 'articles') { sources.articles.notifyDataReloaded() }
    if (mode !== 'social') { sources.social.notifyDataReloaded() }
    if (mode !== 'pictures') { sources.pictures.notifyDataReloaded() }
    if (mode !== 'videos') { sources.videos.notifyDataReloaded() }
  }

  private dataSourceFor(mode: SubscriptionMode): ArrayLazyDataSource<EntryCardModel> {
    const sources = this.state.homeEntryDataSources
    switch (mode) {
      case 'social': return sources.social
      case 'pictures': return sources.pictures
      case 'videos': return sources.videos
      default: return sources.articles
    }
  }
}
