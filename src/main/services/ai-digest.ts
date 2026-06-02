import type OpenAI from 'openai'
import { clampContentToBudget } from './ai-prompts'

export interface DigestCandidate {
  id: string
  title: string
  summary?: string
  content?: string
  feedTitle?: string
  url?: string
  publishedAt?: number
}

export interface DigestRerankInput {
  topic: string
  candidates: DigestCandidate[]
  maxIds?: number
}

export interface DigestRerankSelection {
  ids: string[]
  rejectedIds: string[]
}

export interface DigestBudgetOptions {
  totalContextChars?: number
  promptReserveChars?: number
  maxArticlesPerBatch?: number
  maxArticleChars?: number
  minArticleChars?: number
}

export interface DigestArticleSnippet {
  id: string
  title: string
  text: string
  feedTitle?: string
  url?: string
  publishedAt?: number
}

export interface DigestBatch {
  index: number
  articles: DigestArticleSnippet[]
}

export interface DigestBudgetPlan {
  articleCharBudget: number
  batches: DigestBatch[]
}

const DEFAULT_TOTAL_CONTEXT_CHARS = 60_000
const DEFAULT_PROMPT_RESERVE_CHARS = 6_000
const DEFAULT_MAX_ARTICLES_PER_BATCH = 4
const DEFAULT_MAX_ARTICLE_CHARS = 8_000
const DEFAULT_MIN_ARTICLE_CHARS = 600

function normalizeText(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function normalizeId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function clampDigestText(value: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  return clampContentToBudget(value, maxChars)
}

function extractJsonPayload(raw: string): unknown {
  const text = raw.trim()
  if (!text) throw new Error('AI 返回为空')

  try {
    return JSON.parse(text)
  } catch {
    const arrayStart = text.indexOf('[')
    const arrayEnd = text.lastIndexOf(']')
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      return JSON.parse(text.slice(arrayStart, arrayEnd + 1))
    }

    const objectStart = text.indexOf('{')
    const objectEnd = text.lastIndexOf('}')
    if (objectStart !== -1 && objectEnd > objectStart) {
      return JSON.parse(text.slice(objectStart, objectEnd + 1))
    }
  }

  throw new Error('AI 返回不是可解析的 JSON')
}

function readIdsFromPayload(payload: unknown): string[] {
  if (Array.isArray(payload)) return payload.map(normalizeId).filter(Boolean)
  if (!payload || typeof payload !== 'object') return []

  const object = payload as Record<string, unknown>
  const candidates = [object.ids, object.selectedIds, object.articleIds]
  const ids = candidates.find(Array.isArray)
  return Array.isArray(ids) ? ids.map(normalizeId).filter(Boolean) : []
}

export function buildDigestRerankMessages(
  input: DigestRerankInput,
): OpenAI.ChatCompletionMessageParam[] {
  const maxIds = Math.max(1, input.maxIds ?? 12)
  const candidates = input.candidates.map((candidate) => ({
    id: candidate.id,
    title: normalizeText(candidate.title),
    feedTitle: normalizeText(candidate.feedTitle),
    summary: clampContentToBudget(
      normalizeText(candidate.summary || candidate.content),
      700,
    ),
  }))

  return [
    {
      role: 'system',
      content:
        '你是文章候选集筛选器。只能从候选 id 中选择，输出严格 JSON，不要编造 id。',
    },
    {
      role: 'user',
      content: JSON.stringify({
        topic: normalizeText(input.topic),
        maxIds,
        candidates,
        output: { ids: ['候选 id'] },
      }),
    },
  ]
}

export function selectValidDigestRerankIds(
  raw: string,
  candidateIds: Iterable<string>,
  limit = Number.POSITIVE_INFINITY,
): DigestRerankSelection {
  const allowed = new Set(Array.from(candidateIds))
  const seen = new Set<string>()
  const ids: string[] = []
  const rejectedIds: string[] = []
  const parsedIds = readIdsFromPayload(extractJsonPayload(raw))

  for (const id of parsedIds) {
    if (!allowed.has(id)) {
      rejectedIds.push(id)
      continue
    }
    if (seen.has(id)) continue
    seen.add(id)
    if (ids.length < limit) ids.push(id)
  }

  return { ids, rejectedIds }
}

export function getDigestArticleCharBudget(
  articleCount: number,
  options: DigestBudgetOptions = {},
): number {
  if (articleCount <= 0) return 0

  const totalContextChars =
    options.totalContextChars ?? DEFAULT_TOTAL_CONTEXT_CHARS
  const promptReserveChars =
    options.promptReserveChars ?? DEFAULT_PROMPT_RESERVE_CHARS
  const maxArticleChars = options.maxArticleChars ?? DEFAULT_MAX_ARTICLE_CHARS
  const minArticleChars = options.minArticleChars ?? DEFAULT_MIN_ARTICLE_CHARS
  const usableChars = Math.max(0, totalContextChars - promptReserveChars)
  const rawBudget = Math.floor(usableChars / articleCount)

  if (rawBudget <= 0) return 0
  if (rawBudget < minArticleChars) return rawBudget
  return Math.min(maxArticleChars, rawBudget)
}

export function buildDigestBudgetPlan(
  candidates: DigestCandidate[],
  options: DigestBudgetOptions = {},
): DigestBudgetPlan {
  const articleCharBudget = getDigestArticleCharBudget(
    candidates.length,
    options,
  )
  const maxArticlesPerBatch = Math.max(
    1,
    options.maxArticlesPerBatch ?? DEFAULT_MAX_ARTICLES_PER_BATCH,
  )
  const batches: DigestBatch[] = []

  for (let index = 0; index < candidates.length; index += maxArticlesPerBatch) {
    const articles = candidates
      .slice(index, index + maxArticlesPerBatch)
      .map((candidate) => ({
        id: candidate.id,
        title: normalizeText(candidate.title),
        text: clampDigestText(
          normalizeText(candidate.summary || candidate.content || ''),
          articleCharBudget,
        ),
        feedTitle: normalizeText(candidate.feedTitle) || undefined,
        url: normalizeText(candidate.url) || undefined,
        publishedAt: candidate.publishedAt,
      }))

    batches.push({
      index: batches.length,
      articles,
    })
  }

  return { articleCharBudget, batches }
}
