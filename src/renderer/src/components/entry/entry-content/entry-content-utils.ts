import type { MediaItem } from '../../../../../shared/types'

/** 估算正文阅读时间，兼顾 CJK 字符和拉丁词数。 */
export function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, '').trim()
  const cjkCount = (
    text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []
  ).length
  const wordCount = text
    .replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, '')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(cjkCount / 400 + wordCount / 200))
}

export function formatMediaDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return ''
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

export function isAudioOnlyContentFallback(
  content: string | undefined,
  media: MediaItem[] | undefined,
): boolean {
  const trimmed = (content || '').trim()
  const audioUrl = media?.find((item) => item.type === 'audio')?.url?.trim()
  return !!trimmed && !!audioUrl && trimmed === audioUrl
}

function normalizeMediaKey(url: string): string {
  const decoded = url
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim()
  if (!decoded) return ''
  try {
    const u = new URL(decoded, window.location.href)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const path = u.pathname.replace(/\/+$/, '')
    return `${host}${path}`
  } catch {
    return decoded
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
  }
}

export function stripDuplicateMediaFromHtml(
  html: string,
  options: {
    duplicateImageKeys?: string[]
    removeEmbeddedVideos?: boolean
  },
): string {
  if (!html) return html
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<div id="__root__">${html}</div>`,
    'text/html',
  )
  const root = doc.getElementById('__root__')
  if (!root) return html

  const imageKeySet = new Set(
    (options.duplicateImageKeys || []).map(normalizeMediaKey).filter(Boolean),
  )

  if (imageKeySet.size > 0) {
    const imgs = Array.from(root.querySelectorAll('img'))
    for (const img of imgs) {
      const src =
        img.getAttribute('src') ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-original') ||
        ''
      if (!src) continue
      const key = normalizeMediaKey(src)
      if (imageKeySet.has(key)) {
        img.remove()
      }
    }
  }

  if (options.removeEmbeddedVideos) {
    const mediaNodes = root.querySelectorAll(
      'video, iframe, embed, object, audio, source, picture',
    )
    mediaNodes.forEach((node) => node.remove())
  }

  return root.innerHTML
}

export function htmlContainsImage(html: string, imageUrl: string): boolean {
  if (!html || !imageUrl) return false
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<div id="__root__">${html}</div>`,
    'text/html',
  )
  const root = doc.getElementById('__root__')
  if (!root) return false

  const targetKey = normalizeMediaKey(imageUrl)
  if (!targetKey) return false

  return Array.from(root.querySelectorAll('img')).some((img) => {
    const src =
      img.getAttribute('src') ||
      img.getAttribute('data-src') ||
      img.getAttribute('data-original') ||
      ''
    return !!src && normalizeMediaKey(src) === targetKey
  })
}
