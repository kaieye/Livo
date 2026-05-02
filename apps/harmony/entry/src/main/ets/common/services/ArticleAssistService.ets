/**
 * Public seam for the article-assist subsystem (AI summarization, translation,
 * and localization for article content).
 *
 * The implementation lives in ./article-assist/ and is split into:
 *   - ChatCompletionRunner:    one HTTP call to the chosen provider, with retry
 *   - ProviderProtocol:        endpoint + format + request-body shaping per provider
 *   - ProviderResponseParser:  pulls reply text out of OpenAI/Anthropic/MiniMax shapes
 *   - ArticleContextBuilder:   shapes article content for prompts; language labels
 *   - TranslationOutput:       sanitises model output; retweet-prompt formatting
 *   - TranslationPipeline:     three-tier retry policy for translateWithAI
 *   - HttpResponseDecoder:     byte-array → string utilities
 *
 * Callers continue to import `ArticleAssistService` and `TranslationFormattingHint`
 * from this file; the seam stays stable while the implementation can evolve underneath.
 */

import { AIAssistantSettings, AITargetLanguage } from '../models/LivoModels'
import {
  buildFallbackSummary,
  buildArticleContext,
  languageLabel,
} from './article-assist/ArticleContextBuilder'
import { runChatCompletion } from './article-assist/ChatCompletionRunner'
import {
  TranslationFormattingHint,
  sanitizeModelOutput,
} from './article-assist/TranslationOutput'
import { runTranslation } from './article-assist/TranslationPipeline'

export { TranslationFormattingHint } from './article-assist/TranslationOutput'

const SUMMARY_MAX_TOKENS = 240
const LOCALIZE_MAX_TOKENS = 160

export class ArticleAssistService {
  static summarizeInLanguage(
    title: string,
    summary: string,
    paragraphs: string[],
    language: AITargetLanguage,
  ): string {
    return buildFallbackSummary(title, summary, paragraphs, language)
  }

  static async summarizeWithAI(
    title: string,
    summary: string,
    paragraphs: string[],
    language: AITargetLanguage,
    aiSettings: AIAssistantSettings,
  ): Promise<string> {
    const articleContext = buildArticleContext(title, summary, paragraphs)
    const outputLanguage = languageLabel(language)
    const prompt =
      `请基于给定文章信息，使用${outputLanguage}生成100字内的精炼摘要，不要编造原文没有的信息`
    return runChatCompletion(prompt, aiSettings, articleContext, SUMMARY_MAX_TOKENS)
  }

  static translateWithAI(
    title: string,
    summary: string,
    paragraphs: string[],
    language: AITargetLanguage,
    aiSettings: AIAssistantSettings,
    formattingHint?: TranslationFormattingHint,
  ): Promise<string> {
    return runTranslation(title, summary, paragraphs, language, aiSettings, formattingHint)
  }

  static async localizeTextWithAI(
    text: string,
    language: AITargetLanguage,
    aiSettings: AIAssistantSettings,
  ): Promise<string> {
    const plainText = (text || '').trim()
    if (!plainText) {
      return ''
    }
    const outputLanguage = languageLabel(language)
    const prompt = `请将以下文本转换为${outputLanguage}，只输出结果，不要解释。`
    const raw = await runChatCompletion(prompt, aiSettings, `文本：${plainText}`, LOCALIZE_MAX_TOKENS)
    return sanitizeModelOutput(raw)
  }
}
