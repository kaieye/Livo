import type OpenAI from 'openai'
import type { AIDigestPreset } from '../../../shared/types'
import { extractJsonValue } from './ai-json'
import { clampContentToBudget } from './ai-prompts'

export function getDigestPresetLabel(preset: AIDigestPreset): string {
  return preset === 'week' ? '本周趋势' : '今日简报'
}

export function normalizeDigestPreset(value: unknown): AIDigestPreset {
  return value === 'week' ? 'week' : 'today'
}

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

export interface DigestComposeInput {
  topic: string
  presetLabel: string
  windowStartAt: number
  windowEndAt: number
  plan: DigestBudgetPlan
}

export interface DigestReduceInput {
  topic: string
  presetLabel: string
  windowStartAt: number
  windowEndAt: number
  batchNotes: string[]
}

const DEFAULT_TOTAL_CONTEXT_CHARS = 60_000
const DEFAULT_PROMPT_RESERVE_CHARS = 6_000
const DEFAULT_MAX_ARTICLES_PER_BATCH = 4
const DEFAULT_MAX_ARTICLE_CHARS = 8_000
const DEFAULT_MIN_ARTICLE_CHARS = 600
const DIGEST_TITLE_SIMILARITY_THRESHOLD = 0.82

const TRACKING_QUERY_PARAMS = new Set([
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'mkt_tok',
  'msclkid',
  'ref',
  'ref_src',
  'spm',
])

function normalizeText(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim()
}

export function canonicalizeDigestLink(value: string | undefined): string {
  const raw = normalizeText(value)
  if (!raw) return ''

  try {
    const url = new URL(raw)
    url.hash = ''
    url.username = ''
    url.password = ''

    for (const key of Array.from(url.searchParams.keys())) {
      const lower = key.toLowerCase()
      if (lower.startsWith('utm_') || TRACKING_QUERY_PARAMS.has(lower)) {
        url.searchParams.delete(key)
      }
    }
    url.searchParams.sort()

    const pathname =
      url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname
    return `${url.protocol}//${url.host.toLowerCase()}${pathname}${url.search}`
  } catch {
    return raw.toLowerCase()
  }
}

export function normalizeDigestTitle(value: string | undefined): string {
  return normalizeText(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleBigrams(title: string): Set<string> {
  const compact = title.replace(/\s+/g, '')
  if (!compact) return new Set()
  if (compact.length <= 2) return new Set([compact])

  const grams = new Set<string>()
  for (let index = 0; index < compact.length - 1; index += 1) {
    grams.add(compact.slice(index, index + 2))
  }
  return grams
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0

  let intersection = 0
  for (const item of left) {
    if (right.has(item)) intersection += 1
  }
  const union = left.size + right.size - intersection
  return union > 0 ? intersection / union : 0
}

function digestCandidateScore(candidate: DigestCandidate): number {
  const textLength = normalizeText(
    candidate.summary || candidate.content,
  ).length
  return textLength + Math.floor((candidate.publishedAt || 0) / 1_000_000_000)
}

function pickRicherDigestCandidate<T extends DigestCandidate>(
  left: T,
  right: T,
): T {
  return digestCandidateScore(right) > digestCandidateScore(left) ? right : left
}

function areDigestCandidatesSimilar(
  left: { canonicalLink: string; title: string; titleBigrams: Set<string> },
  right: { canonicalLink: string; title: string; titleBigrams: Set<string> },
): boolean {
  if (left.canonicalLink && left.canonicalLink === right.canonicalLink) {
    return true
  }

  const minTitleLength = Math.min(left.title.length, right.title.length)
  if (minTitleLength < 12) return false

  return (
    jaccardSimilarity(left.titleBigrams, right.titleBigrams) >=
    DIGEST_TITLE_SIMILARITY_THRESHOLD
  )
}

export function dedupeDigestCandidates<T extends DigestCandidate>(
  candidates: T[],
): T[] {
  const groups: Array<{
    canonicalLink: string
    title: string
    titleBigrams: Set<string>
    candidate: T
  }> = []

  for (const candidate of candidates) {
    const current = {
      canonicalLink: canonicalizeDigestLink(candidate.url),
      title: normalizeDigestTitle(candidate.title),
      titleBigrams: titleBigrams(normalizeDigestTitle(candidate.title)),
      candidate,
    }
    const group = groups.find((item) =>
      areDigestCandidatesSimilar(item, current),
    )

    if (group) {
      group.candidate = pickRicherDigestCandidate(group.candidate, candidate)
      continue
    }

    groups.push(current)
  }

  return groups.map((group) => group.candidate)
}

function normalizeId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function clampDigestText(value: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  return clampContentToBudget(value, maxChars)
}

function readIdsFromPayload(payload: unknown): string[] {
  if (Array.isArray(payload)) return payload.map(normalizeId).filter(Boolean)
  if (!payload || typeof payload !== 'object') return []

  const object = payload as Record<string, unknown>
  const candidates = [object.ids, object.selectedIds, object.articleIds]
  const ids = candidates.find(Array.isArray)
  return Array.isArray(ids) ? ids.map(normalizeId).filter(Boolean) : []
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readKnownIdsFromText(raw: string, candidateIds: string[]): string[] {
  const matches: Array<{ id: string; index: number }> = []

  for (const id of candidateIds) {
    const pattern = new RegExp(
      `(?<![\\p{Letter}\\p{Number}_-])${escapeRegExp(id)}(?![\\p{Letter}\\p{Number}_-])`,
      'gu',
    )
    for (const match of raw.matchAll(pattern)) {
      matches.push({ id, index: match.index ?? Number.MAX_SAFE_INTEGER })
    }
  }

  return matches
    .sort((left, right) => left.index - right.index)
    .map((m) => m.id)
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
  const candidateIdList = Array.from(candidateIds)
  const allowed = new Set(candidateIdList)
  const seen = new Set<string>()
  const ids: string[] = []
  const rejectedIds: string[] = []
  let parsedIds: string[]

  try {
    parsedIds = readIdsFromPayload(extractJsonValue(raw))
  } catch {
    // 部分模型会输出解释性文本；这里只从原文中提取已知候选 id，不做额外兜底选择。
    parsedIds = readKnownIdsFromText(raw, candidateIdList)
  }

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

export function buildDigestBatchMessages(input: {
  topic: string
  presetLabel: string
  batch: DigestBatch
}): OpenAI.ChatCompletionMessageParam[] {
  return [
    {
      role: 'system',
      content:
        '你是阅读分析助手。只依据给定文章提炼要点，输出 Markdown 列表，不编造事实。',
    },
    {
      role: 'user',
      content: JSON.stringify({
        topic: normalizeText(input.topic),
        preset: normalizeText(input.presetLabel),
        articles: input.batch.articles,
        output:
          '按主题聚合 3-6 条要点；每条保留涉及的文章 id；不要输出无来源判断。',
      }),
    },
  ]
}

export function buildDigestReduceMessages(
  input: DigestReduceInput,
): OpenAI.ChatCompletionMessageParam[] {
  return [
    {
      role: 'system',
      content:
        '你是 RSS 阅读简报编辑。基于批次要点生成结构化 Markdown 报告，内容要紧凑、可扫描。',
    },
    {
      role: 'user',
      content: JSON.stringify({
        topic: normalizeText(input.topic),
        preset: normalizeText(input.presetLabel),
        windowStartAt: new Date(input.windowStartAt).toISOString(),
        windowEndAt: new Date(input.windowEndAt).toISOString(),
        batchNotes: input.batchNotes.map((note) =>
          clampContentToBudget(normalizeText(note), 6000),
        ),
        output: {
          title: '一级标题',
          sections: ['关键趋势', '值得关注', '后续观察'],
          requirement:
            '输出 Markdown；每个判断后用括号列出来源 id；不要输出代码块。',
        },
      }),
    },
  ]
}
