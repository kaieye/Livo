import { EntryCardModel } from '../../models/LivoModels'
import { buildInlineHighlightSegments } from './HomeInlineSearch'

export function searchEntryTexts(entry: EntryCardModel): string[] {
  return [
    entry.feedTitle || '',
    entry.title || '',
    entry.summary || '',
    entry.author || '',
  ]
}

export function searchResultSnippet(text: string, query: string): string {
  if (!query || !text) {
    return ''
  }

  const lowerText = text.toLocaleLowerCase()
  const index = lowerText.indexOf(query)
  if (index < 0) {
    return ''
  }

  const start = Math.max(0, index - 20)
  const end = Math.min(text.length, index + query.length + 30)
  let snippet = text.slice(start, end).trim()
  if (start > 0) {
    snippet = `...${snippet}`
  }
  if (end < text.length) {
    snippet = `${snippet}...`
  }
  return snippet
}

export function searchResultSummaryText(entry: EntryCardModel, query: string): string {
  const candidates: string[] = [
    entry.summary || '',
    entry.author || '',
    entry.feedTitle || '',
    entry.title || '',
  ]

  for (const text of candidates) {
    const snippet = searchResultSnippet(text, query)
    if (snippet) {
      return snippet
    }
  }

  return ''
}

export function entryMatchesQuery(entry: EntryCardModel, query: string): boolean {
  return searchEntryTexts(entry).some((text: string) =>
    buildInlineHighlightSegments(text, query).some((segment) => segment.matched)
  )
}

export function filterSearchResults(
  entries: EntryCardModel[],
  query: string,
  limit: number,
): EntryCardModel[] {
  if (!query) {
    return []
  }
  return entries.filter((e) => entryMatchesQuery(e, query)).slice(0, limit)
}
