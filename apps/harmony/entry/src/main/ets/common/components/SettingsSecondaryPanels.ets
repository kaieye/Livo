import { openArticleDetail } from '../navigation/AppRouter'
import { SymbolGlyphModifier } from '@kit.ArkUI'
import { fileIo, picker } from '@kit.CoreFileKit'
import { AppRepository } from '../data/AppRepository'
import { AppContextService } from '../services/AppContextService'
import { DEFAULT_HARMONY_SETTINGS, EntryCardModel, Feed, FeedViewType, HarmonySettings, RefreshLogEntry } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { generateOpml, parseOpml } from '../utils/OpmlParser'
import { extractInstagramUsername } from '../utils/SocialFeedTitles'
import { livoMotion } from '../ui/Motion'
import { PageHeader } from './PageHeader'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'

const PANEL_ROW_MIN_HEIGHT: number = 56
const PANEL_ICON_SIZE: number = 22
const PANEL_TITLE_SIZE: number = 15
const PANEL_SUBTITLE_SIZE: number = 12
const PANEL_HINT_SIZE: number = 12
const PANEL_HANDLE_TOP_PADDING: number = 10
const PANEL_HANDLE_BOTTOM_PADDING: number = 8
const PANEL_ROW_TEXT_SPACING: number = 2
const PANEL_GROUP_SPACING: number = 14
const PANEL_SECTION_SPACING: number = 2
const PANEL_ROW_PADDING_HORIZONTAL: number = 12
const PANEL_ROW_PADDING_VERTICAL: number = 6
const REFRESH_INTERVAL_OPTIONS: string[] = ['15', '30', '60', '120']

interface SelectOption {
  label: string
  value: string
}

const LANGUAGE_OPTIONS: SelectOption[] = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
]

@Builder
function SettingsPanelHeader(title: string, theme: ThemePalette) {
  PageHeader({
    title,
    theme,
    titleSize: 20,
    topPadding: 0,
    bottomPadding: 0,
  })
}

@Component
export struct GeneralSettingsPanel {
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State saveHint: string = '通用设置将保存到本地'
  @State refreshIntervalSelection: string = `${DEFAULT_HARMONY_SETTINGS.refreshIntervalMinutes}`
  onSettingsChange: (settings: HarmonySettings) => void = () => {}

  aboutToAppear(): void {
    void this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    this.config = await AppRepository.settings()
    this.refreshIntervalSelection = `${this.config.refreshIntervalMinutes}`
    this.theme = await ThemeService.resolvePalette(this.config)
    this.saveHint = '已加载通用配置'
  }

  private syncSettings(next: HarmonySettings): void {
    this.config = next
    this.refreshIntervalSelection = `${next.refreshIntervalMinutes}`
    console.info(`[GeneralSettings] syncSettings -> refreshIntervalMinutes=${next.refreshIntervalMinutes}`)
    void AppRepository.persistSettings(next).then((saved: HarmonySettings) => {
      this.config = saved
      this.refreshIntervalSelection = `${saved.refreshIntervalMinutes}`
      this.onSettingsChange(saved)
      void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
        this.theme = palette
      })
      this.saveHint = '已保存通用配置'
      console.info(`[GeneralSettings] persistSettings saved -> refreshIntervalMinutes=${saved.refreshIntervalMinutes}`)
    }).catch((error: Error) => {
      this.saveHint = `保存失败：${error.message}`
      console.error(`[GeneralSettings] persistSettings failed: ${error.message}`)
    })
  }

  private getRefreshIntervalOptions(): SelectOption[] {
    return REFRESH_INTERVAL_OPTIONS.map((minutes: string): SelectOption => ({
      label: `${minutes} 分钟`,
      value: minutes,
    }))
  }

  private applyRefreshInterval(value: string): void {
    const minutes = Number(value)
    const normalizedMinutes = Number.isFinite(minutes) && minutes > 0
      ? Math.floor(minutes)
      : this.config.refreshIntervalMinutes
    console.info(`[GeneralSettings] applyRefreshInterval input=${value}, normalized=${normalizedMinutes}`)
    this.refreshIntervalSelection = `${normalizedMinutes}`
    this.config = {
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      aiSummaryAutoTrigger: this.config.aiSummaryAutoTrigger,
      aiTranslationEnabled: this.config.aiTranslationEnabled,
      aiTranslationLanguage: this.config.aiTranslationLanguage,
      aiTranslationAutoTrigger: this.config.aiTranslationAutoTrigger,
      imageProxyEnabled: this.config.imageProxyEnabled,
      searchAllHomeCategories: this.config.searchAllHomeCategories,
      refreshIntervalMinutes: normalizedMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    showUnreadDot: this.config.showUnreadDot,
    }
    const nextSettings: HarmonySettings = {
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      aiSummaryAutoTrigger: this.config.aiSummaryAutoTrigger,
      aiTranslationEnabled: this.config.aiTranslationEnabled,
      aiTranslationLanguage: this.config.aiTranslationLanguage,
      aiTranslationAutoTrigger: this.config.aiTranslationAutoTrigger,
      imageProxyEnabled: this.config.imageProxyEnabled,
      searchAllHomeCategories: this.config.searchAllHomeCategories,
      refreshIntervalMinutes: normalizedMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    showUnreadDot: this.config.showUnreadDot,
    }
    this.syncSettings(nextSettings)
  }

  private applyLanguage(value: string): void {
    const nextSettings: HarmonySettings = {
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      aiSummaryAutoTrigger: this.config.aiSummaryAutoTrigger,
      aiTranslationEnabled: this.config.aiTranslationEnabled,
      aiTranslationLanguage: this.config.aiTranslationLanguage,
      aiTranslationAutoTrigger: this.config.aiTranslationAutoTrigger,
      imageProxyEnabled: this.config.imageProxyEnabled,
      searchAllHomeCategories: this.config.searchAllHomeCategories,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: value,
      remoteFeedUrl: this.config.remoteFeedUrl,
    showUnreadDot: this.config.showUnreadDot,
    }
    this.syncSettings(nextSettings)
  }

  private applySearchAllHomeCategories(enabled: boolean): void {
    const nextSettings: HarmonySettings = {
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      aiSummaryAutoTrigger: this.config.aiSummaryAutoTrigger,
      aiTranslationEnabled: this.config.aiTranslationEnabled,
      aiTranslationLanguage: this.config.aiTranslationLanguage,
      aiTranslationAutoTrigger: this.config.aiTranslationAutoTrigger,
      imageProxyEnabled: this.config.imageProxyEnabled,
      searchAllHomeCategories: enabled,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    showUnreadDot: this.config.showUnreadDot,
    }
    this.syncSettings(nextSettings)
  }

  private toggleSearchAllHomeCategories(): void {
    this.applySearchAllHomeCategories(!this.config.searchAllHomeCategories)
  }

  @Builder
  private SheetHandle() {
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

  @Builder
  private PanelHeader() {
    SettingsPanelHeader('通用', this.theme)
  }

  @Builder
  private InfoRow(symbol: Resource, title: string, subtitle: string, hint: string, iconDelay: number = 0) {
    Row({ space: 12 }) {
      SymbolGlyph(symbol)
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Column({ space: PANEL_ROW_TEXT_SPACING }) {
        Text(title)
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(subtitle)
          .fontSize(PANEL_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Text(hint)
        .fontSize(PANEL_HINT_SIZE)
        .fontColor(this.theme.textSecondary)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: PANEL_ROW_PADDING_HORIZONTAL,
      right: PANEL_ROW_PADDING_HORIZONTAL,
      top: PANEL_ROW_PADDING_VERTICAL,
      bottom: PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private DividerLine() {
    Row()
      .width('92%')
      .height(0.5)
      .backgroundColor(this.theme.divider)
  }

  @Builder
  private OptionMenu(
    options: SelectOption[],
    selectedValue: string,
    onSelect: (value: string) => void,
  ) {
    Menu() {
      ForEach(options, (option: SelectOption) => {
        MenuItem({
          content: option.label,
          symbolEndIcon: selectedValue === option.value ? new SymbolGlyphModifier($r('sys.symbol.checkmark')) : undefined,
        })
          .selected(selectedValue === option.value)
          .onChange((selected: boolean) => {
            if (selected && option.value !== selectedValue) {
              onSelect(option.value)
            }
          })
      }, (option: SelectOption) => option.value)
    }
  }

  @Builder
  private ActionLabel(label: string, options: SelectOption[], selectedValue: string,
    onSelect: (value: string) => void) {
    Row({ space: 6 }) {
      Text(label)
        .fontSize(PANEL_HINT_SIZE)
        .fontColor(this.theme.textSecondary)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      SymbolGlyph($r('sys.symbol.arrowtriangle_down_fill'))
        .fontSize(11)
        .fontColor([this.theme.textMuted])
    }
      .padding({ left: 6, right: 6, top: 8, bottom: 8 })
      .bindMenu(this.OptionMenu(options, selectedValue, onSelect))
  }

  @Builder
  private SettingActionRow(
    symbol: Resource,
    title: string,
    subtitle: string,
    actionLabel: string,
    options: SelectOption[],
    selectedValue: string,
    onSelect: (value: string) => void,
    iconDelay: number = 0,
  ) {
    Row({ space: 12 }) {
      SymbolGlyph(symbol)
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Column({ space: PANEL_ROW_TEXT_SPACING }) {
        Text(title)
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(subtitle)
          .fontSize(PANEL_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      this.ActionLabel(actionLabel, options, selectedValue, onSelect)
    }
    .width('100%')
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: PANEL_ROW_PADDING_HORIZONTAL,
      right: PANEL_ROW_PADDING_HORIZONTAL,
      top: PANEL_ROW_PADDING_VERTICAL,
      bottom: PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private RefreshIntervalMenuRow(iconDelay: number = 0) {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.arrow_clockwise'))
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Column({ space: PANEL_ROW_TEXT_SPACING }) {
        Text('刷新间隔')
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text('控制后台自动刷新频率')
          .fontSize(PANEL_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Row({ space: 6 }) {
        Text(`${this.refreshIntervalSelection} 分钟`)
          .fontSize(PANEL_HINT_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        SymbolGlyph($r('sys.symbol.arrowtriangle_down_fill'))
          .fontSize(11)
          .fontColor([this.theme.textMuted])
      }
      .padding({ left: 6, right: 6, top: 8, bottom: 8 })
      .bindMenu(this.OptionMenu(
        this.getRefreshIntervalOptions(),
        this.refreshIntervalSelection,
        (value: string) => {
          this.applyRefreshInterval(value)
        },
      ))
    }
    .width('100%')
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: PANEL_ROW_PADDING_HORIZONTAL,
      right: PANEL_ROW_PADDING_HORIZONTAL,
      top: PANEL_ROW_PADDING_VERTICAL,
      bottom: PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private ToggleRow(
    symbol: Resource,
    title: string,
    subtitle: string,
    checked: boolean,
    onToggle: (nextChecked: boolean) => void,
    iconDelay: number = 0,
  ) {
    Row({ space: 12 }) {
      SymbolGlyph(symbol)
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Column({ space: PANEL_ROW_TEXT_SPACING }) {
        Text(title)
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(subtitle)
          .fontSize(PANEL_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Toggle({ type: ToggleType.Switch, isOn: checked })
        .selectedColor(this.theme.accent)
        .switchPointColor('#FFFFFF')
        .onChange((isOn: boolean) => {
          onToggle(isOn)
        })
    }
    .width('100%')
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: PANEL_ROW_PADDING_HORIZONTAL,
      right: PANEL_ROW_PADDING_HORIZONTAL,
      top: PANEL_ROW_PADDING_VERTICAL,
      bottom: PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => onToggle(!checked))
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        Column() {
          this.SettingActionRow(
            $r('sys.symbol.translate'),
            '界面语言',
            '切换应用显示语言',
            this.config.language === 'en' ? 'English' : '简体中文',
            LANGUAGE_OPTIONS,
            this.config.language,
            (value: string) => this.applyLanguage(value),
            0,
          )
          this.DividerLine()
          this.RefreshIntervalMenuRow(1)
          this.DividerLine()
          Row({ space: 12 }) {
            SymbolGlyph($r('sys.symbol.magnifyingglass_circle'))
              .fontSize(PANEL_ICON_SIZE)
              .fontColor([this.theme.accent])
              .transition(livoMotion.enterIconSpin(2))

            Column({ space: PANEL_ROW_TEXT_SPACING }) {
              Text('跨栏目搜索')
                .fontSize(PANEL_TITLE_SIZE)
                .fontWeight(FontWeight.Medium)
                .fontColor(this.theme.textPrimary)

              Text('开启后，搜索范围包含所有栏目')
                .fontSize(PANEL_SUBTITLE_SIZE)
                .fontColor(this.theme.textSecondary)
                .maxLines(2)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Start)

            Toggle({ type: ToggleType.Switch, isOn: this.config.searchAllHomeCategories })
              .selectedColor(this.theme.accent)
              .switchPointColor('#FFFFFF')
              .onChange((isOn: boolean) => {
                this.applySearchAllHomeCategories(isOn)
              })
          }
          .width('100%')
          .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
          .padding({
            left: PANEL_ROW_PADDING_HORIZONTAL,
            right: PANEL_ROW_PADDING_HORIZONTAL,
            top: PANEL_ROW_PADDING_VERTICAL,
            bottom: PANEL_ROW_PADDING_VERTICAL,
          })
          .backgroundColor(this.theme.surface)
          .borderRadius(20)
          .clickEffect({ level: ClickEffectLevel.MIDDLE })
          .onClick(() => this.toggleSearchAllHomeCategories())
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })
        .transition(livoMotion.enterSoft(40))

        Text(this.saveHint)
          .fontSize(12)
          .fontColor(this.theme.textMuted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
          .padding({ left: 6, right: 6, top: 6, bottom: 2 })

        Row()
          .height(28)
          .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
    .edgeEffect(EdgeEffect.Spring)
  }
}

@Component
export struct FavoritesPanel {
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State starredEntries: EntryCardModel[] = []
  @State isLoading: boolean = true

  aboutToAppear(): void {
    this.theme = ThemeService.currentPalette()
    void this.loadStarredEntries()
  }

  private async loadStarredEntries(): Promise<void> {
    this.isLoading = true
    try {
      this.starredEntries = await AppRepository.starredEntries()
    } finally {
      this.isLoading = false
    }
  }

  private async toggleStar(entryId: string): Promise<void> {
    await AppRepository.toggleStar(entryId)
    this.starredEntries = this.starredEntries.filter((entry: EntryCardModel) => entry.id !== entryId)
  }

  private favoritePreviewImages(entry: EntryCardModel): string[] {
    if (entry.viewLabel !== '图片') {
      return []
    }

    const candidates = (entry.mediaUrls && entry.mediaUrls.length > 0)
      ? entry.mediaUrls
      : (entry.imageUrl ? [entry.imageUrl] : [])
    return candidates.slice(0, 5)
  }

  @Builder
  private PictureThumbStrip(entry: EntryCardModel) {
    if (this.favoritePreviewImages(entry).length > 0) {
      Row({ space: 8 }) {
        ForEach(this.favoritePreviewImages(entry), (url: string, index: number) => {
          Image(url)
            .width(58)
            .height(58)
            .objectFit(ImageFit.Cover)
            .borderRadius(10)
            .backgroundColor(this.theme.elevated)
            .border({ width: index === 0 ? 1 : 0.6, color: this.theme.divider })
        }, (url: string, index: number) => `${url}-${index}`)
      }
      .width('100%')
    }
  }

  @Builder
  private SheetHandle() {
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

  @Builder
  private PanelHeader() {
    SettingsPanelHeader('收藏', this.theme)
  }

  @Builder
  private StatusCard(symbol: Resource, title: string, subtitle: string) {
    Row({ space: 12 }) {
      SymbolGlyph(symbol)
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])

      Column({ space: PANEL_ROW_TEXT_SPACING }) {
        Text(title)
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(subtitle)
          .fontSize(PANEL_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: PANEL_ROW_PADDING_HORIZONTAL,
      right: PANEL_ROW_PADDING_HORIZONTAL,
      top: PANEL_ROW_PADDING_VERTICAL,
      bottom: PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private EntryCard(entry: EntryCardModel, index: number) {
    Column({ space: 8 }) {
      Row({ space: 6 }) {
        Text(entry.feedTitle)
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.accent)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        Text('·')
          .fontSize(12)
          .fontColor(this.theme.textMuted)

        Text(entry.publishedLabel)
          .fontSize(12)
          .fontColor(this.theme.textMuted)

        Blank()

        SymbolGlyph($r('sys.symbol.star_fill'))
          .fontSize(18)
          .fontColor(['#F59E0B'])
          .padding(4)
          .clickEffect({ level: ClickEffectLevel.LIGHT })
          .onClick(() => {
            void this.toggleStar(entry.id)
          })
      }
      .width('100%')

      Text(entry.title)
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')

      if (entry.summary) {
        Text(entry.summary)
          .fontSize(14)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
      }

      this.PictureThumbStrip(entry)
    }
    .width('100%')
    .padding(16)
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
      offsetX: 0,
      offsetY: 4,
    })
    .transition(livoMotion.enterSoft(index * 20 + 40))
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => {
      void openArticleDetail(entry.id)
    })
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        if (this.isLoading) {
          Column({ space: 10 }) {
            LoadingProgress()
              .width(28)
              .height(28)
              .color(this.theme.accent)

            Text('正在加载收藏')
              .fontSize(13)
              .fontColor(this.theme.textSecondary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .width('100%')
          .padding({ top: 24, bottom: 12 })
          .alignItems(HorizontalAlign.Center)
          .transition(livoMotion.enterSoft(20))
        } else if (this.starredEntries.length === 0) {
          Column() {
            this.StatusCard($r('sys.symbol.star'), '暂无收藏内容', '在文章详情里点亮星标后，会出现在这里')
          }
          .width('100%')
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_LG)
          .border({ width: 0.8, color: this.theme.divider })
          .transition(livoMotion.enterSoft(40))
        } else {
          Column({ space: 12 }) {
            ForEach(this.starredEntries, (entry: EntryCardModel, index: number) => {
              this.EntryCard(entry, index)
            }, (entry: EntryCardModel) => entry.id)
          }
          .width('100%')
          .padding({ top: 8 })
        }

        Row()
          .height(28)
          .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
    .edgeEffect(EdgeEffect.Spring)
  }
}

@Component
export struct SubscriptionsSettingsPanel {
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State isOpmlProcessing: boolean = false

  aboutToAppear(): void {
    void this.loadTheme()
  }

  private async loadTheme(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
  }

  private showToast(message: string, duration: number = 2200): void {
    try {
      this.getUIContext().getPromptAction().showToast({ message, duration })
    } catch (_error) {
    }
  }

  private normalizeFeedUrl(url: string): string {
    return (url || '').trim().toLowerCase().replace(/\/+$/g, '')
  }

  private inferFeedViewByUrl(url: string): FeedViewType {
    const normalized = this.normalizeFeedUrl(url)
    if (!!extractInstagramUsername(normalized)) {
      return FeedViewType.Pictures
    }
    if (
      normalized.includes('/twitter/')
      || normalized.includes('/x.com/')
      || normalized.includes('/nitter.')
      || normalized.includes('/bilibili/user/dynamic/')
    ) {
      return FeedViewType.SocialMedia
    }
    if (
      normalized.includes('/youtube/')
      || normalized.includes('/bilibili/user/video/')
      || normalized.includes('tedtalks')
    ) {
      return FeedViewType.Videos
    }
    return FeedViewType.Articles
  }

  private async pickImportOpmlUri(): Promise<string> {
    const documentPicker = new picker.DocumentViewPicker(AppContextService.getContext())
    const options = new picker.DocumentSelectOptions()
    options.maxSelectNumber = 1
    options.fileSuffixFilters = ['OPML|.opml,.xml']
    const uris = await documentPicker.select(options)
    if (!uris || uris.length === 0) {
      return ''
    }
    return uris[0]
  }

  private async pickExportOpmlUri(): Promise<string> {
    const documentPicker = new picker.DocumentViewPicker(AppContextService.getContext())
    const options = new picker.DocumentSaveOptions()
    options.newFileNames = ['livo-subscriptions.opml']
    options.fileSuffixChoices = ['OPML|.opml']
    const uris = await documentPicker.save(options)
    if (!uris || uris.length === 0) {
      return ''
    }
    return uris[0]
  }

  private decodeUtf8Bytes(bytes: Uint8Array): string {
    if (bytes.length === 0) {
      return ''
    }

    let encoded = ''
    bytes.forEach((value: number) => {
      const hex = value.toString(16).padStart(2, '0')
      encoded += `%${hex}`
    })

    try {
      return decodeURIComponent(encoded)
    } catch (_error) {
      let fallback = ''
      bytes.forEach((value: number) => {
        fallback += String.fromCharCode(value)
      })
      return fallback
    }
  }

  private normalizeImportedUrl(raw: string): string {
    const trimmed = (raw || '').trim()
    if (!trimmed) {
      return ''
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(trimmed)) {
      return `https://${trimmed.replace(/^\/\/+/, '')}`
    }
    return trimmed
  }

  private readTextFromUri(uri: string): string {
    const file = fileIo.openSync(uri, fileIo.OpenMode.READ_ONLY)
    try {
      const bytes: number[] = []
      const bufferSize = 4096
      while (true) {
        const buffer = new ArrayBuffer(bufferSize)
        const readLength = fileIo.readSync(file.fd, buffer)
        if (readLength <= 0) {
          break
        }
        const view = new Uint8Array(buffer).subarray(0, readLength)
        view.forEach((value: number) => {
          bytes.push(value)
        })
      }
      return this.decodeUtf8Bytes(new Uint8Array(bytes))
    } finally {
      fileIo.closeSync(file)
    }
  }

  private async exportOpmlToFile(): Promise<void> {
    if (this.isOpmlProcessing) {
      return
    }
    this.isOpmlProcessing = true
    try {
      const targetUri = await this.pickExportOpmlUri()
      if (!targetUri) {
        this.showToast('已取消导出')
        return
      }
      const feeds = await AppRepository.feedEntities()
      const opml = generateOpml(feeds)
      const file = fileIo.openSync(
        targetUri,
        fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC,
      )
      try {
        fileIo.writeSync(file.fd, opml)
      } finally {
        fileIo.closeSync(file)
      }
      this.showToast(`导出完成，共 ${feeds.length} 条`)
    } catch (error) {
      this.showToast(`导出失败：${error instanceof Error ? error.message : String(error)}`, 3000)
    } finally {
      this.isOpmlProcessing = false
    }
  }

  private async importOpmlFromFile(mode: 'merge' | 'overwrite'): Promise<void> {
    if (this.isOpmlProcessing) {
      return
    }
    this.isOpmlProcessing = true
    try {
      const targetUri = await this.pickImportOpmlUri()
      if (!targetUri) {
        this.showToast('已取消导入')
        return
      }

      const xml = this.readTextFromUri(targetUri)
      const opmlFeeds = parseOpml(xml)
      if (opmlFeeds.length === 0) {
        this.showToast('OPML 文件中未发现可导入订阅', 3000)
        return
      }

      const existingFeeds = await AppRepository.feedEntities()
      const existingUrlSet: Set<string> = new Set<string>()
      const existingFeedMap: Map<string, Feed> = new Map<string, Feed>()
      existingFeeds.forEach((feed: Feed) => {
        const normalized = this.normalizeFeedUrl(feed.url)
        if (normalized) {
          existingUrlSet.add(normalized)
          existingFeedMap.set(normalized, feed)
        }
      })

      if (mode === 'overwrite') {
        for (const feed of existingFeeds) {
          await AppRepository.removeFeed(feed.id)
        }
        existingUrlSet.clear()
      }

      const seenInOpml: Set<string> = new Set<string>()
      let imported = 0
      let skipped = 0
      let failed = 0

      for (const opmlFeed of opmlFeeds) {
        const url = this.normalizeImportedUrl(opmlFeed.xmlUrl || '')
        if (!url) {
          skipped += 1
          continue
        }
        const importedView = this.inferFeedViewByUrl(url)
        const normalizedUrl = this.normalizeFeedUrl(url)
        if (!normalizedUrl) {
          skipped += 1
          continue
        }
        if (seenInOpml.has(normalizedUrl)) {
          skipped += 1
          continue
        }
        seenInOpml.add(normalizedUrl)

        if (mode === 'merge' && existingUrlSet.has(normalizedUrl)) {
          const existingFeed = existingFeedMap.get(normalizedUrl)
          if (existingFeed && existingFeed.view !== importedView && importedView === FeedViewType.SocialMedia) {
            try {
              await AppRepository.updateFeed(existingFeed.id, {
                title: (opmlFeed.title || url).trim(),
                url,
                siteUrl: this.normalizeImportedUrl(opmlFeed.htmlUrl || ''),
                imageUrl: '',
                description: '',
                category: (opmlFeed.category || '').trim(),
                view: importedView,
                showInAll: true,
              })
              imported += 1
              continue
            } catch (_error) {
              failed += 1
              continue
            }
          }
          skipped += 1
          continue
        }

        try {
          await AppRepository.createFeed({
            title: (opmlFeed.title || url).trim(),
            url,
            siteUrl: this.normalizeImportedUrl(opmlFeed.htmlUrl || ''),
            imageUrl: '',
            description: '',
            category: (opmlFeed.category || '').trim(),
            view: importedView,
            showInAll: true,
          })
          existingUrlSet.add(normalizedUrl)
          imported += 1
        } catch (_error) {
          failed += 1
        }
      }

      AppStorage.setOrCreate('feedsChangedAt', Date.now())
      this.showToast(`导入完成：新增 ${imported}，跳过 ${skipped}，失败 ${failed}`, 3200)
    } catch (error) {
      this.showToast(`导入失败：${error instanceof Error ? error.message : String(error)}`, 3200)
    } finally {
      this.isOpmlProcessing = false
    }
  }

  private openOpmlImportChoiceDialog(): void {
    this.getUIContext().showAlertDialog({
      title: '导入 OPML',
      message: '请选择导入方式',
      primaryButton: {
        value: '合并导入',
        action: () => {
          void this.importOpmlFromFile('merge')
        },
      },
      secondaryButton: {
        value: '覆盖导入',
        fontColor: '#D94848',
        action: () => {
          void this.importOpmlFromFile('overwrite')
        },
      },
    })
  }

  @Builder
  private SheetHandle() {
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

  @Builder
  private PanelHeader() {
    SettingsPanelHeader('订阅', this.theme)
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        Column({ space: 12 }) {
          Button(this.isOpmlProcessing ? '处理中...' : '导入 OPML')
            .width('100%')
            .height(44)
            .type(ButtonType.Capsule)
            .fontSize(14)
            .fontWeight(FontWeight.Medium)
            .enabled(!this.isOpmlProcessing)
            .backgroundColor(this.theme.surface)
            .fontColor(this.theme.textPrimary)
            .border({ width: 0.8, color: this.theme.divider })
            .onClick(() => {
              this.openOpmlImportChoiceDialog()
            })

          Button(this.isOpmlProcessing ? '处理中...' : '导出 OPML')
            .width('100%')
            .height(44)
            .type(ButtonType.Capsule)
            .fontSize(14)
            .fontWeight(FontWeight.Medium)
            .enabled(!this.isOpmlProcessing)
            .backgroundColor(this.theme.surface)
            .fontColor(this.theme.textPrimary)
            .border({ width: 0.8, color: this.theme.divider })
            .onClick(() => {
              void this.exportOpmlToFile()
            })

          Text('导入支持“合并导入 / 覆盖导入”，导出会生成标准 OPML 文件。')
            .fontSize(12)
            .lineHeight(18)
            .fontColor(this.theme.textSecondary)
            .width('100%')
        }
        .width('100%')
        .padding(16)
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })
        .transition(livoMotion.enterSoft(30))

        Row()
          .height(28)
          .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
    .edgeEffect(EdgeEffect.Spring)
  }
}

@Component
export struct RefreshLogSettingsPanel {
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State logs: RefreshLogEntry[] = []
  @State isLoading: boolean = true
  onSettingsChange: (settings: HarmonySettings) => void = () => {}

  aboutToAppear(): void {
    void this.loadData()
  }

  private async loadData(): Promise<void> {
    this.isLoading = true
    try {
      const settings = await AppRepository.settings()
      this.theme = await ThemeService.resolvePalette(settings)
      this.logs = await AppRepository.refreshLogs()
    } finally {
      this.isLoading = false
    }
  }

  private formatDateTime(timestamp: number): string {
    if (timestamp <= 0) {
      return '未知时间'
    }
    const date = new Date(timestamp)
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    const hour = `${date.getHours()}`.padStart(2, '0')
    const minute = `${date.getMinutes()}`.padStart(2, '0')
    return `${month}-${day} ${hour}:${minute}`
  }

  private failedFeedsLabel(log: RefreshLogEntry): string {
    if (!log.failedFeedTitles || log.failedFeedTitles.length === 0) {
      return '无'
    }
    return log.failedFeedTitles.join('、')
  }

  private async clearLogs(): Promise<void> {
    await AppRepository.clearRefreshLogs()
    this.logs = []
  }

  @Builder
  private SheetHandle() {
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

  @Builder
  private PanelHeader() {
    SettingsPanelHeader('刷新日志', this.theme)
  }

  @Builder
  private EmptyState() {
    Column({ space: 8 }) {
      Text('暂无刷新记录')
        .fontSize(PANEL_TITLE_SIZE)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)

      Text('在首页执行刷新后，这里会显示刷新时间、成功数、失败数和失败订阅源。')
        .fontSize(PANEL_SUBTITLE_SIZE)
        .lineHeight(18)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(14)
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }

  @Builder
  private LogCard(log: RefreshLogEntry, index: number) {
    Column({ space: 8 }) {
      Row() {
        Text(this.formatDateTime(log.refreshedAt))
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .layoutWeight(1)

        Text(`#${this.logs.length - index}`)
          .fontSize(PANEL_HINT_SIZE)
          .fontColor(this.theme.textMuted)
      }
      .width('100%')

      Text(`成功刷新 ${log.successFeedCount} 个订阅源 · 失败 ${log.failedFeedCount} 个`)
        .fontSize(PANEL_SUBTITLE_SIZE)
        .fontColor(this.theme.textSecondary)
        .width('100%')

      Text(`失败订阅源：${this.failedFeedsLabel(log)}`)
        .fontSize(PANEL_SUBTITLE_SIZE)
        .lineHeight(18)
        .fontColor(this.theme.textSecondary)
        .maxLines(3)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .backgroundColor(this.theme.surface)
    .borderRadius(16)
    .border({ width: 0.8, color: this.theme.divider })
    .transition(livoMotion.enterSoft(index * 18 + 20))
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        if (this.isLoading) {
          Column({ space: 10 }) {
            LoadingProgress()
              .width(26)
              .height(26)
              .color(this.theme.accent)

            Text('正在加载刷新日志')
              .fontSize(PANEL_SUBTITLE_SIZE)
              .fontColor(this.theme.textSecondary)
          }
          .width('100%')
          .padding({ top: 24, bottom: 12 })
          .alignItems(HorizontalAlign.Center)
        } else {
          Row({ space: 10 }) {
            Button('清空日志')
              .type(ButtonType.Capsule)
              .height(36)
              .fontSize(13)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.theme.textPrimary)
              .backgroundColor(this.theme.surface)
              .border({ width: 0.8, color: this.theme.divider })
              .onClick(() => {
                void this.clearLogs()
              })

            Button('刷新列表')
              .type(ButtonType.Capsule)
              .height(36)
              .fontSize(13)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.theme.textPrimary)
              .backgroundColor(this.theme.surface)
              .border({ width: 0.8, color: this.theme.divider })
              .onClick(() => {
                void this.loadData()
              })
          }
          .width('100%')
          .justifyContent(FlexAlign.End)
          .padding({ top: 8, bottom: 10 })

          if (this.logs.length === 0) {
            this.EmptyState()
          } else {
            Column({ space: 10 }) {
              ForEach(this.logs, (log: RefreshLogEntry, index: number) => {
                this.LogCard(log, index)
              }, (log: RefreshLogEntry) => log.id)
            }
            .width('100%')
          }
        }

        Row()
          .height(28)
          .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
    .edgeEffect(EdgeEffect.Spring)
  }
}

@Component
export struct PrivacySettingsPanel {
  @State theme: ThemePalette = ThemeService.currentPalette()

  aboutToAppear(): void {
    void this.loadTheme()
  }

  private async loadTheme(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
  }

  @Builder
  private SheetHandle() {
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

  @Builder
  private PanelHeader() {
    Column() {
      SettingsPanelHeader('隐私', this.theme)
    }
    .width('100%')
    .transition(livoMotion.enterRise(20))
  }

  @Builder
  private InfoRow(symbol: Resource, title: string, subtitle: string) {
    Row({ space: 12 }) {
      SymbolGlyph(symbol)
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])

      Column({ space: PANEL_ROW_TEXT_SPACING }) {
        Text(title)
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(subtitle)
          .fontSize(PANEL_SUBTITLE_SIZE)
          .lineHeight(18)
          .fontColor(this.theme.textSecondary)
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({ left: PANEL_ROW_PADDING_HORIZONTAL, right: PANEL_ROW_PADDING_HORIZONTAL, top: 10, bottom: 10 })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private DividerLine() {
    Row()
      .width('92%')
      .height(0.5)
      .backgroundColor(this.theme.divider)
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        Column() {
          this.InfoRow($r('sys.symbol.person_shield_fill'), '本地优先', '订阅源、文章状态与设置会优先保存在本机，不需要登录即可使用。')
          this.DividerLine()
          this.InfoRow($r('sys.symbol.link'), '网络请求', '仅在刷新订阅、发现内容或加载远程媒体时才会访问网络。')
          this.DividerLine()
          this.InfoRow($r('sys.symbol.externaldrive_fill'), '代理与媒体', '如果你启用了图片代理，远程图片请求会经过代理地址再加载。')
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })

        Row()
          .height(28)
          .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
    .edgeEffect(EdgeEffect.Spring)
  }
}

@Component
export struct AboutSettingsPanel {
  @State theme: ThemePalette = ThemeService.currentPalette()

  aboutToAppear(): void {
    void this.loadTheme()
  }

  private async loadTheme(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
  }

  @Builder
  private SheetHandle() {
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

  @Builder
  private PanelHeader() {
    Column() {
      SettingsPanelHeader('关于', this.theme)
    }
    .width('100%')
    .transition(livoMotion.enterRise(20))
  }

  @Builder
  private InfoRow(title: string, value: string) {
    Row() {
      Text(title)
        .fontSize(PANEL_TITLE_SIZE)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .layoutWeight(1)

      Text(value)
        .fontSize(PANEL_SUBTITLE_SIZE)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({ left: PANEL_ROW_PADDING_HORIZONTAL, right: PANEL_ROW_PADDING_HORIZONTAL, top: 10, bottom: 10 })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private DividerLine() {
    Row()
      .width('92%')
      .height(0.5)
      .backgroundColor(this.theme.divider)
  }

  @Builder
  private SummaryCard() {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.info_circle'))
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])

      Column({ space: PANEL_ROW_TEXT_SPACING }) {
        Text('Harmony 端信息')
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text('当前页面展示应用与项目的基础信息')
          .fontSize(PANEL_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: PANEL_ROW_PADDING_HORIZONTAL,
      right: PANEL_ROW_PADDING_HORIZONTAL,
      top: PANEL_ROW_PADDING_VERTICAL,
      bottom: PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        Column() {
          this.SummaryCard()
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })
        .transition(livoMotion.enterSoft(20))

        Column() {
          this.InfoRow('应用名称', 'Livo')
          this.DividerLine()
          this.InfoRow('Harmony 端', 'ArkTS / ArkUI')
          this.DividerLine()
          this.InfoRow('数据策略', '本地优先')
          this.DividerLine()
          this.InfoRow('项目状态', '开发中')
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })

        Row()
          .height(28)
          .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
    .edgeEffect(EdgeEffect.Spring)
  }
}
