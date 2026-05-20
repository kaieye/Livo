import { SymbolGlyphModifier } from '@kit.ArkUI'
import { AIAssistantSettings, AIProvider } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG } from '../ui/UiTokens'
import {
  AI_PANEL_ICON_SIZE,
  AI_PANEL_HINT_SIZE,
  AI_PANEL_INPUT_HEIGHT,
  AI_PANEL_ROW_MIN_HEIGHT,
  AI_PANEL_ROW_PADDING_HORIZONTAL,
  AI_PANEL_ROW_PADDING_VERTICAL,
  AI_PANEL_TITLE_SIZE,
} from '../ui/AIPanelTokens'
import {
  aiModelOptions,
  aiProviderDefinition,
  aiProviderOptions,
  SelectOption,
} from '../utils/AIAssistantSettingsResolver'

@Component
export struct AIConfigInputCard {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop providerSelection: string = 'deepseek'
  @Prop modelSelection: string = 'deepseek-v4-flash'
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
        .fontSize(AI_PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Text('模型提供商')
        .fontSize(AI_PANEL_TITLE_SIZE)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .layoutWeight(1)

      Row() {
        Text(aiProviderDefinition(this.providerSelection as AIProvider).label)
          .fontSize(AI_PANEL_HINT_SIZE)
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
    .constraintSize({ minHeight: AI_PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: AI_PANEL_ROW_PADDING_HORIZONTAL,
      right: AI_PANEL_ROW_PADDING_HORIZONTAL,
      top: AI_PANEL_ROW_PADDING_VERTICAL,
      bottom: AI_PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private ModelRow(iconDelay: number = 0) {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.doc_text'))
        .fontSize(AI_PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Text('模型')
        .fontSize(AI_PANEL_TITLE_SIZE)
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
          .fontSize(AI_PANEL_HINT_SIZE)
          .borderRadius(10)
          .padding({ left: 10, right: 10 })
          .textAlign(TextAlign.Center)
          .onChange((nextValue: string) => {
            this.onModelChange(nextValue)
          })
      } else {
        Row() {
          Text(this.modelSelection)
            .fontSize(AI_PANEL_HINT_SIZE)
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
    .constraintSize({ minHeight: AI_PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: AI_PANEL_ROW_PADDING_HORIZONTAL,
      right: AI_PANEL_ROW_PADDING_HORIZONTAL,
      top: AI_PANEL_ROW_PADDING_VERTICAL,
      bottom: AI_PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private BaseUrlRow(iconDelay: number = 0) {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.link'))
        .fontSize(AI_PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Text('Base URL')
        .fontSize(AI_PANEL_TITLE_SIZE)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .width(80)
        .flexShrink(0)

      TextInput({ text: this.baseUrlDraft, placeholder: '请输入 Base URL' })
        .height(AI_PANEL_INPUT_HEIGHT)
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
    .constraintSize({ minHeight: AI_PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: AI_PANEL_ROW_PADDING_HORIZONTAL,
      right: AI_PANEL_ROW_PADDING_HORIZONTAL,
      top: AI_PANEL_ROW_PADDING_VERTICAL,
      bottom: AI_PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private ApiKeyRow(iconDelay: number = 0) {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.key_horizontal'))
        .fontSize(AI_PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Text('API Key')
        .fontSize(AI_PANEL_TITLE_SIZE)
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
    .constraintSize({ minHeight: AI_PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: AI_PANEL_ROW_PADDING_HORIZONTAL,
      right: AI_PANEL_ROW_PADDING_HORIZONTAL,
      top: AI_PANEL_ROW_PADDING_VERTICAL,
      bottom: AI_PANEL_ROW_PADDING_VERTICAL,
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
