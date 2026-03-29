import { SymbolGlyphModifier } from '@kit.ArkUI'
import { AppRepository } from '../data/AppRepository'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings, ThemeAccent, ThemeMode } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'

interface AppearanceOption {
  label: string
  value: string
  color?: string
}

const THEME_MODE_OPTIONS: AppearanceOption[] = [
  { label: '跟随系统', value: 'system' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
]

const THEME_ACCENT_OPTIONS: AppearanceOption[] = [
  { label: '流光橙', value: 'orange', color: '#FF6A00' },
  { label: '星河蓝', value: 'blue', color: '#2563EB' },
  { label: '珊瑚红', value: 'red', color: '#DC2626' },
  { label: '莓果粉', value: 'pink', color: '#DB2777' },
  { label: '森林绿', value: 'green', color: '#16A34A' },
]

const REFRESH_INTERVAL_OPTIONS: AppearanceOption[] = [
  { label: '15 分钟', value: '15' },
  { label: '30 分钟', value: '30' },
  { label: '60 分钟', value: '60' },
  { label: '120 分钟', value: '120' },
]

const LANGUAGE_OPTIONS: AppearanceOption[] = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
]

const ROW_MIN_HEIGHT: number = 56
const ROW_ICON_SIZE: number = 22
const PANEL_HEADER_TITLE_SIZE: number = 20
const ROW_TITLE_SIZE: number = 15
const ROW_SUBTITLE_SIZE: number = 12
const ROW_TIPS_SIZE: number = 12
const PANEL_HANDLE_TOP_PADDING: number = 10
const PANEL_HANDLE_BOTTOM_PADDING: number = 8
const PANEL_HEADER_SPACING: number = 4
const PANEL_HEADER_MIN_HEIGHT: number = 36
const PANEL_HEADER_TOP_PADDING: number = 0
const PANEL_HEADER_BOTTOM_PADDING: number = 0
const PANEL_SECTION_SPACING: number = 2
const ROW_TEXT_SPACING: number = 2

@Component
export struct AppearanceSettingsPanel {
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State themeModeText: string = '跟随系统'
  @State themeAccentText: string = '流光橙'
  @State refreshIntervalText: string = '30 分钟'
  @State languageText: string = '简体中文'
  @Prop showBackButton: boolean = true
  @Prop initialSettings: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @Prop inheritedTheme: ThemePalette = ThemeService.currentPalette()
  onThemeChange: (theme: ThemePalette) => void = () => {}
  onSettingsChange: (settings: HarmonySettings) => void = () => {}
  onClose: () => void = () => {}

  aboutToAppear(): void {
    this.applyResolvedState(this.initialSettings, this.inheritedTheme)
    void this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    const saved = await AppRepository.settings()
    const palette = await ThemeService.resolvePalette(saved)
    this.applyResolvedState(saved, palette)
  }

  private applyResolvedState(settings: HarmonySettings, palette: ThemePalette): void {
    this.config = settings
    this.theme = palette
    this.themeModeText = this.resolveThemeLabel(settings.themeMode)
    this.themeAccentText = this.resolveAccentLabel(settings.themeAccent)
    this.refreshIntervalText = `${settings.refreshIntervalMinutes} 分钟`
    this.languageText = settings.language === 'en' ? 'English' : '简体中文'
    this.onSettingsChange(settings)
    this.onThemeChange(palette)
  }

  private syncSettings(next: HarmonySettings): void {
    const optimisticTheme: ThemePalette = {
      isDark: this.theme.isDark,
      background: this.theme.background,
      surface: this.theme.surface,
      elevated: this.theme.elevated,
      textPrimary: this.theme.textPrimary,
      textSecondary: this.theme.textSecondary,
      textMuted: this.theme.textMuted,
      divider: this.theme.divider,
      accent: this.resolveAccentColor(next.themeAccent),
      accentText: '#FFFFFF',
      tabBarBackground: this.theme.tabBarBackground,
      tabBarInactive: this.theme.tabBarInactive,
      dragHandle: this.theme.dragHandle,
    }
    this.applyResolvedState(next, optimisticTheme)
    void AppRepository.persistSettings(next).then((saved: HarmonySettings) => {
      void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
        this.applyResolvedState(saved, palette)
      })
    }).catch((_error: Error) => {})
  }

  private resolveThemeLabel(themeMode: ThemeMode): string {
    switch (themeMode) {
      case 'light':
        return '浅色'
      case 'dark':
        return '深色'
      default:
        return '跟随系统'
    }
  }

  private resolveAccentLabel(themeAccent: ThemeAccent): string {
    switch (themeAccent) {
      case 'blue':
        return '星河蓝'
      case 'red':
        return '珊瑚红'
      case 'pink':
        return '莓果粉'
      case 'green':
        return '森林绿'
      default:
        return '流光橙'
    }
  }

  private resolveAccentColor(themeAccent: ThemeAccent): string {
    switch (themeAccent) {
      case 'blue':
        return '#2563EB'
      case 'red':
        return '#DC2626'
      case 'pink':
        return '#DB2777'
      case 'green':
        return '#16A34A'
      default:
        return '#FF6A00'
    }
  }

  private applyThemeMode(value: string): void {
    this.syncSettings({
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      imageProxyEnabled: this.config.imageProxyEnabled,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: value as ThemeMode,
      themeAccent: this.config.themeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }

  private applyThemeAccent(value: string): void {
    this.syncSettings({
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      imageProxyEnabled: this.config.imageProxyEnabled,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: value as ThemeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }

  private applyRefreshInterval(value: string): void {
    const minutes = Number(value)
    this.syncSettings({
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      imageProxyEnabled: this.config.imageProxyEnabled,
      refreshIntervalMinutes: Number.isFinite(minutes) ? minutes : this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }

  private applyLanguage(value: string): void {
    this.syncSettings({
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      imageProxyEnabled: this.config.imageProxyEnabled,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: value,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }

  private toggleAutoRefresh(): void {
    this.syncSettings({
      autoRefresh: !this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      imageProxyEnabled: this.config.imageProxyEnabled,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }

  private toggleAiSummary(): void {
    this.syncSettings({
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: !this.config.aiSummaryEnabled,
      imageProxyEnabled: this.config.imageProxyEnabled,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }

  private toggleImageProxy(): void {
    this.syncSettings({
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      imageProxyEnabled: !this.config.imageProxyEnabled,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }


  @Builder
  private DividerLine() {
    Row()
      .width('92%')
      .height(0.5)
      .backgroundColor(this.theme.divider)
  }

  @Builder
  private OptionMenu(options: AppearanceOption[], selectedValue: string, onSelect: (value: string) => void) {
    Menu() {
      ForEach(options, (option: AppearanceOption) => {
        MenuItem({
          content: option.label,
          symbolStartIcon: option.color
            ? new SymbolGlyphModifier($r('sys.symbol.paintpalette_fill')).fontColor([option.color])
            : undefined,
          symbolEndIcon: selectedValue === option.value ? new SymbolGlyphModifier($r('sys.symbol.checkmark')) : undefined,
        })
          .selected(selectedValue === option.value)
          .onChange((selected: boolean) => {
            if (selected) {
              onSelect(option.value)
            }
          })
      }, (option: AppearanceOption) => option.value)
    }
  }

  @Builder
  private MenuAction(label: string, options: AppearanceOption[], selectedValue: string, onSelect: (value: string) => void) {
    Row() {
      Text(label)
        .fontSize(ROW_TIPS_SIZE)
        .fontColor(this.theme.textSecondary)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      SymbolGlyph($r('sys.symbol.arrowtriangle_down_fill'))
        .fontSize(12)
        .fontColor([this.theme.textMuted])
        .margin({ left: 7, right: 2, top: 1 })
    }
    .padding({ left: 6, right: 6, top: 8, bottom: 8 })
    .bindMenu(this.OptionMenu(options, selectedValue, onSelect))
  }

  @Builder
  private ThemeModeRow() {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.circle_righthalf_inset_filled'))
        .fontSize(ROW_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(0))

      Column({ space: ROW_TEXT_SPACING }) {
        Text('主题模式')
          .fontSize(ROW_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text('切换浅色、深色或跟随系统')
          .fontSize(ROW_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Row() {
        Text(this.resolveThemeLabel(this.config.themeMode))
          .fontSize(ROW_TIPS_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        SymbolGlyph($r('sys.symbol.arrowtriangle_down_fill'))
          .fontSize(12)
          .fontColor([this.theme.textMuted])
          .margin({ left: 7, right: 2, top: 1 })
      }
      .padding({ left: 6, right: 6, top: 8, bottom: 8 })
      .bindMenu(this.OptionMenu(THEME_MODE_OPTIONS, this.config.themeMode, (value: string) => {
        this.applyThemeMode(value)
      }))
    }
    .width('100%')
    .constraintSize({ minHeight: ROW_MIN_HEIGHT })
    .padding({ left: 12, right: 12, top: 6, bottom: 6 })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private RefreshIntervalRow() {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.arrow_clockwise'))
        .fontSize(ROW_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(1))

      Column({ space: ROW_TEXT_SPACING }) {
        Text('刷新间隔')
          .fontSize(ROW_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text('控制后台自动刷新的频率')
          .fontSize(ROW_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      this.MenuAction(
        this.refreshIntervalText,
        REFRESH_INTERVAL_OPTIONS,
        `${this.config.refreshIntervalMinutes}`,
        (value: string) => this.applyRefreshInterval(value)
      )
    }
    .width('100%')
    .constraintSize({ minHeight: ROW_MIN_HEIGHT })
    .padding({ left: 12, right: 12, top: 6, bottom: 6 })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private LanguageRow() {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.translate'))
        .fontSize(ROW_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(2))

      Column({ space: ROW_TEXT_SPACING }) {
        Text('界面语言')
          .fontSize(ROW_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text('切换应用显示语言')
          .fontSize(ROW_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      this.MenuAction(
        this.languageText,
        LANGUAGE_OPTIONS,
        this.config.language,
        (value: string) => this.applyLanguage(value)
      )
    }
    .width('100%')
    .constraintSize({ minHeight: ROW_MIN_HEIGHT })
    .padding({ left: 12, right: 12, top: 6, bottom: 6 })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private ToggleRow(icon: Resource, title: string, subtitle: string, checked: boolean, onToggle: () => void) {
    Row({ space: 12 }) {
      SymbolGlyph(icon)
        .fontSize(ROW_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(3))

      Column({ space: ROW_TEXT_SPACING }) {
        Text(title)
          .fontSize(ROW_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(subtitle)
          .fontSize(ROW_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Toggle({ type: ToggleType.Switch, isOn: checked })
        .selectedColor(this.theme.accent)
        .switchPointColor('#FFFFFF')
        .hitTestBehavior(HitTestMode.None)
    }
    .width('100%')
    .constraintSize({ minHeight: ROW_MIN_HEIGHT })
    .padding({ left: 12, right: 12, top: 6, bottom: 6 })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => onToggle())
  }

  @Builder
  private SheetHandle() {
    if (!this.showBackButton) {
      Column() {
        Row()
          .width(40)
          .height(5)
          .borderRadius(999)
          .backgroundColor(this.theme.dragHandle)
      }
      .width('100%')
      .alignItems(HorizontalAlign.Center)
      .padding({ top: PANEL_HANDLE_TOP_PADDING, bottom: PANEL_HANDLE_BOTTOM_PADDING })
    }
  }

  @Builder
  private ThemeAccentRow() {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.paintpalette_fill'))
        .fontSize(ROW_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(0.5))

      Column({ space: ROW_TEXT_SPACING }) {
        Text('主题色')
          .fontSize(ROW_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text('统一强调色、选中态与操作按钮色彩')
          .fontSize(ROW_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      this.MenuAction(
        this.themeAccentText,
        THEME_ACCENT_OPTIONS,
        this.config.themeAccent,
        (value: string) => this.applyThemeAccent(value)
      )
    }
    .width('100%')
    .constraintSize({ minHeight: ROW_MIN_HEIGHT })
    .padding({ left: 12, right: 12, top: 6, bottom: 6 })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private PanelHeader() {
    Column() {
      Text('外观')
        .fontSize(PANEL_HEADER_TITLE_SIZE)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
    }
    .width('100%')
    .height(PANEL_HEADER_MIN_HEIGHT)
    .justifyContent(FlexAlign.Start)
    .alignItems(HorizontalAlign.Start)
    .padding({ top: PANEL_HEADER_TOP_PADDING, bottom: PANEL_HEADER_BOTTOM_PADDING })
  }

  @Builder
  private SettingsGroup() {
    Column({ space: 14 }) {
      Column() {
        this.ThemeModeRow()
        this.DividerLine()
        this.ThemeAccentRow()
        this.DividerLine()
        this.RefreshIntervalRow()
        this.DividerLine()
        this.LanguageRow()
      }
      .width('100%')
      .backgroundColor(this.theme.surface)
      .borderRadius(CARD_RADIUS_LG)
      .border({ width: 0.8, color: this.theme.divider })
      .transition(livoMotion.enterSoft(40))

      Column() {
        this.ToggleRow(
          $r('sys.symbol.arrow_clockwise'),
          '自动刷新',
          '进入应用后保持订阅内容及时更新',
          this.config.autoRefresh,
          () => this.toggleAutoRefresh()
        )
        this.DividerLine()
        this.ToggleRow(
          $r('sys.symbol.ellipsis_message_fill'),
          'AI 摘要',
          '在文章详情中启用智能摘要能力',
          this.config.aiSummaryEnabled,
          () => this.toggleAiSummary()
        )
        this.DividerLine()
        this.ToggleRow(
          $r('sys.symbol.externaldrive_fill'),
          '图片代理',
          '使用代理加载远程图片内容',
          this.config.imageProxyEnabled,
          () => this.toggleImageProxy()
        )
      }
      .width('100%')
      .backgroundColor(this.theme.surface)
      .borderRadius(CARD_RADIUS_LG)
      .border({ width: 0.8, color: this.theme.divider })
      .transition(livoMotion.enterSoft(70))
    }
    .width('100%')
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()
        this.SettingsGroup()

        Row()
          .height(28)
          .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .alignItems(HorizontalAlign.Start)
      .padding({
        left: PAGE_HORIZONTAL_PADDING,
        right: PAGE_HORIZONTAL_PADDING,
        top: 0,
        bottom: 12,
      })
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
    .edgeEffect(EdgeEffect.Spring)
  }
}
