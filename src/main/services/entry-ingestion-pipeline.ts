import type { Entry, Feed } from '../../shared/types'
import type {
  ActionCondition,
  ActionEffectType,
  ActionRule,
} from '../../shared/actions'
import {
  evaluateActionRules,
  isSemanticCondition,
  matchCondition,
} from '../../shared/actions'
import type {
  AIConfig,
  AISemanticFilterDecision,
  AISemanticFilterInput,
} from '../../shared/types'
import {
  insertEntriesWithResult,
  replaceEntriesForFeedWithResult,
} from '../database'
import { getSettings } from '../handlers/settings-handlers'
import { buildEntriesFromParsedItems } from './entry-builder'
import { enqueueEntryActionEffects } from './entry-action-effects'
import { getActionRules } from './action-rules-store'
import { validateAIConfig } from './ai-client'
import { judgeSemanticFilter } from './ai-filter'
import { isInstagramUserFeedUrl as _isInstagramUserFeed } from '../../shared/url-detect'

export interface EntryIngestionInput {
  feed: Feed
  items: Array<Record<string, any>>
  authorAvatarSeed?: string
  parsedFeedLink?: string
  now: number
  replaceExisting?: boolean
}

export interface EntryIngestionResult {
  addedCount: number
  addedEntries: Entry[]
  storedEntries: number
}

export interface ActionRuleAppliedEntry {
  entry: Entry
  effects: ActionEffectType[]
}

type SemanticFilterJudge = (
  input: AISemanticFilterInput,
  config: AIConfig,
) => Promise<AISemanticFilterDecision>

export interface ApplyActionRulesOptions {
  aiConfig?: AIConfig
  semanticJudge?: SemanticFilterJudge
}

/**
 * 过滤 FeedBurner 等聚合源注入的跨站条目，社交/视频源保留跨子域内容。
 */
export function filterForeignEntries(
  entries: Entry[],
  feedSiteUrl: string | undefined,
  parsedFeedLink: string | undefined,
  feedUrl?: string,
): Entry[] {
  const rawFeedUrl = (feedUrl || '').toLowerCase()
  const isTwitterFeed = /\/(?:twitter|x)\/user\//i.test(rawFeedUrl)
  const isInstagramMirrorFeed = _isInstagramUserFeed(rawFeedUrl)
  const isBilibiliUserFeed =
    /\/bilibili\/user\/(?:dynamic|video|article)\//i.test(rawFeedUrl)
  if (isTwitterFeed || isInstagramMirrorFeed || isBilibiliUserFeed) {
    return entries
  }

  const siteUrl = feedSiteUrl || parsedFeedLink || ''
  if (!siteUrl) return entries
  let siteHost: string
  try {
    siteHost = new URL(siteUrl).hostname.replace(/^www\./, '')
  } catch {
    return entries
  }
  if (!siteHost) return entries

  return entries.filter((entry) => {
    if (!entry.url) return true
    let entryHost: string
    try {
      entryHost = new URL(entry.url).hostname.replace(/^www\./, '')
    } catch {
      return true
    }
    return (
      entryHost === siteHost ||
      entryHost.endsWith('.' + siteHost) ||
      siteHost.endsWith('.' + entryHost)
    )
  })
}

export function applyActionRulesToEntries(
  entries: Entry[],
  feed: Feed,
  rules: ActionRule[],
): ActionRuleAppliedEntry[] {
  if (rules.length === 0) {
    return entries.map((entry) => ({ entry, effects: [] }))
  }

  const feedContext = {
    title: feed.title,
    url: feed.url,
    category: feed.category,
  }

  const kept: ActionRuleAppliedEntry[] = []
  for (const entry of entries) {
    const decision = evaluateActionRules(
      rules,
      {
        title: entry.title,
        content: entry.content,
        author: entry.author,
        url: entry.url,
      },
      feedContext,
    )
    if (decision.blocked) continue

    const effects = filterPodcastActionEffects(decision.effects, entry, feed)
    const nextEntry =
      decision.star || decision.markRead
        ? {
            ...entry,
            isStarred: entry.isStarred || decision.star,
            isRead: entry.isRead || decision.markRead,
          }
        : entry

    kept.push({ entry: nextEntry, effects })
  }
  return kept
}

async function matchSemanticActionCondition(
  condition: ActionCondition,
  entry: Entry,
  feed: Feed,
  options: ApplyActionRulesOptions,
): Promise<boolean> {
  const value = condition.value.trim()
  const config = options.aiConfig
  const judge = options.semanticJudge ?? judgeSemanticFilter
  if (!value || !config) return false

  try {
    const decision = await judge(
      {
        condition: value,
        title: entry.title,
        summary: entry.summary || entry.content,
        feedTitle: feed.title,
        author: entry.author,
        url: entry.url,
      },
      config,
    )
    return decision.matched
  } catch {
    return false
  }
}

async function matchAllActionConditions(
  rule: ActionRule,
  entry: Entry,
  feed: Feed,
  options: ApplyActionRulesOptions,
): Promise<boolean> {
  if (rule.conditions.length === 0) return false

  const feedContext = {
    title: feed.title,
    url: feed.url,
    category: feed.category,
  }

  for (const condition of rule.conditions) {
    if (isSemanticCondition(condition)) {
      const matched = await matchSemanticActionCondition(
        condition,
        entry,
        feed,
        options,
      )
      if (!matched) return false
      continue
    }

    if (
      !matchCondition(
        condition,
        {
          title: entry.title,
          content: entry.content,
          author: entry.author,
          url: entry.url,
        },
        feedContext,
      )
    ) {
      return false
    }
  }

  return true
}

export async function applyActionRulesToEntriesAsync(
  entries: Entry[],
  feed: Feed,
  rules: ActionRule[],
  options: ApplyActionRulesOptions = {},
): Promise<ActionRuleAppliedEntry[]> {
  if (rules.length === 0) {
    return entries.map((entry) => ({ entry, effects: [] }))
  }

  const kept: ActionRuleAppliedEntry[] = []
  for (const entry of entries) {
    const decision = {
      blocked: false,
      star: false,
      markRead: false,
      effects: [] as ActionEffectType[],
    }
    const seen = new Set<ActionEffectType>()

    for (const rule of rules) {
      if (!rule.enabled) continue
      if (!(await matchAllActionConditions(rule, entry, feed, options))) {
        continue
      }

      for (const effect of rule.actions) {
        if (!seen.has(effect.type)) {
          seen.add(effect.type)
          decision.effects.push(effect.type)
        }
        if (effect.type === 'block') decision.blocked = true
        else if (effect.type === 'star') decision.star = true
        else if (effect.type === 'mark_read') decision.markRead = true
      }
    }

    if (decision.blocked) continue

    const effects = filterPodcastActionEffects(decision.effects, entry, feed)
    const nextEntry =
      decision.star || decision.markRead
        ? {
            ...entry,
            isStarred: entry.isStarred || decision.star,
            isRead: entry.isRead || decision.markRead,
          }
        : entry

    kept.push({ entry: nextEntry, effects })
  }

  return kept
}

const PODCAST_TEXT_EFFECTS = new Set<ActionEffectType>([
  'readability',
  'summarize',
])

function isPodcastLikeEntry(entry: Entry, feed: Feed): boolean {
  if ((feed.category || '').trim().toLowerCase() === 'podcast') return true
  return (entry.media || []).some((item) => item.type === 'audio')
}

function filterPodcastActionEffects(
  effects: ActionEffectType[],
  entry: Entry,
  feed: Feed,
): ActionEffectType[] {
  if (!isPodcastLikeEntry(entry, feed)) return effects
  return effects.filter((effect) => !PODCAST_TEXT_EFFECTS.has(effect))
}

async function applyActionRules(
  entries: Entry[],
  feed: Feed,
): Promise<ActionRuleAppliedEntry[]> {
  const aiConfig = getSettings().ai
  return applyActionRulesToEntriesAsync(entries, feed, getActionRules(), {
    aiConfig: validateAIConfig(aiConfig) ? undefined : aiConfig,
  })
}

export async function ingestParsedFeedEntries(
  input: EntryIngestionInput,
): Promise<EntryIngestionResult> {
  const builtEntries = await buildEntriesFromParsedItems(
    input.feed.id,
    input.items,
    input.authorAvatarSeed,
    input.feed.view,
    input.now,
  )
  const foreignFiltered = filterForeignEntries(
    builtEntries,
    input.feed.siteUrl,
    input.parsedFeedLink,
    input.feed.url,
  )
  const ruleAppliedEntries = await applyActionRules(foreignFiltered, input.feed)
  const entriesToInsert = ruleAppliedEntries.map(({ entry }) => entry)
  const effectsByEntryId = new Map(
    ruleAppliedEntries.map(({ entry, effects }) => [entry.id, effects]),
  )

  const writeResult = input.replaceExisting
    ? replaceEntriesForFeedWithResult(input.feed.id, entriesToInsert)
    : insertEntriesWithResult(entriesToInsert)

  enqueueEntryActionEffects(
    writeResult.addedEntries.map((entry) => ({
      entry,
      feed: input.feed,
      effects: effectsByEntryId.get(entry.id) || [],
    })),
  )

  return {
    addedCount: writeResult.addedCount,
    addedEntries: writeResult.addedEntries,
    storedEntries: entriesToInsert.length,
  }
}
