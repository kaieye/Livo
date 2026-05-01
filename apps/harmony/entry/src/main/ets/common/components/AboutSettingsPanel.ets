import { AppRepository } from '../data/AppRepository'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import {
  PANEL_ICON_SIZE,
  PANEL_ROW_MIN_HEIGHT,
  PANEL_ROW_PADDING_HORIZONTAL,
  PANEL_ROW_PADDING_VERTICAL,
  PANEL_ROW_TEXT_SPACING,
  PANEL_SECTION_SPACING,
  PANEL_SUBTITLE_SIZE,
  PANEL_TITLE_SIZE,
  SettingsPanelDividerLine,
  SettingsPanelSheetHandle,
  SettingsPanelTitle,
} from './SettingsPanelShared'

@Component
export struct AboutSettingsPanel {
  @State theme: ThemePalette = ThemeService.currentPalette()
  @Prop useInheritedTheme: boolean = false
  @Prop inheritedTheme: ThemePalette = ThemeService.currentPalette()

  aboutToAppear(): void {
    if (this.useInheritedTheme) {
      this.theme = this.inheritedTheme
      return
    }
    void this.loadTheme()
  }

  private async loadTheme(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
  }

  @Builder
  private SheetHandle() {
    SettingsPanelSheetHandle({ theme: this.theme })
  }

  @Builder
  private PanelHeader() {
    Column() {
      SettingsPanelTitle({ title: '关于', theme: this.theme })
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
    SettingsPanelDividerLine({ theme: this.theme })
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
