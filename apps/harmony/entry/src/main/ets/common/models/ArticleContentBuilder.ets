import { selectArticleVideoUrls } from '../utils/ArticleVideoSource'
import {
  extractEntryGalleryImageUrls,
  extractPictureCarouselMediaUrls,
  PictureCarouselMediaItem,
  resolvePictureCarouselMediaItems,
} from '../utils/PictureGallery'
import { ArticleContentBlock, Entry, Feed } from './LivoTypes'
import { feedSiteUrl } from './FeedViewUtils'
import { selectPictureCarouselMediaUrls } from './MediaUrlUtils'
import {
  buildVideoPreviewUrl,
  decodeBasicHtml,
  extractSupportedVideoUrls,
  isSupportedVideoUrl,
  normalizeSupportedVideoUrl,
  resolveAbsoluteUrl,
} from './VideoUrlExtractor'

export { extractSupportedVideoUrls } from './VideoUrlExtractor'

export interface EntryMediaContext {
  pictureUrls: string[]
  rawUrls: string[]
}

export function isLegacyPlainArticleContent(content: string): boolean {
  const normalized = (content || '').trim()
  if (!normalized) {
    return false
  }
  return !/<[a-z][\s\S]*>/i.test(normalized) && !/\[\[IMG_\d+\]\]/.test(normalized)
}

export function resolveEntryMediaContext(entry: Entry, feed: Feed): EntryMediaContext {
  const pictureUrls = extractEntryGalleryImageUrls({
    summary: entry.summary,
    content: entry.content,
    articleUrl: entry.url,
    siteUrl: feedSiteUrl(feed),
    mediaUrls: entry.mediaUrls ?? [],
  })
  const rawUrls = extractPictureCarouselMediaUrls({
    summary: entry.summary,
    content: entry.content,
    articleUrl: entry.url,
    siteUrl: feedSiteUrl(feed),
    mediaUrls: selectPictureCarouselMediaUrls(entry.mediaUrls ?? [], pictureUrls),
  })
  const result: EntryMediaContext = { pictureUrls: pictureUrls, rawUrls: rawUrls }
  return result
}

export function buildMediaContentBlocks(
  mediaItems: PictureCarouselMediaItem[],
  fallbackImageUrl: string,
  startIndex: number = 0,
): ArticleContentBlock[] {
  const blocks: ArticleContentBlock[] = []
  let index = startIndex
  mediaItems.forEach((item) => {
    if (item.kind === 'livePhoto' && item.videoUrl) {
      blocks.push({
        id: `video-${index}`,
        type: 'video',
        text: '',
        imageUrl: item.imageUrl || fallbackImageUrl,
        videoUrl: item.videoUrl,
      })
      index += 1
      return
    }
    if (item.imageUrl) {
      blocks.push({ id: `image-${index}`, type: 'image', text: '', imageUrl: item.imageUrl, videoUrl: '' })
      index += 1
    }
  })
  return blocks
}

function extractImageUrl(tag: string, baseUrl: string): string {
  const srcMatch = tag.match(/\b(?:data-src|data-original|src)=["']([^"']+)["']/i)
  return srcMatch?.[1] ? resolveAbsoluteUrl(baseUrl, decodeBasicHtml(srcMatch[1])) : ''
}

function createVideoContentBlock(id: string, videoUrl: string): ArticleContentBlock {
  return { id, type: 'video', text: '', imageUrl: buildVideoPreviewUrl(videoUrl), videoUrl }
}

function isStandaloneVideoParagraph(text: string): boolean {
  const normalized = (text || '')
    .trim()
    .replace(/^[("'\[{<\s]+|[)"'\]}>、，,。.!！？\s]+$/g, '')
  if (!normalized) {
    return false
  }
  return isSupportedVideoUrl(normalized) || isSupportedVideoUrl(normalizeSupportedVideoUrl(normalized))
}

function splitDenseParagraph(text: string): string[] {
  const normalized = text.trim()
  if (!normalized) {
    return []
  }
  const numberedParts = normalized
    .replace(/([。！？!?])\s*(\d+[、.．])/g, '$1\n\n$2')
    .replace(/([。！？!?])\s*((?:其|另|再)次[，,]?)/g, '$1\n\n$2')
    .split(/\n{2,}/)
    .map((item: string) => item.trim())
    .filter((item: string) => item.length > 0)

  const result: string[] = []
  numberedParts.forEach((part: string) => {
    if (part.length <= 110) {
      result.push(part)
      return
    }
    let current = ''
    const sentences = part.match(/[^。！？!?]+[。！？!?]?/g) ?? [part]
    sentences.forEach((sentence: string) => {
      const next = `${current}${sentence}`.trim()
      if (current && next.length > 110) {
        result.push(current.trim())
        current = sentence.trim()
      } else {
        current = next
      }
    })
    if (current.trim()) {
      result.push(current.trim())
    }
  })
  return result.length > 0 ? result : [normalized]
}

function pushParagraphBlocks(source: string, blocks: ArticleContentBlock[], startIndex: number): number {
  const segments = source
    .split(/\n{2,}/)
    .map((item: string) => item.replace(/[ \t]+\n/g, '\n').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((item: string) => item.length > 0)

  let index = startIndex
  segments.forEach((text: string) => {
    splitDenseParagraph(text).forEach((paragraph: string) => {
      if (isStandaloneVideoParagraph(paragraph)) {
        return
      }
      blocks.push({ id: `paragraph-${index}`, type: 'paragraph', text: paragraph, imageUrl: '', videoUrl: '' })
      index += 1
    })
  })
  return index
}

export function buildArticleContentBlocks(
  content: string,
  baseUrl: string,
  articleUrl: string,
  mediaUrls: string[] = [],
): ArticleContentBlock[] {
  const raw = (content || '').trim()
  const videoUrls = selectArticleVideoUrls(
    articleUrl,
    mediaUrls,
    extractSupportedVideoUrls(raw, baseUrl, articleUrl),
  )

  if (!raw) {
    return videoUrls.map((videoUrl: string, index: number) => createVideoContentBlock(`video-${index}`, videoUrl))
  }

  const imageUrls: string[] = []
  const normalized = decodeBasicHtml(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<img\b[^>]*>/gi, (tag: string) => {
      const imageUrl = extractImageUrl(tag, baseUrl)
      if (!imageUrl) {
        return '\n\n'
      }
      const imageIndex = imageUrls.length
      imageUrls.push(imageUrl)
      return `\n\n[[IMG_${imageIndex}]]\n\n`
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(?:\/p|\/div|\/section|\/article|\/blockquote|\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/tr)>/gi, '\n\n')
    .replace(/<(?:p|div|section|article|blockquote|h[1-6]|ul|ol|pre|tr)\b[^>]*>/gi, '')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<[^>]*>/g, '')
    .replace(/\r/g, '')

  const parts = normalized.split(/(\[\[IMG_\d+\]\])/g)
  const blocks: ArticleContentBlock[] = []
  let blockIndex = 0

  videoUrls.forEach((videoUrl: string) => {
    blocks.push(createVideoContentBlock(`video-${blockIndex}`, videoUrl))
    blockIndex += 1
  })

  parts.forEach((part: string) => {
    const imageMatch = part.match(/^\[\[IMG_(\d+)\]\]$/)
    if (imageMatch?.[1]) {
      const imageUrl = imageUrls[Number(imageMatch[1])] ?? ''
      if (imageUrl) {
        blocks.push({ id: `image-${blockIndex}`, type: 'image', text: '', imageUrl, videoUrl: '' })
        blockIndex += 1
      }
      return
    }
    blockIndex = pushParagraphBlocks(part, blocks, blockIndex)
  })

  return blocks
}

export function buildPictureDetailContentBlocks(
  entry: Entry,
  feed: Feed,
  fallbackImageUrl: string,
): ArticleContentBlock[] {
  const mediaCtx = resolveEntryMediaContext(entry, feed)
  const mediaItems = resolvePictureCarouselMediaItems(mediaCtx.rawUrls, fallbackImageUrl)
  const blocks = buildMediaContentBlocks(mediaItems, fallbackImageUrl)

  const mediaStrippedContent = decodeBasicHtml(entry.content || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(?:img|video|source)\b[^>]*>/gi, '\n\n')
  const pictureTextSource = [entry.summary, mediaStrippedContent]
    .filter((value: string) => !!(value || '').trim())
    .join('\n\n')

  pushParagraphBlocks(pictureTextSource, blocks, blocks.length)
  return blocks
}
