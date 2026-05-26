import { RootTabId } from '../../navigation/AppRouter'
import { SubscriptionMode } from '../../config/HomeRootConfig'

export interface IndexHomeScrollerRegistryOwner {
  activeRootTabId: RootTabId
  settingsScrollerBindingVersion: number
}

export class IndexHomeScrollerRegistry {
  readonly articlesScroller: Scroller = new Scroller()
  readonly socialScroller: Scroller = new Scroller()
  readonly picturesScroller: Scroller = new Scroller()
  readonly videosScroller: Scroller = new Scroller()
  private settingsRootScroller?: Scroller
  // 提前固化 home / empty / settings 的绑定数组实例:Index.build() 每帧都会把
  // currentRootBindScrollers() 透传给 IndexRootNavigationShell.bindScrollers (@Prop)。
  // 之前函数每次返回新数组字面量,@Prop 比较恒认为变更,触发 Shell partial rebuild。
  // 现在按 tab 复用同一数组实例,数组引用稳定,Shell 不再被滚动事件击穿。
  private readonly homeBindScrollers: Scroller[]
  private readonly emptyBindScrollers: Scroller[] = []
  private settingsBindScrollers: Scroller[] | undefined
  private readonly owner: IndexHomeScrollerRegistryOwner

  constructor(owner: IndexHomeScrollerRegistryOwner) {
    this.owner = owner
    this.homeBindScrollers = [
      this.articlesScroller,
      this.socialScroller,
      this.picturesScroller,
      this.videosScroller,
    ]
  }

  currentRootBindScrollers(): Scroller[] {
    if (this.owner.activeRootTabId === 'home') {
      return this.homeBindScrollers
    }
    if (this.owner.activeRootTabId === 'settings' && this.settingsBindScrollers) {
      return this.settingsBindScrollers
    }
    return this.emptyBindScrollers
  }

  homeScrollerForMode(mode: SubscriptionMode): Scroller {
    switch (mode) {
      case 'social':
        return this.socialScroller
      case 'pictures':
        return this.picturesScroller
      case 'videos':
        return this.videosScroller
      default:
        return this.articlesScroller
    }
  }

  handleSettingsContentScrollerReady(scroller: Scroller): void {
    if (this.settingsRootScroller === scroller) {
      return
    }
    this.settingsRootScroller = scroller
    this.settingsBindScrollers = [scroller]
    this.owner.settingsScrollerBindingVersion += 1
  }
}
