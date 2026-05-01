import { ThemePalette, ThemeService } from '../services/ThemeService'
import { PageHeader } from './PageHeader'

export const PANEL_ROW_MIN_HEIGHT: number = 56
export const PANEL_ICON_SIZE: number = 22
export const PANEL_TITLE_SIZE: number = 15
export const PANEL_SUBTITLE_SIZE: number = 12
export const PANEL_HINT_SIZE: number = 12
export const PANEL_HANDLE_TOP_PADDING: number = 10
export const PANEL_HANDLE_BOTTOM_PADDING: number = 8
export const PANEL_ROW_TEXT_SPACING: number = 2
export const PANEL_SECTION_SPACING: number = 2
export const PANEL_ROW_PADDING_HORIZONTAL: number = 12
export const PANEL_ROW_PADDING_VERTICAL: number = 6

export interface SelectOption {
  label: string
  value: string
}

@Component
export struct SettingsPanelTitle {
  @Prop title: string = ''
  @Prop theme: ThemePalette = ThemeService.currentPalette()

  build() {
    PageHeader({
      title: this.title,
      theme: this.theme,
      titleSize: 20,
      topPadding: 0,
      bottomPadding: 0,
    })
  }
}

@Component
export struct SettingsPanelSheetHandle {
  @Prop theme: ThemePalette = ThemeService.currentPalette()

  build() {
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

@Component
export struct SettingsPanelDividerLine {
  @Prop theme: ThemePalette = ThemeService.currentPalette()

  build() {
    Row()
      .width('92%')
      .height(0.5)
      .backgroundColor(this.theme.divider)
  }
}
