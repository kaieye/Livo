export interface PreviewSeedEntry {
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

function sanitizeIdentity(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createEntryId(
  feedId: string,
  entryId: string,
  link: string,
  title: string,
  index: number,
): string {
  const normalizedEntryId = sanitizeIdentity(entryId)
  if (normalizedEntryId) {
    return `${feedId}-${normalizedEntryId}`
  }

  const normalized = `${feedId}-${link || title || index}`.toLowerCase()
  const compact = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return compact || `${feedId}-${index}`
}

export function rekeyPreviewEntries(
  feedId: string,
  entries: PreviewSeedEntry[],
): PreviewSeedEntry[] {
  return entries.map((entry: PreviewSeedEntry, index: number) => ({
    ...entry,
    id: createEntryId(feedId, entry.id, entry.url, entry.title, index),
    feedId,
    mediaUrls: [...(entry.mediaUrls ?? [])],
  }))
}
