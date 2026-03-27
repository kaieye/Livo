import { ROOT_TABS, RootTabId, RootTabDefinition, openRootTab } from '../navigation/AppRouter'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import {
  BOTTOM_TAB_BAR_HEIGHT,
  BOTTOM_TAB_FLOAT_GAP,
  BOTTOM_TAB_BAR_WIDTH,
  BOTTOM_TAB_ITEM_HEIGHT,
  BOTTOM_TAB_LABEL_SIZE,
  BOTTOM_TAB_TOTAL_HEIGHT,
  CHIP_RADIUS,
} from '../ui/UiTokens'

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
      return -2
    }

    return 0
  }

  private itemOpacity(tabId: RootTabId): number {
    return this.isActive(tabId) ? 1 : 0.94
  }

  private itemScale(tabId: RootTabId): number {
    if (this.pressedTabId === tabId) {
      return 0.985
    }

    return 1
  }

  private dockBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.94)'
  }

  private dockShadowColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.25)'
  }

  private dockBackgroundColor(): string {
    return this.theme.isDark ? 'rgba(20,22,28,0.85)' : 'rgba(255,255,255,0.85)'
  }

  private labelWeight(tabId: RootTabId): number {
    return this.isActive(tabId) ? FontWeight.Medium : FontWeight.Regular
  }

  private itemBackgroundColor(tabId: RootTabId): string {
    if (!this.isActive(tabId)) {
      return 'rgba(0,0,0,0)'
    }

    return this.theme.isDark ? 'rgba(118,162,255,0.10)' : 'rgba(47,107,255,0.08)'
  }

  private itemBorderColor(tabId: RootTabId): string {
    if (!this.isActive(tabId)) {
      return 'rgba(0,0,0,0)'
    }

    return this.theme.isDark ? 'rgba(118,162,255,0.18)' : 'rgba(47,107,255,0.12)'
  }

  private itemShadowColor(tabId: RootTabId): string {
    if (!this.isActive(tabId)) {
      return 'rgba(0,0,0,0)'
    }

    return 'rgba(0,0,0,0)'
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
    Row()
      .width(BOTTOM_TAB_BAR_WIDTH)
      .height(BOTTOM_TAB_BAR_HEIGHT)
      .backgroundColor(this.dockBackgroundColor())
      .backdropBlur(this.theme.isDark ? 10 : 18)
      .borderRadius(CHIP_RADIUS)
      .border({ width: 0.6, color: this.dockBorderColor() })
      .shadow({
        radius: 10,
        color: this.dockShadowColor(),
        offsetX: 0,
        offsetY: 2,
      })
  }

  @Builder
  private TabButton(tab: RootTabDefinition) {
    Column({ space: 3 }) {
      Stack({ alignContent: Alignment.Center }) {
        Row()
          .width(36)
          .height(26)
          .borderRadius(CHIP_RADIUS)
          .backgroundColor(this.itemBackgroundColor(tab.id))
          .border({ width: this.isActive(tab.id) ? 0.6 : 0, color: this.itemBorderColor(tab.id) })
          .shadow({
            radius: 0,
            color: this.itemShadowColor(tab.id),
            offsetX: 0,
            offsetY: 0,
          })
          .animation({ duration: 140, curve: Curve.EaseOut })

        this.Icon(tab.id)
      }
      .width(36)
      .height(26)

      Text(tab.label)
        .fontSize(BOTTOM_TAB_LABEL_SIZE)
        .fontWeight(this.labelWeight(tab.id))
        .fontColor(this.labelColor(tab.id))
        .animation({ duration: 140, curve: Curve.EaseOut })
    }
    .alignItems(HorizontalAlign.Center)
    .justifyContent(FlexAlign.Start)
    .width(this.itemWidth())
    .height(BOTTOM_TAB_ITEM_HEIGHT)
    .padding({ top: 9, bottom: 2 })
    .scale({ x: this.itemScale(tab.id), y: this.itemScale(tab.id) })
    .translate({ y: this.itemOffset(tab.id) })
    .opacity(this.itemOpacity(tab.id))
    .animation({ duration: 140, curve: Curve.EaseOut })
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

      Row({ space: 0 }) {
        ForEach(ROOT_TABS, (tab: RootTabDefinition) => {
          this.TabButton(tab)
        }, (tab: RootTabDefinition) => tab.id)
      }
      .width(BOTTOM_TAB_BAR_WIDTH)
      .height(BOTTOM_TAB_BAR_HEIGHT)
      .padding({ left: 2, right: 2 })
    }
    .width('100%')
    .height(this.containerHeight())
    .padding({ bottom: BOTTOM_TAB_FLOAT_GAP + this.bottomAvoidArea })
    .backgroundColor(Color.Transparent)
  }
}
