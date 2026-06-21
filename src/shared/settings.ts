import {
  FEED_COLUMN_DEFAULTS,
  FeedViewType,
  type FeedColumnId,
} from './types/feed'
import { DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE } from './types/ai'
import {
  DEFAULT_SETTINGS,
  MAX_AGENT_RUN_TIMEOUT_SECONDS,
  type AppSettings,
} from './settings-schema'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function mergeDefined<T>(target: T, source: unknown): T {
  if (Array.isArray(target)) {
    return (Array.isArray(source) ? source : target) as T
  }
  if (!isPlainObject(target)) {
    return (source === undefined ? target : source) as T
  }
  const result: Record<string, unknown> = { ...target }
  if (!isPlainObject(source)) return result as T
  // 空对象默认值表示动态记录，例如 ai.apiKeys/baseUrls/models。
  if (Object.keys(target).length === 0) return { ...source } as T
  for (const key of Object.keys(target)) {
    const current = target[key as keyof typeof target]
    const next = source[key]
    if (next === undefined) continue
    result[key] = mergeDefined(current, next)
  }
  return result as T
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback

  let next = options.integer ? Math.floor(numeric) : numeric
  if (options.min !== undefined) next = Math.max(options.min, next)
  if (options.max !== undefined) next = Math.min(options.max, next)
  return next
}

function normalizePositiveIntegerOrFallback(
  value: unknown,
  fallback: number,
  options: { max?: number } = {},
): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback

  const next = Math.floor(numeric)
  if (next <= 0) return fallback
  if (options.max !== undefined) return Math.min(options.max, next)
  return next
}

function normalizeViewTabs(
  viewTabs: Array<{ id: FeedViewType; visible: boolean }> | undefined,
): Array<{ id: FeedViewType; visible: boolean }> {
  const visibleById = new Map<FeedViewType, boolean>()
  for (const tab of viewTabs || []) {
    visibleById.set(tab.id, tab.visible)
  }
  return [
    FeedViewType.Articles,
    FeedViewType.SocialMedia,
    FeedViewType.Videos,
    FeedViewType.Pictures,
  ].map((id) => ({
    id,
    visible: visibleById.get(id) ?? true,
  }))
}

function normalizeFeedColumns(
  feedColumns: Array<{ id: FeedColumnId; visible: boolean }> | undefined,
): Array<{ id: FeedColumnId; visible: boolean }> {
  const visibleById = new Map<FeedColumnId, boolean>()
  for (const column of feedColumns || []) {
    visibleById.set(column.id, column.visible)
  }
  return FEED_COLUMN_DEFAULTS.map((column) => ({
    id: column.id,
    visible: visibleById.get(column.id) ?? column.visible,
  }))
}

function syncContentWidth(settings: AppSettings): void {
  const width = Math.max(
    settings.general.contentMaxWidth || 0,
    settings.general.customContentMaxWidth || 0,
  )
  if (width > 0) {
    settings.general.contentMaxWidth = width
    settings.general.customContentMaxWidth = width
  }
}

function normalizeNumericSettings(settings: AppSettings): void {
  const defaults = DEFAULT_SETTINGS

  settings.agent.runTimeoutSeconds = normalizePositiveIntegerOrFallback(
    settings.agent.runTimeoutSeconds,
    defaults.agent.runTimeoutSeconds,
    { max: MAX_AGENT_RUN_TIMEOUT_SECONDS },
  )

  settings.general.refreshInterval = normalizeNumber(
    settings.general.refreshInterval,
    defaults.general.refreshInterval,
    { min: 0, max: 1440, integer: true },
  )
  settings.general.fontSize = normalizeNumber(
    settings.general.fontSize,
    defaults.general.fontSize,
    { min: 12, max: 24, integer: true },
  )
  settings.general.contentMaxWidth = normalizeNumber(
    settings.general.contentMaxWidth,
    defaults.general.contentMaxWidth,
    { min: 400, max: 1400, integer: true },
  )
  settings.general.customContentMaxWidth = normalizeNumber(
    settings.general.customContentMaxWidth,
    defaults.general.customContentMaxWidth,
    { min: 400, max: 1400, integer: true },
  )
  settings.general.contentLineHeight = normalizeNumber(
    settings.general.contentLineHeight,
    defaults.general.contentLineHeight,
    { min: 1, max: 2.5 },
  )
  settings.general.videosPerPage = normalizeNumber(
    settings.general.videosPerPage,
    defaults.general.videosPerPage,
    { min: 1, max: 100, integer: true },
  )

  settings.data.entriesPerFeed = normalizeNumber(
    settings.data.entriesPerFeed,
    defaults.data.entriesPerFeed,
    { min: 0, integer: true },
  )
  settings.data.maxEntryAgeDays = normalizeNumber(
    settings.data.maxEntryAgeDays,
    defaults.data.maxEntryAgeDays,
    { min: 0, integer: true },
  )
  settings.data.freshnessTTL = normalizeNumber(
    settings.data.freshnessTTL,
    defaults.data.freshnessTTL,
    { min: 0, max: 1440, integer: true },
  )
  settings.data.refreshConcurrency = normalizeNumber(
    settings.data.refreshConcurrency,
    defaults.data.refreshConcurrency,
    { min: 1, max: 20, integer: true },
  )
  settings.data.cacheSizeLimitMB = normalizeNumber(
    settings.data.cacheSizeLimitMB,
    defaults.data.cacheSizeLimitMB,
    { min: 0, integer: true },
  )
  settings.data.codeCacheLimitMB = normalizeNumber(
    settings.data.codeCacheLimitMB,
    defaults.data.codeCacheLimitMB,
    { min: 0, integer: true },
  )
}

export function cloneDefaultSettings(): AppSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as AppSettings
}

export function isLegacyDefaultSystemPromptTemplate(
  value: string | undefined,
): boolean {
  if (!value) return false
  return value.trim() === 'You are a helpful AI assistant for RSS feed reading.'
}

export function normalizeSettings(input?: Partial<AppSettings>): AppSettings {
  const merged = mergeDefined(cloneDefaultSettings(), input)

  if (isLegacyDefaultSystemPromptTemplate(merged.ai.systemPromptTemplate)) {
    merged.ai.systemPromptTemplate = DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE
  }

  merged.general.viewTabs = normalizeViewTabs(merged.general.viewTabs)
  merged.general.feedColumns = normalizeFeedColumns(merged.general.feedColumns)
  normalizeNumericSettings(merged)
  syncContentWidth(merged)

  return merged
}

export function mergeSettings(
  current: AppSettings,
  patch: Partial<AppSettings>,
): AppSettings {
  return normalizeSettings(mergeDefined(current, patch))
}
