import type { PictureCarouselMediaItem } from '../PictureGallery.ts'

export interface ArticleDetailContentBlockLike {
  type: string
  text?: string
  imageUrl?: string
  videoUrl?: string
}

export interface ArticleDetailTextEntryLike {
  title?: string
  summary?: string
  contentParagraphs?: string[]
  contentBlocks?: ArticleDetailContentBlockLike[]
}

export function cleanArticleDetailText(value: string): string {
  return (value || '')
    .replace(/https?:\/\/[^\s]+/gi, ' ')
    .replace(/\b(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#@]/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function resolvePictureDetailMediaItems(
  blocks: ArticleDetailContentBlockLike[],
): PictureCarouselMediaItem[] {
  return (blocks ?? []).reduce(
    (
      result: PictureCarouselMediaItem[],
      block: ArticleDetailContentBlockLike,
    ) => {
      if (block.type === 'video' && block.videoUrl) {
        result.push({
          kind: 'livePhoto',
          imageUrl: block.imageUrl || '',
          videoUrl: block.videoUrl,
        })
        return result
      }

      if (block.type === 'image' && block.imageUrl) {
        result.push({
          kind: 'image',
          imageUrl: block.imageUrl,
          videoUrl: '',
        })
      }
      return result
    },
    [],
  )
}

export function resolvePictureDetailTextBlocks<
  T extends ArticleDetailContentBlockLike,
>(blocks: T[]): T[] {
  return (blocks ?? []).filter(
    (block: T) => block.type === 'paragraph' && !!block.text,
  )
}

export function shouldRenderArticleSummary(
  entry?: ArticleDetailTextEntryLike,
): boolean {
  const summary = cleanArticleDetailText(entry?.summary ?? '')
  if (!summary) {
    return false
  }

  const title = cleanArticleDetailText(entry?.title ?? '')
  if (
    title &&
    (summary === title || summary.includes(title) || title.includes(summary))
  ) {
    return false
  }

  const firstParagraphBlock = entry?.contentBlocks?.find(
    (block: ArticleDetailContentBlockLike) =>
      block.type === 'paragraph' && block.text,
  )
  const firstParagraph = cleanArticleDetailText(
    firstParagraphBlock?.text ?? entry?.contentParagraphs?.[0] ?? '',
  )
  if (
    firstParagraph &&
    (summary === firstParagraph ||
      summary.includes(firstParagraph) ||
      firstParagraph.includes(summary))
  ) {
    return false
  }

  const openingParagraphs = cleanArticleDetailText(
    (entry?.contentParagraphs ?? []).slice(0, 3).join(' '),
  )
  if (
    openingParagraphs &&
    (openingParagraphs.includes(summary) || summary.includes(openingParagraphs))
  ) {
    return false
  }

  return true
}

export function shouldRenderArticleParagraphBlock(
  entry: ArticleDetailTextEntryLike | undefined,
  block: ArticleDetailContentBlockLike,
  index: number,
): boolean {
  if (block.type !== 'paragraph' || !block.text) {
    return true
  }

  const normalizedParagraph = cleanArticleDetailText(block.text)
  if (!normalizedParagraph) {
    return false
  }

  const title = cleanArticleDetailText(entry?.title ?? '')
  if (
    title &&
    (normalizedParagraph === title || normalizedParagraph.includes(title))
  ) {
    return false
  }

  if (!shouldRenderArticleSummary(entry)) {
    return true
  }

  const normalizedSummary = cleanArticleDetailText(entry?.summary ?? '')
  if (!normalizedSummary) {
    return true
  }

  if (
    index <= 2 &&
    (normalizedParagraph === normalizedSummary ||
      normalizedParagraph.includes(normalizedSummary) ||
      normalizedSummary.includes(normalizedParagraph))
  ) {
    return false
  }

  return true
}

export function articleImageBlockServesAsVideoCover(
  blocks: ArticleDetailContentBlockLike[],
  index: number,
): boolean {
  const current = blocks[index]
  if (!current || current.type !== 'image' || !current.imageUrl) {
    return false
  }

  const previous = index > 0 ? blocks[index - 1] : undefined
  if (!previous || previous.type !== 'video') {
    return false
  }

  return !(previous.imageUrl || '').trim()
}

export function resolveArticleVideoPreviewImage(
  blocks: ArticleDetailContentBlockLike[],
  block: ArticleDetailContentBlockLike,
  index: number,
): string {
  const ownPreview = (block.imageUrl || '').trim()
  if (ownPreview) {
    return ownPreview
  }

  const next = index + 1 < blocks.length ? blocks[index + 1] : undefined
  if (next && next.type === 'image' && next.imageUrl) {
    return next.imageUrl
  }

  return ''
}
