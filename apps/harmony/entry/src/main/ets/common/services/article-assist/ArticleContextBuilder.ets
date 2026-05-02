/**
 * Input-shaping for the article-assist chat completions.
 *
 * Three context shapings exist because the translation pipeline degrades
 * progressively when the model returns empty / oversized output:
 *   - full         → title + summary + first 4 paragraphs (≤2200 chars)
 *   - compact      → title + summary only (≤900 chars)
 *   - linePreserved → newline-aware shape so the model can keep RT/quote layout
 *
 * Also owns the per-language label registries used by both the offline
 * fallback summary and the AI prompts.
 */

import { AITargetLanguage } from '../../models/LivoModels'

const FULL_CONTEXT_MAX_CHARS = 2200
const COMPACT_CONTEXT_MAX_CHARS = 900
const LINE_CONTEXT_MAX_CHARS = 2600
const FALLBACK_SUMMARY_MAX_CHARS = 140

export function buildArticleContext(title: string, summary: string, paragraphs: string[]): string {
  const compactParagraphs = compactNonEmpty(paragraphs)
  const contentExcerpt = compactParagraphs.slice(0, 4).join('\n')
  const merged = [
    `标题：${(title || '').trim()}`,
    `摘要：${(summary || '').trim()}`,
    `正文片段：${contentExcerpt}`,
  ].join('\n')
  return merged.slice(0, FULL_CONTEXT_MAX_CHARS)
}

export function buildCompactArticleContext(title: string, summary: string): string {
  const merged = [
    `标题：${(title || '').trim()}`,
    `摘要：${(summary || '').trim()}`,
  ].join('\n')
  return merged.slice(0, COMPACT_CONTEXT_MAX_CHARS)
}

export function buildTranslationLineContext(
  title: string,
  summary: string,
  paragraphs: string[],
): string {
  const compactParagraphs = compactNonEmpty(paragraphs)
  const content = compactParagraphs.slice(0, 6).join('\n\n')
  const merged = [
    (title || '').trim(),
    '',
    (summary || '').trim(),
    '',
    content,
  ].join('\n')
  return merged.slice(0, LINE_CONTEXT_MAX_CHARS)
}

export function buildFallbackSummary(
  title: string,
  summary: string,
  paragraphs: string[],
  language: AITargetLanguage,
): string {
  const compactParagraphs = compactNonEmpty(paragraphs)
  const lead = compactParagraphs.slice(0, 2).join(' ')
  const source = summary.trim() || lead || title
  const trimmed = source.length > FALLBACK_SUMMARY_MAX_CHARS
    ? `${source.slice(0, FALLBACK_SUMMARY_MAX_CHARS)}...`
    : source
  return `${summaryPrefix(language)}${trimmed}`
}

export function languageLabel(language: AITargetLanguage): string {
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

export function summaryPrefix(language: AITargetLanguage): string {
  switch (language) {
    case 'en':
      return 'Summary: '
    case 'ja':
      return '要点: '
    case 'ko':
      return '요약: '
    case 'fr':
      return 'Résumé : '
    case 'de':
      return 'Zusammenfassung: '
    case 'es':
      return 'Resumen: '
    case 'ru':
      return 'Кратко: '
    case 'ar':
      return 'الملخص: '
    case 'zh-TW':
      return '摘要重點：'
    case 'zh-CN':
    default:
      return '摘要重点：'
  }
}

function compactNonEmpty(paragraphs: string[]): string[] {
  return paragraphs
    .map((paragraph: string) => paragraph.trim())
    .filter((paragraph: string) => paragraph.length > 0)
}
