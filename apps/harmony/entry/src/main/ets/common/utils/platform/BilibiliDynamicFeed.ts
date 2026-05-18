interface BilibiliDynamicEntry {
  id: string
  feedId: string
  title: string
  url: string
  summary: string
  content: string
  author: string
  publishedAt: number
  readingTimeMinutes: number
  tags: string[]
  mediaUrls?: string[]
  isRead: boolean
  isStarred: boolean
  createdAt: number
  updatedAt: number
}

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonObject | JsonArray
interface JsonObject {
  [key: string]: JsonValue
}
type JsonArray = JsonValue[]

function readString(record: JsonObject, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

function readNumber(record: JsonObject, key: string): number {
  const value = record[key]
  return typeof value === 'number' ? value : 0
}

function readRecord(record: JsonObject, key: string): JsonObject | undefined {
  const value = record[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined
}

function readRecords(record: JsonObject, key: string): JsonObject[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(
      (item: JsonValue) =>
        item !== null && typeof item === 'object' && !Array.isArray(item),
    )
    .map((item: JsonValue) => item as JsonObject)
}

function normalizeImageUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }
  return trimmed.replace(/^http:\/\//i, 'https://')
}

function summaryParagraph(summary: string): string {
  const trimmed = summary.trim()
  return trimmed ? `<p>${trimmed}</p>` : ''
}

function imageParagraph(imageUrl: string): string {
  const normalized = normalizeImageUrl(imageUrl)
  return normalized ? `<p><img src="${normalized}" /></p>` : ''
}

function createEntry(
  feedId: string,
  itemId: string,
  title: string,
  url: string,
  summary: string,
  imageUrl: string,
  author: string,
  publishedAtSeconds: number,
  now: number,
): BilibiliDynamicEntry | undefined {
  const resolvedTitle = title.trim() || summary.trim()
  const resolvedUrl = url.trim()
  if (!resolvedTitle || !resolvedUrl) {
    return undefined
  }

  const mediaUrl = normalizeImageUrl(imageUrl)
  const content =
    `${summaryParagraph(summary)}${imageParagraph(mediaUrl)}` ||
    `<p>${resolvedTitle}</p>`

  return {
    id: `${feedId}-bilibili-dynamic-${itemId}`,
    feedId,
    title: resolvedTitle,
    url: resolvedUrl,
    summary: summary.trim() || resolvedTitle,
    content,
    author: author.trim() || 'Bilibili 用户',
    publishedAt: Math.max(0, publishedAtSeconds) * 1000,
    readingTimeMinutes: 1,
    tags: ['Bilibili', '动态'],
    mediaUrls: mediaUrl ? [mediaUrl] : [],
    isRead: false,
    isStarred: false,
    createdAt: now,
    updatedAt: now,
  }
}

function moduleByType(item: JsonObject, type: string): JsonObject | undefined {
  return readRecords(item, 'modules').find(
    (moduleRecord: JsonObject) =>
      readString(moduleRecord, 'module_type') === type,
  )
}

function parseArchiveEntry(
  feedId: string,
  itemId: string,
  dynamicRecord: JsonObject,
  author: string,
  publishedAtSeconds: number,
  now: number,
): BilibiliDynamicEntry | undefined {
  const archive = readRecord(dynamicRecord, 'dyn_archive')
  if (!archive) {
    return undefined
  }

  const bvid = readString(archive, 'bvid')
  const title = readString(archive, 'title')
  const summary = readString(archive, 'desc')
  const cover = readString(archive, 'cover')
  const url = bvid
    ? `https://www.bilibili.com/video/${bvid}`
    : `https://t.bilibili.com/${itemId}`

  return createEntry(
    feedId,
    itemId,
    title,
    url,
    summary,
    cover,
    author,
    publishedAtSeconds,
    now,
  )
}

function parseForwardEntry(
  feedId: string,
  itemId: string,
  dynamicRecord: JsonObject,
  author: string,
  publishedAtSeconds: number,
  now: number,
): BilibiliDynamicEntry | undefined {
  const forward = readRecord(dynamicRecord, 'dyn_forward')
  const forwardItem = forward ? readRecord(forward, 'item') : undefined
  if (!forwardItem) {
    return undefined
  }

  const nestedDynamicModule = moduleByType(forwardItem, 'MODULE_TYPE_DYNAMIC')
  const nestedDynamic = nestedDynamicModule
    ? readRecord(nestedDynamicModule, 'module_dynamic')
    : undefined
  if (!nestedDynamic) {
    return undefined
  }

  const nested = parseArchiveEntry(
    feedId,
    itemId,
    nestedDynamic,
    author,
    publishedAtSeconds,
    now,
  )

  if (!nested) {
    return undefined
  }

  return {
    ...nested,
    title: `${nested.title}（转发）`,
    summary: nested.summary,
  }
}

export function parseBilibiliDynamicEntries(
  feedId: string,
  payload: object,
  now: number = Date.now(),
): BilibiliDynamicEntry[] {
  const items = readRecords(payload as JsonObject, 'items')
  const entries: BilibiliDynamicEntry[] = []

  items.forEach((item: JsonObject) => {
    const itemId = readString(item, 'id_str')
    if (!itemId) {
      return
    }

    const authorModule = moduleByType(item, 'MODULE_TYPE_AUTHOR')
    const authorRecord = authorModule
      ? readRecord(authorModule, 'module_author')
      : undefined
    const userRecord = authorRecord
      ? readRecord(authorRecord, 'user')
      : undefined
    const author = userRecord ? readString(userRecord, 'name') : ''
    const publishedAtSeconds = authorRecord
      ? readNumber(authorRecord, 'pub_ts')
      : 0

    const dynamicModule = moduleByType(item, 'MODULE_TYPE_DYNAMIC')
    const dynamicRecord = dynamicModule
      ? readRecord(dynamicModule, 'module_dynamic')
      : undefined
    if (!dynamicRecord) {
      return
    }

    const dynamicType = readString(item, 'type')
    const entry =
      dynamicType === 'DYNAMIC_TYPE_FORWARD'
        ? parseForwardEntry(
            feedId,
            itemId,
            dynamicRecord,
            author,
            publishedAtSeconds,
            now,
          )
        : parseArchiveEntry(
            feedId,
            itemId,
            dynamicRecord,
            author,
            publishedAtSeconds,
            now,
          )

    if (entry) {
      entries.push(entry)
    }
  })

  return entries
}
