import { ArticleAssistService, TranslationFormattingHint } from '../services/ArticleAssistService'
import { AppPreferenceService } from '../services/AppPreferenceService'
import {
  AIAssistantSettings,
  AITargetLanguage,
  ArticleDetailModel,
  HarmonySettings,
} from '../models/LivoModels'

export interface ArticleAIAssistOwner {
  aiSummary: string
  aiTranslation: string
  aiSummaryError: string
  aiTranslationError: string
  aiResultEntryId: string
  actionHint: string
  showToast(message: string, duration?: number): void
}

export interface ArticleAIAssistRunArgs {
  entry: ArticleDetailModel
  summaryEnabled: boolean
  translationEnabled: boolean
  targetLanguage: AITargetLanguage
  formattingHint?: TranslationFormattingHint
}

/**
 * Orchestrates AI summary/translation for an article entry.
 *
 * The owner exposes the @State fields directly (so writes propagate through
 * ArkUI's reactivity); this class supplies the orchestration: fallback
 * localization, partial-error reporting, and progress hints.
 */
export class ArticleAIAssistViewModel {
  private readonly owner: ArticleAIAssistOwner

  constructor(owner: ArticleAIAssistOwner) {
    this.owner = owner
  }

  static labelFor(language: AITargetLanguage): string {
    switch (language) {
      case 'zh-CN':
        return '简体中文'
      case 'zh-TW':
        return '繁体中文'
      case 'en':
        return 'English'
      case 'ja':
        return '日本語'
      case 'ko':
        return '한국어'
      case 'fr':
        return 'Français'
      case 'de':
        return 'Deutsch'
      case 'es':
        return 'Español'
      case 'ru':
        return 'Русский'
      case 'ar':
        return 'العربية'
      default:
        return language
    }
  }

  static compactErrorMessage(message: string, maxLength: number = 88): string {
    const normalized = (message || '').replace(/\s+/g, ' ').trim()
    if (!normalized) {
      return '未知错误'
    }
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
  }

  static shouldAutoTrigger(settings: HarmonySettings): boolean {
    return (settings.aiSummaryEnabled && settings.aiSummaryAutoTrigger)
      || (settings.aiTranslationEnabled && settings.aiTranslationAutoTrigger)
  }

  private static isChineseLanguage(language: AITargetLanguage): boolean {
    return language === 'zh-CN' || language === 'zh-TW'
  }

  private static containsCjk(value: string): boolean {
    return /[㐀-鿿]/.test(value || '')
  }

  async run(args: ArticleAIAssistRunArgs): Promise<void> {
    const summaryEnabled = args.summaryEnabled
    const translationEnabled = args.translationEnabled

    if (!summaryEnabled && !translationEnabled) {
      this.owner.actionHint = '请先在 设置 > AI助手 中开启摘要或翻译'
      this.owner.showToast('请先在 设置 > AI助手 中开启摘要或翻译')
      return
    }

    this.owner.actionHint = 'AI 助手处理中...'
    this.owner.showToast('AI 助手处理中...', 1200)
    this.owner.aiSummaryError = ''
    this.owner.aiTranslationError = ''

    const errors: string[] = []
    let summaryReady = false
    let translationReady = false

    try {
      const aiSettings: AIAssistantSettings = await AppPreferenceService.loadAISettings()
      this.owner.aiResultEntryId = args.entry.id

      const tasks: Promise<void>[] = []

      if (summaryEnabled) {
        tasks.push(this.runSummaryTask(args.entry, args.targetLanguage, aiSettings, errors)
          .then((didSucceed: boolean) => { summaryReady = didSucceed }))
      }

      if (translationEnabled) {
        tasks.push(this.runTranslationTask(args.entry, args.targetLanguage, aiSettings, args.formattingHint, errors)
          .then((didSucceed: boolean) => { translationReady = didSucceed }))
      }

      if (tasks.length > 0) {
        await Promise.all(tasks)
      }

      this.reportRunOutcome(errors, summaryReady, translationReady, summaryEnabled, translationEnabled)
    } catch (error) {
      const message = `AI 处理失败：${error instanceof Error ? error.message : String(error)}`
      this.owner.actionHint = message
      this.owner.showToast(message, 2600)
    }
  }

  private async runSummaryTask(
    entry: ArticleDetailModel,
    targetLanguage: AITargetLanguage,
    aiSettings: AIAssistantSettings,
    errors: string[],
  ): Promise<boolean> {
    try {
      const summary = await ArticleAssistService.summarizeWithAI(
        entry.title,
        entry.summary,
        entry.contentParagraphs,
        targetLanguage,
        aiSettings,
      )
      this.owner.aiSummary = summary
      return !!summary.trim()
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      const fallback = await this.fallbackLocalizedSummary(entry, targetLanguage, aiSettings)
      this.owner.aiSummary = fallback
      if (!fallback.trim()) {
        this.owner.aiSummaryError = reason
        errors.push(`摘要失败：${reason}`)
        return false
      }
      return true
    }
  }

  private async fallbackLocalizedSummary(
    entry: ArticleDetailModel,
    targetLanguage: AITargetLanguage,
    aiSettings: AIAssistantSettings,
  ): Promise<string> {
    const fallbackSummary = ArticleAssistService.summarizeInLanguage(
      entry.title,
      entry.summary,
      entry.contentParagraphs,
      targetLanguage,
    )
    if (targetLanguage === 'en') {
      return fallbackSummary
    }
    try {
      const localized = await ArticleAssistService.localizeTextWithAI(
        fallbackSummary,
        targetLanguage,
        aiSettings,
      )
      if (ArticleAIAssistViewModel.isChineseLanguage(targetLanguage)
        && !ArticleAIAssistViewModel.containsCjk(localized)) {
        return ''
      }
      return localized.trim()
    } catch (_localizeError) {
      return ''
    }
  }

  private async runTranslationTask(
    entry: ArticleDetailModel,
    targetLanguage: AITargetLanguage,
    aiSettings: AIAssistantSettings,
    formattingHint: TranslationFormattingHint | undefined,
    errors: string[],
  ): Promise<boolean> {
    try {
      const translation = await ArticleAssistService.translateWithAI(
        entry.title,
        entry.summary,
        entry.contentParagraphs,
        targetLanguage,
        aiSettings,
        formattingHint,
      )
      this.owner.aiTranslation = translation
      return !!translation.trim()
    } catch (error) {
      this.owner.aiTranslation = ''
      const reason = error instanceof Error ? error.message : String(error)
      this.owner.aiTranslationError = reason
      errors.push(`翻译失败：${reason}`)
      return false
    }
  }

  private reportRunOutcome(
    errors: string[],
    summaryReady: boolean,
    translationReady: boolean,
    summaryEnabled: boolean,
    translationEnabled: boolean,
  ): void {
    if (errors.length === 0) {
      this.owner.actionHint = 'AI 处理完成'
      this.owner.showToast('AI 处理完成')
      return
    }

    if (errors.length === 1 && (summaryEnabled || translationEnabled)) {
      if (summaryReady && !translationReady) {
        this.owner.actionHint = `摘要已完成，翻译失败：${errors[0]}`
        this.owner.showToast(ArticleAIAssistViewModel.compactErrorMessage(`AI 摘要已完成，翻译失败：${errors[0]}`), 3000)
        return
      }
      if (!summaryReady && translationReady) {
        this.owner.actionHint = `翻译已完成，摘要失败：${errors[0]}`
        this.owner.showToast(ArticleAIAssistViewModel.compactErrorMessage(`AI 翻译已完成，摘要失败：${errors[0]}`), 3000)
        return
      }
      this.owner.actionHint = `部分完成：${errors[0]}`
      this.owner.showToast(ArticleAIAssistViewModel.compactErrorMessage(`AI 部分完成：${errors[0]}`), 3000)
      return
    }

    this.owner.actionHint = errors.join('；')
    this.owner.showToast(ArticleAIAssistViewModel.compactErrorMessage(`AI 处理存在错误：${errors[0]}`), 3000)
  }
}
