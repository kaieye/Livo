import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const source = readFileSync(
  path.join(
    process.cwd(),
    'entry/src/main/ets/common/services/ArticleAssistService.ets',
  ),
  'utf8',
)

test('article assist service should not use standalone this calls in static methods', () => {
  assert.doesNotMatch(
    source,
    /this\.(buildArticleContext|languageLabel|runChatCompletion|completionEndpoint|providerApiKey|resolveSystemPrompt|sanitizeModelOutput)\(/,
  )
})

test('article assist service should avoid indexed provider option access', () => {
  assert.doesNotMatch(source, /AI_PROVIDER_OPTIONS\[[^\]]+\]/)
})

test('article assist service should support multiple model response content shapes', () => {
  assert.match(
    source,
    /private static extractResponseContent\(parsed: [^)]+\): string/,
  )
  assert.match(source, /output_text/)
  assert.match(source, /parseTextFromContentArray\(messageContent\)/)
  assert.match(source, /reasoning_content/)
})

test('article assist translation should retry with compact context on failure', () => {
  assert.match(
    source,
    /const fullContext = ArticleAssistService\.buildArticleContext\(title, summary, paragraphs\)/,
  )
  assert.match(
    source,
    /const compactContext = ArticleAssistService\.buildCompactArticleContext\(title, summary\)/,
  )
  assert.match(
    source,
    /const enhancedPrompt = ArticleAssistService\.enhanceTranslationPromptForRetweet\(prompt, formattingHint\)/,
  )
  assert.match(
    source,
    /const raw = await ArticleAssistService\.runChatCompletion\(enhancedPrompt, aiSettings, fullContext, 720\)/,
  )
  assert.match(
    source,
    /const raw = await ArticleAssistService\.runChatCompletion\(enhancedPrompt, aiSettings, compactContext, 420\)/,
  )
  assert.match(
    source,
    /const normalized = ArticleAssistService\.normalizeTranslationOutput\(raw\)/,
  )
  assert.match(source, /return normalized/)
})

test('article assist translation prompt should include RT rules and strip heading labels', () => {
  assert.match(
    source,
    /若出现 RT，表示“转发”；RT 下方的人名\/账号名不翻译；RT 下方正文视为被转发内容并继续翻译/,
  )
  assert.match(
    source,
    /private static normalizeTranslationOutput\(content: string\): string/,
  )
  assert.match(
    source,
    /\.map\(\(line: string\) => line\.replace\(\/\^\(标题\|摘要\|正文\|正文片段\|翻译\)\\s\*\[：:\]\\s\*\/g, ''\)\.trim\(\)\)/,
  )
  assert.match(source, /throw new Error\('AI 返回翻译内容为空'\)/)
})
