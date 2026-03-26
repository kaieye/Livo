import {
  DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE,
  DEFAULT_SETTINGS,
  FEED_COLUMN_DEFAULTS,
  FeedViewType,
  type AppSettings,
  type FeedColumnId,
} from '@livo/models'

type PartialSettings = Partial<AppSettings> | null | undefined

function cloneViewTabs() {
  return DEFAULT_SETTINGS.general.viewTabs.map((tab) => ({ ...tab }))
}

function cloneFeedColumns() {
  return FEED_COLUMN_DEFAULTS.map((column) => ({ ...column }))
}

export function cloneDefaultSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ai: { ...DEFAULT_SETTINGS.ai },
    general: {
      ...DEFAULT_SETTINGS.general,
      viewTabs: cloneViewTabs(),
      feedColumns: cloneFeedColumns(),
    },
    data: { ...DEFAULT_SETTINGS.data },
    aggregator: { ...DEFAULT_SETTINGS.aggregator },
    translation: { ...DEFAULT_SETTINGS.translation },
  }
}

export function isLegacyDefaultSystemPromptTemplate(
  template: string | undefined,
): boolean {
  const normalized = (template || '').trim().replace(/\s+/g, ' ')
  if (!normalized) return false
  return (
    normalized.includes('AI assistant') &&
    normalized.includes('{{context}}') &&
    normalized.includes('{{persona}}') &&
    normalized.includes('RSS feed content')
  )
}

function normalizeViewTabs(
  value: Array<{ id: FeedViewType; visible: boolean }> | undefined,
): Array<{ id: FeedViewType; visible: boolean }> {
  const source = Array.isArray(value) ? value : []
  const next = source
    .filter(
      (tab): tab is { id: FeedViewType; visible: boolean } =>
        !!tab &&
        typeof tab.id === 'number' &&
        typeof tab.visible === 'boolean' &&
        tab.id in FeedViewType,
    )
    .filter(
      (tab, index, array) =>
        array.findIndex((item) => item.id === tab.id) === index,
    )
    .map((tab) => ({ ...tab }))

  for (const fallback of DEFAULT_SETTINGS.general.viewTabs) {
    if (!next.some((tab) => tab.id === fallback.id)) {
      next.push({ ...fallback })
    }
  }

  return next
}

function normalizeFeedColumns(
  value: Array<{ id: FeedColumnId; visible: boolean }> | undefined,
): Array<{ id: FeedColumnId; visible: boolean }> {
  const allowedIds = new Set(FEED_COLUMN_DEFAULTS.map((column) => column.id))
  const source = Array.isArray(value) ? value : []
  const next = source
    .filter(
      (column): column is { id: FeedColumnId; visible: boolean } =>
        !!column &&
        typeof column.id === 'string' &&
        typeof column.visible === 'boolean' &&
        allowedIds.has(column.id as FeedColumnId),
    )
    .filter(
      (column, index, array) =>
        array.findIndex((item) => item.id === column.id) === index,
    )
    .map((column) => ({ ...column }))

  for (const fallback of FEED_COLUMN_DEFAULTS) {
    if (!next.some((column) => column.id === fallback.id)) {
      next.push({ ...fallback })
    }
  }

  return next
}

function normalizeContentWidth(
  general: AppSettings['general'],
): AppSettings['general'] {
  const fallbackWidth = DEFAULT_SETTINGS.general.contentMaxWidth
  const contentMaxWidth =
    Number.isFinite(general.contentMaxWidth) && general.contentMaxWidth > 0
      ? general.contentMaxWidth
      : Number.isFinite(general.customContentMaxWidth) &&
          general.customContentMaxWidth > 0
        ? general.customContentMaxWidth
        : fallbackWidth

  return {
    ...general,
    contentMaxWidth,
    customContentMaxWidth: contentMaxWidth,
  }
}

export function normalizeSettings(input?: PartialSettings): AppSettings {
  const defaults = cloneDefaultSettings()
  const raw = input || {}

  const normalized: AppSettings = {
    ...defaults,
    ...raw,
    ai: { ...defaults.ai, ...(raw.ai || {}) },
    general: normalizeContentWidth({
      ...defaults.general,
      ...(raw.general || {}),
      viewTabs: normalizeViewTabs(raw.general?.viewTabs),
      feedColumns: normalizeFeedColumns(raw.general?.feedColumns),
    }),
    data: { ...defaults.data, ...(raw.data || {}) },
    aggregator: { ...defaults.aggregator, ...(raw.aggregator || {}) },
    translation: { ...defaults.translation, ...(raw.translation || {}) },
  }

  if (isLegacyDefaultSystemPromptTemplate(normalized.ai.systemPromptTemplate)) {
    normalized.ai.systemPromptTemplate = DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE
  }

  return normalized
}

export function mergeSettings(
  current: AppSettings,
  updates: Partial<AppSettings>,
): AppSettings {
  return normalizeSettings({
    ...current,
    ...updates,
    ai: { ...current.ai, ...(updates.ai || {}) },
    general: { ...current.general, ...(updates.general || {}) },
    data: { ...current.data, ...(updates.data || {}) },
    aggregator: { ...current.aggregator, ...(updates.aggregator || {}) },
    translation: { ...current.translation, ...(updates.translation || {}) },
  })
}
