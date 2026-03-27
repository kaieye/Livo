import { AppRepository } from '../data/AppRepository'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'

const PANEL_ROW_MIN_HEIGHT: number = 56
const PANEL_ICON_SIZE: number = 22
const PANEL_HEADER_TITLE_SIZE: number = 20
const PANEL_TITLE_SIZE: number = 15
const PANEL_SUBTITLE_SIZE: number = 12
const PANEL_HINT_SIZE: number = 12
const PANEL_HANDLE_TOP_PADDING: number = 14
const PANEL_HANDLE_BOTTOM_PADDING: number = 6
const PANEL_HEADER_SPACING: number = 8
const PANEL_ROW_TEXT_SPACING: number = 2

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
    this.onSettingsChange(this.config)
  }

  @Builder
  private PanelHeader() {
    Column({ space: PANEL_HEADER_SPACING }) {
      Column() {
        Row()
          .width(40)
          .height(4)
          .borderRadius(999)
          .backgroundColor(this.theme.dragHandle)
      }
      .width('100%')
      .padding({ top: PANEL_HANDLE_TOP_PADDING, bottom: PANEL_HANDLE_BOTTOM_PADDING })
      .alignItems(HorizontalAlign.Center)

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
    }
    .width('100%')
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({ left: 12, right: 12, top: 6, bottom: 6 })
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
      Column({ space: 14 }) {
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
    this.onSettingsChange(this.config)
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
  private PanelHeader() {
    Column({ space: PANEL_HEADER_SPACING }) {
      Column() {
        Row()
          .width(40)
          .height(4)
          .borderRadius(999)
          .backgroundColor(this.theme.dragHandle)
      }
      .width('100%')
      .padding({ top: PANEL_HANDLE_TOP_PADDING, bottom: PANEL_HANDLE_BOTTOM_PADDING })
      .alignItems(HorizontalAlign.Center)

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
    .padding({ left: 12, right: 12, top: 6, bottom: 6 })
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => onToggle())
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
      Column({ space: 14 }) {
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
  private PanelHeader() {
    Column({ space: PANEL_HEADER_SPACING }) {
      Column() {
        Row()
          .width(40)
          .height(4)
          .borderRadius(999)
          .backgroundColor(this.theme.dragHandle)
      }
      .width('100%')
      .padding({ top: PANEL_HANDLE_TOP_PADDING, bottom: PANEL_HANDLE_BOTTOM_PADDING })
      .alignItems(HorizontalAlign.Center)

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
    .transition(livoMotion.enterRise(20))
  }

  @Builder
  private TextCard(title: string, content: string) {
    Column({ space: PANEL_HEADER_SPACING }) {
      Text(title)
        .fontSize(PANEL_TITLE_SIZE)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)

      Text(content)
        .fontSize(PANEL_SUBTITLE_SIZE)
        .lineHeight(18)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(16)
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }

  build() {
    Scroll() {
      Column({ space: 14 }) {
        this.PanelHeader()

        Column({ space: 10 }) {
          Column() {
            this.TextCard('本地优先', '订阅源、文章状态与设置会优先保存在本机，不需要登录即可使用。')
          }
          .transition(livoMotion.enterSoft(40))

          Column() {
            this.TextCard('网络请求', '仅在刷新订阅、发现内容或加载远程媒体时才会访问网络。')
          }
          .transition(livoMotion.enterSoft(60))

          Column() {
            this.TextCard('代理与媒体', '如果你启用了图片代理，远程图片请求会经过代理地址再加载。')
          }
          .transition(livoMotion.enterSoft(80))
        }
        .width('100%')

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
  private PanelHeader() {
    Column({ space: PANEL_HEADER_SPACING }) {
      Column() {
        Row()
          .width(40)
          .height(4)
          .borderRadius(999)
          .backgroundColor(this.theme.dragHandle)
      }
      .width('100%')
      .padding({ top: PANEL_HANDLE_TOP_PADDING, bottom: PANEL_HANDLE_BOTTOM_PADDING })
      .alignItems(HorizontalAlign.Center)

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
    .transition(livoMotion.enterRise(20))
  }

  @Builder
  private InfoRow(title: string, value: string) {
    Row() {
      Text(title)
        .fontSize(PANEL_TITLE_SIZE)
        .fontColor(this.theme.textPrimary)
        .layoutWeight(1)

      Text(value)
        .fontSize(PANEL_SUBTITLE_SIZE)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .padding(16)
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }

  build() {
    Scroll() {
      Column({ space: 14 }) {
        this.PanelHeader()

        Column({ space: 10 }) {
          Column() {
            this.InfoRow('应用名称', 'Livo')
          }
          .transition(livoMotion.enterSoft(40))

          Column() {
            this.InfoRow('Harmony 端', 'ArkTS / ArkUI')
          }
          .transition(livoMotion.enterSoft(60))

          Column() {
            this.InfoRow('数据策略', '本地优先')
          }
          .transition(livoMotion.enterSoft(80))

          Column() {
            this.InfoRow('项目状态', '开发中')
          }
          .transition(livoMotion.enterSoft(100))
        }
        .width('100%')

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
