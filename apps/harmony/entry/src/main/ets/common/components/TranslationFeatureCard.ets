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
  AI_PANEL_ICON_SIZE,
  AI_PANEL_HINT_SIZE,
  AI_PANEL_ROW_MIN_HEIGHT,
  AI_PANEL_ROW_PADDING_HORIZONTAL,
  AI_PANEL_ROW_PADDING_VERTICAL,
  AI_PANEL_ROW_TEXT_SPACING,
  AI_PANEL_SUBTITLE_SIZE,
  AI_PANEL_TITLE_SIZE,
} from '../ui/AIPanelTokens'
import {
  SelectOption,
  TRANSLATION_LANGUAGE_OPTIONS,
  translationLanguageLabel,
} from '../utils/AIAssistantSettingsResolver'

@Component
export struct TranslationFeatureCard {
  @Prop config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop iconDelay: number = 0
  onTranslationEnabledChange: (enabled: boolean) => void = () => {}
  onTranslationAutoTriggerChange: (enabled: boolean) => void = () => {}
  onTranslationLanguageChange: (language: AITargetLanguage) => void = () => {}

  @Builder
  private TranslationLanguageMenu() {
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
              this.onTranslationLanguageChange(option.value as AITargetLanguage)
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
          .fontSize(AI_PANEL_ICON_SIZE)
          .fontColor([this.theme.accent])
          .transition(livoMotion.enterIconSpin(this.iconDelay))

        Text('目标语言')
          .fontSize(AI_PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .layoutWeight(1)

        Row({ space: 4 }) {
          Text(translationLanguageLabel(this.config.aiTranslationLanguage))
            .fontSize(AI_PANEL_HINT_SIZE)
            .fontColor(this.theme.textSecondary)
            .maxLines(1)

          SymbolGlyph($r('sys.symbol.arrowtriangle_down_fill'))
            .fontSize(11)
            .fontColor([this.theme.textMuted])
        }
        .padding({ left: 6, right: 6, top: 8, bottom: 8 })
        .bindMenu(this.TranslationLanguageMenu())
      }
      .width('100%')
      .constraintSize({ minHeight: AI_PANEL_ROW_MIN_HEIGHT })
      .padding({
        left: AI_PANEL_ROW_PADDING_HORIZONTAL,
        right: AI_PANEL_ROW_PADDING_HORIZONTAL,
        top: AI_PANEL_ROW_PADDING_VERTICAL,
        bottom: AI_PANEL_ROW_PADDING_VERTICAL,
      })

      this.DividerLine()

      Row({ space: 12 }) {
        SymbolGlyph($r('sys.symbol.bolt_fill'))
          .fontSize(AI_PANEL_ICON_SIZE)
          .fontColor([this.theme.accent])
          .transition(livoMotion.enterIconSpin(this.iconDelay + 1))

        Column({ space: AI_PANEL_ROW_TEXT_SPACING }) {
          Text('打开文章自动执行')
            .fontSize(AI_PANEL_TITLE_SIZE)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)

          Text('进入文章页时自动触发，无需手动点击')
            .fontSize(AI_PANEL_SUBTITLE_SIZE)
            .fontColor(this.theme.textSecondary)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        Toggle({ type: ToggleType.Switch, isOn: this.config.aiTranslationAutoTrigger })
          .selectedColor(this.theme.accent)
          .switchPointColor('#FFFFFF')
          .onChange((isOn: boolean) => this.onTranslationAutoTriggerChange(isOn))
      }
      .width('100%')
      .constraintSize({ minHeight: AI_PANEL_ROW_MIN_HEIGHT })
      .padding({
        left: AI_PANEL_ROW_PADDING_HORIZONTAL,
        right: AI_PANEL_ROW_PADDING_HORIZONTAL,
        top: AI_PANEL_ROW_PADDING_VERTICAL,
        bottom: AI_PANEL_ROW_PADDING_VERTICAL,
      })
      .clickEffect({ level: ClickEffectLevel.MIDDLE })
      .onClick(() => this.onTranslationAutoTriggerChange(!this.config.aiTranslationAutoTrigger))

      this.DividerLine()

      Row({ space: 12 }) {
        SymbolGlyph($r('sys.symbol.doc_text_fill'))
          .fontSize(AI_PANEL_ICON_SIZE)
          .fontColor([this.theme.accent])
          .transition(livoMotion.enterIconSpin(this.iconDelay + 2))

        Text('开启 AI 翻译')
          .fontSize(AI_PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .layoutWeight(1)

        Toggle({ type: ToggleType.Switch, isOn: this.config.aiTranslationEnabled })
          .selectedColor(this.theme.accent)
          .switchPointColor('#FFFFFF')
          .onChange((isOn: boolean) => this.onTranslationEnabledChange(isOn))
      }
      .width('100%')
      .constraintSize({ minHeight: AI_PANEL_ROW_MIN_HEIGHT })
      .padding({
        left: AI_PANEL_ROW_PADDING_HORIZONTAL,
        right: AI_PANEL_ROW_PADDING_HORIZONTAL,
        top: AI_PANEL_ROW_PADDING_VERTICAL,
        bottom: AI_PANEL_ROW_PADDING_VERTICAL,
      })
      .clickEffect({ level: ClickEffectLevel.MIDDLE })
      .onClick(() => this.onTranslationEnabledChange(!this.config.aiTranslationEnabled))
    }
    .width('100%')
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }
}
