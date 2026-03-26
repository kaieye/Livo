import { AppRepository } from '../common/data/AppRepository'
import { BottomTabs } from '../common/components/BottomTabs'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings, ThemeMode } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'

interface SettingItem {
  title: string
  icon: string
  color: string
}

const PRIMARY_GROUP: SettingItem[] = [
  { title: '通用', icon: '◎', color: '#FF4571' },
  { title: '外观', icon: '◔', color: '#8B5CF6' },
  { title: '数据控制', icon: '◫', color: '#3B82F6' },
  { title: '账户', icon: '◉', color: '#FF7A1A' },
]

const SECOND_GROUP: SettingItem[] = [
  { title: '自动化', icon: '✦', color: '#9333EA' },
  { title: '列表', icon: '◌', color: '#0EA5E9' },
]

const THIRD_GROUP: SettingItem[] = [
  { title: '订阅', icon: '◍', color: '#FF7A1A' },
]

const FOURTH_GROUP: SettingItem[] = [
  { title: '隐私', icon: '◈', color: '#6366F1' },
  { title: '关于', icon: '⬢', color: '#FBBF24' },
]

@Entry
@Component
struct Settings {
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State saveHint: string = '设置将写入本地 Preferences'
  @State theme: ThemePalette = ThemeService.darkPalette()

  aboutToAppear(): void {
    void this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    this.config = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(this.config)
    this.saveHint = '已加载本地配置'
  }

  private syncSettings(next: HarmonySettings): void {
    this.config = next
    void AppRepository.persistSettings(next).then((saved: HarmonySettings) => {
      this.config = saved
      void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
        this.theme = palette
      })
      this.saveHint = '已保存到本地 Preferences'
    }).catch((error: Error) => {
      this.saveHint = `保存失败：${error.message}`
    })
  }

  private themeLabel(): string {
    switch (this.config.themeMode) {
      case 'light':
        return '浅色'
      case 'dark':
        return '深色'
      default:
        return '跟随系统'
    }
  }

  private quickToggleTheme(): void {
    const next: ThemeMode = this.config.themeMode === 'dark' ? 'light' : 'dark'
    this.syncSettings({
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      imageProxyEnabled: this.config.imageProxyEnabled,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: next,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }

  private applyThemeMode(themeMode: ThemeMode): void {
    this.syncSettings({
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      imageProxyEnabled: this.config.imageProxyEnabled,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }

  @Builder
  private Hero() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column({ space: 16 }) {
        Row() {
          Blank()
          Text('编辑')
            .fontSize(18)
            .fontColor(this.theme.textPrimary)
        }
        .width('100%')
        .padding({ top: 16 })

        Column({ space: 16 }) {
          Stack({ alignContent: Alignment.Center }) {
            Row()
              .width(92)
              .height(92)
              .borderRadius(999)
              .backgroundColor(this.theme.isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.28)')

            Text('L')
              .fontSize(34)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme.accentText)
          }

          Text('Livo 用户')
            .fontSize(30)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)

          Text(`${this.themeLabel()} · ${this.config.language} · 每 ${this.config.refreshIntervalMinutes} 分钟刷新`)
            .fontSize(12)
            .fontColor(this.theme.isDark ? 'rgba(255, 255, 255, 0.78)' : 'rgba(17, 17, 17, 0.72)')

          Text(this.saveHint)
            .fontSize(12)
            .fontColor(this.theme.isDark ? 'rgba(255, 255, 255, 0.64)' : 'rgba(17, 17, 17, 0.58)')
        }
        .width('100%')
        .alignItems(HorizontalAlign.Center)
      }
      .width('100%')
      .height(320)
      .alignItems(HorizontalAlign.Start)
      .padding({ left: 18, right: 18 })

      Row()
        .width(260)
        .height(260)
        .borderRadius(999)
        .backgroundColor('rgba(250, 204, 21, 0.32)')
        .align(Alignment.TopEnd)
        .margin({ top: -30, right: -90 })

      Row()
        .width(260)
        .height(260)
        .borderRadius(999)
        .backgroundColor('rgba(250, 204, 21, 0.08)')
        .align(Alignment.TopStart)
        .margin({ top: -90, left: -120 })
    }
    .width('100%')
    .height(320)
    .backgroundColor(this.theme.isDark ? '#131313' : '#D9C57A')
  }

  @Builder
  private SettingRow(item: SettingItem, showDivider: boolean) {
    Column() {
      Row({ space: 16 }) {
        Stack({ alignContent: Alignment.Center }) {
          Row()
            .width(44)
            .height(44)
            .borderRadius(12)
            .backgroundColor(item.color)

          Text(item.icon)
            .fontSize(18)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.accentText)
        }

        Text(item.title)
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .layoutWeight(1)

        Text('›')
          .fontSize(24)
          .fontColor(this.theme.textMuted)
      }
      .width('100%')
      .padding({ left: 18, right: 18, top: 18, bottom: 18 })

      if (showDivider) {
        Divider()
          .strokeWidth(0.5)
          .color(this.theme.divider)
          .margin({ left: 78, right: 18 })
      }
    }
    .width('100%')
    .clickEffect({ level: ClickEffectLevel.LIGHT })
  }

  @Builder
  private Group(items: SettingItem[]) {
    Column() {
      ForEach(items, (item: SettingItem, index: number) => {
        this.SettingRow(item, index < items.length - 1)
      }, (item: SettingItem) => item.title)
    }
    .width('100%')
    .backgroundColor(this.theme.surface)
    .borderRadius(24)
    .clip(true)
  }

  @Builder
  private QuickActions() {
    Column({ space: 10 }) {
      Text('快捷控制')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)

      Column({ space: 8 }) {
        Text('主题模式')
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textSecondary)

        Row({ space: 8 }) {
          Button('浅色')
            .type(ButtonType.Capsule)
            .backgroundColor(this.config.themeMode === 'light' ? this.theme.accent : this.theme.elevated)
            .fontColor(this.config.themeMode === 'light' ? this.theme.accentText : this.theme.textPrimary)
            .clickEffect({ level: ClickEffectLevel.LIGHT })
            .onClick(() => this.applyThemeMode('light'))

          Button('深色')
            .type(ButtonType.Capsule)
            .backgroundColor(this.config.themeMode === 'dark' ? this.theme.accent : this.theme.elevated)
            .fontColor(this.config.themeMode === 'dark' ? this.theme.accentText : this.theme.textPrimary)
            .clickEffect({ level: ClickEffectLevel.LIGHT })
            .onClick(() => this.applyThemeMode('dark'))

          Button('跟随系统')
            .type(ButtonType.Capsule)
            .backgroundColor(this.config.themeMode === 'system' ? this.theme.accent : this.theme.elevated)
            .fontColor(this.config.themeMode === 'system' ? this.theme.accentText : this.theme.textPrimary)
            .clickEffect({ level: ClickEffectLevel.LIGHT })
            .onClick(() => this.applyThemeMode('system'))
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)

      Row({ space: 8 }) {
        Button(this.config.autoRefresh ? '关闭自动刷新' : '开启自动刷新')
          .type(ButtonType.Capsule)
          .backgroundColor(this.theme.accent)
          .fontColor(this.theme.accentText)
          .clickEffect({ level: ClickEffectLevel.LIGHT })
          .onClick(() => {
            this.syncSettings({
              autoRefresh: !this.config.autoRefresh,
              aiSummaryEnabled: this.config.aiSummaryEnabled,
              imageProxyEnabled: this.config.imageProxyEnabled,
              refreshIntervalMinutes: this.config.refreshIntervalMinutes,
              themeMode: this.config.themeMode,
              language: this.config.language,
              remoteFeedUrl: this.config.remoteFeedUrl,
            })
          })

        Button('切换主题')
          .type(ButtonType.Capsule)
          .backgroundColor(this.theme.elevated)
          .fontColor(this.theme.textPrimary)
          .clickEffect({ level: ClickEffectLevel.LIGHT })
          .onClick(() => this.quickToggleTheme())
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(18)
    .backgroundColor(this.theme.surface)
    .borderRadius(24)
    .clip(true)
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      List({ space: 24 }) {
        ListItem() {
          this.Hero()
        }

        ListItem() {
          Column({ space: 18 }) {
            this.Group(PRIMARY_GROUP)
            this.Group(SECOND_GROUP)
            this.Group(THIRD_GROUP)
            this.Group(FOURTH_GROUP)
            this.QuickActions()
          }
          .width('100%')
          .padding({ left: 18, right: 18 })
          .margin({ top: -18 })
        }

        ListItem() {
          Row().height(100).width('100%')
        }
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Off)
      .backgroundColor(this.theme.background)
      .edgeEffect(EdgeEffect.Spring)

      BottomTabs({ activeTab: 'settings', theme: this.theme })
        .align(Alignment.Bottom)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
