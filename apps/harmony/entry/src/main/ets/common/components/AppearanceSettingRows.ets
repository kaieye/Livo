import { SymbolGlyphModifier } from '@kit.ArkUI'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG } from '../ui/UiTokens'
import { AppearanceOption } from '../utils/AppearanceSettingsResolver'

const ROW_MIN_HEIGHT: number = 56
const ROW_ICON_SIZE: number = 22
const ROW_TITLE_SIZE: number = 15
const ROW_SUBTITLE_SIZE: number = 12
const ROW_TIPS_SIZE: number = 12
const ROW_TEXT_SPACING: number = 2
const ROW_PADDING_HORIZONTAL: number = 12
const ROW_PADDING_VERTICAL: number = 6
const ROW_HINT_FONT_SIZE: number = 12

@Component
export struct AppearanceMenuRow {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop icon: Resource = $r('sys.symbol.circle_righthalf_inset_filled')
  @Prop title: string = ''
  @Prop subtitle: string = ''
  @Prop hint: string = ''
  @Prop options: AppearanceOption[] = []
  @Prop selectedValue: string = ''
  @Prop iconDelay: number = 0
  onSelect: (value: string) => void = () => {}

  @Builder
  private OptionMenu() {
    Menu() {
      ForEach(this.options, (option: AppearanceOption) => {
        MenuItem({
          content: option.label,
          symbolStartIcon: option.color
            ? new SymbolGlyphModifier($r('sys.symbol.paintpalette_fill')).fontColor([option.color])
            : undefined,
          symbolEndIcon: this.selectedValue === option.value
            ? new SymbolGlyphModifier($r('sys.symbol.checkmark'))
            : undefined,
        })
          .selected(this.selectedValue === option.value)
          .onChange((selected: boolean) => {
            if (selected && option.value !== this.selectedValue) {
              this.onSelect(option.value)
            }
          })
      }, (option: AppearanceOption) => option.value)
    }
  }

  build() {
    Row({ space: 12 }) {
      SymbolGlyph(this.icon)
        .fontSize(ROW_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(this.iconDelay))

      Column({ space: ROW_TEXT_SPACING }) {
        Text(this.title)
          .fontSize(ROW_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(this.subtitle)
          .fontSize(ROW_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Row() {
        Text(this.hint)
          .fontSize(ROW_TIPS_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        SymbolGlyph($r('sys.symbol.arrowtriangle_down_fill'))
          .fontSize(ROW_HINT_FONT_SIZE)
          .fontColor([this.theme.textMuted])
          .margin({ left: 7, right: 2, top: 1 })
      }
      .padding({ left: 6, right: 6, top: 8, bottom: 8 })
      .bindMenu(this.OptionMenu())
    }
    .width('100%')
    .constraintSize({ minHeight: ROW_MIN_HEIGHT })
    .padding({
      left: ROW_PADDING_HORIZONTAL,
      right: ROW_PADDING_HORIZONTAL,
      top: ROW_PADDING_VERTICAL,
      bottom: ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
  }
}

@Component
export struct AppearanceUnreadDotRow {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop checked: boolean = false
  @Prop iconDelay: number = 2
  onToggle: (next: boolean) => void = () => {}

  build() {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.sun_max'))
        .fontSize(ROW_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(this.iconDelay))

      Column({ space: ROW_TEXT_SPACING }) {
        Text('显示未读圆点')
          .fontSize(ROW_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text('在未读推文右上角显示圆点标记')
          .fontSize(ROW_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Toggle({ type: ToggleType.Switch, isOn: this.checked })
        .selectedColor(this.theme.accent)
        .switchPointColor('#FFFFFF')
        .onChange((isOn: boolean) => {
          this.onToggle(isOn)
        })
    }
    .width('100%')
    .constraintSize({ minHeight: ROW_MIN_HEIGHT })
    .padding({
      left: ROW_PADDING_HORIZONTAL,
      right: ROW_PADDING_HORIZONTAL,
      top: ROW_PADDING_VERTICAL,
      bottom: ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => this.onToggle(!this.checked))
  }
}
