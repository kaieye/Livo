import { SymbolGlyphModifier } from '@kit.ArkUI'
import { AppRepository } from '../data/AppRepository'
import {
  AIAssistantSettings,
  AIProvider,
  AITargetLanguage,
  DEFAULT_AI_ASSISTANT_SETTINGS,
  DEFAULT_HARMONY_SETTINGS,
  HarmonySettings,
} from '../models/LivoModels'
import {
  AIAssistantConnectionTestResult,
  AIAssistantConnectionTestService,
} from '../services/AIAssistantConnectionTestService'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { PageHeader } from './PageHeader'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import {
  aiModelOptions,
  aiProviderDefinition,
  aiProviderOptions,
  copyApiKeys,
  patchHarmonyAISettings,
  resolveAIAssistantState,
  resolveNextAIModel,
  SelectOption,
  TRANSLATION_LANGUAGE_OPTIONS,
  translationLanguageLabel,
} from '../utils/AIAssistantSettingsResolver'

const PANEL_ROW_MIN_HEIGHT: number = 56
const PANEL_ICON_SIZE: number = 22
const PANEL_TITLE_SIZE: number = 15
const PANEL_SUBTITLE_SIZE: number = 12
const PANEL_HINT_SIZE: number = 12
const PANEL_HANDLE_TOP_PADDING: number = 10
const PANEL_HANDLE_BOTTOM_PADDING: number = 8
const PANEL_ROW_TEXT_SPACING: number = 2
const PANEL_SECTION_SPACING: number = 14
const PANEL_ROW_PADDING_HORIZONTAL: number = 12
const PANEL_ROW_PADDING_VERTICAL: number = 8
const INPUT_HEIGHT: number = 36

@Builder
function AIPanelHeader(title: string, theme: ThemePalette) {
  PageHeader({
    title,
    theme,
    titleSize: 20,
    topPadding: 0,
    bottomPadding: 0,
  })
}

@Component
export struct AIAssistantSettingsPanel {
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State aiConfig: AIAssistantSettings = DEFAULT_AI_ASSISTANT_SETTINGS
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State saveHint: string = 'AI 助手设置将保存到本地'
  @State providerSelection: string = 'deepseek'
  @State modelSelection: string = 'deepseek-chat'
  @State baseUrlDraft: string = ''
  @State apiKeyDraft: string = ''
  @State isTesting: boolean = false
  onSettingsChange: (settings: HarmonySettings) => void = () => {}
  private settingsMutationVersion: number = 0

  aboutToAppear(): void {
    void this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    try {
      const loadVersion = this.settingsMutationVersion
      const settings = await AppRepository.settings()
      this.config = settings
      this.theme = await ThemeService.resolvePalette(settings)
      const aiSettings = await AppRepository.aiSettings()
      if (loadVersion !== this.settingsMutationVersion) {
        return
      }
      this.applyResolvedAIState(aiSettings)
      this.saveHint = '已加载 AI 助手配置'
    } catch (error) {
      this.saveHint = `加载失败：${error instanceof Error ? error.message : 'unknown error'}`
    }
  }

  private applyResolvedAIState(settings: AIAssistantSettings): void {
    const resolved = resolveAIAssistantState(settings)
    this.aiConfig = resolved.settings
    this.providerSelection = resolved.providerSelection
    this.modelSelection = resolved.modelSelection
    this.baseUrlDraft = resolved.baseUrlDraft
    this.apiKeyDraft = resolved.apiKeyDraft
  }

  private syncGeneralSettings(next: HarmonySettings): void {
    this.config = next
    void AppRepository.persistSettings(next).then((saved: HarmonySettings) => {
      this.config = saved
      this.onSettingsChange(saved)
      void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
        this.theme = palette
      })
      this.saveHint = '已保存 AI 功能设置'
    }).catch((error: Error) => {
      this.saveHint = `保存失败：${error.message}`
    })
  }

  private syncAISettings(next: AIAssistantSettings): void {
    const mutationVersion = this.settingsMutationVersion + 1
    this.settingsMutationVersion = mutationVersion
    this.applyResolvedAIState(next)
    void AppRepository.persistAISettings(next).then((_saved: AIAssistantSettings) => {
      if (mutationVersion !== this.settingsMutationVersion) {
        return
      }
      this.saveHint = '已保存 AI 助手配置'
    }).catch((error: Error) => {
      this.saveHint = `保存失败：${error.message}`
    })
  }

  private modelOptions(): SelectOption[] {
    return aiModelOptions(this.providerSelection as AIProvider, this.modelSelection, this.aiConfig.model)
  }

  private resolveNextModel(provider: AIProvider): string {
    return resolveNextAIModel(provider, this.modelSelection, this.aiConfig.model)
  }

  private applyModel(value: string): void {
    this.modelSelection = value
    this.syncAISettings({
      provider: this.aiConfig.provider,
      apiKeys: this.aiConfig.apiKeys,
      baseUrl: this.aiConfig.baseUrl,
      model: value,
      enableSystemPrompt: this.aiConfig.enableSystemPrompt,
      systemPromptTemplate: this.aiConfig.systemPromptTemplate,
      chatPersonaPrompt: this.aiConfig.chatPersonaPrompt,
    })
  }

  private applyProvider(value: string): void {
    const provider = value as AIProvider
    const nextModel = this.resolveNextModel(provider)
    this.providerSelection = provider
    this.modelSelection = nextModel
    const nextSettings: AIAssistantSettings = {
      provider,
      apiKeys: this.aiConfig.apiKeys,
      baseUrl: '',
      model: nextModel,
      enableSystemPrompt: this.aiConfig.enableSystemPrompt,
      systemPromptTemplate: this.aiConfig.systemPromptTemplate,
      chatPersonaPrompt: this.aiConfig.chatPersonaPrompt,
    }
    this.syncAISettings(nextSettings)
  }

  private applyAISummarySwitch(enabled: boolean): void {
    this.syncGeneralSettings(patchHarmonyAISettings(this.config, { aiSummaryEnabled: enabled }))
  }

  private patchTranslationEnabled(value: boolean): void {
    this.syncGeneralSettings(patchHarmonyAISettings(this.config, { aiTranslationEnabled: value }))
  }

  private patchTranslationLanguage(value: AITargetLanguage): void {
    this.syncGeneralSettings(patchHarmonyAISettings(this.config, { aiTranslationLanguage: value }))
  }

  private patchTranslationAutoTrigger(value: boolean): void {
    this.syncGeneralSettings(patchHarmonyAISettings(this.config, { aiTranslationAutoTrigger: value }))
  }

  private patchSummaryAutoTrigger(value: boolean): void {
    this.syncGeneralSettings(patchHarmonyAISettings(this.config, { aiSummaryAutoTrigger: value }))
  }

  private persistCurrentDraft(): void {
    const trimmedApiKey = this.apiKeyDraft.trim()
    const trimmedBaseUrl = (this.aiConfig.baseUrl || '').trim()
    const trimmedModel = (this.aiConfig.model || '').trim()
    const nextApiKeys: Record<string, string> = copyApiKeys(this.aiConfig.apiKeys)
    nextApiKeys[this.providerSelection] = trimmedApiKey
    const nextSettings: AIAssistantSettings = {
      provider: this.aiConfig.provider,
      apiKeys: nextApiKeys,
      baseUrl: trimmedBaseUrl,
      model: trimmedModel,
      enableSystemPrompt: this.aiConfig.enableSystemPrompt,
      systemPromptTemplate: this.aiConfig.systemPromptTemplate,
      chatPersonaPrompt: this.aiConfig.chatPersonaPrompt,
    }
    this.syncAISettings(nextSettings)
  }

  private showToast(message: string, duration: number = 3000): void {
    try {
      this.getUIContext().getPromptAction().showToast({ message, duration })
    } catch (error) {
      console.error(`showToast failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  private async runConnectionTest(): Promise<void> {
    if (this.isTesting) {
      return
    }
    const apiKey = (this.aiConfig.apiKeys[this.providerSelection] ?? this.apiKeyDraft).trim()
    const model = (this.aiConfig.model || this.modelSelection || '').trim()
    const providerConfig = aiProviderDefinition(this.providerSelection as AIProvider)
    const baseUrl = (this.aiConfig.baseUrl || '').trim() || providerConfig.defaultBaseUrl
    if (!apiKey || !model || !baseUrl) {
      this.showToast('请先填写 API Key、模型和 Base URL')
      return
    }
    this.isTesting = true
    try {
      const result: AIAssistantConnectionTestResult = await AIAssistantConnectionTestService.run({
        provider: this.providerSelection as AIProvider,
        apiKey,
        model,
        baseUrl,
      })
      this.showToast(result.message, result.duration)
    } catch (error) {
      this.showToast(`连接失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.isTesting = false
    }
  }

  @Builder
  private SheetHandle() {
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

  @Builder
  private PanelHeader() {
    AIPanelHeader('AI助手', this.theme)
  }

  @Builder
  private DividerLine() {
    Row()
      .width('92%')
      .height(0.5)
      .backgroundColor(this.theme.divider)
  }

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
              this.patchTranslationLanguage(option.value as AITargetLanguage)
            }
          })
      }, (option: SelectOption) => option.value)
    }
  }

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
              this.patchTranslationLanguage(option.value as AITargetLanguage)
            }
          })
      }, (option: SelectOption) => option.value)
    }
  }

  @Builder
  private TranslationFeatureCard(iconDelay: number) {
    Column() {
      // 语言选择行（带菜单）
      Row({ space: 12 }) {
        SymbolGlyph($r('sys.symbol.translate'))
          .fontSize(PANEL_ICON_SIZE)
          .fontColor([this.theme.accent])
          .transition(livoMotion.enterIconSpin(iconDelay))

        Text('目标语言')
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
        .bindMenu(this.TranslationLanguageMenu())
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

      // 自动触发行
      Row({ space: 12 }) {
        SymbolGlyph($r('sys.symbol.bolt_fill'))
          .fontSize(PANEL_ICON_SIZE)
          .fontColor([this.theme.accent])
          .transition(livoMotion.enterIconSpin(iconDelay + 1))

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

        Toggle({ type: ToggleType.Switch, isOn: this.config.aiTranslationAutoTrigger })
          .selectedColor(this.theme.accent)
          .switchPointColor('#FFFFFF')
          .onChange((isOn: boolean) => this.patchTranslationAutoTrigger(isOn))
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
      .onClick(() => this.patchTranslationAutoTrigger(!this.config.aiTranslationAutoTrigger))

      this.DividerLine()

      // 功能开关行
      Row({ space: 12 }) {
        SymbolGlyph($r('sys.symbol.doc_text_fill'))
          .fontSize(PANEL_ICON_SIZE)
          .fontColor([this.theme.accent])
          .transition(livoMotion.enterIconSpin(iconDelay + 2))

        Text('开启 AI 翻译')
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .layoutWeight(1)

        Toggle({ type: ToggleType.Switch, isOn: this.config.aiTranslationEnabled })
          .selectedColor(this.theme.accent)
          .switchPointColor('#FFFFFF')
          .onChange((isOn: boolean) => this.patchTranslationEnabled(isOn))
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
      .onClick(() => this.patchTranslationEnabled(!this.config.aiTranslationEnabled))
    }
    .width('100%')
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }

  @Builder
  private SummaryFeatureCard(iconDelay: number) {
    Column() {
      // 语言选择行（摘要输出语言，复用翻译语言设置）
      Row({ space: 12 }) {
        SymbolGlyph($r('sys.symbol.translate'))
          .fontSize(PANEL_ICON_SIZE)
          .fontColor([this.theme.accent])
          .transition(livoMotion.enterIconSpin(iconDelay))

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

      // 自动触发行
      Row({ space: 12 }) {
        SymbolGlyph($r('sys.symbol.bolt_fill'))
          .fontSize(PANEL_ICON_SIZE)
          .fontColor([this.theme.accent])
          .transition(livoMotion.enterIconSpin(iconDelay + 1))

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
          .onChange((isOn: boolean) => this.patchSummaryAutoTrigger(isOn))
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
      .onClick(() => this.patchSummaryAutoTrigger(!this.config.aiSummaryAutoTrigger))

      this.DividerLine()

      // 功能开关行
      Row({ space: 12 }) {
        SymbolGlyph($r('sys.symbol.ellipsis_message_fill'))
          .fontSize(PANEL_ICON_SIZE)
          .fontColor([this.theme.accent])
          .transition(livoMotion.enterIconSpin(iconDelay + 2))

        Text('开启 AI 摘要')
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .layoutWeight(1)

        Toggle({ type: ToggleType.Switch, isOn: this.config.aiSummaryEnabled })
          .selectedColor(this.theme.accent)
          .switchPointColor('#FFFFFF')
          .onChange((isOn: boolean) => this.applyAISummarySwitch(isOn))
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
      .onClick(() => this.applyAISummarySwitch(!this.config.aiSummaryEnabled))
    }
    .width('100%')
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }

  @Builder
  private FeatureSectionLabel(label: string, iconDelay: number) {
    Text(label)
      .fontSize(13)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.theme.textSecondary)
      .width('100%')
      .padding({ left: 4, bottom: 2 })
      .transition(livoMotion.enterSoft(iconDelay))
  }

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
              this.applyProvider(option.value)
            }
          })
      }, (option: SelectOption) => option.value)
    }
  }

  @Builder
  private ModelOptionMenu() {
    Menu() {
      ForEach(this.modelOptions(), (option: SelectOption) => {
        MenuItem({
          content: option.label,
          symbolEndIcon: this.modelSelection === option.value
            ? new SymbolGlyphModifier($r('sys.symbol.checkmark'))
            : undefined,
        })
          .selected(this.modelSelection === option.value)
          .onChange((selected: boolean) => {
            if (selected && option.value !== this.modelSelection) {
              this.applyModel(option.value)
            }
          })
      }, (option: SelectOption) => option.value)
    }
  }

  @Builder
  private ProviderActionRow(iconDelay: number = 0) {
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
  private ModelActionRow(iconDelay: number = 0) {
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
            this.modelSelection = nextValue
            this.aiConfig = {
              provider: this.aiConfig.provider,
              apiKeys: this.aiConfig.apiKeys,
              baseUrl: this.aiConfig.baseUrl,
              model: nextValue,
              enableSystemPrompt: this.aiConfig.enableSystemPrompt,
              systemPromptTemplate: this.aiConfig.systemPromptTemplate,
              chatPersonaPrompt: this.aiConfig.chatPersonaPrompt,
            }
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
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Column({ space: PANEL_ROW_TEXT_SPACING }) {
        Text(title)
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        if (subtitle) {
          Text(subtitle)
            .fontSize(PANEL_SUBTITLE_SIZE)
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
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: PANEL_ROW_PADDING_HORIZONTAL,
      right: PANEL_ROW_PADDING_HORIZONTAL,
      top: PANEL_ROW_PADDING_VERTICAL,
      bottom: PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => onToggle(!checked))
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
          this.aiConfig = {
            provider: this.aiConfig.provider,
            apiKeys: this.aiConfig.apiKeys,
            baseUrl: nextValue,
            model: this.aiConfig.model,
            enableSystemPrompt: this.aiConfig.enableSystemPrompt,
            systemPromptTemplate: this.aiConfig.systemPromptTemplate,
            chatPersonaPrompt: this.aiConfig.chatPersonaPrompt,
          }
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
          const nextApiKeys: Record<string, string> = copyApiKeys(this.aiConfig.apiKeys)
          nextApiKeys[this.providerSelection] = nextValue
          this.aiConfig = {
            provider: this.aiConfig.provider,
            apiKeys: nextApiKeys,
            baseUrl: this.aiConfig.baseUrl,
            model: this.aiConfig.model,
            enableSystemPrompt: this.aiConfig.enableSystemPrompt,
            systemPromptTemplate: this.aiConfig.systemPromptTemplate,
            chatPersonaPrompt: this.aiConfig.chatPersonaPrompt,
          }
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
  private ConnectionTestRow(iconDelay: number = 0) {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.wifi'))
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Text('在线连接测试')
        .fontSize(PANEL_TITLE_SIZE)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .layoutWeight(1)

      Button(this.isTesting ? '测试中' : '测试')
        .height(32)
        .padding({ left: 16, right: 16 })
        .backgroundColor(this.isTesting ? this.theme.elevated : this.theme.accent)
        .fontColor(this.isTesting ? this.theme.textMuted : this.theme.accentText)
        .fontSize(13)
        .borderRadius(10)
        .enabled(!this.isTesting)
        .onClick(() => {
          void this.runConnectionTest()
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
  private InputRow(symbol: Resource, title: string, subtitle: string, value: string, placeholder: string,
    onChange: (nextValue: string) => void, iconDelay: number = 0, rebuildKey: string = '') {
    Column({ space: 10 }) {
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
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')

      TextInput({ text: value, placeholder })
        .height(INPUT_HEIGHT)
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

        // AI 翻译卡片
        this.FeatureSectionLabel('AI 翻译', 20)
        this.TranslationFeatureCard(20)

        // AI 摘要卡片
        this.FeatureSectionLabel('AI 摘要', 35)
        this.SummaryFeatureCard(35)

        // 模型配置卡片
        Column() {
          this.ProviderActionRow(50)
          this.DividerLine()
          this.ModelActionRow(51)
          this.DividerLine()
          this.BaseUrlRow(52)
          this.DividerLine()
          this.ApiKeyRow(53)
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })
        .transition(livoMotion.enterSoft(55))

        this.ConnectionTestRow(60)

        Column() {
          this.ToggleRow(
            $r('sys.symbol.ellipsis_message_fill'),
            '启用系统提示词',
            '为 AI 摘要/对话注入系统身份与上下文',
            this.aiConfig.enableSystemPrompt,
            (enabled: boolean) => {
              this.aiConfig = {
                provider: this.aiConfig.provider,
                apiKeys: this.aiConfig.apiKeys,
                baseUrl: this.aiConfig.baseUrl,
                model: this.aiConfig.model,
                enableSystemPrompt: enabled,
                systemPromptTemplate: this.aiConfig.systemPromptTemplate,
                chatPersonaPrompt: this.aiConfig.chatPersonaPrompt,
              }
            },
            65,
          )
          this.DividerLine()
          this.InputRow(
            $r('sys.symbol.list_bullet_square_fill'),
            '系统提示词模板',
            '支持占位符 {{context}} / {{persona}}',
            this.aiConfig.systemPromptTemplate,
            '请输入系统提示词模板',
            (nextValue: string) => {
              this.aiConfig = {
                provider: this.aiConfig.provider,
                apiKeys: this.aiConfig.apiKeys,
                baseUrl: this.aiConfig.baseUrl,
                model: this.aiConfig.model,
                enableSystemPrompt: this.aiConfig.enableSystemPrompt,
                systemPromptTemplate: nextValue,
                chatPersonaPrompt: this.aiConfig.chatPersonaPrompt,
              }
            },
            66,
          )
          this.DividerLine()
          this.InputRow(
            $r('sys.symbol.person'),
            'AI 个性化 Prompt',
            '作为固定提示词附加到每次请求',
            this.aiConfig.chatPersonaPrompt,
            '请输入个性化 Prompt',
            (nextValue: string) => {
              this.aiConfig = {
                provider: this.aiConfig.provider,
                apiKeys: this.aiConfig.apiKeys,
                baseUrl: this.aiConfig.baseUrl,
                model: this.aiConfig.model,
                enableSystemPrompt: this.aiConfig.enableSystemPrompt,
                systemPromptTemplate: this.aiConfig.systemPromptTemplate,
                chatPersonaPrompt: nextValue,
              }
            },
            67,
          )
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })
        .transition(livoMotion.enterSoft(70))

        Row({ space: 10 }) {
          Button('保存 AI 配置')
            .height(42)
            .layoutWeight(1)
            .backgroundColor(this.theme.accent)
            .fontColor(this.theme.accentText)
            .fontSize(14)
            .borderRadius(12)
            .onClick(() => {
              this.persistCurrentDraft()
            })

          Button('重置默认')
            .height(42)
            .layoutWeight(1)
            .backgroundColor(this.theme.elevated)
            .fontColor(this.theme.textPrimary)
            .fontSize(14)
            .borderRadius(12)
            .onClick(() => {
              this.syncAISettings(DEFAULT_AI_ASSISTANT_SETTINGS)
            })
        }
        .width('100%')

        Text(this.saveHint)
          .fontSize(12)
          .fontColor(this.theme.textMuted)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
          .padding({ left: 6, right: 6, top: 2, bottom: 2 })

        Row()
          .height(24)
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
