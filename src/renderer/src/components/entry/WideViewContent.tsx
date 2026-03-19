/**
 * WideViewContent 锟?Full-width content panel for Social Media / Videos views.
 *
 * These views use a 2-column layout: sidebar + content.
 * There is NO separate entry-list or entry-detail panel 锟?the content
 * fills the entire remaining area after the sidebar.
 *
 * Interaction model:
 * - Videos: click shows modal with embedded player + title + description
 * - Social media: click shows animated overlay with full entry content;
 *   double-click opens in browser; Escape closes overlay
 */
import { useEffect, useState, useCallback, useMemo, useRef, useLayoutEffect, memo, type SyntheticEvent, type UIEvent } from "react"
import { useTranslation } from "react-i18next"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useEntryStore } from "../../store/entry-store"
import { useFeedStore } from "../../store/feed-store"
import { useSettingsStore } from "../../store/settings-store"
import { FeedViewType, VIEW_DEFINITIONS, type Entry } from "../../../../shared/types"
import { VIEW_TYPE_I18N_KEYS } from "../../lib/view-type-keys"
import { transformVideoUrl } from "../media/MediaPlayer"
import { sanitizeHTML } from "../../utils/sanitize"
import { RECOMMENDED_CATEGORY } from "../../hooks/useInitRecommendedFeeds"
import { formatDistanceToNow, type Locale } from "date-fns"
import { getDateLocale } from "../../lib/date-locale"
import { SkeletonList } from "../ui/Skeleton"
import { ContextMenu, useEntryContextMenu, useEntryContextActions } from "../ui/ContextMenu"
import { SharePoster } from "../ui/SharePoster"
import { VideoPlayer } from "../ui/VideoPlayer"
import { groupEntriesByDate } from "../../lib/date-groups"
import { useAsyncSocialDedupe } from "../../hooks/useAsyncSocialDedupe"
import { canonicalizeSocialUrl, extractFirstHttpUrl, extractFirstNonMediaUrl } from "../../lib/social-url"
import { getImageProxyFallbackUrls } from "../../lib/image-proxy"
import { getEntryLoadLimit } from "../../lib/entry-load-limit"
import { blurhashToAverageColor } from "../../lib/blurhash"
import { Search, CheckCheck, Loader2, Inbox, RefreshCw, X, ChevronLeft, ChevronRight, ExternalLink, Share2, Eye, EyeOff, Languages, Sparkles, Play, Image } from "lucide-react"

function getVideoColumnCount(containerWidth: number): number {
  return containerWidth >= 1600 ? 5 :
    containerWidth >= 1200 ? 4 :
    containerWidth >= 800 ? 3 : 2
}

function getMasonryColumnCount(containerWidth: number): number {
  return containerWidth >= 1600 ? 7 :
    containerWidth >= 1400 ? 6 :
    containerWidth >= 1100 ? 5 :
    containerWidth >= 800 ? 4 : 3
}

const MASONRY_INITIAL_RENDER = 30
const MASONRY_RENDER_BATCH = 40

interface MasonryCardData {
  id: string
  feedId: string
  firstImage: string
  photoCount: number
  publishedAt: number
}

const MasonryCard = memo(function MasonryCard({
  data,
  feedTitle,
  feedImage,
  onClick,
  onContextMenu,
  locale,
}: {
  data: MasonryCardData
  feedTitle?: string
  feedImage?: string
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  locale: Locale | undefined
}) {
  const timeAgo = useMemo(() => {
    if (!data.publishedAt) return ""
    return formatDistanceToNow(new Date(data.publishedAt), { addSuffix: true, locale })
  }, [data.publishedAt, locale])

  return (
    <div
      className="cursor-pointer group"
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className="relative rounded-xl overflow-hidden bg-surface-tertiary dark:bg-surface-dark-tertiary">
        <img
          src={data.firstImage}
          alt=""
          className="w-full h-auto object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const parent = e.currentTarget.closest(".group") as HTMLElement | null
            if (parent) parent.style.display = "none"
          }}
        />
        {/* Feed avatar + time + photo count overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-end gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {feedImage ? (
                <img
                  src={feedImage}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.display = "none" }}
                />
              ) : null}
              <span className="text-[11px] text-white/90 truncate font-medium min-w-0">
                {feedTitle || ""}
              </span>
            </div>
            <div className="ml-auto flex flex-col items-end flex-shrink-0">
              {data.photoCount > 1 && (
                <span className="flex items-center gap-0.5 text-[10px] text-white/80">
                  <Image size={9} />
                  {data.photoCount}
                </span>
              )}
              {timeAgo && (
                <span className="text-[10px] text-white/60 whitespace-nowrap">{timeAgo}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

const SOCIAL_INITIAL_RENDER_COUNT = 24
const SOCIAL_RENDER_BATCH = 80

const rememberedContainerWidthByView = new Map<string, number>()

function normalizeLooseText(value: string): string {
  return (value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\p{L}\p{N}\p{Script=Han}#@]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Return true when the plain-text description adds no information beyond the title. */
function isDescriptionRedundant(title: string, descriptionHtml: string): boolean {
  if (!title || !descriptionHtml || title === "Untitled") return false
  const normT = normalizeLooseText(title)
  const normS = normalizeLooseText(descriptionHtml)
  if (normT && normS) {
    return normS === normT || normS.startsWith(normT) || normT.startsWith(normS)
  }
  // Fallback: compare raw trimmed strings (handles emoji-only content)
  const rawT = title.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  const rawS = descriptionHtml.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  if (!rawT || !rawS) return false
  return rawS === rawT || rawS.startsWith(rawT) || rawT.startsWith(rawS)
}

function hasVisualSignal(entry: Entry): boolean {
  if ((entry.media?.length || 0) > 0) return true
  if (entry.imageUrl) return true
  const html = `${entry.content || ""}\n${entry.summary || ""}`
  return /<img\b/i.test(html)
}

function countLikelyRenderableImages(entry: Entry): number {
  const keys = new Set<string>()
  for (const m of entry.media || []) {
    const preview = decodeMediaUrl(m.previewUrl || "")
    const original = decodeMediaUrl(m.url || "")
    if (preview && isLikelyImageByUrl(preview)) keys.add(normalizeImageCacheKey(preview))
    if (original && isLikelyImageByUrl(original)) keys.add(normalizeImageCacheKey(original))
  }
  const imageUrl = decodeMediaUrl(entry.imageUrl || "")
  if (imageUrl && isLikelyImageByUrl(imageUrl)) keys.add(normalizeImageCacheKey(imageUrl))
  for (const url of extractImagesFromHtml(entry.content || entry.summary || "")) {
    const decoded = decodeMediaUrl(url)
    if (decoded && isLikelyImageByUrl(decoded)) keys.add(normalizeImageCacheKey(decoded))
  }
  return keys.size
}

function getMediaRenderWeight(url: string): number {
  const raw = decodeMediaUrl(url || "").toLowerCase()
  if (!raw) return 0
  if (raw.includes("media.picnob.info/get")) return 0
  if (/sp\d+\.pixnoy\.com\/p\/pt/i.test(raw)) return 4
  if (raw.includes("pixnoy.com/p/pt")) return 3
  if (raw.includes("media.pixnoy.com/get")) return 2
  if (/cdninstagram|fbcdn\.net|scontent\./i.test(raw)) return 1
  if (isLikelyImageByUrl(raw)) return 1
  return 0
}

function renderQualityScore(entry: Entry): number {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const m of entry.media || []) {
    if (m.previewUrl) urls.push(m.previewUrl)
    if (m.url) urls.push(m.url)
  }
  if (entry.imageUrl) urls.push(entry.imageUrl)
  for (const u of extractImagesFromHtml(entry.content || entry.summary || "")) urls.push(u)

  let score = 0
  for (const u of urls) {
    const decoded = decodeMediaUrl(u)
    const key = normalizeImageCacheKey(decoded)
    if (!key || seen.has(key)) continue
    seen.add(key)
    score += getMediaRenderWeight(decoded)
  }
  return score
}

function timelineEntryScore(entry: Entry): number {
  const likelyImages = countLikelyRenderableImages(entry)
  const quality = renderQualityScore(entry)
  const hasVideo = (entry.media || []).some((m) => m.type === "video") ? 12000 : 0
  return hasVideo + quality * 5000 + likelyImages * 500 + (entry.media?.length || 0) * 10 + ((entry.content || entry.summary || "").length || 0)
}
/** Split HTML content into paragraph blocks for bilingual display */
function splitIntoParagraphs(html: string): string[] {
  const blocks = html
    .split(/(<\/(?:p|div|h[1-6]|li|blockquote|pre|table|tr|section|article|figure)>)/i)
    .reduce<string[]>((acc, part, i, arr) => {
      if (i % 2 === 0 && i + 1 < arr.length) {
        acc.push(part + arr[i + 1])
      } else if (i % 2 === 0 && i === arr.length - 1 && part.trim()) {
        acc.push(part)
      }
      return acc
    }, [])
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && b.replace(/<[^>]*>/g, "").trim().length > 0)
  return blocks.length > 0 ? blocks : [html]
}

/** Decode HTML entities that may remain in URLs extracted from RSS content */
function decodeMediaUrl(url: string): string {
  let decoded = (!url || !url.includes("&")) ? url : url
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  if (decoded?.startsWith("//")) decoded = `https:${decoded}`
  return normalizePicnobImageUrl(normalizeNitterImageUrl(decoded))
}

function isDecorativeSocialImageUrl(url: string): boolean {
  const raw = (url || "").trim()
  const lower = raw.toLowerCase()
  if (!lower) return false
  const nested = lower.match(/[?&]url=([^&#]+)/i)?.[1]
  if (nested) {
    try {
      const decodedNested = decodeURIComponent(nested)
      if (decodedNested && decodedNested !== raw && isDecorativeSocialImageUrl(decodedNested)) return true
    } catch {
      // Ignore malformed nested URLs.
    }
  }
  if (lower.includes("unavatar.io/instagram/")) return true
  if (/(?:^|[/?#&_.=-])(avatar|profile|icon|logo|favicon|apple-touch-icon|android-chrome|mstile|sprite|emoji|placeholder|glyph|badge|button|download|appstore|app-store|playstore|play-store|googleplay|google-play)(?:$|[/?#&_.=-])/i.test(lower)) {
    return true
  }
  if (lower.includes("static.cdninstagram.com")) return true
  if (lower.includes("instagram.com/static/")) return true
  if (lower.includes("instagram_static/")) return true
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    const isInstagramAssetHost = host.includes("instagram.com") && !host.includes("cdninstagram") && !host.includes("scontent") && !host.includes("fbcdn.net")
    if (isInstagramAssetHost) {
      const isPostMedia = /\/(?:p|reel|tv)\/[a-z0-9_-]+\/media\/?/i.test(path)
      if (!isPostMedia) return true
    }
    if (host.includes("cdninstagram.com") && /\/(?:static|assets?|images?)\//i.test(path) && !/\/(?:p|post|get)\//i.test(path)) return true
    if (/(?:picnob|pixnoy|piokok|pixwox)\./i.test(host)) {
      if (/\/(?:static|assets?|images?)\//i.test(path) && !/\/(?:p|post|get)\//i.test(path)) return true
      if (/\/(?:logos?|icons?|favicons?|downloads?|apple-touch-icon|android-chrome|mstile|sprites?|emoji|buttons?|badges?)(?:$|[\/_\-.])/i.test(path)) return true
    }
  } catch {
    // Ignore malformed URLs.
  }
  return false
}

function hasTinyDecorativeDimensions(width?: number, height?: number): boolean {
  const safeWidth = width || 0
  const safeHeight = height || 0
  if (safeWidth <= 0 || safeHeight <= 0) return false
  const maxDimension = Math.max(safeWidth, safeHeight)
  const minDimension = Math.min(safeWidth, safeHeight)
  return maxDimension <= 180 || (maxDimension <= 240 && minDimension <= 180)
}

function isLikelyImageByUrl(url: string): boolean {
  const raw = (url || "").trim().toLowerCase()
  if (!raw) return false
  const nested = raw.match(/[?&]url=([^&#]+)/i)?.[1]
  if (nested) {
    try {
      const decodedNested = decodeURIComponent(nested)
      if (/^https?:\/\//i.test(decodedNested)) return isLikelyImageByUrl(decodedNested)
    } catch {
      // Ignore malformed nested URL and continue fallback checks.
    }
  }
  if (isDecorativeSocialImageUrl(raw)) return false
  if (/^https?:\/\/media\.(?:picnob|pixnoy|piokok|pixwox)\.[^/]+\//i.test(raw)) return true
  if (/^https?:\/\/sp\d+\.pixnoy\.[^/]+\//i.test(raw)) return true
  if (/\.(mp4|webm|mov|m3u8)(\?|$)/i.test(raw)) return false
  if (/(?:^|[?&])(mime|type)=video/i.test(raw)) return false
  if (/(?:^|[?&])(mime|type)=image/i.test(raw)) return true
  if (/\/v\/t\d+\.\d+-16\//i.test(raw)) return false
  if (/\/o1\/v\/t16\//i.test(raw)) return false
  if (/[?&]ig_cache_key=/i.test(raw)) return true
  return (
    /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(raw) ||
    raw.includes("cdninstagram") ||
    raw.includes("scontent.") ||
    raw.includes("fbcdn.net") ||
    raw.includes("/p/pt_") ||
    raw.includes("pixnoy.com/p/")
  )
}

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(url)
}

function isRenderableVideoUrl(url: string): boolean {
  const decoded = decodeMediaUrl(url || "")
  if (!decoded || isLikelyImageByUrl(decoded)) return false
  if (isDirectVideoUrl(decoded)) return true
  if (/(?:^|\.)(?:bilibili\.com|b23\.tv)\//i.test(decoded)) return true
  return !!transformVideoUrl(decoded)
}

function isRenderableVideoMediaItem(media?: { url?: string; previewUrl?: string } | null): boolean {
  if (!media) return false
  const url = decodeMediaUrl(media.url || "")
  const preview = decodeMediaUrl(media.previewUrl || "")
  if (url && isRenderableVideoUrl(url)) return true
  if (preview && isDirectVideoUrl(preview)) return true
  return false
}
  const hasVideo = (entry: Entry): boolean => (entry.media || []).some((m) => m.type === "video" && isRenderableVideoMediaItem(m))

function extractImagesFromHtml(html: string): string[] {
  if (!html || !html.includes("<")) return []
  try {
    const doc = new DOMParser().parseFromString(html, "text/html")
    const urls = Array.from(doc.querySelectorAll("img"))
      .flatMap((img) => {
        const width = img.getAttribute("width") || img.getAttribute("data-width") || ""
        const height = img.getAttribute("height") || img.getAttribute("data-height") || ""
        const widthValue = width ? Number.parseInt(width, 10) : undefined
        const heightValue = height ? Number.parseInt(height, 10) : undefined
        if (hasTinyDecorativeDimensions(widthValue, heightValue)) return []
        return [
          decodeMediaUrl(img.getAttribute("src") || ""),
          decodeMediaUrl(img.getAttribute("data-src") || ""),
          decodeMediaUrl(img.getAttribute("data-original") || ""),
          decodeMediaUrl(img.getAttribute("data-lazy-src") || ""),
        ].filter((value) => !!value && !isDecorativeSocialImageUrl(value))
      })
      .filter((url) => /^https?:\/\//i.test(url))
      .filter((url) => isLikelyImageByUrl(url))
      .filter((url) => !/profile_images|avatar|emoji|icon/i.test(url))

    const linkImages = Array.from(doc.querySelectorAll("a"))
      .map((a) => decodeMediaUrl(a.getAttribute("href") || ""))
      .filter((url) => /^https?:\/\//i.test(url))
      .filter((url) => isLikelyImageByUrl(url))

    const videoPosters = Array.from(doc.querySelectorAll("video"))
      .flatMap((video) => [
        decodeMediaUrl(video.getAttribute("poster") || ""),
        decodeMediaUrl(video.getAttribute("data-poster") || ""),
      ])
      .filter((url) => /^https?:\/\//i.test(url))
      .filter((url) => isLikelyImageByUrl(url))

    return Array.from(new Set([...urls, ...linkImages, ...videoPosters]))
  } catch {
    return []
  }
}

function normalizeImageCacheKey(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  try {
    const u = new URL(raw)
    const query = u.search || ""
    u.hash = ""
    return `${u.origin}${u.pathname}${query}`
  } catch {
    return raw.split("#")[0] || raw
  }
}

function isPicnobMirrorHost(host: string): boolean {
  const lower = host.toLowerCase()
  return (
    lower === "media.picnob.info" ||
    lower === "media.pixnoy.com" ||
    lower.includes("piokok.com") ||
    lower.includes("picnob.com") ||
    lower.includes("pixnoy.com") ||
    lower.includes("pixwox.com") ||
    lower.includes("sp1.pixnoy.com") ||
    lower.includes("sp2.pixnoy.com") ||
    lower.includes("sp3.pixnoy.com") ||
    lower.includes("sp4.pixnoy.com") ||
    lower.includes("sp5.pixnoy.com")
  )
}

function decodeUrlEntities(url: string): string {
  let decoded = (!url || !url.includes("&")) ? url : url
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  if (decoded?.startsWith("//")) decoded = `https:${decoded}`
  return decoded
}

function normalizeMediaCompareKey(url: string): string {
  const raw = decodeMediaUrl(url || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (isPicnobMirrorHost(host) && parsed.pathname === "/get") {
      const origin = extractPixnoyOriginUrl(raw)
      if (origin && origin !== raw) return normalizeMediaCompareKey(origin)
      const mirrorReq = normalizePicnobMirrorRequestUrl(raw)
      if (mirrorReq && mirrorReq !== raw) return mirrorReq.toLowerCase()
    }
    const pathname = decodeURIComponent(parsed.pathname).replace(/\/+$/, "")
    const isInstagramLikeHost = /cdninstagram\.com|fbcdn\.net|scontent\.|instagram\.com/i.test(host)
    if (isInstagramLikeHost) {
      // Keep full path + query for Instagram images to distinguish different photos in the same post
      // Instagram carousel photos have different URLs with unique ig_cache_key or _nc_ parameters
      const query = parsed.search || ""
      return `igfull:${pathname.toLowerCase()}${query}`
    }
    return `${parsed.origin.toLowerCase()}${pathname}${parsed.search || ""}`
  } catch {
    return raw.split("#")[0].trim()
  }
}

function extractInstagramAssetId(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (isPicnobMirrorHost(host) && parsed.pathname === "/get") {
      const nested = parsed.searchParams.get("url") || ""
      if (nested) {
        const nestedId = extractInstagramAssetId(nested)
        if (nestedId) return nestedId
      }
    }
    const direct = raw.match(/_(\d{12,})_/)
    if (direct?.[1]) return direct[1]
    const decoded = decodeURIComponent(raw)
    const decodedMatch = decoded.match(/_(\d{12,})_/)
    if (decodedMatch?.[1]) return decodedMatch[1]
  } catch {
    const direct = raw.match(/_(\d{12,})_/)
    if (direct?.[1]) return direct[1]
  }
  return ""
}

function getPhotoDedupeKey(url: string, previewUrl?: string): string {
  return getPhotoDedupeKeys(url, previewUrl)[0] || ""
}

function getPhotoDedupeKeys(url: string, previewUrl?: string): string[] {
  const keys: string[] = []
  const uniq = new Set<string>()
  const push = (key: string) => {
    if (!key || uniq.has(key)) return
    uniq.add(key)
    keys.push(key)
  }

  const normalizedPreview = normalizeMediaCompareKey(previewUrl || "")
  if (normalizedPreview) push(`url:${normalizedPreview}`)
  const normalizedUrl = normalizeMediaCompareKey(url || "")
  if (normalizedUrl) push(`url:${normalizedUrl}`)

  const igCacheKey = extractIgCacheKeyFromUrl(url) || extractIgCacheKeyFromUrl(previewUrl || "")
  if (keys.length === 0 && igCacheKey) push(`igcache:${igCacheKey}`)

  // Fallback only: asset id may be post-scoped (not photo-scoped) on some Instagram mirrors.
  // Using it together with URL keys can incorrectly merge different photos in one carousel.
  if (keys.length === 0) {
    const assetId = extractInstagramAssetId(url) || extractInstagramAssetId(previewUrl || "")
    if (assetId) push(`asset:${assetId}`)
  }

  return keys
}

function buildMediaFallbackCandidates(primaryUrl: string, coverUrl: string, mirrorOriginUrl: string): string[] {
  const proxyFallbacks = getImageProxyFallbackUrls(mirrorOriginUrl || coverUrl || primaryUrl, {
    width: 1280,
    quality: 85,
    format: "jpg",
  })
  const candidates = [primaryUrl, coverUrl, mirrorOriginUrl, ...proxyFallbacks].filter(Boolean)
  const unique: string[] = []
  for (const url of candidates) {
    if (!/^https?:\/\//i.test(url)) continue
    const normalized = normalizeImageCacheKey(url)
    if (!normalized || unique.some((existing) => normalizeImageCacheKey(existing) === normalized)) continue
    unique.push(url)
  }
  return unique
}

function normalizeNitterImageUrl(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    if (!parsed.hostname.toLowerCase().includes("nitter")) return raw
    if (!parsed.pathname.startsWith("/pic/")) return raw
    const encoded = parsed.pathname.slice("/pic/".length)
    const decodedPath = decodeURIComponent(encoded)
    if (!decodedPath) return raw
    return `https://pbs.twimg.com/${decodedPath.replace(/^\/+/, "")}`
  } catch {
    return raw
  }
}

function normalizePicnobImageUrl(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    const isMirrorHost = isPicnobMirrorHost(host)
    if (!isMirrorHost || parsed.pathname !== "/get") return raw

    const fromSearchParams = (parsed.searchParams.get("url") || "").trim()
    const questionIndex = raw.indexOf("?")
    const rawQuery = questionIndex >= 0 ? raw.slice(questionIndex + 1) : ""
    const markerIndex = rawQuery.indexOf("url=")
    const rawSlice = markerIndex >= 0 ? rawQuery.slice(markerIndex + 4).trim() : ""
    let fromRawSlice = rawSlice
    if (fromRawSlice) {
      try {
        fromRawSlice = decodeURIComponent(fromRawSlice)
      } catch {
        // Keep raw when already decoded.
      }
    }

    const candidates = [fromRawSlice, fromSearchParams].filter((candidate) => /^https?:\/\//i.test(candidate))
    if (candidates.length === 0) return raw

    const score = (value: string): number => {
      let s = 0
      const lower = value.toLowerCase()
      if (/cdninstagram|fbcdn\.net|scontent\./i.test(lower)) s += 4
      if (/\.(jpe?g|png|webp|gif|bmp|avif)(\?|$)/i.test(lower)) s += 3
      if (lower.includes("ig_cache_key=")) s += 1
      if (lower.includes("oh=")) s += 2
      if (lower.includes("oe=")) s += 2
      if ((lower.match(/&_nc_/g) || []).length >= 2) s += 2
      if (/cdninstagram|fbcdn\.net|scontent\./i.test(lower) && !lower.includes("oh=")) s -= 3
      if (/cdninstagram|fbcdn\.net|scontent\./i.test(lower) && !lower.includes("oe=")) s -= 3
      if ((value.match(/https?:\/\//gi) || []).length > 1) s -= 6
      return s
    }
    candidates.sort((a, b) => score(b) - score(a))
    return candidates[0] || raw
  } catch {
    return raw
  }
}

function normalizePicnobMirrorRequestUrl(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    const isMirrorHost = isPicnobMirrorHost(host)
    if (!isMirrorHost || parsed.pathname !== "/get") return raw

    const questionIndex = raw.indexOf("?")
    const rawQuery = questionIndex >= 0 ? raw.slice(questionIndex + 1) : ""
    const markerIndex = rawQuery.indexOf("url=")
    const nestedRaw = markerIndex >= 0 ? rawQuery.slice(markerIndex + 4).trim() : ""
    let nested = nestedRaw || (parsed.searchParams.get("url") || "").trim()
    if (!nested) return raw
    try {
      nested = decodeURIComponent(nested)
    } catch {
      // Keep raw when already decoded.
    }
    if (!/^https?:\/\//i.test(nested)) return raw
    return `${parsed.origin}/get?url=${encodeURIComponent(nested)}`
  } catch {
    return raw
  }
}

function normalizePixnoyPtImageUrl(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (!/pixnoy|picnob/i.test(host)) return raw
    if (!/\/p\/pt_/i.test(parsed.pathname)) return raw

    const encoded = parsed.searchParams.get("o") || ""
    if (!encoded) return raw
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
    const decoded = atob(padded)
    const match = decoded.match(/https?:\/\/[^\s"'<>]+/i)
    if (match?.[0]) return match[0]
    return /^https?:\/\//i.test(decoded) ? decoded : raw
  } catch {
    return raw
  }
}

function normalizeBilibiliVideoUrl(rawUrl: string): string {
  const bvidMatch = rawUrl.match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)
  if (bvidMatch?.[1]) return `https://www.bilibili.com/video/${bvidMatch[1]}`

  const aidMatch = rawUrl.match(/(?:\/video\/av|[?&]aid=)(\d+)/i)
  if (aidMatch?.[1]) return `https://www.bilibili.com/video/av${aidMatch[1]}`

  return rawUrl
}

function extractIgCacheKeyFromUrl(rawUrl: string): string {
  const raw = decodeMediaUrl(String(rawUrl || "").trim())
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const direct = parsed.searchParams.get("ig_cache_key") || ""
    if (direct) return direct
    const nested = parsed.searchParams.get("url") || ""
    if (nested) {
      const nestedParsed = new URL(decodeMediaUrl(nested))
      return nestedParsed.searchParams.get("ig_cache_key") || ""
    }
  } catch {
    // ignore
  }
  const m = raw.match(/[?&]ig_cache_key=([^&#]+)/i)
  return m?.[1] ? decodeURIComponent(m[1]) : ""
}

function buildBilibiliInAppPlayerUrl(rawUrl: string): string {
  const bvidMatch = rawUrl.match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)
  if (bvidMatch?.[1]) {
    return `https://www.bilibili.com/blackboard/newplayer.html?${new URLSearchParams({
      isOutside: "true",
      autoplay: "true",
      danmaku: "true",
      muted: "false",
      highQuality: "true",
      bvid: bvidMatch[1],
    }).toString()}`
  }

  const aidMatch = rawUrl.match(/(?:\/video\/av|[?&]aid=)(\d+)/i)
  if (aidMatch?.[1]) {
    return `https://www.bilibili.com/blackboard/newplayer.html?${new URLSearchParams({
      isOutside: "true",
      autoplay: "true",
      danmaku: "true",
      muted: "false",
      highQuality: "true",
      aid: aidMatch[1],
    }).toString()}`
  }

  return normalizeBilibiliVideoUrl(rawUrl)
}

function cleanSocialTextHtml(html: string): string {
  if (!html) return ""
  let safe = sanitizeHTML(html)
  try {
    const doc = new DOMParser().parseFromString(`<div id="root">${safe}</div>`, "text/html")
    const root = doc.getElementById("root")
    if (!root) return safe

    root.querySelectorAll("img,video,iframe,audio,picture,source,svg,canvas").forEach((el) => el.remove())

    const prune = (el: Element) => {
      Array.from(el.children).forEach((child) => prune(child))
      if (!(el instanceof HTMLElement)) return
      el.removeAttribute("style")
      el.removeAttribute("width")
      el.removeAttribute("height")
      const meaningfulChildren = Array.from(el.children).filter(
        (child) => !["BR", "WBR"].includes(child.tagName),
      )
      const text = (el.textContent || "").replace(/[\u00a0\u200b\u200c\u200d\ufeff]/g, " ").trim()
      if (!text && meaningfulChildren.length === 0) {
        el.remove()
      }
    }
    Array.from(root.children).forEach((child) => prune(child))
    safe = root.innerHTML
  } catch {
    // Fallback below.
  }
  return safe
    .replace(/&lt;\s*(img|video|iframe|audio|picture|source)\b[\s\S]*?(?:&gt;|$)/gi, "")
    .replace(/<\s*(img|video|iframe|audio|picture|source)\b[^>]*(?:>|$)/gi, "")
    .replace(/<(img|video|iframe|audio|picture|source)\b[^>]*\/?>/gi, "")
    .replace(/<\/(video|iframe|audio|picture)>/gi, "")
    .replace(/<(p|div|span|section|article|li|blockquote)[^>]*>(?:\s|&nbsp;|&#160;|&#8203;|&#xfeff;|<br\s*\/?>)*<\/\1>/gi, "")
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .trim()
}

function cleanSocialPlainText(value: string): string {
  if (!value) return ""
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<\s*(img|video|iframe|audio|picture|source)\b[^>]*(?:>|$)/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/<[^>\n]*$/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractPixnoyOriginUrl(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    if (/^media\.(picnob|pixnoy)\./i.test(parsed.hostname) && parsed.pathname === "/get") {
      const questionIndex = raw.indexOf("?")
      const rawQuery = questionIndex >= 0 ? raw.slice(questionIndex + 1) : ""
      const markerIndex = rawQuery.indexOf("url=")
      const nestedRaw = markerIndex >= 0 ? rawQuery.slice(markerIndex + 4).trim() : ""
      let decodedRaw = nestedRaw
      if (decodedRaw) {
        try {
          decodedRaw = decodeURIComponent(decodedRaw)
        } catch {}
      }
      const fromSearchParams = (parsed.searchParams.get("url") || "").trim()
      const candidates = [decodedRaw, nestedRaw, fromSearchParams].filter((candidate) => /^https?:\/\//i.test(candidate))
      if (candidates.length === 0) return ""
      candidates.sort((a, b) => {
        const score = (value: string) => {
          const lower = value.toLowerCase()
          let s = 0
          if (/cdninstagram|fbcdn\.net|scontent\./i.test(lower)) s += 4
          if (lower.includes("oh=")) s += 2
          if (lower.includes("oe=")) s += 2
          if ((lower.match(/&_nc_/g) || []).length >= 2) s += 2
          if (/cdninstagram|fbcdn\.net|scontent\./i.test(lower) && !lower.includes("oh=")) s -= 3
          if (/cdninstagram|fbcdn\.net|scontent\./i.test(lower) && !lower.includes("oe=")) s -= 3
          if ((value.match(/https?:\/\//gi) || []).length > 1) s -= 6
          return s
        }
        return score(b) - score(a)
      })
      return candidates[0] || ""
    }
    if (!/pixnoy|pixnob/i.test(parsed.hostname)) return ""
    const encoded = parsed.searchParams.get("o")
    if (!encoded) return ""
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
    const decoded = atob(padded)
    return /^https?:\/\//i.test(decoded) ? decoded : ""
  } catch {
    return ""
  }
}

function withCacheBust(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    parsed.searchParams.set("_fr_retry", String(Date.now()))
    return parsed.toString()
  } catch {
    const sep = raw.includes("?") ? "&" : "?"
    return `${raw}${sep}_fr_retry=${Date.now()}`
  }
}

function buildOverlayPhotoFallbackCandidates(primaryUrl: string, coverUrl: string, mirrorOriginUrl: string): string[] {
  const proxyFallbacks = getImageProxyFallbackUrls(mirrorOriginUrl || coverUrl || primaryUrl, {
    width: 1600,
    quality: 85,
    format: "jpg",
  })
  const candidates = [primaryUrl, coverUrl, mirrorOriginUrl, ...proxyFallbacks].filter(Boolean)
  // For Instagram CDN URLs without a working mirror origin, reconstruct a mirror
  // proxy URL so expired signed CDN URLs can still be served via the mirror cache.
  const seedForMirror = mirrorOriginUrl || coverUrl || primaryUrl
  if (seedForMirror && /cdninstagram\.com|fbcdn\.net|scontent\./i.test(seedForMirror)) {
    const mirrorProxy = `https://media.pixnoy.com/get?url=${encodeURIComponent(seedForMirror)}`
    candidates.push(mirrorProxy)
  }
  const unique: string[] = []
  for (const url of candidates) {
    if (!/^https?:\/\//i.test(url)) continue
    const normalized = normalizeImageCacheKey(url)
    if (!normalized || unique.some((existing) => normalizeImageCacheKey(existing) === normalized)) continue
    unique.push(url)
  }
  return unique
}

function advanceOverlayPhotoFallback(
  e: SyntheticEvent<HTMLImageElement>,
  seedUrl: string,
  onExhausted?: (img: HTMLImageElement) => void,
  previewUrl?: string,
): void {
  const img = e.currentTarget
  const normalizedSeed = decodeMediaUrl(seedUrl || "")
  const originFromMirror = extractPixnoyOriginUrl(seedUrl) || extractPixnoyOriginUrl(normalizedSeed)
  const candidates = buildOverlayPhotoFallbackCandidates(
    img.currentSrc || img.src || normalizedSeed,
    normalizedSeed || seedUrl,
    originFromMirror,
  )
  // Keep the raw (non-normalized) mirror/proxy URL as a fallback.
  // normalizePicnobImageUrl() unwraps mirror proxy URLs (picnob/pixnoy) to direct
  // CDN URLs, but the mirror can still serve images when signed CDN URLs have expired.
  const rawDecoded = decodeUrlEntities(seedUrl || "")
  if (rawDecoded && rawDecoded !== normalizedSeed && /^https?:\/\//i.test(rawDecoded)) {
    const rawKey = normalizeImageCacheKey(rawDecoded)
    if (rawKey && !candidates.some((c) => normalizeImageCacheKey(c) === rawKey)) {
      candidates.splice(1, 0, rawDecoded)
    }
  }
  // Also try previewUrl (may hold the original mirror proxy URL preserved during feed parsing).
  if (previewUrl) {
    const decodedPreview = decodeMediaUrl(previewUrl)
    for (const pUrl of [previewUrl, decodedPreview]) {
      if (pUrl && /^https?:\/\//i.test(pUrl)) {
        const pKey = normalizeImageCacheKey(pUrl)
        if (pKey && !candidates.some((c) => normalizeImageCacheKey(c) === pKey)) {
          candidates.splice(1, 0, pUrl)
          const mirrorProxyFallbacks = getImageProxyFallbackUrls(pUrl, { width: 1600, quality: 85, format: "jpg" })
          for (const mpUrl of mirrorProxyFallbacks) {
            const mpKey = normalizeImageCacheKey(mpUrl)
            if (mpKey && !candidates.some((c) => normalizeImageCacheKey(c) === mpKey)) {
              candidates.push(mpUrl)
            }
          }
        }
      }
    }
  }
  const currentKey = normalizeImageCacheKey(img.currentSrc || img.src || "")
  const currentIdx = candidates.findIndex((candidate) => normalizeImageCacheKey(candidate) === currentKey)
  const nextIdx = currentIdx >= 0 ? currentIdx + 1 : 1
  if (nextIdx < candidates.length) {
    img.dataset.fallbackIndex = String(nextIdx)
    img.src = withCacheBust(candidates[nextIdx])
    return
  }
  onExhausted?.(img)
}

function getInstagramAvatarUrl(siteUrl?: string, feedUrl?: string): string | null {
  const candidates = [siteUrl, feedUrl].filter(Boolean) as string[]
  for (const url of candidates) {
    try {
      const parsed = new URL(url)
      const host = parsed.hostname.toLowerCase()
      if (host === "instagram.com" || host === "www.instagram.com") {
        const username = parsed.pathname.split("/").filter(Boolean)[0]
        if (username && /^[a-zA-Z0-9._]+$/.test(username)) {
          return `https://unavatar.io/instagram/${username}?fallback=false`
        }
      }
    } catch {}
    const rsshub = url.match(/\/instagram\/user\/([^/?#]+)/i)
    if (rsshub?.[1]) return `https://unavatar.io/instagram/${decodeURIComponent(rsshub[1])}?fallback=false`
    const picnob = url.match(/\/picnob(?:\.info)?\/user\/([^/?#]+)/i)
    if (picnob?.[1]) return `https://unavatar.io/instagram/${decodeURIComponent(picnob[1])}?fallback=false`
  }
  return null
}

function isGenericInstagramIconUrl(url: string): boolean {
  const raw = (url || "").trim()
  const src = raw.toLowerCase()
  if (!src) return false
  if (isDecorativeSocialImageUrl(raw)) return true
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    const path = u.pathname.toLowerCase()
    const isInstaAssetHost = host.includes("instagram.com") && !host.includes("cdninstagram") && !host.includes("scontent")
    if (isInstaAssetHost) return true
    if (host.includes("picnob") || host.includes("pixnoy") || host.includes("piokok") || host.includes("pixwox")) {
      if (path.includes("favicon") || path.endsWith(".ico") || path.includes("logo")) return true
    }
  } catch {}
  return (
    src.includes("instagram.com/static/images/ico") ||
    src.includes("instagram_static/images/ico") ||
    src.includes("instagram_logo") ||
    src.includes("instagram-logo") ||
    src.includes("/apple-touch-icon") ||
    src.includes("favicon")
  )
}

function normalizeInstagramUnavatar(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  if (!/unavatar\.io\/instagram\//i.test(raw)) return raw
  try {
    const u = new URL(raw)
    u.searchParams.set("fallback", "false")
    return u.toString()
  } catch {
    return raw.includes("?") ? `${raw}&fallback=false` : `${raw}?fallback=false`
  }
}

function resolveBilibiliVideoPageUrl(entry: Entry): string | null {
  const urls = [entry.url || "", ...(entry.media || []).filter((m) => m.type === "video").map((m) => m.url)]

  for (const url of urls) {
    if (!url) continue
    const bvidMatch = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i)
    if (bvidMatch?.[1]) return `https://www.bilibili.com/video/${bvidMatch[1]}`

    const avMatch = url.match(/bilibili\.com\/video\/(av\d+)/i)
    if (avMatch?.[1]) return `https://www.bilibili.com/video/${avMatch[1]}`

    if (/(?:^|\.)(?:bilibili\.com|b23\.tv)\//i.test(url)) {
      return normalizeBilibiliVideoUrl(url)
    }
  }

  return null
}

function resolveEntryBrowserOpenUrl(entry: Entry): string {
  const instagramIdToShortcode = (instagramId: string): string => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    if (!/^\d+$/.test(instagramId)) return ""
    let n = BigInt(instagramId)
    if (n === 0n) return alphabet[0]
    let shortcode = ""
    while (n > 0n) {
      const idx = Number(n % 64n)
      shortcode = alphabet[idx] + shortcode
      n = n / 64n
    }
    return shortcode
  }

  const buildInstagramPostUrlFromMedia = (): string => {
    const contentText = `${entry.content || ""}\n${entry.summary || ""}`
    const contentCandidates = Array.from(new Set(
      (contentText.match(/https?:\/\/[^\s"'<>]+/g) || []).map((u) => decodeMediaUrl(u)),
    ))
    const mediaCandidates = [
      ...(entry.media || []).flatMap((m) => [m.url || "", m.previewUrl || ""]),
      entry.imageUrl || "",
      ...contentCandidates,
    ]
    for (const candidate of mediaCandidates) {
      const decodedCandidate = decodeMediaUrl(candidate || "")
      const igCacheKeyRaw = extractIgCacheKeyFromUrl(decodedCandidate)
      const base64Part = decodeURIComponent(igCacheKeyRaw).split(".")[0] || ""
      if (!base64Part) continue
      try {
        const instagramId = atob(base64Part)
        const shortcode = instagramIdToShortcode(instagramId)
        if (shortcode) return `https://www.instagram.com/p/${shortcode}/`
      } catch {
        // ignore invalid base64
      }
    }
    return ""
  }

  const extractSocialPostUrl = (text: string): string => {
    const raw = String(text || "")
    const patterns = [
      /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/\s?#]+\/status\/\d+[^\s"'<>)]*/i,
      /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+[^\s"'<>)]*/i,
      /https?:\/\/(?:www\.)?(?:picnob\.com|picnob\.info|pixnoy\.com|pixwox\.com)\/post\/[a-zA-Z0-9_-]+[^\s"'<>)]*/i,
      /https?:\/\/(?:www\.)?threads\.net\/@[^/\s?#]+\/post\/[a-zA-Z0-9_-]+[^\s"'<>)]*/i,
    ]
    for (const pattern of patterns) {
      const m = raw.match(pattern)
      if (m?.[0]) return canonicalizeSocialUrl(m[0])
    }
    return ""
  }

  const direct = (entry.url || "").trim()
  if (/^https?:\/\//i.test(direct)) return canonicalizeSocialUrl(direct)
  const postUrlFromContent = extractSocialPostUrl(`${entry.content || ""}\n${entry.summary || ""}`)
  if (postUrlFromContent) return postUrlFromContent
  const contentUrl = extractFirstNonMediaUrl(`${entry.content || ""}\n${entry.summary || ""}`)
  if (contentUrl) return canonicalizeSocialUrl(contentUrl)
  const anyUrl = extractFirstHttpUrl(`${entry.content || ""}\n${entry.summary || ""}`)
  if (anyUrl && !isLikelyImageByUrl(anyUrl)) return canonicalizeSocialUrl(anyUrl)
  const igPostUrl = buildInstagramPostUrlFromMedia()
  if (igPostUrl) return canonicalizeSocialUrl(igPostUrl)
  return ""
}
import { SocialMediaItem, GridCard, ViewRecommendations } from "./EntryList"

export function WideViewContent() {
  const {
    entries,
    isLoading,
    isLoadingMore,
    hasMoreEntries,
    loadEntries,
    loadMoreEntries,
    selectEntry,
    markAllRead,
    markAboveRead,
    markBelowRead,
    searchQuery,
    setSearchQuery,
    search,
  } =
    useEntryStore()
  const { selectedFeedId, feeds, activeView, refreshFeed, refreshMultiple, refreshAll, isRefreshing, refreshProgress } = useFeedStore()
  const { settings } = useSettingsStore()
  const { t } = useTranslation()
  const [filterMode, setFilterMode] = useState<"all" | "unread">("all")
  const baseEntryLoadLimit = useMemo(() => getEntryLoadLimit(activeView), [activeView])
  const [entryLoadLimit, setEntryLoadLimit] = useState(baseEntryLoadLimit)

  // Video modal state
  const [videoEntry, setVideoEntry] = useState<Entry | null>(null)
  const [inlineBilibili, setInlineBilibili] = useState<{ entry: Entry; url: string } | null>(null)

  // Social media overlay state.
  const [socialEntry, setSocialEntry] = useState<Entry | null>(null)

  // Video pagination state
  const [videoPage, setVideoPage] = useState(0)
  const [adaptiveVideosPerPage, setAdaptiveVideosPerPage] = useState<number | null>(null)
  const videoGridRef = useRef<HTMLDivElement>(null)
  const [socialRenderLimit, setSocialRenderLimit] = useState(SOCIAL_INITIAL_RENDER_COUNT)

  // Context menu state
  const { menuState, showMenu, hideMenu } = useEntryContextMenu()
  // Share poster state
  const [posterEntry, setPosterEntry] = useState<Entry | null>(null)

  const viewDef = activeView !== null ? VIEW_DEFINITIONS[activeView] : null
  const feedById = useMemo(() => new Map(feeds.map((f) => [f.id, f] as const)), [feeds])

  // Compute feed IDs for the active view (excluding recommended feeds)
  const viewFeedIds = useMemo(
    () => activeView !== null
      ? feeds
          .filter((f) =>
            (f.view ?? FeedViewType.Articles) === activeView
            && f.category !== RECOMMENDED_CATEGORY
            && f.showInAll !== false
          )
          .map((f) => f.id)
      : undefined,
    [feeds, activeView]
  )

  // Loading entries when feed selection changes
  useEffect(() => {
    if (selectedFeedId === "starred") {
      loadEntries({ starred: true, limit: entryLoadLimit })
    } else if (selectedFeedId) {
      loadEntries({ feedId: selectedFeedId, unreadOnly: filterMode === "unread", limit: entryLoadLimit })
    } else if (viewFeedIds && viewFeedIds.length > 0) {
      loadEntries({ feedIds: viewFeedIds, unreadOnly: filterMode === "unread", limit: entryLoadLimit })
    } else {
      loadEntries({ unreadOnly: filterMode === "unread", limit: entryLoadLimit })
    }
    setVideoPage(0) // Reset pagination on data change
  }, [selectedFeedId, filterMode, loadEntries, viewFeedIds, entryLoadLimit])

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      search(searchQuery)
    },
    [search, searchQuery],
  )

  const currentFeed = selectedFeedId ? feedById.get(selectedFeedId) : undefined
  const title = selectedFeedId === "starred"
    ? t("entryList.starred")
    : currentFeed?.title || (viewDef ? t(VIEW_TYPE_I18N_KEYS[activeView!] || "common.all") : t("common.all"))

  const reloadCurrentList = useCallback(() => {
    if (selectedFeedId === "starred") {
      loadEntries({ starred: true, limit: entryLoadLimit })
    } else if (selectedFeedId) {
      loadEntries({ feedId: selectedFeedId, unreadOnly: filterMode === "unread", limit: entryLoadLimit })
    } else if (viewFeedIds && viewFeedIds.length > 0) {
      loadEntries({ feedIds: viewFeedIds, unreadOnly: filterMode === "unread", limit: entryLoadLimit })
    } else {
      loadEntries({ unreadOnly: filterMode === "unread", limit: entryLoadLimit })
    }
  }, [entryLoadLimit, filterMode, loadEntries, selectedFeedId, viewFeedIds])

  // Build a set of recommended feed IDs so we can exclude their entries
  const recommendedFeedIds = useMemo(
    () => new Set(feeds.filter((f) => f.category === RECOMMENDED_CATEGORY).map((f) => f.id)),
    [feeds],
  )
  const receiveRecommended = settings.general.showRecommended

  // Filter entries by active view (when showing all feeds) 锟?exclude recommended feeds
  const baseFilteredEntries = useMemo(() => {
    const filtered = selectedFeedId
      ? selectedFeedId === "starred"
        ? entries
        : entries.filter((entry) => entry.feedId === selectedFeedId)
      : activeView !== null
        ? entries.filter((entry) => {
            const feed = feedById.get(entry.feedId)
            if (!feed) return false
            if (feed.showInAll === false) return false
            if (!receiveRecommended && recommendedFeedIds.has(entry.feedId)) return false
            return (feed.view ?? FeedViewType.Articles) === activeView
          })
        : entries.filter((entry) => {
            const feed = feedById.get(entry.feedId)
            if (!feed) return false
            if (feed.showInAll === false) return false
            if (!receiveRecommended && recommendedFeedIds.has(entry.feedId)) return false
            return true
          })

    let finalFiltered = filtered
    if (!selectedFeedId && activeView === null && entries.length > 0 && filtered.length === 0) {
      finalFiltered = entries.filter((entry) => {
        const feed = feedById.get(entry.feedId)
        if (!feed) return false
        if (feed.showInAll === false) return false
        if (!receiveRecommended && recommendedFeedIds.has(entry.feedId)) return false
        return true
      })
    }
    return finalFiltered
  }, [activeView, entries, feedById, receiveRecommended, recommendedFeedIds, selectedFeedId])
  // Picture feed entries must bypass social dedupe. Merging near-duplicate entries in this view
  // can incorrectly concatenate media from different posts.
  const shouldDedupeSocialEntries = activeView === FeedViewType.SocialMedia
  const { entries: viewFilteredEntries, isProcessing: isSocialDedupeProcessing } = useAsyncSocialDedupe(
    baseFilteredEntries,
    {
      enabled: shouldDedupeSocialEntries,
      cacheKey: `${activeView ?? "all"}:${selectedFeedId ?? "all"}`,
    },
  )
  const hasStaleEntriesWhileLoading =
    (isLoading || isSocialDedupeProcessing) && viewFilteredEntries.length === 0 && entries.length > 0
  const baseRenderEntries = hasStaleEntriesWhileLoading ? entries : viewFilteredEntries
  const renderEntries = baseRenderEntries
  const shouldShowLoadingSkeleton =
    isLoading
    && renderEntries.length === 0
  const timelineEntries = renderEntries
  const timelineIndexById = useMemo(
    () => new Map(timelineEntries.map((entry, index) => [entry.id, index] as const)),
    [timelineEntries],
  )
  const isPicturesAllView = activeView === FeedViewType.Pictures && !selectedFeedId
  const isTimelineView = activeView === FeedViewType.SocialMedia || (activeView === FeedViewType.Pictures && !!selectedFeedId)

  // Pre-compute masonry card data to avoid per-render extraction
  const masonryCards = useMemo<MasonryCardData[]>(() => {
    if (!isPicturesAllView) return []
    const result: MasonryCardData[] = []
    for (const entry of renderEntries) {
      let firstImage = ""
      let photoCount = 0
      for (const m of entry.media || []) {
        if (m.type !== "photo") continue
        const url = decodeMediaUrl(m.previewUrl || m.url || "")
        if (!url || !isLikelyImageByUrl(url) || isDecorativeSocialImageUrl(url)) continue
        if (hasTinyDecorativeDimensions(m.width, m.height)) continue
        photoCount++
        if (!firstImage) firstImage = url
      }
      if (!firstImage) {
        const fallback = decodeMediaUrl(entry.imageUrl || "")
        if (fallback && isLikelyImageByUrl(fallback) && !isDecorativeSocialImageUrl(fallback)) firstImage = fallback
      }
      if (!firstImage) continue
      result.push({ id: entry.id, feedId: entry.feedId, firstImage, photoCount, publishedAt: entry.publishedAt || 0 })
    }
    return result
  }, [isPicturesAllView, renderEntries])

  // Progressive masonry rendering
  const [masonryRenderLimit, setMasonryRenderLimit] = useState(MASONRY_INITIAL_RENDER)
  useEffect(() => {
    if (!isPicturesAllView) return
    setMasonryRenderLimit(MASONRY_INITIAL_RENDER)
  }, [isPicturesAllView, selectedFeedId, activeView])
  const visibleMasonryCards = useMemo(
    () => isPicturesAllView ? masonryCards.slice(0, masonryRenderLimit) : [],
    [isPicturesAllView, masonryCards, masonryRenderLimit],
  )

  const dateLocale = useMemo(() => getDateLocale(), [settings.general.language])
  const shouldUseVirtualTimeline = isTimelineView && !settings.general.groupByDate
  const renderedTimelineEntries = useMemo(() => {
    if (!isTimelineView || shouldUseVirtualTimeline) return timelineEntries
    return timelineEntries.slice(0, socialRenderLimit)
  }, [isTimelineView, shouldUseVirtualTimeline, socialRenderLimit, timelineEntries])
  const groupedRenderedTimelineEntries = useMemo(
    () => settings.general.groupByDate ? groupEntriesByDate(renderedTimelineEntries) : [],
    [settings.general.groupByDate, renderedTimelineEntries],
  )
  useEffect(() => {
    setEntryLoadLimit(baseEntryLoadLimit)
  }, [baseEntryLoadLimit, activeView, selectedFeedId, filterMode])

  useEffect(() => {
    if (!isTimelineView || shouldUseVirtualTimeline) return
    setSocialRenderLimit(SOCIAL_INITIAL_RENDER_COUNT)
  }, [isTimelineView, shouldUseVirtualTimeline, selectedFeedId, activeView])

  const handleTimelineScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    if (!isTimelineView || shouldUseVirtualTimeline) return
    if (socialRenderLimit >= timelineEntries.length) return
    const el = e.currentTarget
    const hasScrolledEnough = el.scrollTop > 120
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 800
    if (!nearBottom || !hasScrolledEnough) return
    setSocialRenderLimit((prev) => Math.min(prev + SOCIAL_RENDER_BATCH, timelineEntries.length))
  }, [isTimelineView, shouldUseVirtualTimeline, socialRenderLimit, timelineEntries.length])

  const handleMasonryScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    if (!isPicturesAllView) return
    if (masonryRenderLimit >= masonryCards.length) return
    const el = e.currentTarget
    const hasScrolledEnough = el.scrollTop > 120
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 900
    if (!nearBottom || !hasScrolledEnough) return
    setMasonryRenderLimit((prev) => Math.min(prev + MASONRY_RENDER_BATCH, masonryCards.length))
  }, [isPicturesAllView, masonryCards.length, masonryRenderLimit])

  const handlePagedEntryScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const hasScrolledEnough = el.scrollTop > 120
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 700
    if (!nearBottom || !hasScrolledEnough) return
    if (searchQuery.trim()) return
    if (!hasMoreEntries || isLoadingMore) return
    void loadMoreEntries()
  }, [hasMoreEntries, isLoadingMore, loadMoreEntries, searchQuery])

  // Measure container width for masonry / grid.
  // Keep updates synchronous with ResizeObserver to avoid one-frame stale widths on window resize.
  const containerRef = useRef<HTMLDivElement>(null)
  const lastScrollScopeRef = useRef<string>("")
  const viewKey = `${activeView ?? "all"}:${selectedFeedId ?? ""}`
  const [containerWidth, setContainerWidth] = useState(() => rememberedContainerWidthByView.get(viewKey) ?? 0)
  const timelineVirtualizer = useVirtualizer({
    count: shouldUseVirtualTimeline ? timelineEntries.length : 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 560,
    overscan: 2,
    getItemKey: (index) => timelineEntries[index]?.id ?? index,
  })
  const virtualTimelineItems = timelineVirtualizer.getVirtualItems()

  useEffect(() => {
    const nextScope = `${activeView ?? "all"}:${selectedFeedId ?? "all"}`
    if (lastScrollScopeRef.current === nextScope) return
    lastScrollScopeRef.current = nextScope
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: 0, behavior: "auto" })
  }, [activeView, selectedFeedId])

  useLayoutEffect(() => {
    if (activeView !== FeedViewType.Videos && !isPicturesAllView) return
    const el = containerRef.current
    if (!el) return

    const updateWidth = () => {
      const newWidth = Math.round(el.getBoundingClientRect().width)
      rememberedContainerWidthByView.set(viewKey, newWidth)
      setContainerWidth((prev) => (prev === newWidth ? prev : newWidth))
    }

    // Initial measurement
    updateWidth()

    // Use ResizeObserver for container resize
    const ro = new ResizeObserver(updateWidth)
    ro.observe(el)

    // Also listen to window resize for maximize/restore
    window.addEventListener("resize", updateWidth)

    return () => {
      ro.disconnect()
      window.removeEventListener("resize", updateWidth)
    }
  }, [activeView, isPicturesAllView, viewKey])

  // On view/feed switch, sync width immediately to prevent "first render oversized
  // then shrink" flash when entering Pictures view.
  useLayoutEffect(() => {
    const cached = rememberedContainerWidthByView.get(viewKey)
    if (cached) {
      setContainerWidth((prev) => (prev === cached ? prev : cached))
    }
  }, [viewKey])

  useLayoutEffect(() => {
    if (activeView !== FeedViewType.Videos && !isPicturesAllView) return
    const el = containerRef.current
    if (el) {
      const newWidth = Math.round(el.getBoundingClientRect().width)
      rememberedContainerWidthByView.set(viewKey, newWidth)
      setContainerWidth((prev) => (prev === newWidth ? prev : newWidth))
    }
  }, [viewKey, activeView, isPicturesAllView])

  const videoColumnCount = useMemo(() => getVideoColumnCount(containerWidth), [containerWidth])
  const masonryColumnCount = useMemo(() => getMasonryColumnCount(containerWidth), [containerWidth])

  useLayoutEffect(() => {
    if (activeView !== FeedViewType.Videos || inlineBilibili || !settings.general.videoPagination) {
      setAdaptiveVideosPerPage(null)
      return
    }

    const containerEl = containerRef.current
    if (!containerEl) return

    const measure = () => {
      const horizontalPadding = 48 // p-6
      const verticalPadding = 48 // p-6
      const paginationReserve = 64
      const gridGap = 16
      const availableWidth = Math.max(0, containerEl.clientWidth - horizontalPadding)
      const columnCount = Math.max(1, videoColumnCount)
      const estimatedCardWidth = Math.max(120, (availableWidth - gridGap * (columnCount - 1)) / columnCount)
      const estimatedCardHeight = estimatedCardWidth * 0.75 + 64
      const firstCard = videoGridRef.current?.querySelector("button")
      const measuredCardHeight = firstCard?.getBoundingClientRect().height || estimatedCardHeight
      const availableHeight = Math.max(0, containerEl.clientHeight - verticalPadding - paginationReserve)
      // Use ceil so the page tends to fill the viewport instead of leaving a large blank area.
      const rows = Math.max(1, Math.ceil(availableHeight / Math.max(1, measuredCardHeight + gridGap)))
      const nextPerPage = Math.max(columnCount, rows * columnCount)
      setAdaptiveVideosPerPage((prev) => prev === nextPerPage ? prev : nextPerPage)
    }

    const frame = window.requestAnimationFrame(measure)
    return () => window.cancelAnimationFrame(frame)
  }, [activeView, inlineBilibili, settings.general.videoPagination, videoColumnCount, containerWidth, renderEntries.length])

  // Click handler: for Bilibili (open-in-page ON), play inline in current page; otherwise open modal
  const handleVideoClick = useCallback(
    (entry: Entry) => {
      selectEntry(entry) // marks read
      const shouldInlineBilibili = settings.general.bilibiliOpenInPage
      const bilibiliUrl = shouldInlineBilibili ? resolveBilibiliVideoPageUrl(entry) : null
      if (bilibiliUrl) {
        setVideoEntry(null)
        setInlineBilibili({ entry, url: bilibiliUrl })
        return
      }
      setInlineBilibili(null)
      setVideoEntry(entry)
    },
    [selectEntry, settings.general.bilibiliOpenInPage],
  )

  // Click handler: single-click opens the social overlay, double-click opens the browser.
  const handleSocialClick = useCallback(
    (entry: Entry) => {
      selectEntry(entry) // marks read
      setSocialEntry(entry)
    },
    [selectEntry],
  )

  const handleSocialDoubleClick = useCallback(
    (entry: Entry) => {
      if (!entry.url) return
      const target = canonicalizeSocialUrl(entry.url)
      if (!target) return
      if (window.api?.app?.openExternal) {
        void window.api.app.openExternal(target)
      } else {
        window.open(target, "_blank")
      }
    },
    [],
  )

  const handleSocialBilibiliOpenInPage = useCallback((entry: Entry, url: string) => {
    selectEntry(entry)
    setVideoEntry(null)
    setSocialEntry(null)
    setInlineBilibili({ entry, url })
  }, [selectEntry])

  // Close social overlay on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (videoEntry) setVideoEntry(null)
        else if (inlineBilibili) setInlineBilibili(null)
        else if (socialEntry) setSocialEntry(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [videoEntry, inlineBilibili, socialEntry])

  useEffect(() => {
    const canStayInline = activeView === FeedViewType.Videos || activeView === FeedViewType.SocialMedia
    if (!canStayInline || !settings.general.bilibiliOpenInPage) {
      setInlineBilibili(null)
    }
  }, [activeView, settings.general.bilibiliOpenInPage])

  useEffect(() => {
    // Switching subscription/feed should always exit full-page inline player.
    setInlineBilibili(null)
  }, [selectedFeedId])

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-white dark:bg-surface-dark">
      {/* Header bar: social media view uses a minimal header without search/filter */}
      <div className={`flex-shrink-0 px-6 pt-3 pb-2 border-b ${activeView === FeedViewType.SocialMedia || activeView === FeedViewType.Pictures ? "" : "space-y-2.5"}`}>
        <div className="flex items-center justify-between">
          {inlineBilibili ? (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                className="inline-flex items-center gap-1.5 text-base font-semibold px-3 py-1.5 rounded-md border border-surface-tertiary dark:border-surface-dark-tertiary bg-surface-secondary/70 dark:bg-surface-dark-secondary/70 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                onClick={() => setInlineBilibili(null)}
                title={t("common.back")}
              >
                <ChevronLeft size={16} />
                杩斿洖
              </button>
            </div>
          ) : (
            <h2 className="text-lg font-bold truncate flex items-center gap-2 leading-tight">
              {viewDef && <span className={viewDef.color}>{title}</span>}
              {!viewDef && title}
            </h2>
          )}
          {!inlineBilibili && (
            <div className="flex items-center gap-2 text-text-secondary dark:text-text-dark-secondary">
            {/* Refresh */}
            <button
              onClick={async () => {
                if (selectedFeedId && selectedFeedId !== "starred") {
                  await refreshFeed(selectedFeedId)
                  loadEntries({ feedId: selectedFeedId, limit: entryLoadLimit })
                } else if (activeView !== null) {
                  const viewFeedIds = feeds
                    .filter((f) => (f.view ?? FeedViewType.Articles) === activeView)
                    .map((f) => f.id)
                  await refreshMultiple(viewFeedIds)
                  loadEntries({ limit: entryLoadLimit })
                } else {
                  await refreshAll()
                  loadEntries({ limit: entryLoadLimit })
                }
              }}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary disabled:opacity-50"
              title={t("common.refresh")}
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
            {/* Unread toggle */}
            <button
              onClick={() => setFilterMode(filterMode === "unread" ? "all" : "unread")}
              className={`p-1.5 rounded-lg transition-colors ${
                filterMode === "unread"
                  ? "text-accent bg-accent/10"
                  : "hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              }`}
              title={filterMode === "unread" ? t("common.all") : t("entryList.unread")}
            >
              {filterMode === "unread" ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            {/* Mark all read */}
            <button
              onClick={() => markAllRead(selectedFeedId || undefined)}
              className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              title={t("common.markAllRead")}
            >
              <CheckCheck size={16} />
            </button>
            </div>
          )}
        </div>

        {/* Search and filter are shown only for non-social views */}
        {activeView !== FeedViewType.SocialMedia && activeView !== FeedViewType.Pictures && !inlineBilibili && (
          <div className="flex items-center gap-3 mt-2">
            {/* Search */}
            <form onSubmit={handleSearch} className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value
                  setSearchQuery(value)
                  if (!value.trim()) {
                    reloadCurrentList()
                  }
                }}
                placeholder={t("entryList.searchArticles")}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-secondary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </form>

            {/* Filter tabs */}
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setFilterMode("all")}
                className={`px-3 py-1 rounded-full transition-colors ${
                  filterMode === "all"
                    ? "bg-accent text-white"
                    : "bg-surface-secondary dark:bg-surface-dark-secondary hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
                }`}
              >
                {t("common.all")}
              </button>
              <button
                onClick={() => setFilterMode("unread")}
                className={`px-3 py-1 rounded-full transition-colors ${
                  filterMode === "unread"
                    ? "bg-accent text-white"
                    : "bg-surface-secondary dark:bg-surface-dark-secondary hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
                }`}
              >
                {t("entryList.unread")}
              </button>
            </div>
          </div>
        )}

        {isRefreshing && refreshProgress && refreshProgress.total > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-text-tertiary">
              <span>{`Refreshing ${refreshProgress.completed}/${refreshProgress.total}`}</span>
              <span>{`${refreshProgress.percent}%`}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary overflow-hidden">
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{ width: `${Math.max(0, Math.min(100, refreshProgress.percent))}%` }}
              />
            </div>
            {refreshProgress.feedTitle && (
              <div className="text-[11px] truncate text-text-tertiary">{refreshProgress.feedTitle}</div>
            )}
          </div>
        )}
      </div>

      {/* Content area 锟?fills remaining space */}
      <div
        ref={containerRef}
        className={`flex-1 ${
          activeView === FeedViewType.Videos || isPicturesAllView || ((activeView === FeedViewType.SocialMedia) && !!inlineBilibili)
            ? "overflow-hidden"
            : "overflow-y-auto"
        }`}
        onScroll={(e) => {
          handleTimelineScroll(e)
          handleMasonryScroll(e)
          handlePagedEntryScroll(e)
        }}
      >
        {shouldShowLoadingSkeleton ? (
          <SkeletonList
            count={8}
            type={activeView === FeedViewType.SocialMedia || (activeView === FeedViewType.Pictures && !!selectedFeedId) ? "social" :
                  activeView === FeedViewType.Videos || isPicturesAllView ? "grid" : "article"}
          />
        ) : renderEntries.length === 0 ? (
          selectedFeedId && selectedFeedId !== "starred" ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-secondary dark:text-text-dark-secondary">
              <Inbox size={40} className="mb-3 text-text-tertiary" />
              <p className="text-sm">{t("entryList.noArticles")}</p>
              <button
                onClick={async () => {
                  await refreshFeed(selectedFeedId)
                  loadEntries({ feedId: selectedFeedId, limit: entryLoadLimit })
                }}
                disabled={isRefreshing}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-sm hover:bg-accent/90 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                {isRefreshing ? t("common.refreshing") : t("common.refresh")}
              </button>
            </div>
          ) : activeView !== null ? (
            <ViewRecommendations viewType={activeView} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-text-secondary dark:text-text-dark-secondary">
              <Inbox size={40} className="mb-3 text-text-tertiary" />
              <p className="text-sm">{t("entryList.noArticles")}</p>
              <p className="text-xs mt-1">{t("entryList.addFeedToStart")}</p>
            </div>
          )
        ) : inlineBilibili && (activeView === FeedViewType.Videos || activeView === FeedViewType.SocialMedia) ? (
          <div className="h-full min-h-[520px] bg-white dark:bg-surface-dark flex flex-col">
            <div className="flex-1 min-h-0 bg-black">
              <webview
                src={inlineBilibili.url}
                className="w-full h-full border-0"
                useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
              />
            </div>
          </div>
        ) : isTimelineView ? (
          /* Social media timeline: centered full-width layout */
          <div className="py-2">
            {shouldUseVirtualTimeline ? (
              <div
                className="relative"
                style={{ height: `${timelineVirtualizer.getTotalSize()}px` }}
              >
                {virtualTimelineItems.map((item) => {
                  const entry = timelineEntries[item.index]
                  if (!entry) return null
                  return (
                    <div
                      key={entry.id}
                      data-index={item.index}
                      ref={timelineVirtualizer.measureElement}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      <SocialMediaItem
                        entry={entry}
                        isActive={socialEntry?.id === entry.id}
                        onSelect={() => handleSocialClick(entry)}
                        onDoubleClick={() => handleSocialDoubleClick(entry)}
                        feedTitle={feedById.get(entry.feedId)?.title}
                        feedImage={feedById.get(entry.feedId)?.imageUrl}
                        feedSiteUrl={feedById.get(entry.feedId)?.siteUrl}
                        feedUrl={feedById.get(entry.feedId)?.url}
                        entryIndex={item.index}
                        totalEntries={timelineEntries.length}
                        onMarkAboveRead={() => markAboveRead(entry.id)}
                        onMarkBelowRead={() => markBelowRead(entry.id)}
                        onContextMenu={(e) => showMenu(e, entry.id)}
                        dimRead={settings.general.dimRead}
                        onOpenBilibiliInPage={handleSocialBilibiliOpenInPage}
                      />
                    </div>
                  )
                })}
              </div>
            ) : settings.general.groupByDate ? (
              groupedRenderedTimelineEntries.map((group) => (
                <div key={group.labelKey + group.label}>
                  <div className="sticky top-0 z-[1] h-9 flex items-center border-b border-transparent bg-white/80 dark:bg-surface-dark/80 backdrop-blur-sm">
                    <div className="m-auto flex w-full max-w-[clamp(45ch,60vw,65ch)] select-none gap-3 pl-2 text-base font-bold text-text dark:text-text-dark">
                      <span>{t(group.labelKey, group.labelKey === "entryList.daysAgo" ? { days: group.label.match(/\d+/)?.[0] } : undefined) || group.label}</span>
                    </div>
                  </div>
                  {group.entries.map((entry) => {
                    const globalIndex = timelineIndexById.get(entry.id) ?? 0
                    return (
                      <SocialMediaItem
                        key={entry.id}
                        entry={entry}
                        isActive={socialEntry?.id === entry.id}
                        onSelect={() => handleSocialClick(entry)}
                        onDoubleClick={() => handleSocialDoubleClick(entry)}
                        feedTitle={feedById.get(entry.feedId)?.title}
                        feedImage={feedById.get(entry.feedId)?.imageUrl}
                        feedSiteUrl={feedById.get(entry.feedId)?.siteUrl}
                        feedUrl={feedById.get(entry.feedId)?.url}
                        entryIndex={globalIndex}
                        totalEntries={timelineEntries.length}
                        onMarkAboveRead={() => markAboveRead(entry.id)}
                        onMarkBelowRead={() => markBelowRead(entry.id)}
                        onContextMenu={(e) => showMenu(e, entry.id)}
                        dimRead={settings.general.dimRead}
                        onOpenBilibiliInPage={handleSocialBilibiliOpenInPage}
                      />
                    )
                  })}
                </div>
              ))
            ) : (
              renderedTimelineEntries.map((entry) => (
                <SocialMediaItem
                  key={entry.id}
                  entry={entry}
                  isActive={socialEntry?.id === entry.id}
                  onSelect={() => handleSocialClick(entry)}
                  onDoubleClick={() => handleSocialDoubleClick(entry)}
                  feedTitle={feedById.get(entry.feedId)?.title}
                  feedImage={feedById.get(entry.feedId)?.imageUrl}
                  feedSiteUrl={feedById.get(entry.feedId)?.siteUrl}
                  feedUrl={feedById.get(entry.feedId)?.url}
                  entryIndex={timelineIndexById.get(entry.id) ?? 0}
                  totalEntries={timelineEntries.length}
                  onMarkAboveRead={() => markAboveRead(entry.id)}
                  onMarkBelowRead={() => markBelowRead(entry.id)}
                  onContextMenu={(e) => showMenu(e, entry.id)}
                  dimRead={settings.general.dimRead}
                  onOpenBilibiliInPage={handleSocialBilibiliOpenInPage}
                />
              ))
            )}
            {!shouldUseVirtualTimeline && renderedTimelineEntries.length < timelineEntries.length && (
              <div className="py-3 text-center text-xs text-text-tertiary">
                {`Loading ${renderedTimelineEntries.length}/${timelineEntries.length}...`}
              </div>
            )}
            {isLoadingMore && (
              <div className="py-3 text-center text-xs text-text-tertiary inline-flex w-full items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                <span>Loading more...</span>
              </div>
            )}
          </div>
        ) : isPicturesAllView ? (
          /* Pictures grid: show first image from each post, ordered left-to-right */
          <div className="h-full p-4 box-border overflow-y-auto">
            <div className="flex gap-2.5">
              {(() => {
                // Round-robin distribute cards into columns for left-to-right chronological order
                const cols: typeof visibleMasonryCards[] = Array.from({ length: masonryColumnCount }, () => [])
                visibleMasonryCards.forEach((card, i) => cols[i % masonryColumnCount].push(card))
                return cols.map((colCards, colIdx) => (
                  <div key={colIdx} className="flex-1 flex flex-col gap-2.5 min-w-0">
                    {colCards.map((card) => {
                      const feed = feedById.get(card.feedId)
                      return (
                        <MasonryCard
                          key={card.id}
                          data={card}
                          feedTitle={feed?.title}
                          feedImage={feed?.imageUrl}
                          onClick={() => {
                            const entry = renderEntries.find((e) => e.id === card.id)
                            if (entry) handleSocialClick(entry)
                          }}
                          onContextMenu={(e) => showMenu(e, card.id)}
                          locale={dateLocale}
                        />
                      )
                    })}
                  </div>
                ))
              })()}
            </div>
            {visibleMasonryCards.length < masonryCards.length && (
              <div className="py-3 text-center text-xs text-text-tertiary">
                {`${visibleMasonryCards.length}/${masonryCards.length}...`}
              </div>
            )}
          </div>
        ) : activeView === FeedViewType.Videos ? (
          /* Video grid with optional pagination */
          <div className={inlineBilibili ? "h-full" : "h-full p-6 box-border"}>
            {(() => {
              const videoPagination = settings.general.videoPagination
              const videosPerPage = Math.max(1, Number(settings.general.videosPerPage) || 20)
              const totalVideos = renderEntries.length
              const totalPages = videoPagination ? Math.ceil(totalVideos / videosPerPage) : 1
              const currentPage = videoPagination ? Math.min(videoPage, Math.max(0, totalPages - 1)) : 0
              const displayEntries = videoPagination
                ? renderEntries.slice(currentPage * videosPerPage, (currentPage + 1) * videosPerPage)
                : renderEntries

              return (
                <div className="h-full flex flex-col">
                  <div
                    className="flex-1 pb-3"
                    style={{ scrollbarGutter: "stable both-edges" }}
                  >
                    <div
                    ref={videoGridRef}
                    className="grid gap-4"
                    style={{
                      gridTemplateColumns: `repeat(${videoColumnCount}, minmax(0, 1fr))`,
                    }}
                  >
                    {displayEntries.map((entry) => (
                      <GridCard
                        key={entry.id}
                        entry={entry}
                        isActive={false}
                        onSelect={() => handleVideoClick(entry)}
                        feedTitle={feedById.get(entry.feedId)?.title}
                        feedImage={feedById.get(entry.feedId)?.imageUrl}
                        isVideo={true}
                        onContextMenu={(e) => showMenu(e, entry.id)}
                      />
                    ))}
                  </div>
                  </div>

                  {/* Pagination controls */}
                  {videoPagination && totalPages > 1 && (
                    <div className="shrink-0 flex items-center justify-center gap-3 pt-3 pb-1 border-t border-surface-tertiary dark:border-surface-dark-tertiary bg-white dark:bg-surface-dark">
                      <button
                        onClick={() => setVideoPage(Math.max(0, currentPage - 1))}
                        disabled={currentPage === 0}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                      >
                        <ChevronLeft size={16} />
                        {t("common.prevPage")}
                      </button>
                      <span className="text-sm text-text-secondary dark:text-text-dark-secondary">
                        {currentPage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={() => setVideoPage(Math.min(totalPages - 1, currentPage + 1))}
                        disabled={currentPage >= totalPages - 1}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                      >
                        {t("common.nextPage")}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        ) : null}

        {/* Context Menu */}
        {menuState.visible && menuState.entryId && (() => {
          const menuEntry = renderEntries.find((e) => e.id === menuState.entryId)
          if (!menuEntry) return null
          const menuIndex = renderEntries.findIndex((e) => e.id === menuState.entryId)
          return (
            <WideViewContextMenuWrapper
              entry={menuEntry}
              entryIndex={menuIndex}
              totalEntries={renderEntries.length}
              x={menuState.x}
              y={menuState.y}
              onClose={hideMenu}
              onMarkAboveRead={() => markAboveRead(menuEntry.id)}
              onMarkBelowRead={() => markBelowRead(menuEntry.id)}
              onSharePoster={() => setPosterEntry(menuEntry)}
            />
          )
        })()}

        {/* Share Poster Modal */}
        {posterEntry && (
          <SharePoster
            entry={posterEntry}
            feedTitle={feedById.get(posterEntry.feedId)?.title}
            onClose={() => setPosterEntry(null)}
          />
        )}
      </div>

      {/* Video player modal */}
      {videoEntry && <VideoModal entry={videoEntry} onClose={() => setVideoEntry(null)} feeds={feeds} />}

      {/* Social media overlay */}
      {socialEntry && (
        <SocialOverlay
          entry={socialEntry}
          feed={feedById.get(socialEntry.feedId)}
          onClose={() => setSocialEntry(null)}
        />
      )}
    </div>
  )
}


// 閳光偓閳光偓閳光偓 Video Modal 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓

function VideoModal({ entry, onClose, feeds }: { entry: Entry; onClose: () => void; feeds: { id: string; title?: string }[] }) {
  const { t } = useTranslation()
  const bilibiliOpenInPage = useSettingsStore((s) => s.settings.general.bilibiliOpenInPage)
  const feedTitle = feeds.find((f) => f.id === entry.feedId)?.title

  // Classify the video source: direct mp4, Bilibili iframe, YouTube (needs proxy), or unknown
  const videoSource = useMemo(() => {
    const urls = [entry.url || "", ...(entry.media || []).filter((m) => m.type === "video").map((m) => m.url)]

    for (const url of urls) {
      // Direct video file
      if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
        return { type: "direct" as const, url }
      }
    }

    for (const url of urls) {
      // Bilibili 锟?use full site player in app window for reliable login/quality switching
      const biliMatch = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/)
      if (biliMatch) {
        if (bilibiliOpenInPage) {
          return { type: "bilibili" as const, url: `https://www.bilibili.com/video/${biliMatch[1]}` }
        }
        return { type: "bilibiliEmbed" as const, url: buildBilibiliInAppPlayerUrl(url) }
      }
      const biliAvMatch = url.match(/bilibili\.com\/video\/(av\d+)/)
      if (biliAvMatch) {
        if (bilibiliOpenInPage) {
          return { type: "bilibili" as const, url: `https://www.bilibili.com/video/${biliAvMatch[1]}` }
        }
        return { type: "bilibiliEmbed" as const, url: buildBilibiliInAppPlayerUrl(url) }
      }
      if (/(?:^|\.)(?:bilibili\.com|b23\.tv)\//i.test(url)) {
        if (bilibiliOpenInPage) {
          return { type: "bilibili" as const, url: normalizeBilibiliVideoUrl(url) }
        }
        return { type: "bilibiliEmbed" as const, url: buildBilibiliInAppPlayerUrl(url) }
      }
    }

    for (const url of urls) {
      // YouTube 锟?needs Invidious proxy resolution
      const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
      if (ytMatch) {
        return { type: "youtube" as const, url, videoId: ytMatch[1] }
      }
    }

    // Other embeddable via transformVideoUrl (Vimeo, TED, etc.)
    for (const url of urls) {
      const embed = transformVideoUrl(url)
      if (embed) {
        return { type: "iframe" as const, url: embed.replace("autoplay=0", "autoplay=1") }
      }
    }

    return { type: "none" as const, url: entry.url || "" }
  }, [bilibiliOpenInPage, entry])

  // State for YouTube proxy resolution
  // "resolving" 锟?trying Invidious; "resolved" 锟?got direct URL; "iframe" 锟?use embed
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [useIframeFallback, setUseIframeFallback] = useState(false)

  // For YouTube: check login status first.
  // If logged in 锟?skip slow Invidious and go straight to iframe (cookies work).
  // If not logged in 锟?try Invidious proxy, then fall back to iframe.
  useEffect(() => {
    if (videoSource.type !== "youtube") return
    let cancelled = false
    setResolving(true)
    setResolvedUrl(null)
    setUseIframeFallback(false)

    ;(async () => {
      try {
        // Check if user has linked their YouTube account
        const status = await window.api.video.ytStatus()
        if (status.loggedIn) {
          // Logged in 锟?iframe with youtube.com (carries cookies), skip proxy
          if (!cancelled) {
            setUseIframeFallback(true)
            setResolving(false)
          }
          return
        }
      } catch { /* ignore, proceed to proxy */ }

      // Not logged in 锟?try Invidious/Piped proxy for direct URL
      try {
        const result = await window.api.video.resolve(videoSource.url)
        if (cancelled) return
        if (result.success && result.url) {
          setResolvedUrl(result.url)
        } else {
          setUseIframeFallback(true)
        }
      } catch {
        if (!cancelled) setUseIframeFallback(true)
      } finally {
        if (!cancelled) setResolving(false)
      }
    })()

    return () => { cancelled = true }
  }, [videoSource])

  // Build YouTube iframe embed URL
  // IMPORTANT: use youtube.com (NOT youtube-nocookie.com) so login cookies are sent
  const youtubeIframeSrc = useMemo(() => {
    if (videoSource.type !== "youtube" || !('videoId' in videoSource)) return null
    return `https://www.youtube.com/embed/${videoSource.videoId}?controls=1&autoplay=1&mute=0`
  }, [videoSource])

  // Content description
  const description = useMemo(() => {
    const html = entry.content || entry.summary || ""
    if (!html) return ""
    let safe = sanitizeHTML(html)
    safe = safe.replace(/<(img|video|iframe|audio|picture|source|embed|object)\b[^>]*\/?>/gi, "")
    safe = safe.replace(/<\/(video|iframe|audio|picture|embed|object)>/gi, "")
    return safe
  }, [entry])

  const timeAgo = formatDistanceToNow(new Date(entry.publishedAt), {
    addSuffix: true,
    locale: getDateLocale(),
  })

  if (videoSource.type === "none") return null

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-8 lg:p-12"
      onClick={onClose}
    >
      <div
        className={`w-full ${videoSource.type === "bilibili" ? "max-w-7xl" : "max-w-5xl"} flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video player 锟?16:9 aspect ratio */}
        <div className={`bg-black overflow-hidden flex-shrink-0 ${videoSource.type === "bilibili" ? "rounded-xl h-[72vh]" : "relative w-full aspect-video rounded-t-xl"}`}>
          {/* Direct video file */}
          {videoSource.type === "direct" && (
            <video
              src={videoSource.url}
              className="w-full h-full"
              controls
              autoPlay
              preload="metadata"
            />
          )}

          {/* Bilibili / Vimeo / TED iframe */}
          {videoSource.type === "iframe" && (
            <iframe
              src={videoSource.url}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; encrypted-media; accelerometer; clipboard-write; gyroscope; picture-in-picture"
            />
          )}

          {/* Bilibili in-app playback (first-party webview for login + quality switch) */}
          {videoSource.type === "bilibiliEmbed" && (
            <webview
              src={videoSource.url}
              className="w-full h-full"
              useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            />
          )}

          {/* Bilibili: keep inside current page and show web page on the right side */}
          {videoSource.type === "bilibili" && (
            <div className="w-full h-full flex flex-col lg:flex-row">
              <div className="w-full lg:w-[34%] bg-white dark:bg-surface-dark p-4 overflow-y-auto">
                {entry.title && <h3 className="text-base font-semibold leading-snug">{entry.title}</h3>}
                <div className="flex items-center gap-2 mt-1.5 text-xs text-text-secondary dark:text-text-dark-secondary">
                  {feedTitle && <span>{feedTitle}</span>}
                  <span>路</span>
                  <span>{timeAgo}</span>
                  {entry.url && (
                    <>
                      <span>路</span>
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:underline text-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={11} />
                        {t("common.original")}
                      </a>
                    </>
                  )}
                </div>
                {description && !isDescriptionRedundant(entry.title, description) && (
                  <div
                    className="mt-3 prose prose-sm dark:prose-invert max-w-none text-text-secondary dark:text-text-dark-secondary"
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                )}
              </div>
              <div className="w-full lg:w-[66%] h-[44vh] lg:h-full bg-black">
                <webview
                  src={videoSource.url}
                  className="w-full h-full"
                  useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                />
              </div>
            </div>
          )}

          {/* YouTube 锟?loading / resolving state */}
          {videoSource.type === "youtube" && resolving && (
            <div className="w-full h-full flex flex-col items-center justify-center text-white gap-3">
              <Loader2 size={32} className="animate-spin opacity-60" />
              <span className="text-sm opacity-60">姝ｅ湪瑙ｆ瀽瑙嗛鍦板潃...</span>
            </div>
          )}

          {/* YouTube 锟?resolved via Invidious, play with native video */}
          {videoSource.type === "youtube" && resolvedUrl && !resolving && !useIframeFallback && (
            <video
              src={resolvedUrl}
              className="w-full h-full"
              controls
              autoPlay
              preload="metadata"
              onError={() => {
                // Direct URL failed (expired, geo-blocked, etc.) 锟?switch to iframe fallback
                setResolvedUrl(null)
                setUseIframeFallback(true)
              }}
            />
          )}

          {/* YouTube 锟?iframe fallback (UA spoofed in main process to bypass bot detection) */}
          {videoSource.type === "youtube" && useIframeFallback && !resolving && youtubeIframeSrc && (
            <iframe
              src={youtubeIframeSrc}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; encrypted-media; accelerometer; clipboard-write; gyroscope; picture-in-picture"
            />
          )}
        </div>

        {/* Info area below video */}
        {videoSource.type !== "bilibili" && (
          <div className="bg-white dark:bg-surface-dark rounded-b-xl p-4 overflow-y-auto">
            {entry.title && <h3 className="text-base font-semibold leading-snug">{entry.title}</h3>}
            <div className="flex items-center gap-2 mt-1.5 text-xs text-text-secondary dark:text-text-dark-secondary">
              {feedTitle && <span>{feedTitle}</span>}
              <span>路</span>
              <span>{timeAgo}</span>
              {entry.url && (
                <>
                  <span>路</span>
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:underline text-accent"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={11} />
                    {t("common.original")}
                  </a>
                </>
              )}
            </div>
            {description && !isDescriptionRedundant(entry.title || "", description) && (
              <div
                className="mt-3 prose prose-sm dark:prose-invert max-w-none text-text-secondary dark:text-text-dark-secondary"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            )}
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <X size={20} />
      </button>
    </div>
  )
}

// 閳光偓閳光偓閳光偓 Context Menu Wrapper 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓

function WideViewContextMenuWrapper({
  entry,
  entryIndex,
  totalEntries,
  x,
  y,
  onClose,
  onMarkAboveRead,
  onMarkBelowRead,
  onSharePoster,
}: {
  entry: Entry
  entryIndex: number
  totalEntries: number
  x: number
  y: number
  onClose: () => void
  onMarkAboveRead: () => void
  onMarkBelowRead: () => void
  onSharePoster: () => void
}) {
  const { markRead, toggleStar } = useEntryStore()
  const browserOpenUrl = resolveEntryBrowserOpenUrl(entry)
  const actions = useEntryContextActions({
    entry,
    entryIndex,
    totalEntries,
    onMarkRead: markRead,
    onToggleStar: toggleStar,
    onMarkAboveRead,
    onMarkBelowRead,
    onOpenInBrowser: browserOpenUrl
      ? () => {
          if (window.api?.app?.openExternal) {
            void window.api.app.openExternal(browserOpenUrl)
          } else {
            window.open(browserOpenUrl, "_blank")
          }
        }
      : undefined,
    onSharePoster,
  })
  return <ContextMenu x={x} y={y} onClose={onClose} actions={actions} />
}

// 閳光偓閳光偓閳光偓 Social Media Overlay 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
// Wide overlay: slides up on top of the timeline,
// shows AuthorHeader + full content + all media individually.

function SocialOverlay({
  entry,
  feed,
  onClose,
}: {
  entry: Entry
  feed?: { title?: string; imageUrl?: string; url?: string; siteUrl?: string }
  onClose: () => void
}) {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const timeAgo = formatDistanceToNow(new Date(entry.publishedAt), {
    addSuffix: true,
    locale: getDateLocale(),
  })

  // Smart avatar: prefer unavatar.io for Twitter/X feeds
  const twitterAvatar = useMemo(() => {
    const urls = [feed?.siteUrl, feed?.url].filter(Boolean) as string[]
    for (const u of urls) {
      try {
        const { hostname, pathname } = new URL(u)
        if (hostname === "x.com" || hostname === "twitter.com" || hostname === "www.x.com" || hostname === "www.twitter.com") {
          const username = pathname.split("/").filter(Boolean)[0]
          if (username && /^[a-zA-Z0-9_]+$/.test(username)) {
            return `https://unavatar.io/x/${username}`
          }
        }
      } catch {}
      const m = u.match(/\/twitter\/user\/([a-zA-Z0-9_]+)/i)
      if (m) return `https://unavatar.io/x/${m[1]}`
    }
    return null
  }, [feed?.siteUrl, feed?.url])
  const [avatarImageFailed, setAvatarImageFailed] = useState(false)
  const cleanAuthorAvatar = useMemo(() => {
    const candidate = normalizeInstagramUnavatar(entry.authorAvatar || "")
    return candidate && !isGenericInstagramIconUrl(candidate) ? candidate : ""
  }, [entry.authorAvatar])
  const cleanFeedImage = useMemo(() => {
    const candidate = normalizeInstagramUnavatar(feed?.imageUrl || "")
    return candidate && !isGenericInstagramIconUrl(candidate) ? candidate : ""
  }, [feed?.imageUrl])
  const avatarCandidates = useMemo(() => {
    const candidates = [
      twitterAvatar || "",
      cleanAuthorAvatar,
      extractPixnoyOriginUrl(cleanAuthorAvatar),
      cleanFeedImage,
      extractPixnoyOriginUrl(cleanFeedImage),
    ]
    const unique: string[] = []
    for (const c of candidates) {
      const candidate = (c || "").trim()
      if (!candidate) continue
      if (!/^https?:\/\//i.test(candidate)) continue
      const key = normalizeImageCacheKey(candidate)
      if (unique.some((u) => normalizeImageCacheKey(u) === key)) continue
      unique.push(candidate)
    }
    return unique
  }, [twitterAvatar, cleanAuthorAvatar, cleanFeedImage])
  const [avatarCandidateIndex, setAvatarCandidateIndex] = useState(0)
  useEffect(() => {
    setAvatarImageFailed(false)
    setAvatarCandidateIndex(0)
  }, [entry.id, avatarCandidates])
  const avatarUrl = avatarCandidates[avatarCandidateIndex] || ""
  const avatarLetter = (entry.author || feed?.title || "?")[0]

  // Full sanitized content 锟?strip media tags to avoid duplication with the media gallery below
  // Content width mapping 锟?matches EntryContent
  const contentWidthClasses = useMemo(() => ({
    narrow: "max-w-[500px]",
    normal: "max-w-[680px]",
    wide: "max-w-[900px]",
    custom: "",
  }), [])
  const contentWidthClass = settings.general.contentWidth === "custom"
    ? ""
    : (contentWidthClasses[settings.general.contentWidth] || contentWidthClasses.normal)
  const contentWidthStyle = settings.general.contentWidth === "custom"
    ? { maxWidth: `${settings.general.contentMaxWidth || 680}px` }
    : undefined

  const fullContent = useMemo(() => {
    const html = entry.content || entry.summary || ""
    if (!html.includes("<")) return ""
    return cleanSocialTextHtml(html)
  }, [entry])

  const plainContent = useMemo(
    () => cleanSocialPlainText(fullContent || entry.content || entry.summary || ""),
    [fullContent, entry.content, entry.summary],
  )
  const allEntries = useEntryStore((s) => s.entries)

  const relatedEntryFallback = useMemo(() => {
    const collectPostKeys = (candidate: Entry): Set<string> => {
      const keys = new Set<string>()
      const push = (k: string) => {
        const value = (k || "").trim()
        if (!value) return
        keys.add(value)
      }
      const htmlText = `${candidate.content || ""}\n${candidate.summary || ""}`
      const urls = [
        candidate.url || "",
        candidate.imageUrl || "",
        ...(candidate.media || []).flatMap((m) => [m.url || "", m.previewUrl || ""]),
        ...extractImagesFromHtml(htmlText),
        ...(htmlText.match(/https?:\/\/[^\s"'<>]+/g) || []),
      ].map((u) => decodeMediaUrl(u)).filter(Boolean)

      for (const url of urls) {
        const decoded = decodeMediaUrl(url)
        const igCacheKey = extractIgCacheKeyFromUrl(decoded)
        const base64Part = decodeURIComponent(igCacheKey).split(".")[0] || ""
        if (base64Part) {
          push(`igk:${base64Part}`)
          try {
            const instagramId = atob(base64Part)
            if (/^\d+$/.test(instagramId)) push(`igid:${instagramId}`)
          } catch {
            // ignore
          }
        }
        const shortcodeMatch = decoded.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i)
        if (shortcodeMatch?.[1]) push(`igsc:${shortcodeMatch[1]}`)
      }
      return keys
    }

    const currentKeys = collectPostKeys(entry)
    const currentTextKey = normalizeLooseText(
      `${entry.title || ""} ${cleanSocialPlainText(entry.content || entry.summary || "")}`,
    ).slice(0, 180)
    const minTime = (entry.publishedAt || 0) - 30 * 24 * 60 * 60 * 1000
    const maxTime = (entry.publishedAt || 0) + 30 * 24 * 60 * 60 * 1000

    const isLikelySamePost = (candidate: Entry): boolean => {
      if (candidate.id === entry.id) return false
      if (candidate.feedId !== entry.feedId) return false
      const ts = candidate.publishedAt || 0
      if (ts < minTime || ts > maxTime) return false

      const candidateKeys = collectPostKeys(candidate)
      for (const key of currentKeys) {
        if (candidateKeys.has(key)) return true
      }
      if (currentTextKey) {
        const candidateTextKey = normalizeLooseText(
          `${candidate.title || ""} ${cleanSocialPlainText(candidate.content || candidate.summary || "")}`,
        ).slice(0, 180)
        if (candidateTextKey && candidateTextKey === currentTextKey) return true
      }
      return false
    }

    const getBestImage = (candidate: Entry): string => {
      const mediaPhotos = (candidate.media || []).filter((m) => m.type === "photo")
      for (const photo of mediaPhotos) {
        const preview = decodeMediaUrl(photo.previewUrl || "")
        if (preview && isLikelyImageByUrl(preview)) return preview
        const primary = decodeMediaUrl(photo.url || "")
        if (primary && isLikelyImageByUrl(primary)) return primary
      }
      const entryImage = decodeMediaUrl(candidate.imageUrl || "")
      if (entryImage && isLikelyImageByUrl(entryImage)) return entryImage
      const contentImages = extractImagesFromHtml(candidate.content || candidate.summary || "")
      const firstValid = contentImages.find((u) => isLikelyImageByUrl(u))
      return firstValid ? decodeMediaUrl(firstValid) : ""
    }

    const related = allEntries
      .filter(isLikelySamePost)
      .map((candidate) => ({
        candidate,
        cover: getBestImage(candidate),
        distance: Math.abs((candidate.publishedAt || 0) - (entry.publishedAt || 0)),
      }))
      .sort((a, b) => a.distance - b.distance)

    const withCover = related.find((item) => !!item.cover)
    if (withCover) return withCover
    return related[0] || null
  }, [allEntries, entry])

  const browserOpenUrl = useMemo(
    () => resolveEntryBrowserOpenUrl(entry) || resolveEntryBrowserOpenUrl(relatedEntryFallback?.candidate || entry),
    [entry, relatedEntryFallback],
  )

  // Split content into paragraphs for bilingual translation
  const paragraphs = useMemo(() => {
    if (fullContent) return splitIntoParagraphs(fullContent)
    if (plainContent) {
      // Split plain text by newlines so bilingual translation interleaves per paragraph
      const lines = plainContent.split(/\n+/).map((l) => l.trim()).filter(Boolean)
      return lines.length > 0 ? lines : [plainContent]
    }
    return []
  }, [fullContent, plainContent])

  // All media items
  const photos = useMemo(() => {
    const mediaPhotos = entry.media?.map((m) => ({
      ...m,
      url: decodeMediaUrl(m.url),
      // Keep original previewUrl (mirror/proxy URL) intact.
      // decodeMediaUrl would unwrap it to an expiring CDN URL via normalizePicnobImageUrl.
      previewUrl: m.previewUrl ? decodeUrlEntities(m.previewUrl) : m.previewUrl,
    })).filter((photo) => {
      const preview = decodeMediaUrl(photo.previewUrl || "")
      const primary = decodeMediaUrl(photo.url || "")
      const passImage = isLikelyImageByUrl(preview || primary)
      const isDecorative = isDecorativeSocialImageUrl(preview || primary)
      const isTiny = hasTinyDecorativeDimensions(photo.width, photo.height)
      const raw = `${primary} ${preview}`.toLowerCase()
      const isVideo = /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(raw)
      if (!passImage) return false
      if (isDecorative) return false
      if (isTiny) return false
      if (isVideo) return false
      return isLikelyImageByUrl(preview || primary)
    }) || []
    if (mediaPhotos.length > 0) {
      const seen = new Set<string>()
      const deduped: typeof mediaPhotos = []
      for (const photo of mediaPhotos) {
        const candidate = decodeMediaUrl(photo.url || photo.previewUrl || "")
        const keys = getPhotoDedupeKeys(photo.url || "", photo.previewUrl || "")
        if (keys.length === 0) {
          const fallbackKey = normalizeImageCacheKey(candidate)
          if (fallbackKey) keys.push(`raw:${fallbackKey}`)
        }
        // Treat as duplicate only when all identity keys are already seen.
        // Instagram/Picnob carousels often share preview keys across multiple photos.
        if (keys.every((key) => seen.has(key))) {
          continue
        }
        keys.forEach((key) => seen.add(key))
        deduped.push(photo)
      }
      return deduped
    }
    const fallback = entry.imageUrl ? decodeMediaUrl(entry.imageUrl) : ""
    return fallback && isLikelyImageByUrl(fallback) ? [{ url: fallback, type: "photo" as const }] : []
  }, [entry.media, entry.imageUrl])
  const videos = useMemo(() => {
    const rawVideos = (entry.media || [])
      .filter((m) => m.type === "video")
      .map((m) => ({
        ...m,
        url: decodeMediaUrl(m.url),
        previewUrl: m.previewUrl ? decodeMediaUrl(m.previewUrl) : m.previewUrl,
      }))
      .filter((m) => isRenderableVideoMediaItem(m))

    const unique: typeof rawVideos = []
    const seen = new Set<string>()
    for (const video of rawVideos) {
      const key = `${normalizeImageCacheKey(video.url || "")}|${normalizeImageCacheKey(video.previewUrl || "")}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(video)
    }
    return unique
  }, [entry.media])
  const hasBilibiliPageVideo = useMemo(
    () => videos.some((video) => /(?:^|\.)bilibili\.com\/video\/|(?:^|\.)b23\.tv\//i.test((video.url || "").toLowerCase())),
    [videos],
  )
  const videosWithCover = useMemo(() => {
    if (videos.length === 0) return videos
    const contentPreview = photos.length === 0
      ? (extractImagesFromHtml(entry.content || entry.summary || "")[0] || "")
      : ""
    const derivePlatformCover = (url: string): string => {
      const raw = decodeMediaUrl(url || "")
      if (!raw) return ""
      const ytMatch = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/i)
      if (ytMatch?.[1]) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`
      return ""
    }
    const firstPhotoPreview = photos[0] && "previewUrl" in photos[0]
      ? decodeMediaUrl(photos[0].previewUrl || "")
      : ""
    const fallbackPreview =
      firstPhotoPreview
      || photos[0]?.url
      || relatedEntryFallback?.cover
      || decodeMediaUrl(entry.imageUrl || "")
      || contentPreview
      || derivePlatformCover(entry.url || "")
      || ""
    return videos.map((video) => {
      const rawPreview = decodeMediaUrl(video.previewUrl || "")
      const rawUrl = decodeMediaUrl(video.url || "")
      const validPreview = rawPreview && isLikelyImageByUrl(rawPreview) ? rawPreview : ""
      if (validPreview) return { ...video, previewUrl: validPreview }

      const derivedCover = derivePlatformCover(rawUrl)
      if (derivedCover) return { ...video, previewUrl: derivedCover }

      if (fallbackPreview && isLikelyImageByUrl(fallbackPreview)) {
        return { ...video, previewUrl: fallbackPreview }
      }
      return video
    })
  }, [videos, photos, relatedEntryFallback, entry.imageUrl, entry.content, entry.summary, entry.url])
  const displayPhotos = hasBilibiliPageVideo ? [] : photos

  // Lightbox for individual media in overlay
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [failedOverlayPhotoTokens, setFailedOverlayPhotoTokens] = useState<Set<string>>(new Set())
  const getOverlayPhotoToken = useCallback((photo?: { url?: string; previewUrl?: string }): string => {
    if (!photo) return ""
    const key = getPhotoDedupeKey(photo.url || "", photo.previewUrl || "")
    if (key) return key
    return normalizeImageCacheKey(photo.url || photo.previewUrl || "")
  }, [])
  const getOverlayPhotoInitialSrc = useCallback((photo?: { url?: string; previewUrl?: string }): string => {
    if (!photo) return ""
    // Prefer previewUrl (mirror/proxy URL) when available — CDN signed URLs expire quickly.
    // decodeMediaUrl unwraps mirror URLs to CDN URLs, so use decodeUrlEntities instead.
    if (photo.previewUrl) {
      const raw = decodeUrlEntities(photo.previewUrl)
      if (raw && /^https?:\/\//i.test(raw)) return raw
    }
    return decodeMediaUrl(photo.url || "")
  }, [])
  useEffect(() => {
    setFailedOverlayPhotoTokens(new Set())
    setPreviewIdx(null)
    setLightboxOpen(false)
  }, [entry.id])

  const markOverlayPhotoFailed = useCallback((photo?: { url?: string; previewUrl?: string }) => {
    const token = getOverlayPhotoToken(photo)
    if (!token) return
    setFailedOverlayPhotoTokens((prev) => {
      if (prev.has(token)) return prev
      const next = new Set(prev)
      next.add(token)
      return next
    })
  }, [getOverlayPhotoToken])

  const handleOverlayPhotoError = useCallback((
    photo: { url?: string; previewUrl?: string } | undefined,
    e: SyntheticEvent<HTMLImageElement>,
  ) => {
    advanceOverlayPhotoFallback(e, photo?.url || photo?.previewUrl || "", (img) => {
      img.style.display = "none"
      markOverlayPhotoFailed(photo)
    }, photo?.previewUrl)
  }, [markOverlayPhotoFailed])

  // 閳光偓閳光偓閳光偓 AI Translation & Summary 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  const [translatedParagraphs, setTranslatedParagraphs] = useState<string[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  const handleTranslate = useCallback(async () => {
    if (paragraphs.length === 0) return
    // Toggle off
    if (showTranslation && translatedParagraphs.length > 0) { setShowTranslation(false); return }
    // Toggle on if already translated
    if (translatedParagraphs.length > 0) { setShowTranslation(true); return }
    // Do translation paragraph by paragraph
    setIsTranslating(true)
    setShowTranslation(true)
    const targetLang = settings.translation?.targetLanguage || settings.general?.language || "zh-CN"
    const results: string[] = []
    for (let i = 0; i < paragraphs.length; i++) {
      const plainText = paragraphs[i].replace(/<[^>]*>/g, "").trim()
      if (!plainText || plainText.length < 5) {
        results.push("")
        continue
      }
      try {
        const result = await window.api.ai.translate(paragraphs[i], targetLang)
        if (result.success) {
          results.push(result.translation)
        } else {
          results.push(`<span class="text-red-400 text-xs">${t("entry.translateFailed")}</span>`)
        }
      } catch {
        results.push(`<span class="text-red-400 text-xs">${t("entry.translateFailed")}</span>`)
      }
      // Update progressively
      setTranslatedParagraphs([...results])
    }
    setIsTranslating(false)
  }, [paragraphs, showTranslation, translatedParagraphs.length, settings.translation?.targetLanguage, settings.general?.language, t])

  const handleSummarize = useCallback(async () => {
    if (!plainContent) return
    // Toggle
    if (showSummary && summary) { setShowSummary(false); return }
    if (summary) { setShowSummary(true); return }
    setIsSummarizing(true)
    setShowSummary(true)
    try {
      const result = await window.api.ai.summarize(plainContent, settings.general?.language || "zh-CN")
      if (result.success) {
        setSummary(result.summary)
      } else {
        setSummary(`\u274c ${result.error}`)
      }
    } catch (err) {
      setSummary(`\u274c ${String(err)}`)
    }
    setIsSummarizing(false)
  }, [plainContent, showSummary, summary, settings.general?.language])

  return (
    <div className="absolute inset-0 z-[50] flex flex-col overflow-hidden">
      {/* Backdrop 锟?click to close */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Content 锟?slides up, scrollable */}
      <div className="relative z-10 flex-1 overflow-y-auto bg-white dark:bg-surface-dark">
        {/* Sticky action bar 锟?always visible at top */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-sm border-b border-border/10 dark:border-border-dark/10">
          <div className={`${contentWidthClass} mx-auto px-4 py-2 flex items-center justify-between`} style={contentWidthStyle}>
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-2 py-1.5 -ml-2 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary text-text-secondary transition-colors"
            >
              <ChevronLeft size={18} />
              <span className="text-sm">{t("common.back")}</span>
            </button>
            <div className="flex items-center gap-2">
              {/* AI action buttons */}
              {plainContent && (
                <>
                  <button
                    onClick={handleTranslate}
                    disabled={isTranslating}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                      showTranslation && translatedParagraphs.length > 0
                        ? "text-accent bg-accent/10"
                        : "text-text-secondary hover:text-accent hover:bg-accent/5"
                    }`}
                    title={t("social.translateTweet")}
                  >
                    {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
                    <span>{t("social.translateTweet")}</span>
                  </button>
                  <button
                    onClick={handleSummarize}
                    disabled={isSummarizing}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                      showSummary && summary
                        ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                        : "text-text-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
                    }`}
                    title={t("social.summarizeTweet")}
                  >
                    {isSummarizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>{t("social.summarizeTweet")}</span>
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  if (!browserOpenUrl) return
                  if (window.api?.app?.openExternal) {
                    void window.api.app.openExternal(browserOpenUrl)
                  } else {
                    window.open(browserOpenUrl, "_blank")
                  }
                }}
                disabled={!browserOpenUrl}
                className="flex items-center gap-1 text-xs text-accent disabled:text-text-tertiary disabled:cursor-not-allowed hover:underline disabled:no-underline"
                title={t("common.openInBrowser", { defaultValue: "鍦ㄦ祻瑙堝櫒涓墦寮€" })}
              >
                <ExternalLink size={12} />
                {t("common.openInBrowser", { defaultValue: "鍦ㄦ祻瑙堝櫒涓墦寮€" })}
              </button>
            </div>
          </div>
        </div>

        <div
          data-context-select-scope="article"
          className={`${contentWidthClass} mx-auto space-y-5 pt-4 pb-12 px-4`}
          style={{
            lineHeight: settings.general.contentLineHeight,
            fontFamily: settings.general.contentFontFamily,
            ...contentWidthStyle,
          }}
        >

          {/* AI Summary 锟?displayed at the top, before content */}
          {showSummary && (
            <div className="rounded-xl border border-amber-300/30 bg-amber-50/50 dark:bg-amber-900/10 p-4">
              <div className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
                <Sparkles size={14} />
                {t("social.aiSummary")}
              </div>
              {isSummarizing ? (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Loader2 size={14} className="animate-spin" />
                  {t("entry.generatingSummary")}
                </div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-line">{summary}</p>
              )}
            </div>
          )}

          {/* Author header */}
          <div className="flex items-center gap-3">
            {avatarUrl && !avatarImageFailed ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
                onError={() => {
                  const nextIndex = avatarCandidateIndex + 1
                  if (nextIndex < avatarCandidates.length) {
                    setAvatarCandidateIndex(nextIndex)
                    return
                  }
                  setAvatarImageFailed(true)
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary flex items-center justify-center text-sm font-bold text-text-secondary">
                {avatarLetter}
              </div>
            )}
            <div>
              <div className="font-semibold text-base">{entry.author || feed?.title}</div>
              <div className="text-xs text-text-secondary dark:text-text-dark-secondary">{timeAgo}</div>
            </div>
          </div>

          {/* Full content 锟?bilingual mode when translation is active */}
          {showTranslation && translatedParagraphs.length > 0 ? (
            <div
              className="space-y-0"
              style={{ fontSize: `${settings.general.fontSize}px` }}
            >
              {paragraphs.map((para, i) => {
                const translated = translatedParagraphs[i]
                const isLoading = isTranslating && i === translatedParagraphs.length
                const plainText = para.replace(/<[^>]*>/g, "").trim()
                if (!plainText) return null
                return (
                  <div
                    key={i}
                    className="group border-l-2 border-transparent hover:border-accent/30 transition-colors pl-0 hover:pl-3"
                  >
                    {/* Original */}
                    {para.includes("<") ? (
                      <div
                        className="entry-content !mb-0 prose dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: para }}
                      />
                    ) : (
                      <p className="whitespace-pre-line !mb-0">{para}</p>
                    )}
                    {/* Translation */}
                    {translated ? (
                      <div className="relative mt-1 mb-4">
                        <div className="flex items-start gap-2">
                          <Languages size={12} className="text-accent/50 mt-1 flex-shrink-0" />
                          <div
                            className="entry-content !mb-0 text-accent/80 dark:text-orange-300/80"
                            style={{ fontSize: `${(settings.general.fontSize || 16) - 1}px` }}
                            dangerouslySetInnerHTML={{ __html: translated }}
                          />
                        </div>
                      </div>
                    ) : isLoading ? (
                      <div className="flex items-center gap-2 mt-1 mb-4 text-xs text-text-tertiary">
                        <Loader2 size={12} className="animate-spin" />
                        {t("entry.translating")}
                      </div>
                    ) : (
                      <div className="mb-4" />
                    )}
                  </div>
                )
              })}
            </div>
          ) : fullContent ? (
            <div
              className="prose dark:prose-invert max-w-none"
              style={{ fontSize: `${settings.general.fontSize}px` }}
              dangerouslySetInnerHTML={{ __html: fullContent }}
            />
          ) : plainContent ? (
            <p
              className="whitespace-pre-line"
              style={{ fontSize: `${settings.general.fontSize}px` }}
            >
              {plainContent}
            </p>
          ) : null}

          {/* Photos carousel */}
          {displayPhotos.length > 0 && (
            <div className="relative group/carousel">
              {/* Fixed-height image area so arrows stay in place */}
              <div className="relative overflow-hidden" style={{ height: "70vh" }}>
                <div
                  className="flex h-full transition-transform duration-300 ease-in-out"
                  style={{ transform: `translateX(-${(previewIdx ?? 0) * 100}%)` }}
                >
                  {displayPhotos.map((photo, i) => {
                    const token = getOverlayPhotoToken(photo)
                    const isFailed = !!token && failedOverlayPhotoTokens.has(token)
                    return (
                      <div key={`slide-${i}`} className="flex-shrink-0 w-full h-full flex items-center justify-center">
                        {isFailed ? (
                          <div className="flex min-h-[180px] w-full max-w-full items-center justify-center rounded-lg bg-surface-tertiary text-sm text-text-tertiary dark:bg-surface-dark-tertiary dark:text-text-dark-tertiary">
                            图片加载失败
                          </div>
                        ) : (
                          <img
                            src={getOverlayPhotoInitialSrc(photo)}
                            alt=""
                            className="max-w-full max-h-full rounded-lg cursor-zoom-in object-contain"
                            loading={i <= (previewIdx ?? 0) + 1 ? "eager" : "lazy"}
                            referrerPolicy="no-referrer"
                            onClick={() => setLightboxOpen(true)}
                            onLoad={(e) => { e.currentTarget.style.display = "" }}
                            onError={(e) => handleOverlayPhotoError(photo, e)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Left / Right arrows — inside fixed-height container */}
                {displayPhotos.length > 1 && (previewIdx ?? 0) > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewIdx(Math.max(0, (previewIdx ?? 0) - 1)) }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                  >
                    <ChevronLeft size={22} />
                  </button>
                )}
                {displayPhotos.length > 1 && (previewIdx ?? 0) < displayPhotos.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewIdx(Math.min(displayPhotos.length - 1, (previewIdx ?? 0) + 1)) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                  >
                    <ChevronRight size={22} />
                  </button>
                )}
              </div>

              {/* Dot indicators */}
              {displayPhotos.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  {displayPhotos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPreviewIdx(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === (previewIdx ?? 0)
                          ? "bg-accent"
                          : "bg-text-tertiary/40 hover:bg-text-tertiary/60"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {videosWithCover.map((video, i) => (
            <div key={`video-${i}`} className="mt-3">
              <VideoPlayer
                src={video.url}
                previewImage={video.previewUrl}
                className="w-full aspect-video rounded-lg"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Photo lightbox within overlay */}
      {lightboxOpen && displayPhotos[(previewIdx ?? 0)] && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          {(() => {
            const idx = previewIdx ?? 0
            const previewPhoto = displayPhotos[idx]
            const previewToken = getOverlayPhotoToken(previewPhoto)
            const previewFailed = !!previewToken && failedOverlayPhotoTokens.has(previewToken)
            return previewFailed ? (
              <div
                className="flex min-h-[240px] min-w-[240px] max-w-[90vw] max-h-[90vh] items-center justify-center rounded-lg bg-surface-tertiary text-sm text-text-tertiary dark:bg-surface-dark-tertiary dark:text-text-dark-tertiary"
                onClick={(e) => e.stopPropagation()}
              >
                图片加载失败
              </div>
            ) : (
              <img
                key={`overlay-preview-${entry.id}-${idx}-${previewPhoto.url}`}
                src={getOverlayPhotoInitialSrc(previewPhoto)}
                alt=""
                className="max-w-[90vw] max-h-[90vh] object-contain"
                referrerPolicy="no-referrer"
                onLoad={(e) => {
                  e.currentTarget.style.display = ""
                }}
                onError={(e) => handleOverlayPhotoError(previewPhoto, e)}
                onClick={(e) => e.stopPropagation()}
              />
            )
          })()}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
          {displayPhotos.length > 1 && (previewIdx ?? 0) > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setPreviewIdx((previewIdx ?? 0) - 1) }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          {displayPhotos.length > 1 && (previewIdx ?? 0) < displayPhotos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setPreviewIdx((previewIdx ?? 0) + 1) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
