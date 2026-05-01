import { Entry, EntryCardModel } from '../models/LivoModels'
import { IndexHomeRootContentCallbacks } from '../components/IndexHomeRootContent'
import { SubscriptionMode } from '../components/HomeRootConfig'
import { TweetEntryPresentation } from './TweetEntryPresentation'

export interface IndexHomeRootContentCallbacksOwner {
  handleModeSwipe(event: GestureEvent): void
  visibleEntriesFor(mode: SubscriptionMode): EntryCardModel[]
  totalEntryCountFor(mode: SubscriptionMode): number
  isModeLoading(mode: SubscriptionMode): boolean
  homeEmptyStateTitle(): string
  modeSceneOpacity(mode: SubscriptionMode): number
  modeSceneOffset(mode: SubscriptionMode): number
  modeSceneZIndex(mode: SubscriptionMode): number
  modeSceneVisible(mode: SubscriptionMode): Visibility
  modeListSwapTranslateY(mode: SubscriptionMode): number
  homeScrollerForMode(mode: SubscriptionMode): Scroller
  markHomeUserScrollIntent(mode: SubscriptionMode, scrollSource: ScrollSource): void
  syncHomeModeRailState(mode?: SubscriptionMode): void
  flushPendingLoadMoreForMode(mode: SubscriptionMode): void
  setHomeScrollInteracting(interacting: boolean, mode: SubscriptionMode): void
  openEntry(entry: EntryCardModel): void
  handleHomeEntryAppear(mode: SubscriptionMode, index: number, totalCount: number): void
  presentTweetEntry(entry: EntryCardModel): TweetEntryPresentation
  pictureCardEntry(entry: EntryCardModel): Entry
  pictureCaption(entry: EntryCardModel): string
  pictureGalleryUrls(entry: EntryCardModel): string[]
}

export function createIndexHomeRootContentCallbacks(
  owner: IndexHomeRootContentCallbacksOwner,
): IndexHomeRootContentCallbacks {
  return {
    onModeSwipe: (event: GestureEvent): void => {
      owner.handleModeSwipe(event)
    },
    getEntries: (mode: SubscriptionMode): EntryCardModel[] => owner.visibleEntriesFor(mode),
    getTotalCount: (mode: SubscriptionMode): number => owner.totalEntryCountFor(mode),
    isModeLoading: (mode: SubscriptionMode): boolean => owner.isModeLoading(mode),
    getEmptyStateTitle: (): string => owner.homeEmptyStateTitle(),
    getSceneOpacity: (mode: SubscriptionMode): number => owner.modeSceneOpacity(mode),
    getSceneOffsetX: (mode: SubscriptionMode): number => owner.modeSceneOffset(mode),
    getSceneZIndex: (mode: SubscriptionMode): number => owner.modeSceneZIndex(mode),
    getSceneVisible: (mode: SubscriptionMode): Visibility => owner.modeSceneVisible(mode),
    getListSwapTranslateY: (mode: SubscriptionMode): number => owner.modeListSwapTranslateY(mode),
    getScroller: (mode: SubscriptionMode): Scroller => owner.homeScrollerForMode(mode),
    onWillScroll: (mode: SubscriptionMode, _scrollOffset: number, scrollSource: ScrollSource): ScrollResult | void => {
      owner.markHomeUserScrollIntent(mode, scrollSource)
      return undefined
    },
    onDidScroll: (mode: SubscriptionMode): void => {
      owner.syncHomeModeRailState(mode)
      owner.flushPendingLoadMoreForMode(mode)
    },
    onStopDragging: (mode: SubscriptionMode): void => {
      owner.setHomeScrollInteracting(false, mode)
      owner.flushPendingLoadMoreForMode(mode)
    },
    onEntryOpen: (entry: EntryCardModel): void => {
      owner.openEntry(entry)
    },
    onItemAppear: (mode: SubscriptionMode, index: number, totalCount: number): void => {
      owner.handleHomeEntryAppear(mode, index, totalCount)
    },
    getTweetPresentation: (entry: EntryCardModel): TweetEntryPresentation => owner.presentTweetEntry(entry),
    getPictureEntry: (entry: EntryCardModel): Entry => owner.pictureCardEntry(entry),
    getPictureCaption: (entry: EntryCardModel): string => owner.pictureCaption(entry),
    getPictureGalleryUrls: (entry: EntryCardModel): string[] => owner.pictureGalleryUrls(entry),
  }
}
