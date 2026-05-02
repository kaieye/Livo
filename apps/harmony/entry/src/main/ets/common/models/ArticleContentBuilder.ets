import { selectArticleVideoUrls } from '../utils/ArticleVideoSource'
import { isDirectVideoUrl } from '../utils/FeedMediaUrl'
import {
  extractEntryGalleryImageUrls,
  extractPictureCarouselMediaUrls,
  resolvePictureCarouselMediaItems,
} from '../utils/PictureGallery'
import { ArticleContentBlock, Entry, Feed } from './LivoTypes'
import { selectPictureCarouselMediaUrls } from './MediaUrlUtils'

export function isLegacyPlainArticleContent(content: string): boolean {
  const normalized = (content || '').trim()
  if (!normalized) {
    return false
  }
  return !/<[a-z][\s\S]*>/i.test(normalized) && !/\[\[IMG_\d+\]\]/.test(normalized)
}

function decodeBasicHtml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&nbsp;/g, ' ')
}

function resolveAbsoluteUrl(baseUrl: string, value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed
  }
  const base = (baseUrl || '').trim()
  if (!base) {
    return trimmed
  }
  const originMatch = base.match(/^(https?:\/\/[^/]+)(\/.*)?$/i)
  const origin = originMatch?.[1] ?? ''
  const basePath = originMatch?.[2] ?? '/'
  if (!origin) {
    return trimmed
  }
  if (trimmed.startsWith('/')) {
    return `${origin}${trimmed}`
  }
  const normalizedBaseDir = basePath.includes('/')
    ? basePath.replace(/\/[^/]*$/, '/')
    : '/'
  return `${origin}${normalizedBaseDir}${trimmed}`.replace(/([^:]\/)\/+/g, '$1')
}

function extractImageUrl(tag: string, baseUrl: string): string {
  const srcMatch = tag.match(/\b(?:data-src|data-original|src)=["']([^"']+)["']/i)
  return srcMatch?.[1] ? resolveAbsoluteUrl(baseUrl, decodeBasicHtml(srcMatch[1])) : ''
}

function extractYouTubeVideoId(value: string): string {
  const matched = (value || '').match(
    /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  )
  return matched?.[1] ?? ''
}

function extractBilibiliVideoToken(value: string): string {
  const bvid = (value || '').match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)?.[1]
  if (bvid) {
    return `BV:${bvid}`
  }
  const aid = (value || '').match(/(?:\/video\/av|[?&]aid=)(\d+)/i)?.[1]
  if (aid) {
    return `AV:${aid}`
  }
  return ''
}

function isSupportedVideoUrl(value: string): boolean {
  return isDirectVideoUrl(value) || !!extractYouTubeVideoId(value) || !!extractBilibiliVideoToken(value)
}

function normalizeSupportedVideoUrl(value: string): string {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return ''
  }
  if (isDirectVideoUrl(trimmed)) {
    return trimmed
  }
  const youTubeId = extractYouTubeVideoId(trimmed)
  if (youTubeId) {
    return `https://www.youtube.com/watch?v=${youTubeId}`
  }
  const bilibiliToken = extractBilibiliVideoToken(trimmed)
  if (bilibiliToken.startsWith('BV:')) {
    return `https://www.bilibili.com/video/${bilibiliToken.substring(3)}`
  }
  if (bilibiliToken.startsWith('AV:')) {
    return `https://www.bilibili.com/video/av${bilibiliToken.substring(3)}`
  }
  return trimmed
}

function buildVideoPreviewUrl(videoUrl: string): string {
  const youTubeId = extractYouTubeVideoId(videoUrl)
  return youTubeId ? `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg` : ''
}

export function extractSupportedVideoUrls(content: string, baseUrl: string, articleUrl: string): string[] {
  const results: string[] = []
  const pushUrl = (value: string): void => {
    const resolved = normalizeSupportedVideoUrl(resolveAbsoluteUrl(baseUrl, decodeBasicHtml(value)))
    if (!resolved || !isSupportedVideoUrl(resolved) || results.includes(resolved)) {
      return
    }
    results.push(resolved)
  }

  const normalizedArticleUrl = normalizeSupportedVideoUrl(articleUrl)
  if (normalizedArticleUrl && isSupportedVideoUrl(normalizedArticleUrl)) {
    results.push(normalizedArticleUrl)
  }

  const raw = decodeBasicHtml(content || '')
  for (const matched of raw.matchAll(/\b(?:href|src|data-src)=["']([^"']+)["']/gi)) {
    if (matched[1]) {
      pushUrl(matched[1])
    }
  }
  for (const matched of raw.matchAll(
    /https?:\/\/[^\s"'<>]+|(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/|bilibili\.com\/video\/)[^\s"'<>]+/gi,
  )) {
    if (!matched[0]) {
      continue
    }
    pushUrl(matched[0].startsWith('http') ? matched[0] : `https://${matched[0]}`)
  }

  return results
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
  const galleryImageUrls = extractEntryGalleryImageUrls({
    summary: entry.summary,
    content: entry.content,
    articleUrl: entry.url,
    siteUrl: feed.siteUrl ?? feed.url,
    mediaUrls: entry.mediaUrls ?? [],
  })
  const orderedMediaUrls = extractPictureCarouselMediaUrls({
    summary: entry.summary,
    content: entry.content,
    articleUrl: entry.url,
    siteUrl: feed.siteUrl ?? feed.url,
    mediaUrls: selectPictureCarouselMediaUrls(entry.mediaUrls ?? [], galleryImageUrls),
  })
  const mediaItems = resolvePictureCarouselMediaItems(orderedMediaUrls, fallbackImageUrl)
  const blocks: ArticleContentBlock[] = []
  let blockIndex = 0

  mediaItems.forEach((item) => {
    if (item.kind === 'livePhoto' && item.videoUrl) {
      blocks.push({
        id: `video-${blockIndex}`,
        type: 'video',
        text: '',
        imageUrl: item.imageUrl || fallbackImageUrl,
        videoUrl: item.videoUrl,
      })
      blockIndex += 1
      return
    }
    if (item.imageUrl) {
      blocks.push({ id: `image-${blockIndex}`, type: 'image', text: '', imageUrl: item.imageUrl, videoUrl: '' })
      blockIndex += 1
    }
  })

  const mediaStrippedContent = decodeBasicHtml(entry.content || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(?:img|video|source)\b[^>]*>/gi, '\n\n')
  const pictureTextSource = [entry.summary, mediaStrippedContent]
    .filter((value: string) => !!(value || '').trim())
    .join('\n\n')

  pushParagraphBlocks(pictureTextSource, blocks, blockIndex)
  return blocks
}
