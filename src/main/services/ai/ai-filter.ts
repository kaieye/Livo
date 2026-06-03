import type OpenAI from 'openai'
import type {
  AIConfig,
  AISemanticFilterDecision,
  AISemanticFilterInput,
} from '../../../shared/types/index'
import { createOpenAIClient, validateAIConfig } from './ai-client'
import { clampContentToBudget } from './ai-prompts'
import { runWithRetry } from './ai-retry'

const MAX_FILTER_TEXT_CHARS = 2400
const FILTER_DECISION_MAX_TOKENS = 180

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function requiredText(value: string, field: string): string {
  const text = normalizeText(value)
  if (!text) throw new Error(`${field} 不能为空`)
  return text
}

export function buildSemanticFilterMessages(
  input: AISemanticFilterInput,
): OpenAI.ChatCompletionMessageParam[] {
  const condition = requiredText(input.condition, '过滤条件')
  const title = requiredText(input.title, '标题')
  const summary = clampContentToBudget(
    normalizeText(input.summary),
    MAX_FILTER_TEXT_CHARS,
  )

  const evidence = [
    `订阅源：${normalizeText(input.feedTitle) || '未知'}`,
    `标题：${title}`,
    input.author ? `作者：${normalizeText(input.author)}` : '',
    input.url ? `URL：${normalizeText(input.url)}` : '',
    summary ? `摘要：${summary}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return [
    {
      role: 'system',
      content:
        '你是文章过滤判定器。只根据给定的标题、摘要和元数据判断文章是否符合过滤条件。输出严格 JSON，不要输出解释性正文。',
    },
    {
      role: 'user',
      content: [
        `过滤条件：${condition}`,
        '',
        '文章信息：',
        evidence,
        '',
        '输出格式：{"matched":true|false,"confidence":0到1之间的数字,"reason":"不超过40字的中文原因"}',
      ].join('\n'),
    },
  ]
}

function extractJsonObject(raw: string): unknown {
  const text = raw.trim()
  if (!text) throw new Error('AI 返回为空')

  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('AI 返回不是 JSON 对象')
    return JSON.parse(text.slice(start, end + 1))
  }
}

function parseConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export function parseSemanticFilterDecision(
  raw: string,
): AISemanticFilterDecision {
  const parsed = extractJsonObject(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI 返回不是 JSON 对象')
  }

  const matched = (parsed as { matched?: unknown }).matched
  if (typeof matched !== 'boolean') {
    throw new Error('AI 返回缺少 matched 布尔值')
  }

  const reason = normalizeText((parsed as { reason?: unknown }).reason)
  return {
    matched,
    confidence: parseConfidence(
      (parsed as { confidence?: unknown }).confidence,
    ),
    reason: reason.slice(0, 80),
  }
}

export async function judgeSemanticFilter(
  input: AISemanticFilterInput,
  config: AIConfig,
): Promise<AISemanticFilterDecision> {
  const configError = validateAIConfig(config)
  if (configError) throw new Error(configError)

  const client = createOpenAIClient(config)
  const messages = buildSemanticFilterMessages(input)

  return runWithRetry(
    async () => {
      const response = await client.chat.completions.create({
        model: config.model,
        messages,
        temperature: 0,
        max_tokens: FILTER_DECISION_MAX_TOKENS,
      })
      return parseSemanticFilterDecision(
        response.choices[0]?.message?.content || '',
      )
    },
    { maxAttempts: 2 },
  )
}
