export const USER_OPERATION_KEYS = {
  FEED_ADD: 'feed.add',
  FEED_REMOVE: 'feed.remove',
  FEED_REFRESH_SINGLE: 'feed.refresh_single',
  FEED_REFRESH_ALL: 'feed.refresh_all',
  FEED_IMPORT_OPML: 'feed.import_opml',
  AI_SUMMARIZE: 'ai.summarize',
  AI_TRANSLATE: 'ai.translate',
  AI_DIGEST_GENERATE: 'ai.digest_generate',
} as const

export type UserOperationKey =
  (typeof USER_OPERATION_KEYS)[keyof typeof USER_OPERATION_KEYS]

export type UserOperationCategory = 'feed' | 'ai'
export type UserOperationMode = 'sync' | 'async'

export interface UserOperationDefinition {
  key: UserOperationKey
  category: UserOperationCategory
  mode: UserOperationMode
  label: string
}

export const USER_OPERATION_CATALOG = {
  [USER_OPERATION_KEYS.FEED_ADD]: {
    key: USER_OPERATION_KEYS.FEED_ADD,
    category: 'feed',
    mode: 'async',
    label: '添加订阅源',
  },
  [USER_OPERATION_KEYS.FEED_REMOVE]: {
    key: USER_OPERATION_KEYS.FEED_REMOVE,
    category: 'feed',
    mode: 'sync',
    label: '删除订阅源',
  },
  [USER_OPERATION_KEYS.FEED_REFRESH_SINGLE]: {
    key: USER_OPERATION_KEYS.FEED_REFRESH_SINGLE,
    category: 'feed',
    mode: 'async',
    label: '刷新订阅源',
  },
  [USER_OPERATION_KEYS.FEED_REFRESH_ALL]: {
    key: USER_OPERATION_KEYS.FEED_REFRESH_ALL,
    category: 'feed',
    mode: 'async',
    label: '刷新全部订阅源',
  },
  [USER_OPERATION_KEYS.FEED_IMPORT_OPML]: {
    key: USER_OPERATION_KEYS.FEED_IMPORT_OPML,
    category: 'feed',
    mode: 'async',
    label: '导入 OPML',
  },
  [USER_OPERATION_KEYS.AI_SUMMARIZE]: {
    key: USER_OPERATION_KEYS.AI_SUMMARIZE,
    category: 'ai',
    mode: 'async',
    label: '生成摘要',
  },
  [USER_OPERATION_KEYS.AI_TRANSLATE]: {
    key: USER_OPERATION_KEYS.AI_TRANSLATE,
    category: 'ai',
    mode: 'async',
    label: '翻译文章',
  },
  [USER_OPERATION_KEYS.AI_DIGEST_GENERATE]: {
    key: USER_OPERATION_KEYS.AI_DIGEST_GENERATE,
    category: 'ai',
    mode: 'async',
    label: '生成 AI 简报',
  },
} as const satisfies Record<UserOperationKey, UserOperationDefinition>

export function getUserOperationDefinition(
  key: UserOperationKey,
): UserOperationDefinition {
  return USER_OPERATION_CATALOG[key]
}
