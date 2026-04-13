import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const articleDetailSource = readFileSync(
  path.join(process.cwd(), 'entry/src/main/ets/pages/ArticleDetail.ets'),
  'utf8',
)

test('article detail AI button is wired to assistant handler', () => {
  assert.match(
    articleDetailSource,
    /\$r\('app\.media\.ri_ai'\),[\s\S]*\(\) => \{ void this\.handleArticleAIAssist\(\) \}/s,
  )
})

test('article detail AI handler uses settings and service translation/summary methods', () => {
  assert.match(
    articleDetailSource,
    /private async runArticleAIAssist\(settings\?: HarmonySettings\): Promise<void> \{/,
  )
  assert.match(articleDetailSource, /resolvedSettings\.aiSummaryEnabled/)
  assert.match(articleDetailSource, /resolvedSettings\.aiTranslationEnabled/)
  assert.match(articleDetailSource, /await AppRepository\.aiSettings\(\)/)
  assert.match(articleDetailSource, /ArticleAssistService\.summarizeWithAI\(/)
  assert.match(articleDetailSource, /ArticleAssistService\.translateWithAI\(/)
})

test('article detail summary fallback should suppress empty-content error noise', () => {
  assert.match(
    articleDetailSource,
    /const fallbackSummary = ArticleAssistService\.summarize\(entry\.title, entry\.summary, entry\.contentParagraphs\)/,
  )
  assert.match(
    articleDetailSource,
    /if \(this\.aiTargetLanguage === 'en'\) \{[\s\S]*this\.aiSummary = fallbackSummary[\s\S]*\} else \{[\s\S]*ArticleAssistService\.localizeTextWithAI\(/s,
  )
  assert.match(
    articleDetailSource,
    /if \(!this\.aiSummary\.trim\(\)\) \{[\s\S]*this\.aiSummaryError = reason[\s\S]*errors\.push\(`摘要失败：\$\{reason\}`\)/s,
  )
})

test('article detail should run AI summary and translation in parallel', () => {
  assert.match(articleDetailSource, /const aiTasks: Promise<void>\[] = \[\]/)
  assert.match(
    articleDetailSource,
    /if \(aiTasks\.length > 0\) \{\s*await Promise\.all\(aiTasks\)\s*\}/s,
  )
})

test('article detail renders AI state panel during processing and on errors', () => {
  assert.match(
    articleDetailSource,
    /private hasAiAssistStatePanel\(\): boolean/,
  )
  assert.match(
    articleDetailSource,
    /if \(this\.hasAiAssistStatePanel\(\)\) \{\s*this\.AIAssistResultSection\(\)\s*\}/s,
  )
  assert.match(articleDetailSource, /Text\('正在生成摘要与翻译\.\.\.'\)/)
  assert.match(
    articleDetailSource,
    /Text\(`翻译失败：\$\{this\.compactErrorMessage\(this\.aiTranslationError, 120\)\}`\)/,
  )
})

test('article detail AI flow provides immediate and error toast feedback', () => {
  assert.match(
    articleDetailSource,
    /this\.showToast\('AI 助手处理中\.\.\.',\s*1200\)/,
  )
  assert.match(
    articleDetailSource,
    /this\.showToast\('请先在 设置 > AI助手 中开启摘要或翻译'\)/,
  )
  assert.match(
    articleDetailSource,
    /const message = `AI 处理失败：\$\{error instanceof Error \? error\.message : String\(error\)\}`[\s\S]*this\.showToast\(message,\s*2600\)/,
  )
  assert.match(
    articleDetailSource,
    /this\.showToast\(this\.compactErrorMessage\(`AI 部分完成：\$\{errors\[0\]\}`\),\s*3000\)/,
  )
  assert.match(
    articleDetailSource,
    /this\.showToast\(this\.compactErrorMessage\(`AI 处理存在错误：\$\{errors\[0\]\}`\),\s*3000\)/,
  )
})

test('article detail renders AI summary and translation result section', () => {
  assert.match(articleDetailSource, /private hasAiAssistResult\(\): boolean/)
  assert.match(
    articleDetailSource,
    /this\.AIAssistResultCard\('AI 摘要', this\.aiSummary\)/,
  )
  assert.match(
    articleDetailSource,
    /this\.AIAssistResultCard\(`AI 翻译（\$\{this\.aiLanguageLabel\(\)\}）`, this\.aiTranslation\)/,
  )
  assert.match(
    articleDetailSource,
    /if \(this\.hasAiAssistStatePanel\(\)\) \{\s*this\.AIAssistResultSection\(\)\s*\}/s,
  )
})
