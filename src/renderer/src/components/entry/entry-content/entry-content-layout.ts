export type EntryContentLayout =
  | 'readability'
  | 'bilingual'
  | 'html'
  | 'audio-only'
  | 'detail-fallback'
  | 'empty'

export function getEntryContentLayout({
  isReadabilityMode,
  hasReadableContent,
  hasArticleContent,
  showTranslation,
  hasAudio,
  showEntryDetailFallback,
}: {
  isReadabilityMode: boolean
  hasReadableContent: boolean
  hasArticleContent: boolean
  showTranslation: boolean
  hasAudio: boolean
  showEntryDetailFallback: boolean
}): EntryContentLayout {
  if (isReadabilityMode && hasReadableContent) return 'readability'
  if (hasArticleContent) return showTranslation ? 'bilingual' : 'html'
  if (hasAudio) return 'audio-only'
  if (showEntryDetailFallback) return 'detail-fallback'
  return 'empty'
}
