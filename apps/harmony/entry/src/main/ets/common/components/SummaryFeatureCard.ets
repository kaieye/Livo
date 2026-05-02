import { SymbolGlyphModifier } from '@kit.ArkUI'
import {
  AITargetLanguage,
  DEFAULT_HARMONY_SETTINGS,
  HarmonySettings,
} from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG } from '../ui/UiTokens'
import {
  SelectOption,
  TRANSLATION_LANGUAGE_OPTIONS,
  translationLanguageLabel,
} from '../utils/AIAssistantSettingsResolver'

const PANEL_ROW_MIN_HEIGHT: number = 56
const PANEL_ICON_SIZE: number = 22
const PANEL_TITLE_SIZE: number = 15
const PANEL_SUBTITLE_SIZE: number = 12
const PANEL_HINT_SIZE: number = 12
const PANEL_ROW_TEXT_SPACING: number = 2
const PANEL_ROW_PADDING_HORIZONTAL: number = 12
const PANEL_ROW_PADDING_VERTICAL: number = 8

@Component
export struct SummaryFeatureCard {
  @LocalStorageLink('config') config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @LocalStorageLink('theme') theme: ThemePalette = ThemeService.currentPalette()
  @Prop iconDelay: number = 0
  onSummaryEnabledChange: (enabled: boolean) => void = () => {}
  onSummaryAutoTriggerChange: (enabled: boolean) => void = () => {}
  onSummaryLanguageChange: (language: AITargetLanguage) => void = () => {}

  @Builder
  private SummaryLanguageMenu() {
    Menu() {
      ForEach(TRANSLATION_LANGUAGE_OPTIONS, (option: SelectOption) => {
        MenuItem({
          content: option.label,
          symbolEndIcon: this.config.aiTranslationLanguage === option.value
            ? new SymbolGlyphModifier($r('sys.symbol.checkmark'))
            : undefined,
        })
          .selected(this.config.aiTranslationLanguage === option.value)
          .onChange((selected: boolean) => {
            if (selected && option.value !== this.config.aiTranslationLanguage) {
              this.onSummaryLanguageChange(option.value as AITargetLanguage)
            }
          })
      }, (option: SelectOption) => option.value)
    }
  }

  @Builder
  private DividerLine() {
    Row()
      .width('92%')
      .height(0.5)
      .backgroundColor(this.theme.divider)
  }

  build() {
    Column() {
      Row({ space: 12 }) {
        SymbolGlyph($r('sys.symbol.translate'))
          .fontSize(PANEL_ICON_SIZE)
          .fontColor([this.theme.accent])
          .transition(livoMotion.enterIconSpin(this.iconDelay))

        Text('输出语言')
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .layoutWeight(1)

        Row({ space: 4 }) {
          Text(translationLanguageLabel(this.config.aiTranslationLanguage))
            .fontSize(PANEL_HINT_SIZE)
            .fontColor(this.theme.textSecondary)
            .maxLines(1)

          SymbolGlyph($r('sys.symbol.arrowtriangle_down_fill'))
            .fontSize(11)
            .fontColor([this.theme.textMuted])
        }
        .padding({ left: 6, right: 6, top: 8, bottom: 8 })
        .bindMenu(this.SummaryLanguageMenu())
      }
      .width('100%')
      .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
      .padding({
        left: PANEL_ROW_PADDING_HORIZONTAL,
        right: PANEL_ROW_PADDING_HORIZONTAL,
        top: PANEL_ROW_PADDING_VERTICAL,
        bottom: PANEL_ROW_PADDING_VERTICAL,
      })

      this.DividerLine()

      Row({ space: 12 }) {
        SymbolGlyph($r('sys.symbol.bolt_fill'))
          .fontSize(PANEL_ICON_SIZE)
          .fontColor([this.theme.accent])
          .transition(livoMotion.enterIconSpin(this.iconDelay + 1))

        Column({ space: PANEL_ROW_TEXT_SPACING }) {
          Text('打开文章自动执行')
            .fontSize(PANEL_TITLE_SIZE)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)

          Text('进入文章页时自动触发，无需手动点击')
            .fontSize(PANEL_SUBTITLE_SIZE)
            .fontColor(this.theme.textSecondary)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        Toggle({ type: ToggleType.Switch, isOn: this.config.aiSummaryAutoTrigger })
          .selectedColor(this.theme.accent)
          .switchPointColor('#FFFFFF')
          .onChange((isOn: boolean) => this.onSummaryAutoTriggerChange(isOn))
      }
      .width('100%')
      .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
      .padding({
        left: PANEL_ROW_PADDING_HORIZONTAL,
        right: PANEL_ROW_PADDING_HORIZONTAL,
        top: PANEL_ROW_PADDING_VERTICAL,
        bottom: PANEL_ROW_PADDING_VERTICAL,
      })
      .clickEffect({ level: ClickEffectLevel.MIDDLE })
      .onClick(() => this.onSummaryAutoTriggerChange(!this.config.aiSummaryAutoTrigger))

      this.DividerLine()

      Row({ space: 12 }) {
        SymbolGlyph($r('sys.symbol.ellipsis_message_fill'))
          .fontSize(PANEL_ICON_SIZE)
          .fontColor([this.theme.accent])
          .transition(livoMotion.enterIconSpin(this.iconDelay + 2))

        Text('开启 AI 摘要')
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .layoutWeight(1)

        Toggle({ type: ToggleType.Switch, isOn: this.config.aiSummaryEnabled })
          .selectedColor(this.theme.accent)
          .switchPointColor('#FFFFFF')
          .onChange((isOn: boolean) => this.onSummaryEnabledChange(isOn))
      }
      .width('100%')
      .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
      .padding({
        left: PANEL_ROW_PADDING_HORIZONTAL,
        right: PANEL_ROW_PADDING_HORIZONTAL,
        top: PANEL_ROW_PADDING_VERTICAL,
        bottom: PANEL_ROW_PADDING_VERTICAL,
      })
      .clickEffect({ level: ClickEffectLevel.MIDDLE })
      .onClick(() => this.onSummaryEnabledChange(!this.config.aiSummaryEnabled))
    }
    .width('100%')
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }
}
