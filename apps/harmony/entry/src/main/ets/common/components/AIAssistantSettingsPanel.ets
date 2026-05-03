import { AppPreferenceService } from '../services/AppPreferenceService'
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
  AI_PANEL_HANDLE_BOTTOM_PADDING,
  AI_PANEL_HANDLE_TOP_PADDING,
  AI_PANEL_ICON_SIZE,
  AI_PANEL_ROW_MIN_HEIGHT,
  AI_PANEL_ROW_PADDING_HORIZONTAL,
  AI_PANEL_ROW_PADDING_VERTICAL,
  AI_PANEL_SECTION_SPACING,
  AI_PANEL_TITLE_SIZE,
} from '../ui/AIPanelTokens'
import {
  aiProviderDefinition,
  copyApiKeys,
  patchAIAssistantSettings,
  patchHarmonyAISettings,
  resolveAIAssistantState,
  resolveNextAIModel,
} from '../utils/AIAssistantSettingsResolver'
import { TranslationFeatureCard } from './TranslationFeatureCard'
import { SummaryFeatureCard } from './SummaryFeatureCard'
import { AIConfigInputCard } from './AIConfigInputCard'
import { SystemPromptCard } from './SystemPromptCard'

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
      const settings = await AppPreferenceService.loadSettings()
      this.config = settings
      this.theme = await ThemeService.resolvePalette(settings)
      const aiSettings = await AppPreferenceService.loadAISettings()
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
    void AppPreferenceService.saveSettings(next).then((saved: HarmonySettings) => {
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
    void AppPreferenceService.saveAISettings(next).then((_saved: AIAssistantSettings) => {
      if (mutationVersion !== this.settingsMutationVersion) {
        return
      }
      this.saveHint = '已保存 AI 助手配置'
    }).catch((error: Error) => {
      this.saveHint = `保存失败：${error.message}`
    })
  }

  private applyModel(value: string): void {
    this.modelSelection = value
    this.syncAISettings(patchAIAssistantSettings(this.aiConfig, { model: value }))
  }

  private applyProvider(value: string): void {
    const provider = value as AIProvider
    const nextModel = resolveNextAIModel(provider, this.modelSelection, this.aiConfig.model)
    this.providerSelection = provider
    this.modelSelection = nextModel
    this.syncAISettings(patchAIAssistantSettings(this.aiConfig, {
      provider,
      baseUrl: '',
      model: nextModel,
    }))
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

  private updateBaseUrlDraft(nextValue: string): void {
    this.baseUrlDraft = nextValue
    this.aiConfig = patchAIAssistantSettings(this.aiConfig, { baseUrl: nextValue })
  }

  private updateApiKeyDraft(nextValue: string): void {
    this.apiKeyDraft = nextValue
    const nextApiKeys: Record<string, string> = copyApiKeys(this.aiConfig.apiKeys)
    nextApiKeys[this.providerSelection] = nextValue
    this.aiConfig = patchAIAssistantSettings(this.aiConfig, { apiKeys: nextApiKeys })
  }

  private updateModelDraft(nextValue: string): void {
    this.modelSelection = nextValue
    this.aiConfig = patchAIAssistantSettings(this.aiConfig, { model: nextValue })
  }

  private updateEnableSystemPrompt(enabled: boolean): void {
    this.aiConfig = patchAIAssistantSettings(this.aiConfig, { enableSystemPrompt: enabled })
  }

  private updateSystemPromptTemplate(nextValue: string): void {
    this.aiConfig = patchAIAssistantSettings(this.aiConfig, { systemPromptTemplate: nextValue })
  }

  private updateChatPersonaPrompt(nextValue: string): void {
    this.aiConfig = patchAIAssistantSettings(this.aiConfig, { chatPersonaPrompt: nextValue })
  }

  private persistCurrentDraft(): void {
    const trimmedApiKey = this.apiKeyDraft.trim()
    const trimmedBaseUrl = (this.aiConfig.baseUrl || '').trim()
    const trimmedModel = (this.aiConfig.model || '').trim()
    const nextApiKeys: Record<string, string> = copyApiKeys(this.aiConfig.apiKeys)
    nextApiKeys[this.providerSelection] = trimmedApiKey
    this.syncAISettings(patchAIAssistantSettings(this.aiConfig, {
      apiKeys: nextApiKeys,
      baseUrl: trimmedBaseUrl,
      model: trimmedModel,
    }))
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
    .padding({ top: AI_PANEL_HANDLE_TOP_PADDING, bottom: AI_PANEL_HANDLE_BOTTOM_PADDING })
  }

  @Builder
  private PanelHeader() {
    PageHeader({
      title: 'AI助手',
      theme: this.theme,
      titleSize: 20,
      topPadding: 0,
      bottomPadding: 0,
    })
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
  private ConnectionTestRow(iconDelay: number = 0) {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.wifi'))
        .fontSize(AI_PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Text('在线连接测试')
        .fontSize(AI_PANEL_TITLE_SIZE)
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
  private ActionButtons() {
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
  }

  build() {
    Scroll() {
      Column({ space: AI_PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        this.FeatureSectionLabel('AI 翻译', 20)
        TranslationFeatureCard({
          config: this.config,
          theme: this.theme,
          iconDelay: 20,
          onTranslationEnabledChange: (enabled: boolean) => this.patchTranslationEnabled(enabled),
          onTranslationAutoTriggerChange: (enabled: boolean) => this.patchTranslationAutoTrigger(enabled),
          onTranslationLanguageChange: (language: AITargetLanguage) => this.patchTranslationLanguage(language),
        })

        this.FeatureSectionLabel('AI 摘要', 35)
        SummaryFeatureCard({
          config: this.config,
          theme: this.theme,
          iconDelay: 35,
          onSummaryEnabledChange: (enabled: boolean) => this.applyAISummarySwitch(enabled),
          onSummaryAutoTriggerChange: (enabled: boolean) => this.patchSummaryAutoTrigger(enabled),
          onSummaryLanguageChange: (language: AITargetLanguage) => this.patchTranslationLanguage(language),
        })

        AIConfigInputCard({
          theme: this.theme,
          providerSelection: this.providerSelection,
          modelSelection: this.modelSelection,
          baseUrlDraft: this.baseUrlDraft,
          apiKeyDraft: this.apiKeyDraft,
          aiConfig: this.aiConfig,
          onProviderChange: (provider: string) => this.applyProvider(provider),
          onModelChange: (model: string) => {
            if (this.providerSelection === 'custom') {
              this.updateModelDraft(model)
            } else {
              this.applyModel(model)
            }
          },
          onBaseUrlChange: (baseUrl: string) => this.updateBaseUrlDraft(baseUrl),
          onApiKeyChange: (apiKey: string) => this.updateApiKeyDraft(apiKey),
        })

        this.ConnectionTestRow(60)

        SystemPromptCard({
          theme: this.theme,
          aiConfig: this.aiConfig,
          onEnableSystemPromptChange: (enabled: boolean) => this.updateEnableSystemPrompt(enabled),
          onSystemPromptTemplateChange: (template: string) => this.updateSystemPromptTemplate(template),
          onChatPersonaPromptChange: (persona: string) => this.updateChatPersonaPrompt(persona),
        })

        this.ActionButtons()

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
