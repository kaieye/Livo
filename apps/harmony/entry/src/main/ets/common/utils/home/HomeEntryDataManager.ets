import { HomeEntrySnapshotStore } from '../../services/HomeEntrySnapshotStore'
import { ArrayLazyDataSource } from '../../data/ArrayLazyDataSource'
import { EntryCardModel } from '../../models/LivoModels'
import { SubscriptionMode, HomeEntryDataSourceMap, HOME_ENTRY_GROUP_DEFER_DELAY_MS, HOME_FULL_MODE_CANDIDATE_LIMIT } from '../../components/HomeRootConfig'
import { HomeEntryGroups, groupHomeEntriesByMode } from './HomeEntryGroups'
import { cloneHomeSnapshotEntry, filterEntriesByMode } from './HomeEntryUtils'
import { modeOfFeedView, uniqueEntryCardKey } from '../../data/AppRepositoryEntryHelpers'

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
  bumpHomeContentVersion(): void
  logHomeLoadMore(message: string): void
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

  private replaceModeEntriesInPlace(mode: SubscriptionMode, entries: EntryCardModel[]): boolean {
    const groups = this.state.entryGroups
    switch (mode) {
      case 'social':
        groups.social.splice(0, groups.social.length, ...entries)
        return true
      case 'pictures':
        groups.pictures.splice(0, groups.pictures.length, ...entries)
        return true
      case 'videos':
        groups.videos.splice(0, groups.videos.length, ...entries)
        return true
      case 'articles':
        groups.articles.splice(0, groups.articles.length, ...entries)
        return true
      default:
        return false
    }
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
    skipPersist: boolean = false,
  ): void {
    const startedAt = Date.now()
    const scopedEntries = filterEntriesByMode(mode, entries)
    const filteredAt = Date.now()
    const usedInPlaceModeUpdate = skipNotify && skipMerge && skipPersist
    if (usedInPlaceModeUpdate) {
      // 加载更多只依赖 ArrayLazyDataSource 的增量通知刷新列表。
      // 这里原地替换当前栏目数组，避免替换 entryGroups 这个 @State 对象，
      // 否则父级 Index 会重建整棵首页内容树，视频网格追加时会明显卡顿。
      this.replaceModeEntriesInPlace(mode, scopedEntries)
    } else {
      const groups = this.state.entryGroups
      this.state.entryGroups = {
        articles: mode === 'articles' ? scopedEntries : groups.articles,
        social: mode === 'social' ? scopedEntries : groups.social,
        pictures: mode === 'pictures' ? scopedEntries : groups.pictures,
        videos: mode === 'videos' ? scopedEntries : groups.videos,
      }
    }
    if (!skipMerge) {
      this.state.featuredEntries = this.mergeFeaturedEntriesFromGroups()
    }
    const mergedAt = Date.now()
    this.actions.markModeLoaded(mode, true)
    this.actions.settleInitialHomeLoadState()
    if (!skipPersist && !skipMerge) {
      if (deferredPersist) {
        this.schedulePersistSnapshot(this.state.featuredEntries)
      } else {
        this.persistSnapshotNow()
      }
    }
    const persistedAt = Date.now()
    if (!skipNotify) {
      this.notifyModeReloaded(mode)
    }
    this.actions.logHomeLoadMore(
      `applyEntriesForMode mode=${mode} total=${entries.length} scoped=${scopedEntries.length} `
      + `skipNotify=${skipNotify} skipMerge=${skipMerge} skipPersist=${skipPersist} `
      + `inPlace=${usedInPlaceModeUpdate} `
      + `filterMs=${filteredAt - startedAt} mergeMs=${mergedAt - filteredAt} `
      + `persistMs=${persistedAt - mergedAt} totalMs=${Date.now() - startedAt}`,
    )
  }

  applyHomeEntriesForAnimatedMode(
    nextEntries: EntryCardModel[],
    mode: SubscriptionMode,
    token: number,
  ): void {
    this.actions.resetTweetPresentationCache()
    this.state.featuredEntries = nextEntries
    this.schedulePersistSnapshot(nextEntries)
    const currentModeEntries = nextEntries.filter((e: EntryCardModel) => modeOfFeedView(e.view) === mode)
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
    const seen = new Set<string>()
    const deduped: EntryCardModel[] = []
    merged.forEach((entry: EntryCardModel) => {
      const key = uniqueEntryCardKey(entry)
      if (seen.has(key)) {
        return
      }
      seen.add(key)
      deduped.push(entry)
    })
    deduped.sort((a: EntryCardModel, b: EntryCardModel) => (b.publishedAt || 0) - (a.publishedAt || 0))
    return deduped
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
      void HomeEntrySnapshotStore.save(snapshotEntries)
    }, 180)
  }

  persistSnapshotNow(): void {
    const entries = this.state.featuredEntries
    if (entries.length === 0) {
      return
    }
    const snapshotEntries = entries.map((e: EntryCardModel) => cloneHomeSnapshotEntry(e))
    void HomeEntrySnapshotStore.save(snapshotEntries)
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
    this.actions.bumpHomeContentVersion()
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

  notifyAllReloaded(shouldBumpContentVersion: boolean = true): void {
    const sources = this.state.homeEntryDataSources
    sources.articles.notifyDataReloaded()
    sources.social.notifyDataReloaded()
    sources.pictures.notifyDataReloaded()
    sources.videos.notifyDataReloaded()
    if (shouldBumpContentVersion) {
      this.actions.bumpHomeContentVersion()
    }
  }

  notifyModeReloaded(mode: SubscriptionMode, shouldBumpContentVersion: boolean = false): void {
    this.dataSourceFor(mode).notifyDataReloaded()
    if (shouldBumpContentVersion) {
      this.actions.bumpHomeContentVersion()
    }
  }

  notifyModeAppended(mode: SubscriptionMode, startIndex: number): void {
    const startedAt = Date.now()
    this.dataSourceFor(mode).notifyDataAdded(startIndex)
    const elapsedMs = Date.now() - startedAt
    console.info(
      `[LIVO-PERF] notifyDataAdded mode=${mode} startIndex=${startIndex} elapsedMs=${elapsedMs}`,
    )
    this.actions.logHomeLoadMore(
      `notifyModeAppended mode=${mode} startIndex=${startIndex} elapsedMs=${elapsedMs}`,
    )
  }

  notifyAllReloadedExcept(mode: SubscriptionMode, shouldBumpContentVersion: boolean = true): void {
    const sources = this.state.homeEntryDataSources
    if (mode !== 'articles') { sources.articles.notifyDataReloaded() }
    if (mode !== 'social') { sources.social.notifyDataReloaded() }
    if (mode !== 'pictures') { sources.pictures.notifyDataReloaded() }
    if (mode !== 'videos') { sources.videos.notifyDataReloaded() }
    if (shouldBumpContentVersion) {
      this.actions.bumpHomeContentVersion()
    }
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
