import { openArticleDetail } from '../navigation/AppRouter'
import { AppRepository } from '../data/AppRepository'
import { DEFAULT_HARMONY_SETTINGS, EntryCardModel, HarmonySettings } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'

const PANEL_ROW_MIN_HEIGHT: number = 56
const PANEL_ICON_SIZE: number = 22
const PANEL_HEADER_TITLE_SIZE: number = 20
const PANEL_TITLE_SIZE: number = 15
const PANEL_SUBTITLE_SIZE: number = 12
const PANEL_HINT_SIZE: number = 12
const PANEL_HANDLE_TOP_PADDING: number = 10
const PANEL_HANDLE_BOTTOM_PADDING: number = 8
const PANEL_HEADER_SPACING: number = 4
const PANEL_HEADER_MIN_HEIGHT: number = 36
const PANEL_HEADER_TOP_PADDING: number = 0
const PANEL_HEADER_BOTTOM_PADDING: number = 0
const PANEL_ROW_TEXT_SPACING: number = 2
const PANEL_GROUP_SPACING: number = 14
const PANEL_SECTION_SPACING: number = 2
const PANEL_ROW_PADDING_HORIZONTAL: number = 12
const PANEL_ROW_PADDING_VERTICAL: number = 6

@Component
export struct GeneralSettingsPanel {
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State saveHint: string = '通用设置将保存到本地'
  onSettingsChange: (settings: HarmonySettings) => void = () => {}

  aboutToAppear(): void {
    void this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    this.config = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(this.config)
    this.saveHint = '已加载通用配置'
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
      Row() {
        Text('通用')
          .fontSize(PANEL_HEADER_TITLE_SIZE)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
          .width('100%')
      }
      .width('100%')
      .justifyContent(FlexAlign.Start)
    }
    .width('100%')
    .height(PANEL_HEADER_MIN_HEIGHT)
    .justifyContent(FlexAlign.Start)
    .alignItems(HorizontalAlign.Start)
    .padding({ top: PANEL_HEADER_TOP_PADDING, bottom: PANEL_HEADER_BOTTOM_PADDING })
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

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        Column() {
          this.InfoRow($r('sys.symbol.translate_c2e'), '应用语言', '当前界面语言', this.config.language, 0)
          this.DividerLine()
          this.InfoRow($r('sys.symbol.arrow_clockwise'), '刷新间隔', '后台自动刷新频率', `${this.config.refreshIntervalMinutes} 分钟`, 1)
          this.DividerLine()
          this.InfoRow($r('sys.symbol.link'), '默认订阅源', '远程订阅源地址', this.config.remoteFeedUrl ? '已配置' : '未配置', 2)
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })
        .transition(livoMotion.enterSoft(40))

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
      Text('收藏')
        .fontSize(PANEL_HEADER_TITLE_SIZE)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
        .width('100%')
    }
    .width('100%')
    .height(PANEL_HEADER_MIN_HEIGHT)
    .justifyContent(FlexAlign.Start)
    .alignItems(HorizontalAlign.Start)
    .padding({ top: PANEL_HEADER_TOP_PADDING, bottom: PANEL_HEADER_BOTTOM_PADDING })
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

        Column() {
          this.StatusCard(
            $r('sys.symbol.star_fill'),
            '收藏概览',
            this.isLoading
              ? '正在整理你已收藏的文章'
              : this.starredEntries.length > 0
                ? `当前共收藏 ${this.starredEntries.length} 条内容`
                : '还没有收藏任何内容'
          )
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })
        .transition(livoMotion.enterSoft(20))

        if (this.isLoading) {
          Column() {
            this.StatusCard($r('sys.symbol.arrow_clockwise'), '正在加载收藏', '请稍等，Livo 正在同步你的收藏列表')
          }
          .width('100%')
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_LG)
          .border({ width: 0.8, color: this.theme.divider })
          .transition(livoMotion.enterSoft(40))
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
export struct DataControlSettingsPanel {
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State theme: ThemePalette = ThemeService.currentPalette()
  onSettingsChange: (settings: HarmonySettings) => void = () => {}

  aboutToAppear(): void {
    void this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    this.config = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(this.config)
  }

  private syncSettings(next: HarmonySettings): void {
    this.config = next
    this.onSettingsChange(next)
    void AppRepository.persistSettings(next).then((saved: HarmonySettings) => {
      this.config = saved
      this.onSettingsChange(saved)
      void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
        this.theme = palette
      })
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
    Column() {
      Row() {
        Text('数据控制')
          .fontSize(PANEL_HEADER_TITLE_SIZE)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
          .width('100%')
      }
      .width('100%')
      .justifyContent(FlexAlign.Start)
    }
    .width('100%')
    .height(PANEL_HEADER_MIN_HEIGHT)
    .justifyContent(FlexAlign.Start)
    .alignItems(HorizontalAlign.Start)
    .padding({ top: PANEL_HEADER_TOP_PADDING, bottom: PANEL_HEADER_BOTTOM_PADDING })
  }

  @Builder
  private ToggleRow(
    symbol: Resource,
    title: string,
    subtitle: string,
    checked: boolean,
    onToggle: () => void,
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
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Toggle({ type: ToggleType.Switch, isOn: checked })
        .selectedColor(this.theme.accent)
        .switchPointColor('#FFFFFF')
        .hitTestBehavior(HitTestMode.None)
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
    .onClick(() => onToggle())
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        Column() {
          this.ToggleRow(
            $r('sys.symbol.externaldrive_fill'),
            '图片代理',
            '通过代理加载远程图片资源',
            this.config.imageProxyEnabled,
            () => {
              const nextSettings: HarmonySettings = {
                autoRefresh: this.config.autoRefresh,
                aiSummaryEnabled: this.config.aiSummaryEnabled,
                imageProxyEnabled: !this.config.imageProxyEnabled,
                refreshIntervalMinutes: this.config.refreshIntervalMinutes,
                themeMode: this.config.themeMode,
                language: this.config.language,
                remoteFeedUrl: this.config.remoteFeedUrl,
              }
              this.syncSettings(nextSettings)
            },
            0,
          )
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })
        .transition(livoMotion.enterSoft(40))

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
      Row() {
        Text('隐私')
          .fontSize(PANEL_HEADER_TITLE_SIZE)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
          .width('100%')
      }
      .width('100%')
      .justifyContent(FlexAlign.Start)
    }
    .width('100%')
    .height(PANEL_HEADER_MIN_HEIGHT)
    .justifyContent(FlexAlign.Start)
    .alignItems(HorizontalAlign.Start)
    .padding({ top: PANEL_HEADER_TOP_PADDING, bottom: PANEL_HEADER_BOTTOM_PADDING })
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
      Row() {
        Text('关于')
          .fontSize(PANEL_HEADER_TITLE_SIZE)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
          .width('100%')
      }
      .width('100%')
      .justifyContent(FlexAlign.Start)
    }
    .width('100%')
    .height(PANEL_HEADER_MIN_HEIGHT)
    .justifyContent(FlexAlign.Start)
    .alignItems(HorizontalAlign.Start)
    .padding({ top: PANEL_HEADER_TOP_PADDING, bottom: PANEL_HEADER_BOTTOM_PADDING })
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
