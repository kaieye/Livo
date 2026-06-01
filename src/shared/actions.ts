/**
 * Actions / Automation Rules system.
 * Allows users to set up filter rules
 * with conditions and automated actions for incoming entries.
 */

export interface ActionRule {
  id: string
  name: string
  enabled: boolean
  conditions: ActionCondition[]
  actions: ActionEffect[]
  createdAt: number
}

export type ConditionField =
  | 'entry.title'
  | 'entry.content'
  | 'entry.author'
  | 'entry.url'
  | 'feed.title'
  | 'feed.url'
  | 'feed.category'

export type ConditionOperator =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'matches_regex'
  | 'starts_with'
  | 'ends_with'

export interface ActionCondition {
  field: ConditionField
  operator: ConditionOperator
  value: string
}

export type ActionEffectType =
  | 'block'
  | 'star'
  | 'mark_read'
  | 'notify'
  | 'readability'
  | 'summarize'

export interface ActionEffect {
  type: ActionEffectType
}

export const CONDITION_FIELD_LABELS: Record<ConditionField, string> = {
  'entry.title': '文章标题',
  'entry.content': '文章内容',
  'entry.author': '文章作者',
  'entry.url': '文章 URL',
  'feed.title': '订阅源标题',
  'feed.url': '订阅源 URL',
  'feed.category': '订阅源分类',
}

export const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  contains: '包含',
  not_contains: '不包含',
  equals: '等于',
  not_equals: '不等于',
  matches_regex: '匹配正则',
  starts_with: '以…开头',
  ends_with: '以…结尾',
}

export const ACTION_EFFECT_LABELS: Record<ActionEffectType, string> = {
  block: '屏蔽 (不添加)',
  star: '自动收藏',
  mark_read: '标记已读',
  notify: '桌面通知',
  readability: '自动 Readability',
  summarize: '自动 AI 摘要',
}

export const ACTION_EFFECT_ICONS: Record<ActionEffectType, string> = {
  block: 'Ban',
  star: 'Star',
  mark_read: 'CheckCircle2',
  notify: 'Bell',
  readability: 'BookType',
  summarize: 'Sparkles',
}

export function matchCondition(
  condition: ActionCondition,
  entry: { title: string; content?: string; author?: string; url: string },
  feed: { title: string; url: string; category?: string },
): boolean {
  let fieldValue = ''
  switch (condition.field) {
    case 'entry.title':
      fieldValue = entry.title
      break
    case 'entry.content':
      fieldValue = entry.content || ''
      break
    case 'entry.author':
      fieldValue = entry.author || ''
      break
    case 'entry.url':
      fieldValue = entry.url
      break
    case 'feed.title':
      fieldValue = feed.title
      break
    case 'feed.url':
      fieldValue = feed.url
      break
    case 'feed.category':
      fieldValue = feed.category || ''
      break
  }

  const value = condition.value
  const fieldLower = fieldValue.toLowerCase()
  const valLower = value.toLowerCase()

  switch (condition.operator) {
    case 'contains':
      return fieldLower.includes(valLower)
    case 'not_contains':
      return !fieldLower.includes(valLower)
    case 'equals':
      return fieldLower === valLower
    case 'not_equals':
      return fieldLower !== valLower
    case 'starts_with':
      return fieldLower.startsWith(valLower)
    case 'ends_with':
      return fieldLower.endsWith(valLower)
    case 'matches_regex':
      try {
        return new RegExp(value, 'i').test(fieldValue)
      } catch {
        return false
      }
  }
}

export function matchAllConditions(
  rule: ActionRule,
  entry: { title: string; content?: string; author?: string; url: string },
  feed: { title: string; url: string; category?: string },
): boolean {
  if (rule.conditions.length === 0) return false
  return rule.conditions.every((c) => matchCondition(c, entry, feed))
}
