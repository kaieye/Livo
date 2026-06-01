import {
  DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE,
  DEFAULT_SETTINGS,
  FEED_COLUMN_DEFAULTS,
  FeedViewType,
  type AppSettings,
  type FeedColumnId,
} from './types'

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
  for (const key of Object.keys(target)) {
    const current = target[key as keyof typeof target]
    const next = source[key]
    if (next === undefined) continue
    result[key] = mergeDefined(current, next)
  }
  return result as T
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
  syncContentWidth(merged)

  return merged
}

export function mergeSettings(
  current: AppSettings,
  patch: Partial<AppSettings>,
): AppSettings {
  return normalizeSettings(mergeDefined(current, patch))
}
