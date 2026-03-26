import router from '@ohos.router'
import { ThemePalette, ThemeService } from '../services/ThemeService'

export type RootTabId = 'home' | 'subscriptions' | 'discover' | 'settings'

interface TabDefinition {
  id: RootTabId
  label: string
  route: string
}

const ROOT_TABS: TabDefinition[] = [
  { id: 'home', label: '首页', route: 'pages/Index' },
  { id: 'subscriptions', label: '订阅', route: 'pages/Subscriptions' },
  { id: 'discover', label: '发现', route: 'pages/Discover' },
  { id: 'settings', label: '设置', route: 'pages/Settings' },
]

@Component
export struct BottomTabs {
  @Prop activeTab: RootTabId = 'home'
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  private isActive(tabId: RootTabId): boolean {
    return this.activeTab === tabId
  }

  private labelColor(tabId: RootTabId): string {
    return this.isActive(tabId) ? this.theme.accent : this.theme.tabBarInactive
  }

  private iconColor(tabId: RootTabId): string {
    return this.isActive(tabId) ? this.theme.accent : this.theme.tabBarInactive
  }

  private async navigate(route: string, tabId: RootTabId): Promise<void> {
    if (this.activeTab === tabId) {
      return
    }

    try {
      await router.replaceUrl({ url: route })
    } catch (_) {
      try {
        await router.pushUrl({ url: route })
      } catch (_) {
      }
    }
  }

  @Builder
  private HomeIcon(tabId: RootTabId) {
    Column({ space: 0 }) {
      Row()
        .width(16)
        .height(8)
        .backgroundColor(this.iconColor(tabId))
        .borderRadius({ topLeft: 999, topRight: 999, bottomLeft: 4, bottomRight: 4 })

      Row()
        .width(20)
        .height(12)
        .backgroundColor(this.iconColor(tabId))
        .borderRadius(5)
        .margin({ top: -1 })
    }
    .width(24)
    .height(24)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }

  @Builder
  private BagIcon(tabId: RootTabId) {
    Stack({ alignContent: Alignment.Center }) {
      Column({ space: 0 }) {
        Row()
          .width(14)
          .height(5)
          .border({
            width: 2,
            color: this.iconColor(tabId),
          })
          .borderRadius({ topLeft: 999, topRight: 999, bottomLeft: 0, bottomRight: 0 })

        Row()
          .width(20)
          .height(14)
          .border({ width: 2, color: this.iconColor(tabId) })
          .borderRadius(5)
          .margin({ top: -1 })
      }
    }
    .width(24)
    .height(24)
  }

  @Builder
  private SearchIcon(tabId: RootTabId) {
    Stack({ alignContent: Alignment.Center }) {
      Row()
        .width(16)
        .height(16)
        .borderRadius(999)
        .border({ width: 2, color: this.iconColor(tabId) })
        .margin({ left: -4, top: -4 })

      Row()
        .width(8)
        .height(2.5)
        .borderRadius(999)
        .backgroundColor(this.iconColor(tabId))
        .rotate({ angle: 45 })
        .margin({ left: 8, top: 8 })
    }
    .width(24)
    .height(24)
  }

  @Builder
  private SettingsIcon(tabId: RootTabId) {
    Stack({ alignContent: Alignment.Center }) {
      Row()
        .width(18)
        .height(18)
        .borderRadius(999)
        .border({ width: 2, color: this.iconColor(tabId) })

      Row()
        .width(6)
        .height(6)
        .borderRadius(999)
        .backgroundColor(this.iconColor(tabId))
    }
    .width(24)
    .height(24)
  }

  @Builder
  private Icon(tabId: RootTabId) {
    if (tabId === 'home') {
      this.HomeIcon(tabId)
    } else if (tabId === 'subscriptions') {
      this.BagIcon(tabId)
    } else if (tabId === 'discover') {
      this.SearchIcon(tabId)
    } else {
      this.SettingsIcon(tabId)
    }
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Row()
        .width('94%')
        .height(64)
        .backgroundColor(this.theme.tabBarBackground)
        .backdropBlur(24)
        .borderRadius(999)
        .border({ width: 0.6, color: this.theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' })
        .shadow({
          radius: 14,
          color: this.theme.isDark ? 'rgba(0, 0, 0, 0.30)' : 'rgba(15, 23, 42, 0.16)',
          offsetX: 0,
          offsetY: 6,
        })

      Column() {
        Row({ space: 0 }) {
          ForEach(ROOT_TABS, (tab: TabDefinition) => {
            Column({ space: 3 }) {
              this.Icon(tab.id)

              Text(tab.label)
                .fontSize(11)
                .fontWeight(this.isActive(tab.id) ? FontWeight.Medium : FontWeight.Regular)
                .fontColor(this.labelColor(tab.id))
            }
            .width('25%')
            .height(42)
            .justifyContent(FlexAlign.Center)
            .alignItems(HorizontalAlign.Center)
            .clickEffect({ level: ClickEffectLevel.LIGHT })
            .onClick(() => { void this.navigate(tab.route, tab.id) })
          }, (tab: TabDefinition) => tab.id)
        }
        .width('100%')
      }
      .width('100%')
      .padding({ left: 14, right: 14, top: 8, bottom: 8 })
    }
    .width('100%')
    .padding({ bottom: 12 })
  }
}
