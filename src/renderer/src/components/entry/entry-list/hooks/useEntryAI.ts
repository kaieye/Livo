import { useState, useCallback, useMemo } from 'react'
import { tweetTranslationCache, tweetSummaryCache } from '../utils/entry-caches'
import { cleanSocialPlainText, cleanSocialTextHtml } from '../utils/entry-media'
import { splitHtmlIntoParagraphs } from '../../../../lib/entry-text'

interface EntryAIContent {
  content?: string
  summary?: string
  title?: string
}

/**
 * Hook for managing AI translation and summary state with LRU cache persistence
 *
 * @param entryId - Unique entry identifier
 * @param entry - Entry content data (content, summary, title)
 * @param sanitizedContent - Pre-sanitized HTML content (optional)
 * @param language - User language preference
 * @param targetLanguage - Translation target language
 * @returns AI translation and summary state and handlers
 */
export function useEntryAI(
  entryId: string,
  entry: EntryAIContent,
  sanitizedContent: string | undefined,
  language: string,
  targetLanguage: string,
) {
  // Translation state
  const [tweetTranslatedParagraphs, setTweetTranslatedParagraphs] = useState<
    string[]
  >(() => tweetTranslationCache.get(entryId) ?? [])
  const [isTranslatingTweet, setIsTranslatingTweet] = useState(false)
  const [showTweetTranslation, setShowTweetTranslation] = useState(() =>
    tweetTranslationCache.has(entryId),
  )

  // Summary state
  const [tweetSummary, setTweetSummary] = useState<string | null>(
    () => tweetSummaryCache.get(entryId) ?? null,
  )
  const [isSummarizingTweet, setIsSummarizingTweet] = useState(false)
  const [showTweetSummary, setShowTweetSummary] = useState(() =>
    tweetSummaryCache.has(entryId),
  )

  // Extract plain text content for summary
  const tweetTextContent = useMemo(() => {
    const cleaned = cleanSocialPlainText(entry.content || entry.summary || '')
    if (cleaned) return cleaned
    return (entry.title || '').trim()
  }, [entry.content, entry.summary, entry.title])

  // Split content into paragraphs for bilingual translation
  const tweetParagraphs = useMemo(() => {
    const html = sanitizedContent || entry.content || entry.summary || ''
    if (html.includes('<')) {
      const safe = cleanSocialTextHtml(html)
      if (safe.trim()) return splitHtmlIntoParagraphs(safe)
    }
    const plain = cleanSocialPlainText(html)
    if (!plain) {
      const titleFallback = (entry.title || '').trim()
      return titleFallback ? [titleFallback] : []
    }
    // Split plain text by newlines so bilingual translation interleaves per paragraph
    const lines = plain
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
    return lines.length > 0 ? lines : [plain]
  }, [entry.content, entry.summary, entry.title, sanitizedContent])

  /**
   * Handle AI translation - translate paragraph by paragraph with caching
   */
  const handleTranslateTweet = useCallback(async () => {
    if (tweetParagraphs.length === 0) return
    // Toggle off
    if (showTweetTranslation && tweetTranslatedParagraphs.length > 0) {
      setShowTweetTranslation(false)
      return
    }
    // Toggle on if cached
    if (tweetTranslatedParagraphs.length > 0) {
      setShowTweetTranslation(true)
      return
    }
    // Do translation paragraph by paragraph
    setIsTranslatingTweet(true)
    setShowTweetTranslation(true)
    const targetLang = targetLanguage || language || 'zh-CN'
    const results: string[] = []
    for (let i = 0; i < tweetParagraphs.length; i++) {
      const plainText = tweetParagraphs[i].replace(/<[^>]*>/g, '').trim()
      if (!plainText || plainText.length < 5) {
        results.push('')
        continue
      }
      try {
        const result = await window.api.ai.translate(
          tweetParagraphs[i],
          targetLang,
        )
        if (result.success) {
          results.push(result.translation)
        } else {
          results.push(`<span class="text-red-400 text-xs">❌</span>`)
        }
      } catch {
        results.push(`<span class="text-red-400 text-xs">❌</span>`)
      }
      setTweetTranslatedParagraphs([...results])
    }
    tweetTranslationCache.set(entryId, results)
    setIsTranslatingTweet(false)
  }, [
    entryId,
    language,
    showTweetTranslation,
    targetLanguage,
    tweetParagraphs,
    tweetTranslatedParagraphs.length,
  ])

  /**
   * Handle AI summary generation with caching
   */
  const handleSummarizeTweet = useCallback(async () => {
    if (!tweetTextContent) return
    // Toggle off
    if (showTweetSummary && tweetSummary) {
      setShowTweetSummary(false)
      return
    }
    // Toggle on if cached
    if (tweetSummary) {
      setShowTweetSummary(true)
      return
    }
    // Do summary
    setIsSummarizingTweet(true)
    setShowTweetSummary(true)
    try {
      const result = await window.api.ai.summarize(
        tweetTextContent,
        language || 'zh-CN',
      )
      if (result.success) {
        setTweetSummary(result.summary)
        tweetSummaryCache.set(entryId, result.summary)
      } else {
        setTweetSummary(`Error: ${result.error}`)
      }
    } catch (err) {
      setTweetSummary(`Error: ${String(err)}`)
    }
    setIsSummarizingTweet(false)
  }, [entryId, language, showTweetSummary, tweetSummary, tweetTextContent])

  return {
    // Translation
    tweetTranslatedParagraphs,
    isTranslatingTweet,
    showTweetTranslation,
    handleTranslateTweet,
    tweetParagraphs,
    // Summary
    tweetSummary,
    isSummarizingTweet,
    showTweetSummary,
    handleSummarizeTweet,
    tweetTextContent,
  }
}
