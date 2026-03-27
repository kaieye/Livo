import { ROOT_TABS, RootTabId, RootTabDefinition, openRootTab, rootTabIndexForId } from '../navigation/AppRouter'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import {
  BOTTOM_TAB_BAR_HEIGHT,
  BOTTOM_TAB_FLOAT_GAP,
  BOTTOM_TAB_BAR_WIDTH,
  BOTTOM_TAB_ITEM_HEIGHT,
  BOTTOM_TAB_LABEL_SIZE,
  BOTTOM_TAB_TOTAL_HEIGHT,
  CHIP_RADIUS,
} from '../ui/UiTokens'

export const rootTabsController: TabsController = new TabsController()

@Component
export struct BottomTabs {
  @Prop activeTab: RootTabId = 'home'
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop useTabsController: boolean = false
  @StorageProp('bottomAvoidArea') bottomAvoidArea: number = 0
  @State pressedTabId: RootTabId | '' = ''
  onTabRequest: (tabId: RootTabId) => void = () => {}

  private isActive(tabId: RootTabId): boolean {
    return this.activeTab === tabId
  }

  private itemWidth(): string {
    return `${100 / ROOT_TABS.length}%`
  }

  private containerHeight(): number {
    return BOTTOM_TAB_TOTAL_HEIGHT + this.bottomAvoidArea
  }

  private labelColor(tabId: RootTabId): string {
    return this.isActive(tabId) ? this.activeColor() : this.inactiveColor()
  }

  private iconColor(tabId: RootTabId): string {
    return this.isActive(tabId) ? this.activeColor() : this.inactiveColor()
  }

  private activeColor(): string {
    return this.theme.isDark ? '#76A2FF' : '#2F6BFF'
  }

  private inactiveColor(): string {
    return this.theme.isDark ? '#A3A8B3' : '#9B9BA1'
  }

  private itemOffset(tabId: RootTabId): number {
    if (this.isActive(tabId)) {
      return -3
    }

    return 0
  }

  private itemOpacity(tabId: RootTabId): number {
    return this.isActive(tabId) ? 1 : 0.88
  }

  private itemScale(tabId: RootTabId): number {
    if (this.pressedTabId === tabId) {
      return 0.98
    }

    return 1
  }

  private dockBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.96)'
  }

  private dockShadowColor(): string {
    return this.theme.isDark ? 'rgba(0,0,0,0.28)' : 'rgba(15,23,42,0.1)'
  }

  private dockHighlightColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)'
  }

  private dockBackgroundColor(): string {
    return this.theme.isDark ? 'rgba(20,22,28,0.96)' : 'rgba(255,255,255,0.96)'
  }

  private labelWeight(tabId: RootTabId): number {
    return this.isActive(tabId) ? FontWeight.Medium : FontWeight.Regular
  }

  private tabIcon(tabId: RootTabId): Resource {
    if (tabId === 'home') {
      return this.isActive(tabId) ? $r('app.media.nav_home_active') : $r('app.media.nav_home_inactive')
    }
    if (tabId === 'subscriptions') {
      return this.isActive(tabId) ? $r('app.media.nav_subscriptions_active') : $r('app.media.nav_subscriptions_inactive')
    }
    if (tabId === 'discover') {
      return this.isActive(tabId) ? $r('app.media.nav_discover_active') : $r('app.media.nav_discover_inactive')
    }
    return this.isActive(tabId) ? $r('app.media.nav_settings_active') : $r('app.media.nav_settings_inactive')
  }

  private async navigate(tabId: RootTabId): Promise<void> {
    if (this.activeTab === tabId) {
      return
    }

    if (this.useTabsController) {
      this.onTabRequest(tabId)
      return
    }

    try {
      await openRootTab(tabId, true)
    } catch (_) {
      try {
        await openRootTab(tabId, false)
      } catch (_) {
      }
    }
  }

  @Builder
  private Icon(tabId: RootTabId) {
    Image(this.tabIcon(tabId))
      .width(24)
      .height(24)
      .objectFit(ImageFit.Contain)
      .animation({ duration: 160, curve: Curve.EaseOut })
  }

  @Builder
  private DockShell() {
    Stack({ alignContent: Alignment.Top }) {
      Row()
        .width(BOTTOM_TAB_BAR_WIDTH)
        .height(BOTTOM_TAB_BAR_HEIGHT)
        .backgroundColor(this.dockBackgroundColor())
        .backdropBlur(this.theme.isDark ? 10 : 20)
        .borderRadius(CHIP_RADIUS)
        .offset({ x: 0, y: 4 })
        .border({ width: 0.6, color: this.dockBorderColor() })
        .shadow({
          radius: 20,
          color: this.dockShadowColor(),
          offsetX: 0,
          offsetY: 8,
        })
        .transition(livoMotion.enterFromBottom())

      Row()
        .width('32%')
        .height(1.5)
        .borderRadius(CHIP_RADIUS)
        .backgroundColor(this.dockHighlightColor())
        .margin({ top: 11 })
        .opacity(this.theme.isDark ? 0.45 : 0.95)
    }
    .width('100%')
    .height(BOTTOM_TAB_TOTAL_HEIGHT)
  }

  @Builder
  private TabButton(tab: RootTabDefinition) {
    Column({ space: 3 }) {
      Stack({ alignContent: Alignment.Center }) {
        this.Icon(tab.id)
      }
      .width(28)
      .height(28)

      Text(tab.label)
        .fontSize(BOTTOM_TAB_LABEL_SIZE)
        .fontWeight(this.labelWeight(tab.id))
        .fontColor(this.labelColor(tab.id))
        .animation({ duration: 160, curve: Curve.EaseOut })
    }
    .alignItems(HorizontalAlign.Center)
    .justifyContent(FlexAlign.Center)
    .width(this.itemWidth())
    .height(BOTTOM_TAB_ITEM_HEIGHT)
    .scale({ x: this.itemScale(tab.id), y: this.itemScale(tab.id) })
    .translate({ y: this.itemOffset(tab.id) })
    .opacity(this.itemOpacity(tab.id))
    .animation({ duration: 160, curve: Curve.EaseOut })
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onTouch((event: TouchEvent) => {
      if (event.type === TouchType.Down) {
        this.pressedTabId = tab.id
        return
      }

      if (event.type === TouchType.Up || event.type === TouchType.Cancel) {
        if (this.pressedTabId === tab.id) {
          this.pressedTabId = ''
        }
      }
    })
    .onClick(() => {
      void this.navigate(tab.id)
    })
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      this.DockShell()

      Column() {
        Row({ space: 0 }) {
          ForEach(ROOT_TABS, (tab: RootTabDefinition) => {
            this.TabButton(tab)
          }, (tab: RootTabDefinition) => tab.id)
        }
        .width('100%')
      }
      .width('100%')
      .padding({ left: 18, right: 18, top: 8, bottom: BOTTOM_TAB_FLOAT_GAP + 8 + this.bottomAvoidArea })
    }
    .width('100%')
    .height(this.containerHeight())
    .backgroundColor(Color.Transparent)
  }
}
