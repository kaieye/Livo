import { AppRepository } from '../data/AppRepository'
import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'
import { EntryCardModel } from '../models/LivoModels'
import { SubscriptionMode, HomeEntryDataSourceMap, HOME_ENTRY_GROUP_DEFER_DELAY_MS, HOME_FULL_MODE_CANDIDATE_LIMIT } from '../components/HomeRootConfig'
import { HomeEntryGroups, groupHomeEntriesByMode } from './HomeEntryGroups'
import { cloneHomeSnapshotEntry, filterEntriesByMode, resolveEntryMode } from './HomeEntryUtils'

export interface HomeEntryDataDelegate {
  getFeaturedEntries(): EntryCardModel[]
  getEntryGroups(): HomeEntryGroups<EntryCardModel>
  getMode(): SubscriptionMode
  getDataSources(): HomeEntryDataSourceMap
  isComponentActive(): boolean
  setFeaturedEntries(entries: EntryCardModel[]): void
  setEntryGroups(groups: HomeEntryGroups<EntryCardModel>): void
  onEntriesSettled(mode?: SubscriptionMode): void
  resetTweetPresentationCache(): void
  setListSwapAnimating(v: boolean): void
  setListSwapOpacity(v: number): void
  setListSwapTranslateY(v: number): void
  getListSwapToken(): number
  getListSwapAnimating(): boolean
  animateWithUiContext(options: AnimateParam, event: () => void): void
  runManagedTimeout(cb: () => void, delayMs: number): void
}

export class HomeEntryDataManager {
  private readonly delegate: HomeEntryDataDelegate
  private entryGroupVersion: number = 0
  private snapshotPersistVersion: number = 0

  constructor(delegate: HomeEntryDataDelegate) {
    this.delegate = delegate
  }

  applyHomeEntries(nextEntries: EntryCardModel[], deferredGrouping: boolean = true): void {
    this.resetTweetPresentationCache()
    this.delegate.setFeaturedEntries(nextEntries)
    this.schedulePersistSnapshot(nextEntries)
    this.delegate.onEntriesSettled()

    if (!deferredGrouping) {
      this.delegate.setEntryGroups(groupHomeEntriesByMode(nextEntries))
      this.notifyAllReloaded()
      return
    }

    const version = ++this.entryGroupVersion
    this.delegate.runManagedTimeout(() => {
      if (this.entryGroupVersion !== version) {
        return
      }
      this.delegate.setEntryGroups(groupHomeEntriesByMode(nextEntries))
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
    const groups = this.delegate.getEntryGroups()
    this.delegate.setEntryGroups({
      articles: mode === 'articles' ? scopedEntries : groups.articles,
      social: mode === 'social' ? scopedEntries : groups.social,
      pictures: mode === 'pictures' ? scopedEntries : groups.pictures,
      videos: mode === 'videos' ? scopedEntries : groups.videos,
    })
    if (!skipMerge) {
      this.delegate.setFeaturedEntries(this.mergeFeaturedEntriesFromGroups())
    }
    this.delegate.onEntriesSettled(mode)
    if (deferredPersist) {
      this.schedulePersistSnapshot(this.delegate.getFeaturedEntries())
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
    this.resetTweetPresentationCache()
    this.delegate.setFeaturedEntries(nextEntries)
    this.schedulePersistSnapshot(nextEntries)
    const currentModeEntries = nextEntries.filter((e: EntryCardModel) => resolveEntryMode(e) === mode)
    const groups = this.delegate.getEntryGroups()
    this.delegate.setEntryGroups({
      articles: mode === 'articles' ? currentModeEntries : groups.articles,
      social: mode === 'social' ? currentModeEntries : groups.social,
      pictures: mode === 'pictures' ? currentModeEntries : groups.pictures,
      videos: mode === 'videos' ? currentModeEntries : groups.videos,
    })
    this.notifyModeReloaded(mode)

    const version = ++this.entryGroupVersion
    this.delegate.runManagedTimeout(() => {
      if (this.entryGroupVersion !== version || this.delegate.getListSwapToken() !== token) {
        return
      }
      const regrouped = groupHomeEntriesByMode(nextEntries)
      this.delegate.setEntryGroups({
        articles: [...regrouped.articles],
        social: [...regrouped.social],
        pictures: [...regrouped.pictures],
        videos: [...regrouped.videos],
      })
      this.notifyAllReloadedExcept(mode)
    }, HOME_ENTRY_GROUP_DEFER_DELAY_MS)
  }

  mergeFeaturedEntriesFromGroups(): EntryCardModel[] {
    const groups = this.delegate.getEntryGroups()
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
    this.delegate.runManagedTimeout(() => {
      if (this.snapshotPersistVersion !== version) {
        return
      }
      void AppRepository.persistHomeEntrySnapshot(snapshotEntries)
    }, 180)
  }

  persistSnapshotNow(): void {
    const entries = this.delegate.getFeaturedEntries()
    if (entries.length === 0) {
      return
    }
    const snapshotEntries = entries.map((e: EntryCardModel) => cloneHomeSnapshotEntry(e))
    void AppRepository.persistHomeEntrySnapshot(snapshotEntries)
  }

  markEntryReadLocally(target: EntryCardModel): void {
    const targetId = (target.id || '').trim()
    const targetUrl = (target.articleUrl || '').trim()
    const targetFeedId = (target.feedId || '').trim()
    const targetTitle = (target.title || '').trim()

    let updated = false
    const updatedEntries = this.delegate.getFeaturedEntries().map((item: EntryCardModel) => {
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

    this.delegate.setFeaturedEntries(updatedEntries)
    this.schedulePersistSnapshot(updatedEntries)
    const regrouped = groupHomeEntriesByMode(updatedEntries)
    this.delegate.setEntryGroups({
      articles: [...regrouped.articles],
      social: [...regrouped.social],
      pictures: [...regrouped.pictures],
      videos: [...regrouped.videos],
    })
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
    if (!this.delegate.isComponentActive()) {
      this.applyHomeEntries(nextEntries)
      return
    }

    if (this.delegate.getListSwapAnimating() || this.delegate.getFeaturedEntries().length === 0) {
      this.applyHomeEntries(nextEntries)
      this.delegate.setListSwapOpacity(1)
      this.delegate.setListSwapTranslateY(0)
      return
    }

    this.delegate.setListSwapAnimating(true)
    this.applyHomeEntries(nextEntries, false)

    if (!animationEnabled) {
      this.delegate.setListSwapOpacity(1)
      this.delegate.setListSwapTranslateY(0)
      this.delegate.setListSwapAnimating(false)
      return
    }

    this.delegate.setListSwapOpacity(listSwapEntryMinOpacity)
    this.delegate.setListSwapTranslateY(listSwapEntryOffsetY)

    this.delegate.animateWithUiContext({
      duration: listSwapEnterDuration,
      curve: Curve.EaseOut,
      onFinish: () => {
        if (this.delegate.getListSwapToken() !== swapToken) {
          return
        }
        this.delegate.setListSwapOpacity(1)
        this.delegate.setListSwapTranslateY(0)
        this.delegate.setListSwapAnimating(false)
      },
    }, () => {
      this.delegate.setListSwapOpacity(1)
      this.delegate.setListSwapTranslateY(0)
    })
  }

  resetTweetPresentationCache(): void {
    this.delegate.resetTweetPresentationCache()
  }

  notifyAllReloaded(): void {
    const sources = this.delegate.getDataSources()
    sources.articles.notifyDataReloaded()
    sources.social.notifyDataReloaded()
    sources.pictures.notifyDataReloaded()
    sources.videos.notifyDataReloaded()
  }

  notifyModeReloaded(mode: SubscriptionMode): void {
    this.dataSourceFor(mode).notifyDataReloaded()
  }

  notifyAllReloadedExcept(mode: SubscriptionMode): void {
    const sources = this.delegate.getDataSources()
    if (mode !== 'articles') { sources.articles.notifyDataReloaded() }
    if (mode !== 'social') { sources.social.notifyDataReloaded() }
    if (mode !== 'pictures') { sources.pictures.notifyDataReloaded() }
    if (mode !== 'videos') { sources.videos.notifyDataReloaded() }
  }

  private dataSourceFor(mode: SubscriptionMode): ArrayLazyDataSource<EntryCardModel> {
    const sources = this.delegate.getDataSources()
    switch (mode) {
      case 'social': return sources.social
      case 'pictures': return sources.pictures
      case 'videos': return sources.videos
      default: return sources.articles
    }
  }
}
