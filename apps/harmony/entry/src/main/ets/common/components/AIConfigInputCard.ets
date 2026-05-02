import { SymbolGlyphModifier } from '@kit.ArkUI'
import { AIAssistantSettings, AIProvider } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG } from '../ui/UiTokens'
import {
  aiModelOptions,
  aiProviderDefinition,
  aiProviderOptions,
  resolveNextAIModel,
  SelectOption,
} from '../utils/AIAssistantSettingsResolver'

const PANEL_ROW_MIN_HEIGHT: number = 56
const PANEL_ICON_SIZE: number = 22
const PANEL_TITLE_SIZE: number = 15
const PANEL_SUBTITLE_SIZE: number = 12
const PANEL_HINT_SIZE: number = 12
const PANEL_ROW_TEXT_SPACING: number = 2
const PANEL_ROW_PADDING_HORIZONTAL: number = 12
const PANEL_ROW_PADDING_VERTICAL: number = 8
const INPUT_HEIGHT: number = 36

@Component
export struct AIConfigInputCard {
  @LocalStorageLink('theme') theme: ThemePalette = ThemeService.currentPalette()
  @Prop providerSelection: string = 'deepseek'
  @Prop modelSelection: string = 'deepseek-chat'
  @Prop baseUrlDraft: string = ''
  @Prop apiKeyDraft: string = ''
  @Prop aiConfig: AIAssistantSettings = {} as AIAssistantSettings
  onProviderChange: (provider: string) => void = () => {}
  onModelChange: (model: string) => void = () => {}
  onBaseUrlChange: (baseUrl: string) => void = () => {}
  onApiKeyChange: (apiKey: string) => void = () => {}

  @Builder
  private ProviderOptionMenu() {
    Menu() {
      ForEach(aiProviderOptions(), (option: SelectOption) => {
        MenuItem({
          content: option.label,
          symbolEndIcon: this.providerSelection === option.value
            ? new SymbolGlyphModifier($r('sys.symbol.checkmark'))
            : undefined,
        })
          .selected(this.providerSelection === option.value)
          .onChange((selected: boolean) => {
            if (selected && option.value !== this.providerSelection) {
              this.onProviderChange(option.value)
            }
          })
      }, (option: SelectOption) => option.value)
    }
  }

  @Builder
  private ModelOptionMenu() {
    Menu() {
      ForEach(aiModelOptions(this.providerSelection as AIProvider, this.modelSelection, this.aiConfig.model), (option: SelectOption) => {
        MenuItem({
          content: option.label,
          symbolEndIcon: this.modelSelection === option.value
            ? new SymbolGlyphModifier($r('sys.symbol.checkmark'))
            : undefined,
        })
          .selected(this.modelSelection === option.value)
          .onChange((selected: boolean) => {
            if (selected && option.value !== this.modelSelection) {
              this.onModelChange(option.value)
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

  @Builder
  private ProviderRow(iconDelay: number = 0) {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.gearshape'))
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Text('模型提供商')
        .fontSize(PANEL_TITLE_SIZE)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .layoutWeight(1)

      Row() {
        Text(aiProviderDefinition(this.providerSelection as AIProvider).label)
          .fontSize(PANEL_HINT_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        SymbolGlyph($r('sys.symbol.arrowtriangle_down_fill'))
          .fontSize(11)
          .fontColor([this.theme.textMuted])
          .margin({ left: 7, right: 2, top: 1 })
      }
      .padding({ left: 6, right: 6, top: 8, bottom: 8 })
      .bindMenu(this.ProviderOptionMenu())
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
  private ModelRow(iconDelay: number = 0) {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.doc_text'))
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Text('模型')
        .fontSize(PANEL_TITLE_SIZE)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .layoutWeight(1)

      if (this.providerSelection === 'custom') {
        TextInput({ text: this.modelSelection, placeholder: '如 gpt-4o' })
          .height(36)
          .layoutWeight(1)
          .backgroundColor(this.theme.elevated)
          .fontColor(this.theme.textPrimary)
          .placeholderColor(this.theme.textMuted)
          .fontSize(PANEL_HINT_SIZE)
          .borderRadius(10)
          .padding({ left: 10, right: 10 })
          .textAlign(TextAlign.Center)
          .onChange((nextValue: string) => {
            this.onModelChange(nextValue)
          })
      } else {
        Row() {
          Text(this.modelSelection)
            .fontSize(PANEL_HINT_SIZE)
            .fontColor(this.theme.textSecondary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          SymbolGlyph($r('sys.symbol.arrowtriangle_down_fill'))
            .fontSize(11)
            .fontColor([this.theme.textMuted])
            .margin({ left: 7, right: 2, top: 1 })
        }
        .padding({ left: 6, right: 6, top: 8, bottom: 8 })
        .bindMenu(this.ModelOptionMenu())
      }
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
  private BaseUrlRow(iconDelay: number = 0) {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.link'))
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Text('Base URL')
        .fontSize(PANEL_TITLE_SIZE)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .width(80)
        .flexShrink(0)

      TextInput({ text: this.baseUrlDraft, placeholder: '请输入 Base URL' })
        .height(INPUT_HEIGHT)
        .layoutWeight(1)
        .backgroundColor(this.theme.elevated)
        .fontColor(this.theme.textPrimary)
        .placeholderColor(this.theme.textMuted)
        .fontSize(10)
        .borderRadius(12)
        .padding({ left: 14, right: 14 })
        .textAlign(TextAlign.Start)
        .onChange((nextValue: string) => {
          this.baseUrlDraft = nextValue
          this.onBaseUrlChange(nextValue)
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
  }

  @Builder
  private ApiKeyRow(iconDelay: number = 0) {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.key_horizontal'))
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Text('API Key')
        .fontSize(PANEL_TITLE_SIZE)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .width(80)
        .flexShrink(0)

      TextInput({ text: this.apiKeyDraft, placeholder: '请输入 API Key' })
        .height(36)
        .layoutWeight(1)
        .backgroundColor(this.theme.elevated)
        .fontColor(this.theme.textPrimary)
        .placeholderColor(this.theme.textMuted)
        .fontSize(10)
        .borderRadius(10)
        .padding({ left: 10, right: 10 })
        .textAlign(TextAlign.Start)
        .type(InputType.Password)
        .showPasswordIcon(true)
        .onChange((nextValue: string) => {
          this.apiKeyDraft = nextValue
          this.onApiKeyChange(nextValue)
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
  }

  build() {
    Column() {
      this.ProviderRow(50)
      this.DividerLine()
      this.ModelRow(51)
      this.DividerLine()
      this.BaseUrlRow(52)
      this.DividerLine()
      this.ApiKeyRow(53)
    }
    .width('100%')
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }
}
