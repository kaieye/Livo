import { SymbolGlyphModifier } from '@kit.ArkUI'
import { http } from '@kit.NetworkKit'
import { AppRepository } from '../data/AppRepository'
import {
  AIAssistantSettings,
  AI_PROVIDER_OPTIONS,
  AIProviderDefinition,
  AIProvider,
  AITargetLanguage,
  DEFAULT_AI_ASSISTANT_SETTINGS,
  DEFAULT_HARMONY_SETTINGS,
  HarmonySettings,
} from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { PageHeader } from './PageHeader'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'

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

interface SelectOption {
  label: string
  value: string
}

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
  @State baseUrlPlaceholder: string = 'https://api.deepseek.com/v1'
  @State baseUrlDraft: string = ''
  @State apiKeyDraft: string = ''
  @State isTesting: boolean = false
  onSettingsChange: (settings: HarmonySettings) => void = () => {}
  private settingsMutationVersion: number = 0

  private readonly providerOrder: AIProvider[] = [
    'minimax',
    'deepseek',
    'openai',
    'anthropic',
    'glm',
    'custom',
  ]

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
    const normalizedProvider = this.normalizeProvider(settings.provider)
    const providerConfig = this.providerDefinition(normalizedProvider)
    const normalizedModel = providerConfig.models.includes(settings.model)
      ? settings.model
      : (providerConfig.models.length > 0 ? providerConfig.models[0] : settings.model)
    const normalizedSettings: AIAssistantSettings = {
      provider: normalizedProvider,
      apiKeys: settings.apiKeys ?? {},
      baseUrl: settings.baseUrl,
      model: normalizedModel,
      enableSystemPrompt: settings.enableSystemPrompt,
      systemPromptTemplate: settings.systemPromptTemplate,
      chatPersonaPrompt: settings.chatPersonaPrompt,
    }
    this.aiConfig = normalizedSettings
    this.providerSelection = normalizedProvider
    this.modelSelection = normalizedModel
    this.baseUrlPlaceholder = providerConfig.defaultBaseUrl
    this.baseUrlDraft = normalizedSettings.baseUrl
    this.apiKeyDraft = normalizedSettings.apiKeys[normalizedProvider] ?? ''
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

  private providerOptions(): SelectOption[] {
    return this.providerOrder.map((provider: AIProvider): SelectOption => ({
      label: this.providerDefinition(provider).label,
      value: provider,
    }))
  }

  private normalizeProvider(provider: AIProvider): AIProvider {
    return this.providerOrder.includes(provider) ? provider : DEFAULT_AI_ASSISTANT_SETTINGS.provider
  }

  private providerDefinition(provider: AIProvider): AIProviderDefinition {
    const normalizedProvider = this.normalizeProvider(provider)
    switch (normalizedProvider) {
      case 'minimax':
        return AI_PROVIDER_OPTIONS.minimax
      case 'deepseek':
        return AI_PROVIDER_OPTIONS.deepseek
      case 'openai':
        return AI_PROVIDER_OPTIONS.openai
      case 'anthropic':
        return AI_PROVIDER_OPTIONS.anthropic
      case 'glm':
        return AI_PROVIDER_OPTIONS.glm
      case 'custom':
        return AI_PROVIDER_OPTIONS.custom
      default:
        return AI_PROVIDER_OPTIONS.deepseek
    }
  }

  private modelOptions(): SelectOption[] {
    const provider = this.providerDefinition(this.providerSelection as AIProvider)
    if (provider.models.length > 0) {
      return provider.models.map((model: string): SelectOption => ({
        label: model,
        value: model,
      }))
    }

    const fallbackModel = (this.modelSelection || this.aiConfig.model || 'custom-model').trim() || 'custom-model'
    return [{
      label: fallbackModel,
      value: fallbackModel,
    }]
  }

  private resolveNextModel(provider: AIProvider): string {
    const providerConfig = this.providerDefinition(provider)
    if (providerConfig.models.length > 0) {
      return providerConfig.models[0]
    }
    const fallbackModel = (this.modelSelection || this.aiConfig.model || 'custom-model').trim()
    return fallbackModel || 'custom-model'
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
    const providerConfig = this.providerDefinition(provider)
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
    this.syncGeneralSettings({
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: enabled,
      aiSummaryAutoTrigger: this.config.aiSummaryAutoTrigger,
      aiTranslationEnabled: this.config.aiTranslationEnabled,
      aiTranslationLanguage: this.config.aiTranslationLanguage,
      aiTranslationAutoTrigger: this.config.aiTranslationAutoTrigger,
      imageProxyEnabled: this.config.imageProxyEnabled,
      searchAllHomeCategories: this.config.searchAllHomeCategories,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }

  private patchTranslationEnabled(value: boolean): void {
    this.syncGeneralSettings({
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      aiSummaryAutoTrigger: this.config.aiSummaryAutoTrigger,
      aiTranslationEnabled: value,
      aiTranslationLanguage: this.config.aiTranslationLanguage,
      aiTranslationAutoTrigger: this.config.aiTranslationAutoTrigger,
      imageProxyEnabled: this.config.imageProxyEnabled,
      searchAllHomeCategories: this.config.searchAllHomeCategories,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }

  private patchTranslationLanguage(value: AITargetLanguage): void {
    this.syncGeneralSettings({
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      aiSummaryAutoTrigger: this.config.aiSummaryAutoTrigger,
      aiTranslationEnabled: this.config.aiTranslationEnabled,
      aiTranslationLanguage: value,
      aiTranslationAutoTrigger: this.config.aiTranslationAutoTrigger,
      imageProxyEnabled: this.config.imageProxyEnabled,
      searchAllHomeCategories: this.config.searchAllHomeCategories,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }

  private patchTranslationAutoTrigger(value: boolean): void {
    this.syncGeneralSettings({
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      aiSummaryAutoTrigger: this.config.aiSummaryAutoTrigger,
      aiTranslationEnabled: this.config.aiTranslationEnabled,
      aiTranslationLanguage: this.config.aiTranslationLanguage,
      aiTranslationAutoTrigger: value,
      imageProxyEnabled: this.config.imageProxyEnabled,
      searchAllHomeCategories: this.config.searchAllHomeCategories,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }

  private patchSummaryAutoTrigger(value: boolean): void {
    this.syncGeneralSettings({
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      aiSummaryAutoTrigger: value,
      aiTranslationEnabled: this.config.aiTranslationEnabled,
      aiTranslationLanguage: this.config.aiTranslationLanguage,
      aiTranslationAutoTrigger: this.config.aiTranslationAutoTrigger,
      imageProxyEnabled: this.config.imageProxyEnabled,
      searchAllHomeCategories: this.config.searchAllHomeCategories,
      refreshIntervalMinutes: this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
    })
  }

  private readonly translationLanguageOptions: SelectOption[] = [
    { label: '简体中文', value: 'zh-CN' },
    { label: '繁體中文', value: 'zh-TW' },
    { label: 'English', value: 'en' },
    { label: '日本語', value: 'ja' },
    { label: '한국어', value: 'ko' },
    { label: 'Français', value: 'fr' },
    { label: 'Deutsch', value: 'de' },
    { label: 'Español', value: 'es' },
    { label: 'Русский', value: 'ru' },
    { label: 'العربية', value: 'ar' },
  ]

  private translationLanguageLabel(value: AITargetLanguage): string {
    return this.translationLanguageOptions.find((o: SelectOption) => o.value === value)?.label ?? value
  }

  private persistCurrentDraft(): void {
    const trimmedApiKey = this.apiKeyDraft.trim()
    const trimmedBaseUrl = (this.aiConfig.baseUrl || '').trim()
    const trimmedModel = (this.aiConfig.model || '').trim()
    const nextApiKeys: Record<string, string> = this.copyApiKeys(this.aiConfig.apiKeys)
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

  private copyApiKeys(source: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {}
    for (const key of Object.keys(source)) {
      result[key] = source[key]
    }
    return result
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
    const providerConfig = this.providerDefinition(this.providerSelection as AIProvider)
    const baseUrl = (this.aiConfig.baseUrl || '').trim() || providerConfig.defaultBaseUrl
    if (!apiKey || !model || !baseUrl) {
      this.showToast('请先填写 API Key、模型和 Base URL')
      return
    }
    this.isTesting = true
    const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions'

    interface ChatMessage {
      role: string
      content: string
    }
    interface ChatRequest {
      model: string
      messages: ChatMessage[]
      max_tokens: number
    }
    const chatBody: ChatRequest = {
      model,
      messages: [{ role: 'user', content: '简短告诉我你是什么公司的什么模型、是什么版本，不超过15个字' }],
      max_tokens: 80,
    }
    const body = JSON.stringify(chatBody)
    const request = http.createHttp()
    try {
      const response = await request.request(endpoint, {
        method: http.RequestMethod.POST,
        connectTimeout: 10000,
        readTimeout: 15000,
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        extraData: body,
      })
      const raw = String(response.result)
      if (response.responseCode === 200) {
        const parsed = JSON.parse(raw) as Record<string, object>
        const choices = parsed['choices'] as Array<Record<string, object>>
        const message = choices[0]['message'] as Record<string, string>
        const content = (message['content'] || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
        this.showToast(content || '无响应内容', 4000)
      } else {
        this.showToast(`错误 ${response.responseCode}`)
      }
    } catch (error) {
      this.showToast(`连接失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      request.destroy()
      this.isTesting = false
    }
  }

  private shortenUrl(url: string): string {
    if (!url) {
      return ''
    }
    try {
      // 去掉 https:// 前缀，保留 host + path 但截短
      const withoutScheme = url.replace(/^https?:\/\//, '')
      return withoutScheme.length > 28 ? withoutScheme.slice(0, 28) + '…' : withoutScheme
    } catch (_) {
      return url
    }
  }

  private displayBaseUrl(): string {
    const provider = this.providerDefinition(this.providerSelection as AIProvider)
    const current = (this.aiConfig.baseUrl || '').trim()
    if (current) {
      return current
    }
    return provider.defaultBaseUrl
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
  private ActionLabel(label: string) {
    Row({ space: 6 }) {
      Text(label)
        .fontSize(PANEL_HINT_SIZE)
        .fontColor(this.theme.textSecondary)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      SymbolGlyph($r('sys.symbol.arrowtriangle_down_fill'))
        .fontSize(11)
        .fontColor([this.theme.textMuted])
    }
      .padding({ left: 6, right: 6, top: 8, bottom: 8 })
  }

  @Builder
  private SettingActionRow(
    symbol: Resource,
    title: string,
    subtitle: string,
    actionLabel: string,
    onTap: () => void,
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

        Text(subtitle)
          .fontSize(PANEL_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      this.ActionLabel(actionLabel)
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
    .onClick(() => onTap())
  }

  @Builder
  private TranslationLanguageMenu() {
    Menu() {
      ForEach(this.translationLanguageOptions, (option: SelectOption) => {
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
      ForEach(this.translationLanguageOptions, (option: SelectOption) => {
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
          Text(this.translationLanguageLabel(this.config.aiTranslationLanguage))
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
          Text(this.translationLanguageLabel(this.config.aiTranslationLanguage))
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
      ForEach(this.providerOptions(), (option: SelectOption) => {
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
        Text(this.providerDefinition(this.providerSelection as AIProvider).label)
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
  private InlineOptionList(
    options: SelectOption[],
    selectedValue: string,
    onSelect: (value: string) => void,
  ) {
    Column({ space: 0 }) {
      ForEach(options, (option: SelectOption, index: number) => {
        Row({ space: 8 }) {
          Text(option.label)
            .layoutWeight(1)
            .fontSize(14)
            .fontColor(selectedValue === option.value ? this.theme.accent : this.theme.textPrimary)
            .fontWeight(selectedValue === option.value ? FontWeight.Medium : FontWeight.Regular)

          if (selectedValue === option.value) {
            SymbolGlyph($r('sys.symbol.checkmark'))
              .fontSize(14)
              .fontColor([this.theme.accent])
          }
        }
        .width('100%')
        .height(40)
        .padding({ left: 14, right: 14 })
        .clickEffect({ level: ClickEffectLevel.MIDDLE })
        .onClick(() => onSelect(option.value))

        if (index < options.length - 1) {
          Row()
            .width('100%')
            .height(0.5)
            .backgroundColor(this.theme.divider)
        }
      }, (option: SelectOption) => option.value)
    }
    .width('100%')
    .backgroundColor(this.theme.surface)
    .borderRadius(12)
    .padding({ left: 6, right: 6, top: 4, bottom: 4 })
  }

  @Builder
  private SelectionListRow(
    symbol: Resource,
    kind: 'provider' | 'model',
    title: string,
    subtitle: string,
    options: SelectOption[],
    onSelect: (value: string) => void,
    iconDelay: number = 0,
  ) {
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

      Column({ space: 6 }) {
        ForEach(options, (option: SelectOption, index: number) => {
          Column({ space: 0 }) {
            Row({ space: 8 }) {
              Text(option.label)
                .layoutWeight(1)
                .fontSize(15)
                .fontWeight(this.isOptionSelected(kind, option.value) ? FontWeight.Medium : FontWeight.Regular)
                .fontColor(this.isOptionSelected(kind, option.value) ? this.theme.accent : this.theme.textPrimary)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })

              if (this.isOptionSelected(kind, option.value)) {
                SymbolGlyph($r('sys.symbol.checkmark'))
                  .fontSize(15)
                  .fontColor([this.theme.accent])
              }
            }
            .width('100%')
            .height(44)
            .padding({ left: 2, right: 2 })
            .clickEffect({ level: ClickEffectLevel.MIDDLE })
            .onClick(() => onSelect(option.value))

            if (index < options.length - 1) {
              Row()
                .width('100%')
                .height(0.5)
                .backgroundColor(this.theme.divider)
            }
          }
          .width('100%')
        }, (option: SelectOption) => option.value)
      }
      .width('100%')
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

  private isOptionSelected(kind: 'provider' | 'model', value: string): boolean {
    return kind === 'provider'
      ? this.providerSelection === value
      : this.modelSelection === value
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
        .flexShrink(0)

      Text(this.baseUrlPlaceholder)
        .fontSize(10)
        .fontColor(this.theme.textSecondary)
        .layoutWeight(1)
        .textAlign(TextAlign.End)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .wordBreak(WordBreak.BREAK_ALL)
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
          const nextApiKeys: Record<string, string> = this.copyApiKeys(this.aiConfig.apiKeys)
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
        .key(rebuildKey)
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
