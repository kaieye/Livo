import { EntryCardModel } from '../models/LivoModels'
import { HEADER_BLUR_SCROLL_RANGE } from '../components/HomeRootConfig'

export interface IndexHomeLoadStateOwner {
  homeInitialLoadPending: boolean
  isHomeStartupRefreshing: boolean
  featuredEntries: EntryCardModel[]
  initialFeedCount: number
  isRefreshing: boolean
  headerBlurProgress: number
}

export class IndexHomeLoadStateGate {
  private readonly owner: IndexHomeLoadStateOwner

  constructor(owner: IndexHomeLoadStateOwner) {
    this.owner = owner
  }

  isHomeContentLoading(): boolean {
    if (this.owner.featuredEntries.length > 0) {
      return false
    }
    return this.owner.homeInitialLoadPending || this.owner.isRefreshing || this.owner.isHomeStartupRefreshing
  }

  settleInitialHomeLoadState(force: boolean = false): void {
    if (!this.owner.homeInitialLoadPending) {
      return
    }
    if (this.owner.isHomeStartupRefreshing) {
      return
    }
    if (this.owner.featuredEntries.length > 0) {
      this.owner.homeInitialLoadPending = false
      return
    }
    if (this.owner.initialFeedCount === 0 && !this.owner.isRefreshing) {
      this.owner.homeInitialLoadPending = false
      return
    }
    if (force && !this.owner.isRefreshing) {
      this.owner.homeInitialLoadPending = false
    }
  }

  homeEmptyStateTitle(): string {
    return this.isHomeContentLoading()
      ? '正在加载订阅内容'
      : '未发现订阅推文，请先到发现页面添加或刷新订阅源'
  }

  updateHeaderBlurProgress(offset: number): void {
    const clampedOffset = Math.max(0, Math.min(offset, HEADER_BLUR_SCROLL_RANGE))
    this.owner.headerBlurProgress = clampedOffset / HEADER_BLUR_SCROLL_RANGE
  }
}
