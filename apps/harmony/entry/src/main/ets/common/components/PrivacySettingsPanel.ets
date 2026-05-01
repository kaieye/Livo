import { AppRepository } from '../data/AppRepository'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import {
  PANEL_ICON_SIZE,
  PANEL_ROW_MIN_HEIGHT,
  PANEL_ROW_PADDING_HORIZONTAL,
  PANEL_ROW_TEXT_SPACING,
  PANEL_SECTION_SPACING,
  PANEL_SUBTITLE_SIZE,
  PANEL_TITLE_SIZE,
  SettingsPanelDividerLine,
  SettingsPanelSheetHandle,
  SettingsPanelTitle,
} from './SettingsPanelShared'

@Component
export struct PrivacySettingsPanel {
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
      SettingsPanelTitle({ title: '隐私', theme: this.theme })
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
    SettingsPanelDividerLine({ theme: this.theme })
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
