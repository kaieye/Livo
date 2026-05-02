import { AIAssistantSettings } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG } from '../ui/UiTokens'
import {
  AI_PANEL_ICON_SIZE,
  AI_PANEL_INPUT_HEIGHT,
  AI_PANEL_ROW_MIN_HEIGHT,
  AI_PANEL_ROW_PADDING_HORIZONTAL,
  AI_PANEL_ROW_PADDING_VERTICAL,
  AI_PANEL_ROW_TEXT_SPACING,
  AI_PANEL_SUBTITLE_SIZE,
  AI_PANEL_TITLE_SIZE,
} from '../ui/AIPanelTokens'

@Component
export struct SystemPromptCard {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop aiConfig: AIAssistantSettings = {} as AIAssistantSettings
  onEnableSystemPromptChange: (enabled: boolean) => void = () => {}
  onSystemPromptTemplateChange: (template: string) => void = () => {}
  onChatPersonaPromptChange: (persona: string) => void = () => {}

  @Builder
  private ToggleRow(
    symbol: Resource,
    title: string,
    subtitle: string,
    checked: boolean,
    onToggle: (nextChecked: boolean) => void,
    iconDelay: number = 0,
  ) {
    Row({ space: 12 }) {
      SymbolGlyph(symbol)
        .fontSize(AI_PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Column({ space: AI_PANEL_ROW_TEXT_SPACING }) {
        Text(title)
          .fontSize(AI_PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        if (subtitle) {
          Text(subtitle)
            .fontSize(AI_PANEL_SUBTITLE_SIZE)
            .fontColor(this.theme.textSecondary)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Toggle({ type: ToggleType.Switch, isOn: checked })
        .selectedColor(this.theme.accent)
        .switchPointColor('#FFFFFF')
        .onChange((isOn: boolean) => onToggle(isOn))
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
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => onToggle(!checked))
  }

  @Builder
  private InputRow(symbol: Resource, title: string, subtitle: string, value: string, placeholder: string,
    onChange: (nextValue: string) => void, iconDelay: number = 0) {
    Column({ space: 10 }) {
      Row({ space: 12 }) {
        SymbolGlyph(symbol)
          .fontSize(AI_PANEL_ICON_SIZE)
          .fontColor([this.theme.accent])
          .transition(livoMotion.enterIconSpin(iconDelay))

        Column({ space: AI_PANEL_ROW_TEXT_SPACING }) {
          Text(title)
            .fontSize(AI_PANEL_TITLE_SIZE)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)

          Text(subtitle)
            .fontSize(AI_PANEL_SUBTITLE_SIZE)
            .fontColor(this.theme.textSecondary)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')

      TextInput({ text: value, placeholder })
        .height(AI_PANEL_INPUT_HEIGHT)
        .width('100%')
        .backgroundColor(this.theme.elevated)
        .fontColor(this.theme.textPrimary)
        .placeholderColor(this.theme.textMuted)
        .borderRadius(12)
        .padding({ left: 14, right: 14 })
        .onChange((nextValue: string) => {
          onChange(nextValue)
        })
    }
    .width('100%')
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
  private DividerLine() {
    Row()
      .width('92%')
      .height(0.5)
      .backgroundColor(this.theme.divider)
  }

  build() {
    Column() {
      this.ToggleRow(
        $r('sys.symbol.ellipsis_message_fill'),
        '启用系统提示词',
        '为 AI 摘要/对话注入系统身份与上下文',
        this.aiConfig.enableSystemPrompt,
        (enabled: boolean) => this.onEnableSystemPromptChange(enabled),
        65,
      )
      this.DividerLine()
      this.InputRow(
        $r('sys.symbol.list_bullet_square_fill'),
        '系统提示词模板',
        '支持占位符 {{context}} / {{persona}}',
        this.aiConfig.systemPromptTemplate,
        '请输入系统提示词模板',
        (nextValue: string) => this.onSystemPromptTemplateChange(nextValue),
        66,
      )
      this.DividerLine()
      this.InputRow(
        $r('sys.symbol.person'),
        'AI 个性化 Prompt',
        '作为固定提示词附加到每次请求',
        this.aiConfig.chatPersonaPrompt,
        '请输入个性化 Prompt',
        (nextValue: string) => this.onChatPersonaPromptChange(nextValue),
        67,
      )
    }
    .width('100%')
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }
}
