export interface InlineHighlightSegment {
  text: string
  matched: boolean
}

export function normalizeInlineSearchQuery(query: string): string {
  return (query || '').trim().toLocaleLowerCase()
}

export function buildInlineHighlightSegments(
  text: string,
  query: string,
): InlineHighlightSegment[] {
  const rawText = text || ''
  const normalizedQuery = normalizeInlineSearchQuery(query)
  if (!rawText || !normalizedQuery) {
    return [{ text: rawText, matched: false }]
  }

  const lowerText = rawText.toLocaleLowerCase()
  const segments: InlineHighlightSegment[] = []
  let cursor = 0

  while (cursor < rawText.length) {
    const matchIndex = lowerText.indexOf(normalizedQuery, cursor)
    if (matchIndex < 0) {
      segments.push({ text: rawText.slice(cursor), matched: false })
      break
    }

    if (matchIndex > cursor) {
      segments.push({ text: rawText.slice(cursor, matchIndex), matched: false })
    }

    const matchEnd = matchIndex + normalizedQuery.length
    segments.push({ text: rawText.slice(matchIndex, matchEnd), matched: true })
    cursor = matchEnd
  }

  return segments.length > 0 ? segments : [{ text: rawText, matched: false }]
}
