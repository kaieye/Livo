/**
 * Three-tier translation retry policy.
 *
 * Translation is harder than summary because the model may return:
 *   - silence (empty body) when context is too long for the model's window
 *   - garbled output when the prompt's structure conflicts with the input
 *
 * So we degrade progressively:
 *   1. full context  + structural prompt   (≤520 tokens out)
 *   2. compact context (title + summary)   (≤320 tokens out)
 *   3. line-preserved context + line-by-line prompt  (≤560 tokens out)
 *
 * Each tier wraps `runChatCompletion` and normalises the output; an empty
 * normalised result is treated as a failure and triggers the next tier.
 */

import { AIAssistantSettings, AITargetLanguage } from '../../models/LivoModels'
import {
  buildArticleContext,
  buildCompactArticleContext,
  buildTranslationLineContext,
  languageLabel,
} from './ArticleContextBuilder'
import { runChatCompletion } from './ChatCompletionRunner'
import {
  TranslationFormattingHint,
  enhanceTranslationPromptForRetweet,
  normalizeTranslationOutput,
} from './TranslationOutput'

const FULL_TIER_MAX_TOKENS = 520
const COMPACT_TIER_MAX_TOKENS = 320
const LINE_TIER_MAX_TOKENS = 560

const EMPTY_OUTPUT_ERROR = 'AI 返回翻译内容为空'

export async function runTranslation(
  title: string,
  summary: string,
  paragraphs: string[],
  language: AITargetLanguage,
  aiSettings: AIAssistantSettings,
  formattingHint?: TranslationFormattingHint,
): Promise<string> {
  const outputLanguage = languageLabel(language)
  const structuralPrompt = enhanceTranslationPromptForRetweet(
    buildStructuralPrompt(outputLanguage),
    formattingHint,
  )
  const linePrompt = enhanceTranslationPromptForRetweet(
    buildLinePrompt(outputLanguage),
    formattingHint,
  )

  try {
    return await translateOnce(
      structuralPrompt,
      buildArticleContext(title, summary, paragraphs),
      FULL_TIER_MAX_TOKENS,
      aiSettings,
    )
  } catch (_fullError) {
    try {
      return await translateOnce(
        structuralPrompt,
        buildCompactArticleContext(title, summary),
        COMPACT_TIER_MAX_TOKENS,
        aiSettings,
      )
    } catch (_compactError) {
      return await translateOnce(
        linePrompt,
        buildTranslationLineContext(title, summary, paragraphs),
        LINE_TIER_MAX_TOKENS,
        aiSettings,
      )
    }
  }
}

async function translateOnce(
  prompt: string,
  context: string,
  maxTokens: number,
  aiSettings: AIAssistantSettings,
): Promise<string> {
  const raw = await runChatCompletion(prompt, aiSettings, context, maxTokens)
  const normalized = normalizeTranslationOutput(raw)
  if (!normalized) {
    throw new Error(EMPTY_OUTPUT_ERROR)
  }
  return normalized
}

function buildStructuralPrompt(outputLanguage: string): string {
  return `请将给定文章内容翻译为${outputLanguage}：\n` +
    '1. 保留原文事实与专有名词\n' +
    '2. 语气自然、简洁\n' +
    '3. 只输出翻译内容，不加解释，不要输出“标题：”“摘要：”“正文：”等标签\n' +
    '4. 若出现 RT，表示“转发”；RT 下方的人名/账号名不翻译；RT 下方正文视为被转发内容并继续翻译'
}

function buildLinePrompt(outputLanguage: string): string {
  return `请将给定文本逐行翻译为${outputLanguage}，必须保留原文换行结构：\n` +
    '1. 一行原文对应一行译文\n' +
    '2. 空行保留为空行\n' +
    '3. 只输出译文，不加解释或标签'
}
