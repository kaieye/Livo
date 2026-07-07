import {
  FEED_COLUMN_DEFAULTS,
  FeedViewType,
  type FeedColumnId,
} from './types/feed'
import { WEB_SEARCH_PROVIDERS, type AppSettings } from './settings-schema'

const SETTINGS_PATCH_MAX_DYNAMIC_RECORD_KEYS = 32
const SETTINGS_PATCH_DYNAMIC_KEY_MAX_LENGTH = 80
const SETTINGS_PATCH_SHORT_STRING_MAX_LENGTH = 512
const SETTINGS_PATCH_URL_MAX_LENGTH = 4096
const SETTINGS_PATCH_SECRET_MAX_LENGTH = 8192
const SETTINGS_PATCH_PROMPT_MAX_LENGTH = 100_000
const SETTINGS_PATCH_CUSTOM_CSS_MAX_LENGTH = 200_000
const SETTINGS_PATCH_MAX_ARRAY_ITEMS = 16

type SettingsPatchFieldError = Record<string, string>
type FieldSanitizer = (value: unknown, field: string) => unknown
type SectionSanitizer = (
  value: unknown,
  field: string,
) => Record<string, unknown>

const AI_PROVIDER_VALUES = [
  'openai',
  'anthropic',
  'deepseek',
  'glm',
  'minimax',
  'custom',
] as const

const THEME_VALUES = ['light', 'dark', 'system'] as const
const PROXY_MODE_VALUES = ['system', 'custom'] as const
const CONTENT_WIDTH_VALUES = ['narrow', 'normal', 'wide', 'custom'] as const
const THUMBNAIL_RATIO_VALUES = ['square', 'original'] as const
const AGGREGATOR_MODE_VALUES = [
  'disabled',
  'prefer-local-agent',
  'prefer-remote',
  'remote-only',
] as const

export class SettingsPatchValidationError extends Error {
  constructor(readonly fields: SettingsPatchFieldError) {
    super('Invalid settings patch')
    this.name = 'SettingsPatchValidationError'
  }
}

function isStrictPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function rejectSettingsPatch(field: string, reason: string): never {
  throw new SettingsPatchValidationError({ [field]: reason })
}

function assertStrictPlainObject(
  value: unknown,
  field: string,
): asserts value is Record<string, unknown> {
  if (!isStrictPlainObject(value)) {
    rejectSettingsPatch(field, 'expected_object')
  }
}

function isUnsafeRecordKey(key: string): boolean {
  const hasControlChar = Array.from(key).some((char) => {
    const code = char.charCodeAt(0)
    return code <= 0x1f || code === 0x7f
  })
  return (
    key === '__proto__' ||
    key === 'prototype' ||
    key === 'constructor' ||
    hasControlChar
  )
}

function sanitizeString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') {
    rejectSettingsPatch(field, 'expected_string')
  }
  if (value.length > maxLength) {
    rejectSettingsPatch(field, `max_length_${maxLength}`)
  }
  return value
}

function sanitizeBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    rejectSettingsPatch(field, 'expected_boolean')
  }
  return value
}

function sanitizeNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    rejectSettingsPatch(field, 'expected_finite_number')
  }
  return value
}

function sanitizeEnum<const T extends readonly string[]>(
  values: T,
): FieldSanitizer {
  const allowed = new Set<string>(values)
  return (value, field) => {
    if (typeof value !== 'string' || !allowed.has(value)) {
      rejectSettingsPatch(field, 'unsupported_value')
    }
    return value
  }
}

function sanitizeStringRecord(
  value: unknown,
  field: string,
  maxValueLength: number,
): Record<string, string> {
  assertStrictPlainObject(value, field)
  const entries = Object.entries(value)
  if (entries.length > SETTINGS_PATCH_MAX_DYNAMIC_RECORD_KEYS) {
    rejectSettingsPatch(
      field,
      `max_keys_${SETTINGS_PATCH_MAX_DYNAMIC_RECORD_KEYS}`,
    )
  }

  const result: Record<string, string> = {}
  for (const [key, item] of entries) {
    const itemField = `${field}.${key}`
    if (
      isUnsafeRecordKey(key) ||
      key.trim().length === 0 ||
      key.length > SETTINGS_PATCH_DYNAMIC_KEY_MAX_LENGTH
    ) {
      rejectSettingsPatch(
        itemField,
        `invalid_key_max_length_${SETTINGS_PATCH_DYNAMIC_KEY_MAX_LENGTH}`,
      )
    }
    if (item === undefined) continue
    result[key] = sanitizeString(item, itemField, maxValueLength)
  }
  return result
}

function sanitizeSettingsSection(
  value: unknown,
  field: string,
  schema: Record<string, FieldSanitizer>,
): Record<string, unknown> {
  assertStrictPlainObject(value, field)
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (isUnsafeRecordKey(key)) {
      rejectSettingsPatch(`${field}.${key}`, 'invalid_key')
    }
    const sanitize = schema[key]
    if (!sanitize) {
      rejectSettingsPatch(`${field}.${key}`, 'unknown_field')
    }
    if (item === undefined) continue
    result[key] = sanitize(item, `${field}.${key}`)
  }
  return result
}

function sanitizeViewTabs(value: unknown, field: string) {
  if (!Array.isArray(value) || value.length > SETTINGS_PATCH_MAX_ARRAY_ITEMS) {
    rejectSettingsPatch(field, `max_items_${SETTINGS_PATCH_MAX_ARRAY_ITEMS}`)
  }
  const allowedIds = new Set<number>(
    Object.values(FeedViewType).filter(
      (id): id is number => typeof id === 'number',
    ),
  )
  return value.map((item, index) => {
    const itemField = `${field}.${index}`
    assertStrictPlainObject(item, itemField)
    for (const key of Object.keys(item)) {
      if (key !== 'id' && key !== 'visible') {
        rejectSettingsPatch(`${itemField}.${key}`, 'unknown_field')
      }
    }
    if (typeof item.id !== 'number' || !allowedIds.has(item.id)) {
      rejectSettingsPatch(`${itemField}.id`, 'unsupported_value')
    }
    return {
      id: item.id as FeedViewType,
      visible: sanitizeBoolean(item.visible, `${itemField}.visible`),
    }
  })
}

function sanitizeFeedColumns(value: unknown, field: string) {
  if (!Array.isArray(value) || value.length > SETTINGS_PATCH_MAX_ARRAY_ITEMS) {
    rejectSettingsPatch(field, `max_items_${SETTINGS_PATCH_MAX_ARRAY_ITEMS}`)
  }
  const allowedIds = new Set<string>(
    FEED_COLUMN_DEFAULTS.map((column) => column.id),
  )
  return value.map((item, index) => {
    const itemField = `${field}.${index}`
    assertStrictPlainObject(item, itemField)
    for (const key of Object.keys(item)) {
      if (key !== 'id' && key !== 'visible') {
        rejectSettingsPatch(`${itemField}.${key}`, 'unknown_field')
      }
    }
    if (typeof item.id !== 'string' || !allowedIds.has(item.id)) {
      rejectSettingsPatch(`${itemField}.id`, 'unsupported_value')
    }
    return {
      id: item.id as FeedColumnId,
      visible: sanitizeBoolean(item.visible, `${itemField}.visible`),
    }
  })
}

const aiSettingsPatchSchema: Record<string, FieldSanitizer> = {
  provider: sanitizeEnum(AI_PROVIDER_VALUES),
  apiKey: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_SECRET_MAX_LENGTH),
  apiKeys: (value, field) =>
    sanitizeStringRecord(value, field, SETTINGS_PATCH_SECRET_MAX_LENGTH),
  baseUrl: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_URL_MAX_LENGTH),
  baseUrls: (value, field) =>
    sanitizeStringRecord(value, field, SETTINGS_PATCH_URL_MAX_LENGTH),
  model: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_SHORT_STRING_MAX_LENGTH),
  models: (value, field) =>
    sanitizeStringRecord(value, field, SETTINGS_PATCH_SHORT_STRING_MAX_LENGTH),
  enableSystemPrompt: sanitizeBoolean,
  systemPromptTemplate: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_PROMPT_MAX_LENGTH),
  chatPersonaPrompt: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_PROMPT_MAX_LENGTH),
  summaryPrompt: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_PROMPT_MAX_LENGTH),
  translationPrompt: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_PROMPT_MAX_LENGTH),
  agentTemperature: sanitizeNumber,
  agentMaxTokens: sanitizeNumber,
}

const agentSettingsPatchSchema: Record<string, FieldSanitizer> = {
  runTimeoutSeconds: sanitizeNumber,
  maxRounds: sanitizeNumber,
  enableServerKnowledge: sanitizeBoolean,
  webSearchProviders: (value, field) => {
    if (!Array.isArray(value) || value.length > WEB_SEARCH_PROVIDERS.length) {
      rejectSettingsPatch(field, `max_items_${WEB_SEARCH_PROVIDERS.length}`)
    }
    const allowed = new Set<string>(WEB_SEARCH_PROVIDERS)
    return value.map((item, index) => {
      const itemField = `${field}.${index}`
      if (typeof item !== 'string' || !allowed.has(item)) {
        rejectSettingsPatch(itemField, 'unsupported_value')
      }
      return item
    })
  },
}

const agentPermissionSettingsPatchSchema: Record<string, FieldSanitizer> = {
  allowRead: sanitizeBoolean,
  allowNavigate: sanitizeBoolean,
  allowMutate: sanitizeBoolean,
  allowDestructive: sanitizeBoolean,
  allowExternal: sanitizeBoolean,
}

const generalSettingsPatchSchema: Record<string, FieldSanitizer> = {
  language: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_SHORT_STRING_MAX_LENGTH),
  theme: sanitizeEnum(THEME_VALUES),
  proxyMode: sanitizeEnum(PROXY_MODE_VALUES),
  proxyUrl: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_URL_MAX_LENGTH),
  minimizeToTray: sanitizeBoolean,
  startInTray: sanitizeBoolean,
  refreshInterval: sanitizeNumber,
  markReadOnScroll: sanitizeBoolean,
  fontSize: sanitizeNumber,
  contentWidth: sanitizeEnum(CONTENT_WIDTH_VALUES),
  customContentMaxWidth: sanitizeNumber,
  contentLineHeight: sanitizeNumber,
  uiFontFamily: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_SHORT_STRING_MAX_LENGTH),
  contentFontFamily: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_SHORT_STRING_MAX_LENGTH),
  rsshubInstance: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_URL_MAX_LENGTH),
  accentColor: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_SHORT_STRING_MAX_LENGTH),
  opaqueSidebar: sanitizeBoolean,
  reduceMotion: sanitizeBoolean,
  renderInlineStyle: sanitizeBoolean,
  thumbnailRatio: sanitizeEnum(THUMBNAIL_RATIO_VALUES),
  customCSS: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_CUSTOM_CSS_MAX_LENGTH),
  contentMaxWidth: sanitizeNumber,
  hoverMarkAsRead: sanitizeBoolean,
  autoExpandLongSocialMedia: sanitizeBoolean,
  dimRead: sanitizeBoolean,
  groupByDate: sanitizeBoolean,
  renderMarkAsRead: sanitizeBoolean,
  imageProxy: sanitizeBoolean,
  showRecommended: sanitizeBoolean,
  showFeedRefreshErrorBadge: sanitizeBoolean,
  viewTabs: sanitizeViewTabs,
  feedColumns: sanitizeFeedColumns,
  videoPagination: sanitizeBoolean,
  videosPerPage: sanitizeNumber,
  bilibiliOpenInPage: sanitizeBoolean,
}

const dataSettingsPatchSchema: Record<string, FieldSanitizer> = {
  entriesPerFeed: sanitizeNumber,
  maxEntryAgeDays: sanitizeNumber,
  freshnessTTL: sanitizeNumber,
  refreshConcurrency: sanitizeNumber,
  enrichVideoDuration: sanitizeBoolean,
  autoCleanCache: sanitizeBoolean,
  cacheSizeLimitMB: sanitizeNumber,
  codeCacheLimitMB: sanitizeNumber,
}

const aggregatorSettingsPatchSchema: Record<string, FieldSanitizer> = {
  mode: sanitizeEnum(AGGREGATOR_MODE_VALUES),
  endpoint: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_URL_MAX_LENGTH),
  apiKey: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_SECRET_MAX_LENGTH),
  deviceId: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_SECRET_MAX_LENGTH),
  pollIntervalSeconds: sanitizeNumber,
  pushEnabled: sanitizeBoolean,
  cacheRetentionDays: sanitizeNumber,
}

const translationSettingsPatchSchema: Record<string, FieldSanitizer> = {
  enabled: sanitizeBoolean,
  targetLanguage: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_SHORT_STRING_MAX_LENGTH),
  autoTranslate: sanitizeBoolean,
}

const summarySettingsPatchSchema: Record<string, FieldSanitizer> = {
  enabled: sanitizeBoolean,
  autoTrigger: sanitizeBoolean,
  language: (value, field) =>
    sanitizeString(value, field, SETTINGS_PATCH_SHORT_STRING_MAX_LENGTH),
}

const settingsPatchSchemas: Record<string, SectionSanitizer> = {
  ai: (value, field) =>
    sanitizeSettingsSection(value, field, aiSettingsPatchSchema),
  agent: (value, field) =>
    sanitizeSettingsSection(value, field, agentSettingsPatchSchema),
  agentPermissions: (value, field) =>
    sanitizeSettingsSection(value, field, agentPermissionSettingsPatchSchema),
  general: (value, field) =>
    sanitizeSettingsSection(value, field, generalSettingsPatchSchema),
  data: (value, field) =>
    sanitizeSettingsSection(value, field, dataSettingsPatchSchema),
  aggregator: (value, field) =>
    sanitizeSettingsSection(value, field, aggregatorSettingsPatchSchema),
  translation: (value, field) =>
    sanitizeSettingsSection(value, field, translationSettingsPatchSchema),
  summary: (value, field) =>
    sanitizeSettingsSection(value, field, summarySettingsPatchSchema),
}

export function sanitizeSettingsPatch(input: unknown): Partial<AppSettings> {
  assertStrictPlainObject(input, 'settings')
  const result: Record<string, unknown> = {}

  for (const [section, value] of Object.entries(input)) {
    if (isUnsafeRecordKey(section)) {
      rejectSettingsPatch(`settings.${section}`, 'invalid_key')
    }
    const sanitize = settingsPatchSchemas[section]
    if (!sanitize) {
      rejectSettingsPatch(`settings.${section}`, 'unknown_section')
    }
    if (value === undefined) continue
    result[section] = sanitize(value, `settings.${section}`)
  }

  return result as Partial<AppSettings>
}
