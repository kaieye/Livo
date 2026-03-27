import { AppRepository } from '../data/AppRepository'
import { BottomTabs } from './BottomTabs'
import { PageHeader } from './PageHeader'
import { SettingListRow } from './SettingListRow'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings, ThemeMode } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'

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

@Component
export struct SettingsContent {
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State saveHint: string = '设置将写入本地 Preferences'
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State hasLoaded: boolean = false
  @State isLoading: boolean = false
  @Prop showBottomTabs: boolean = true
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
  onThemeChange: (theme: ThemePalette) => void = () => {}
  onReady: () => void = () => {}

  aboutToAppear(): void {
    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
      if (this.hasLoaded || this.isLoading) {
        this.onReady()
        return
      }
    }

    void this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    if (this.isLoading) {
      return
    }

    this.isLoading = true
    try {
      this.config = await AppRepository.settings()
      if (this.showBottomTabs) {
        this.theme = await ThemeService.resolvePalette(this.config)
      } else {
        this.theme = this.inheritedTheme
      }
      this.saveHint = '已加载本地配置'
      this.hasLoaded = true
      this.onReady()
    } finally {
      this.isLoading = false
    }
  }

  private syncInheritedTheme(): void {
    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
    }
  }

  private syncSettings(next: HarmonySettings): void {
    this.config = next
    void AppRepository.persistSettings(next).then((saved: HarmonySettings) => {
      this.config = saved
      void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
        this.theme = palette
        this.onThemeChange(palette)
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
  private SettingRow(item: SettingItem, showDivider: boolean) {
    SettingListRow({
      title: item.title,
      icon: item.icon,
      iconColor: item.color,
      theme: this.theme,
      showDivider,
    })
  }

  @Builder
  private Group(items: SettingItem[], delay: number) {
    Column() {
      ForEach(items, (item: SettingItem, index: number) => {
        this.SettingRow(item, index < items.length - 1)
      }, (item: SettingItem) => item.title)
    }
    .width('100%')
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
    .clip(true)
    .transition(livoMotion.enterScale(delay))
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
            .clickEffect({ level: ClickEffectLevel.MIDDLE })
            .onClick(() => this.applyThemeMode('light'))

          Button('深色')
            .type(ButtonType.Capsule)
            .backgroundColor(this.config.themeMode === 'dark' ? this.theme.accent : this.theme.elevated)
            .fontColor(this.config.themeMode === 'dark' ? this.theme.accentText : this.theme.textPrimary)
            .clickEffect({ level: ClickEffectLevel.MIDDLE })
            .onClick(() => this.applyThemeMode('dark'))

          Button('跟随系统')
            .type(ButtonType.Capsule)
            .backgroundColor(this.config.themeMode === 'system' ? this.theme.accent : this.theme.elevated)
            .fontColor(this.config.themeMode === 'system' ? this.theme.accentText : this.theme.textPrimary)
            .clickEffect({ level: ClickEffectLevel.MIDDLE })
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
          .clickEffect({ level: ClickEffectLevel.MIDDLE })
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
          .clickEffect({ level: ClickEffectLevel.MIDDLE })
          .onClick(() => this.quickToggleTheme())
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(18)
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
    .clip(true)
    .transition(livoMotion.enterScale(120))
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      List({ space: 24 }) {
        ListItem() {
          Column({ space: 10 }) {
            PageHeader({
              title: '设置',
              theme: this.theme,
            })

            Text(`${this.themeLabel()} · ${this.config.language} · 每 ${this.config.refreshIntervalMinutes} 分钟刷新`)
              .fontSize(12)
              .fontColor(this.theme.textSecondary)
              .padding({ left: 4, right: 4 })

            Text(this.saveHint)
              .fontSize(12)
              .fontColor(this.theme.textMuted)
              .padding({ left: 4, right: 4 })
          }
          .width('100%')
          .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 12 })
        }

        ListItem() {
          Column({ space: 18 }) {
            this.Group(PRIMARY_GROUP, 30)
            this.Group(SECOND_GROUP, 50)
            this.Group(THIRD_GROUP, 70)
            this.Group(FOURTH_GROUP, 90)
            this.QuickActions()
          }
          .width('100%')
          .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
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

      if (this.showBottomTabs) {
        BottomTabs({ activeTab: 'settings', theme: this.theme })
          .align(Alignment.Bottom)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
