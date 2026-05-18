import { RootTabId } from '../../navigation/AppRouter'
import { SubscriptionMode } from '../../components/HomeRootConfig'

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
  private readonly owner: IndexHomeScrollerRegistryOwner

  constructor(owner: IndexHomeScrollerRegistryOwner) {
    this.owner = owner
  }

  currentRootBindScrollers(): Scroller[] {
    if (this.owner.activeRootTabId === 'home') {
      return [
        this.articlesScroller,
        this.socialScroller,
        this.picturesScroller,
        this.videosScroller,
      ]
    }
    if (this.owner.activeRootTabId === 'settings' && this.settingsRootScroller) {
      return [this.settingsRootScroller]
    }
    return []
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
    this.owner.settingsScrollerBindingVersion += 1
  }
}
