import { useEffect, useState, useCallback, useMemo, useRef, useLayoutEffect, memo, type SyntheticEvent, type UIEvent } from "react"
import { useTranslation } from "react-i18next"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useEntryStore } from "../../store/entry-store"
import { useFeedStore } from "../../store/feed-store"
import {
  useGeneralSettingKey,
  useGeneralSettingsShallowSelector,
  useTranslationSettingKey,
} from "../../store/settings-store"
import { useDiscoverStore } from "../../store/discover-store"
import { FeedViewType, VIEW_DEFINITIONS } from "../../../../shared/types"
import { VIEW_TYPE_I18N_KEYS } from "../../lib/view-type-keys"
import {
  RECOMMENDED_VIDEO_FEEDS,
  RECOMMENDED_ARTICLE_FEEDS,
  RECOMMENDED_SOCIAL_FEEDS,
  DEFAULT_RSSHUB_INSTANCE,
  type RecommendedFeed,
} from "../../../../shared/discover-data"
import { sanitizeHTML } from "../../utils/sanitize"
import { RECOMMENDED_CATEGORY } from "../../hooks/useInitRecommendedFeeds"
import { SkeletonList } from "../ui/Skeleton"
import { ContextMenu, useEntryContextMenu, useEntryContextActions } from "../ui/ContextMenu"
import { SharePoster } from "../ui/SharePoster"
import { VideoPlayer, pauseInlineVideos } from "../ui/VideoPlayer"
import { blurhashToAverageColor } from "../../lib/blurhash"
import { getImageProxyFallbackUrls, getThumbnailUrl } from "../../lib/image-proxy"
import { groupEntriesByDate } from "../../lib/date-groups"
import { useAsyncSocialDedupe } from "../../hooks/useAsyncSocialDedupe"
import { canonicalizeSocialUrl, normalizeSocialHandle, extractFirstHttpUrl, extractFirstNonMediaUrl } from "../../lib/social-url"
import { LRUCache } from "../../lib/lru-cache"
import { getEntryLoadLimit } from "../../lib/entry-load-limit"
import { formatDistanceToNow } from "date-fns"
import { getDateLocale } from "../../lib/date-locale"
import { transformVideoUrl } from "../media/MediaPlayer"
import { Search, CheckCheck, Star, Loader2, Inbox, Play, Plus, Check, FileText, Users, ChevronDown, ChevronUp, RefreshCw, MoreHorizontal, Eye, EyeOff, Globe, Languages, Sparkles } from "lucide-react"
import type { Entry } from "../../../../shared/types"
import type { MediaItem } from "../../../../shared/types"

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
  // Normalize protocol-relative URLs (//host/path) to explicit HTTPS.
  if (decoded?.startsWith("//")) decoded = `https:${decoded}`
  return normalizePicnobImageUrl(normalizeNitterImageUrl(decoded))
}

function decodeHtmlEntitiesUrl(url: string): string {
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

    // Raw-query fallback for feeds that provide the nested URL as plain text.
    // Important: this can accidentally include outer query params, so it is secondary.
    const questionIndex = raw.indexOf("?")
    const rawQuery = questionIndex >= 0 ? raw.slice(questionIndex + 1) : ""
    const markerIndex = rawQuery.indexOf("url=")
    const rawSlice = markerIndex >= 0 ? rawQuery.slice(markerIndex + 4).trim() : ""
    let fromRawSlice = rawSlice
    if (fromRawSlice) {
      try {
        fromRawSlice = decodeURIComponent(fromRawSlice)
      } catch {
        // Keep as-is when already decoded or malformed.
      }
    }

    const candidates = [fromRawSlice, fromSearchParams].filter((candidate) => /^https?:\/\//i.test(candidate))
    if (candidates.length === 0) return raw

    // Prefer complete nested URLs (often present in raw `url=` form).
    // Some mirror URLs carry unescaped `&` inside nested URL; `searchParams.get("url")`
    // can truncate them and drop required signed params.
    const best = candidates.sort((a, b) => {
      const score = (value: string) => {
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
        // Penalize suspiciously concatenated values containing a second full URL.
        if ((value.match(/https?:\/\//gi) || []).length > 1) s -= 6
        return s
      }
      return score(b) - score(a)
    })[0]

    return best || raw
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
      // Use full URL path instead of just filename to distinguish different photos in the same carousel
      return `${parsed.origin.toLowerCase()}${pathname}${parsed.search || ""}`
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

  const normalizedUrl = normalizeMediaCompareKey(url || "")
  if (normalizedUrl) push(`url:${normalizedUrl}`)
  const normalizedPreview = normalizeMediaCompareKey(previewUrl || "")
  if (normalizedPreview) push(`url:${normalizedPreview}`)

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
  if (/^https?:\/\/media\.(picnob|pixnoy)\.[^/]+\/get\?/i.test(raw)) return true
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

function isRenderableVideoMediaItem(media?: Pick<MediaItem, "url" | "previewUrl"> | null): boolean {
  if (!media) return false
  const url = decodeMediaUrl(media.url || "")
  const preview = decodeMediaUrl(media.previewUrl || "")
  if (url && isRenderableVideoUrl(url)) return true
  if (preview && isDirectVideoUrl(preview)) return true
  return false
}

function extractImagesFromHtml(html: string): string[] {
  if (!html || !html.includes("<")) return []
  try {
    const pickBestFromSrcset = (value: string): string => {
      const list = value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const pieces = part.split(/\s+/).filter(Boolean)
          const url = decodeMediaUrl(pieces[0] || "")
          const descriptor = pieces[1] || ""
          const width = descriptor.endsWith("w") ? parseInt(descriptor.slice(0, -1), 10) : 0
          return { url, width: Number.isFinite(width) ? width : 0 }
        })
        .filter((item) => !!item.url)
      if (list.length === 0) return ""
      list.sort((a, b) => b.width - a.width)
      return list[0]?.url || ""
    }

    const doc = new DOMParser().parseFromString(html, "text/html")
    const urls = Array.from(doc.querySelectorAll("img"))
      .flatMap((img) => {
        const width = img.getAttribute("width") || img.getAttribute("data-width") || ""
        const height = img.getAttribute("height") || img.getAttribute("data-height") || ""
        const widthValue = width ? Number.parseInt(width, 10) : undefined
        const heightValue = height ? Number.parseInt(height, 10) : undefined
        if (hasTinyDecorativeDimensions(widthValue, heightValue)) return []
        const attrs = [
          decodeMediaUrl(img.getAttribute("src") || ""),
          decodeMediaUrl(img.getAttribute("data-src") || ""),
          decodeMediaUrl(img.getAttribute("data-original") || ""),
          decodeMediaUrl(img.getAttribute("data-lazy-src") || ""),
          pickBestFromSrcset(img.getAttribute("srcset") || ""),
          pickBestFromSrcset(img.getAttribute("data-srcset") || ""),
        ]
        return attrs.filter((value) => !!value && !isDecorativeSocialImageUrl(value))
      })
      .concat(
        Array.from(doc.querySelectorAll("source"))
          .map((source) =>
            pickBestFromSrcset(source.getAttribute("srcset") || source.getAttribute("data-srcset") || ""),
          )
          .filter(Boolean),
      )
      .concat(
        Array.from(doc.querySelectorAll("video"))
          .flatMap((video) => [
            decodeMediaUrl(video.getAttribute("poster") || ""),
            decodeMediaUrl(video.getAttribute("data-poster") || ""),
          ])
          .filter(Boolean),
      )
      .concat(
        Array.from(doc.querySelectorAll("a"))
          .map((a) => decodeMediaUrl(a.getAttribute("href") || ""))
          .filter((url) => /^https?:\/\//i.test(url))
          .filter((url) => /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(url)),
      )
      .filter((url) => /^https?:\/\//i.test(url))
      .filter((url) => isLikelyImageByUrl(url))
      .filter((url) => {
        // Skip obvious avatar/icon-like assets; keep card/media images.
        return !/profile_images|avatar|emoji|icon/i.test(url)
      })
    return Array.from(new Set(urls))
  } catch {
    return []
  }
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

      // Remove styles that commonly leave large empty placeholders after media removal.
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
    // Fallback to regex cleanup below.
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
    if (/^media\.(picnob|pixnoy|piokok|pixwox)\./i.test(parsed.hostname) && parsed.pathname === "/get") {
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

/** Return a copy of the media item with decoded URLs.
 *  previewUrl is intentionally kept as-is (only HTML-entity decoded) so that
 *  mirror/proxy URLs (e.g. picnob/pixnoy) survive for rendering.
 *  decodeMediaUrl would unwrap them to expiring CDN URLs. */
function decodeMediaUrls(m: MediaItem): MediaItem {
  return {
    ...m,
    url: decodeMediaUrl(m.url),
    previewUrl: m.previewUrl ? decodeHtmlEntitiesUrl(m.previewUrl) : m.previewUrl,
  }
}

// LRU cache for expanded state of social media items
const expandedCache = new LRUCache<string, boolean>(200)
const mediaExpandedCache = new LRUCache<string, boolean>(200)
const tweetTranslationCache = new LRUCache<string, string[]>(100)
const tweetSummaryCache = new LRUCache<string, string>(100)
const MEDIA_SRC_CACHE_STORAGE_KEY = "livo-picture-src-cache-v4"
const mediaSrcCache = new Map<string, string>()
let mediaSrcCacheLoaded = false
let mediaSrcCacheSaveTimer: number | null = null

function normalizeImageCacheKey(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  try {
    const u = new URL(raw)
    // Keep query string: many image providers encode real media identity in search params.
    // Stripping query causes cross-entry collisions and wrong image reuse.
    const query = u.search || ""
    u.hash = ""
    return `${u.origin}${u.pathname}${query}`
  } catch {
    return raw.split("#")[0] || raw
  }
}

function getPhotoVariantQualityScore(photo: { url: string; previewUrl?: string }): number {
  const rawUrl = decodeMediaUrl(photo.url || "")
  const rawPreview = decodeMediaUrl(photo.previewUrl || "")
  const target = rawUrl || rawPreview
  if (!target) return 0

  let score = 0
  const lower = target.toLowerCase()
  if (extractIgCacheKeyFromUrl(rawUrl) || extractIgCacheKeyFromUrl(rawPreview)) score += 12
  if (lower.includes("oh=") && lower.includes("oe=")) score += 8
  if (lower.includes("&_nc_") || lower.includes("?_nc_")) score += 5
  if (/cdninstagram|scontent\.|fbcdn\.net/.test(lower)) score += 4
  if (rawPreview) score += 2
  score += Math.min(target.length, 2000) / 2000
  return score
}

function dedupeGalleryPhotoVariants(photos: Array<{ url: string; previewUrl?: string; width?: number; height?: number; blurhash?: string }>) {
  const kept = new Map<string, { photo: { url: string; previewUrl?: string; width?: number; height?: number; blurhash?: string }; score: number; order: number }>()
  const fallback = new Map<string, { photo: { url: string; previewUrl?: string; width?: number; height?: number; blurhash?: string }; score: number; order: number }>()

  const register = (
    map: Map<string, { photo: { url: string; previewUrl?: string; width?: number; height?: number; blurhash?: string }; score: number; order: number }>,
    key: string,
    payload: { photo: { url: string; previewUrl?: string; width?: number; height?: number; blurhash?: string }; score: number; order: number },
  ) => {
    const existing = map.get(key)
    if (!existing || payload.score > existing.score || (payload.score === existing.score && payload.order < existing.order)) {
      map.set(key, payload)
    }
  }

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index]
    const keys = getPhotoDedupeKeys(photo.url || "", photo.previewUrl || "")
    const payload = { photo, score: getPhotoVariantQualityScore(photo), order: index }
    if (keys.length === 0) {
      const fallbackKey = normalizeImageCacheKey(decodeMediaUrl(photo.url || photo.previewUrl || "")) || `idx:${index}`
      register(fallback, fallbackKey, payload)
      continue
    }
    for (const key of keys) register(kept, key, payload)
  }

  const merged = [...kept.values(), ...fallback.values()]
    .sort((a, b) => a.order - b.order)

  const unique: Array<{ url: string; previewUrl?: string; width?: number; height?: number; blurhash?: string }> = []
  const seenOrders = new Set<number>()
  for (const entry of merged) {
    if (seenOrders.has(entry.order)) continue
    seenOrders.add(entry.order)
    unique.push(entry.photo)
  }

  return unique
}

function isInstagramLikeGalleryPhoto(photo: { url: string; previewUrl?: string }): boolean {
  const candidate = decodeMediaUrl(photo.url || photo.previewUrl || "").toLowerCase()
  if (!candidate) return false
  return (
    candidate.includes("ig_cache_key=") ||
    /cdninstagram|scontent\.|fbcdn\.net|media\.(?:picnob|pixnoy|piokok|pixwox)\./i.test(candidate)
  )
}

function ensuremediaSrcCacheLoaded(): void {
  if (mediaSrcCacheLoaded || typeof window === "undefined") return
  mediaSrcCacheLoaded = true
  try {
    const raw = window.localStorage.getItem(MEDIA_SRC_CACHE_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, string>
    for (const [k, v] of Object.entries(parsed || {})) {
      if (k && v) mediaSrcCache.set(k, v)
    }
  } catch {
    // Ignore malformed cache.
  }
}

function persistmediaSrcCache(): void {
  if (typeof window === "undefined") return
  if (mediaSrcCacheSaveTimer) window.clearTimeout(mediaSrcCacheSaveTimer)
  mediaSrcCacheSaveTimer = window.setTimeout(() => {
    try {
      const maxEntries = 1500
      const entries = Array.from(mediaSrcCache.entries())
      const sliced = entries.length > maxEntries ? entries.slice(entries.length - maxEntries) : entries
      const obj = Object.fromEntries(sliced)
      window.localStorage.setItem(MEDIA_SRC_CACHE_STORAGE_KEY, JSON.stringify(obj))
    } catch {
      // Ignore storage failures.
    }
  }, 200)
}

function buildMediaFallbackCandidates(primaryUrl: string, coverUrl: string, mirrorOriginUrl: string): string[] {
  const proxyFallbacks = getImageProxyFallbackUrls(mirrorOriginUrl || coverUrl || primaryUrl, {
    width: 1280,
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

function advanceCardImageFallback(
  e: SyntheticEvent<HTMLImageElement>,
  seedUrl: string,
  onExhausted?: (img: HTMLImageElement) => void,
  previewUrl?: string,
): void {
  const img = e.currentTarget
  const normalizedSeed = decodeMediaUrl(seedUrl || "")
  const originFromMirror = extractPixnoyOriginUrl(seedUrl) || extractPixnoyOriginUrl(normalizedSeed)
  const candidates = buildMediaFallbackCandidates(
    img.currentSrc || img.src || normalizedSeed,
    normalizedSeed || seedUrl,
    originFromMirror,
  )
  // Keep the raw (non-normalized) mirror/proxy URL as a fallback.
  // normalizePicnobImageUrl() unwraps mirror proxy URLs (picnob/pixnoy) to direct
  // CDN URLs, but the mirror can still serve images when signed CDN URLs have expired.
  const rawDecoded = decodeHtmlEntitiesUrl(seedUrl || "")
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
          // Also add proxy-wrapped mirror URL as a candidate
          const mirrorProxyFallbacks = getImageProxyFallbackUrls(pUrl, { width: 1280, quality: 85, format: "jpg" })
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

function getRememberedMediaSrc(coverUrl: string, primaryUrl: string): string {
  ensuremediaSrcCacheLoaded()
  const byUrl = mediaSrcCache.get(`url:${normalizeImageCacheKey(coverUrl)}`)
  if (byUrl) {
    if (/^https?:\/\/media\.(picnob|pixnoy)\.[^/]+\/get\?/i.test(byUrl)) {
      mediaSrcCache.delete(`url:${normalizeImageCacheKey(coverUrl)}`)
    } else {
      return byUrl
    }
  }
  return primaryUrl
}

function rememberMediaSrc(coverUrl: string, resolvedSrc: string): void {
  const src = (resolvedSrc || "").trim()
  if (!src) return
  ensuremediaSrcCacheLoaded()
  const urlKey = normalizeImageCacheKey(coverUrl)
  if (urlKey) mediaSrcCache.set(`url:${urlKey}`, src)
  persistmediaSrcCache()
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

function normalizeLooseText(value: string): string {
  return (value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\p{L}\p{N}\p{Script=Han}#@]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Return true when the plain-text summary adds no information beyond the title. */
function isSummaryRedundant(title: string, summary: string): boolean {
  if (!title || !summary || title === "Untitled") return false
  const normT = normalizeLooseText(title)
  const normS = normalizeLooseText(summary)
  // If both normalize to non-empty, compare them
  if (normT && normS) {
    return normS === normT || normS.startsWith(normT) || normT.startsWith(normS)
  }
  // Fallback: compare raw trimmed strings (handles emoji-only content)
  const rawT = title.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  const rawS = summary.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  if (!rawT || !rawS) return false
  return rawS === rawT || rawS.startsWith(rawT) || rawT.startsWith(rawS)
}

function hasVideoMedia(entry: Entry): boolean {
  if ((entry.media || []).some((m) => m.type === "video" && isRenderableVideoMediaItem(m))) return true
  const html = `${entry.content || ""}\n${entry.summary || ""}`
  return /<video\b/i.test(html)
}

function countRenderableImages(entry: Entry): number {
  const keys = new Set<string>()
  for (const media of entry.media || []) {
    const preview = decodeMediaUrl(media.previewUrl || "")
    const primary = decodeMediaUrl(media.url || "")
    if (preview && isLikelyImageByUrl(preview)) keys.add(normalizeImageCacheKey(preview))
    if (primary && isLikelyImageByUrl(primary)) keys.add(normalizeImageCacheKey(primary))
  }
  const imageUrl = decodeMediaUrl(entry.imageUrl || "")
  if (imageUrl && isLikelyImageByUrl(imageUrl)) keys.add(normalizeImageCacheKey(imageUrl))
  for (const img of extractImagesFromHtml(entry.content || entry.summary || "")) {
    const decoded = decodeMediaUrl(img)
    if (decoded && isLikelyImageByUrl(decoded)) keys.add(normalizeImageCacheKey(decoded))
  }
  return keys.size
}

function collectEntryPostHints(entry: Entry): Set<string> {
  const hints = new Set<string>()
  const push = (value: string) => {
    const key = (value || "").trim()
    if (key) hints.add(key)
  }
  const html = `${entry.content || ""}\n${entry.summary || ""}`
  const urls = [
    entry.url || "",
    entry.imageUrl || "",
    ...(entry.media || []).flatMap((m) => [m.url || "", m.previewUrl || ""]),
    ...extractImagesFromHtml(html),
    ...(html.match(/https?:\/\/[^\s"'<>]+/g) || []),
  ].map((u) => decodeMediaUrl(u)).filter(Boolean)

  for (const url of urls) {
    const igCacheKey = extractIgCacheKeyFromUrl(url)
    const base = decodeURIComponent(igCacheKey).split(".")[0] || ""
    if (base) push(`igk:${base}`)
    const shortcode = url.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i)?.[1] || ""
    if (shortcode) push(`igsc:${shortcode}`)
  }

  const textKey = normalizeLooseText(`${entry.title || ""} ${cleanSocialPlainText(html)}`).slice(0, 180)
  if (textKey) push(`txt:${textKey}`)
  return hints
}

function areStronglySameSocialPost(a: Entry, b: Entry): boolean {
  if (a.feedId !== b.feedId) return false
  const delta = Math.abs((a.publishedAt || 0) - (b.publishedAt || 0))
  if (delta > 7 * 24 * 60 * 60 * 1000) return false
  const aHints = collectEntryPostHints(a)
  const bHints = collectEntryPostHints(b)
  for (const hint of aHints) {
    if (bHints.has(hint)) return true
  }
  return false
}

function collapseCoverOnlyBeforeVideoEntries(entries: Entry[]): Entry[] {
  if (entries.length <= 1) return entries
  const compacted: Entry[] = []
  const LOOKAHEAD = 8
  for (let i = 0; i < entries.length; i += 1) {
    const current = entries[i]
    const currentIsSingleCover = !hasVideoMedia(current) && countRenderableImages(current) === 1
    if (currentIsSingleCover) {
      const upper = Math.min(entries.length - 1, i + LOOKAHEAD)
      let shouldMergeBackward = false
      for (let j = i + 1; j <= upper; j += 1) {
        const candidate = entries[j]
        if (!hasVideoMedia(candidate)) continue
        if (areStronglySameSocialPost(current, candidate)) {
          shouldMergeBackward = true
          break
        }
      }
      if (shouldMergeBackward) continue
    }
    compacted.push(current)
  }
  return compacted
}

/** Clean relative time by stripping verbose locale prefixes like the English "about" prefix. */
function cleanRelativeTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date)
  const result = formatDistanceToNow(d, { addSuffix: true, locale: getDateLocale() })
  // Remove verbose prefixes for cleaner display.
  return result.replace(/^about\s*/gi, "").replace(/^大约\s*/g, "")
}

export function EntryList({ width }: { width?: number }) {
  const {
    entries,
    selectedEntry,
    isLoading,
    isLoadingMore,
    hasMoreEntries,
    loadEntries,
    loadMoreEntries,
    clearListCache,
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
  const general = useGeneralSettingsShallowSelector((settings) => ({
    showRecommended: settings.showRecommended,
    groupByDate: settings.groupByDate,
    dimRead: settings.dimRead,
    imageProxy: settings.imageProxy,
  }))
  const { t } = useTranslation()
  const [filterMode, setFilterMode] = useState<"all" | "unread">("all")
  const entryLoadLimit = useMemo(() => getEntryLoadLimit(activeView), [activeView])

  // Context menu state
  const { menuState, showMenu, hideMenu } = useEntryContextMenu()
  // Share poster state
  const [posterEntry, setPosterEntry] = useState<Entry | null>(null)

  const viewDef = activeView !== null ? VIEW_DEFINITIONS[activeView] : null

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
  }, [selectedFeedId, filterMode, loadEntries, viewFeedIds, entryLoadLimit])

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      search(searchQuery)
    },
    [search, searchQuery]
  )

  const feedById = useMemo(() => new Map(feeds.map((f) => [f.id, f] as const)), [feeds])
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
  const reloadCurrentListFresh = useCallback(() => {
    clearListCache()
    reloadCurrentList()
  }, [clearListCache, reloadCurrentList])
  const mediaFailureRefreshAtRef = useRef(new Map<string, number>())
  const mediaFailureRefreshInFlightRef = useRef(new Set<string>())
  const handleEntryMediaAllFailed = useCallback((entry: Entry) => {
    const feedId = entry.feedId
    if (!feedId) return
    if (mediaFailureRefreshInFlightRef.current.has(feedId)) return
    const now = Date.now()
    const last = mediaFailureRefreshAtRef.current.get(feedId) || 0
    const cooldownMs = 20 * 1000
    if (now - last < cooldownMs) return
    mediaFailureRefreshAtRef.current.set(feedId, now)
    mediaFailureRefreshInFlightRef.current.add(feedId)
    void refreshFeed(feedId)
      .then(() => {
        reloadCurrentListFresh()
      })
      .finally(() => {
        mediaFailureRefreshInFlightRef.current.delete(feedId)
      })
  }, [refreshFeed, reloadCurrentListFresh])

  // Build a set of recommended feed IDs so we can exclude their entries
  const recommendedFeedIds = useMemo(
    () => new Set(feeds.filter((f) => f.category === RECOMMENDED_CATEGORY).map((f) => f.id)),
    [feeds],
  )
  const receiveRecommended = general.showRecommended

  // Filter entries by active view (when showing all feeds) - exclude recommended feeds
  const baseFilteredEntries = useMemo(() => {
    const filtered = selectedFeedId
      ? entries
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

    // Safety fallback: in "All" view, if filters accidentally remove everything
    // while entries already exist, show raw entries to avoid blank timeline.
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

  // Picture feed entries must not go through social dedupe because dedupe merges media arrays
  // and can mix photos from different posts into a single card.
  const shouldDedupeSocialEntries = activeView === FeedViewType.SocialMedia
  const { entries: viewFilteredEntries, isProcessing: isSocialDedupeProcessing } = useAsyncSocialDedupe(
    baseFilteredEntries,
    {
      enabled: shouldDedupeSocialEntries,
      cacheKey: `${activeView ?? "all"}:${selectedFeedId ?? "all"}`,
    },
  )

  // Only reuse stale entries in broad scopes (all/view-wide).
  // For a concrete feed selection, showing previous-scope entries causes a visible flash.
  const allowStaleEntriesWhileLoading = !selectedFeedId
  const hasStaleEntriesWhileLoading =
    allowStaleEntriesWhileLoading
    && (isLoading || isSocialDedupeProcessing)
    && viewFilteredEntries.length === 0
    && entries.length > 0
  const baseRenderEntries = hasStaleEntriesWhileLoading ? entries : viewFilteredEntries
  const renderEntries = useMemo(
    () => activeView === FeedViewType.SocialMedia
      ? collapseCoverOnlyBeforeVideoEntries(baseRenderEntries)
      : baseRenderEntries,
    [activeView, baseRenderEntries],
  )
  const entryIndexById = useMemo(
    () => new Map(renderEntries.map((entry, index) => [entry.id, index] as const)),
    [renderEntries],
  )
  const groupedRenderEntries = useMemo(
    () => general.groupByDate ? groupEntriesByDate(renderEntries) : [],
    [general.groupByDate, renderEntries],
  )
  const useVirtualSocialList = activeView === FeedViewType.SocialMedia
  const socialRows = useMemo(() => {
    if (!useVirtualSocialList) return []
    if (general.groupByDate) {
      return groupedRenderEntries.flatMap((group) => [
        {
          key: `header:${group.labelKey}:${group.label}`,
          type: "header" as const,
          labelKey: group.labelKey,
          label: group.label,
        },
        ...group.entries.map((entry) => ({
          key: entry.id,
          type: "entry" as const,
          entry,
          entryIndex: entryIndexById.get(entry.id) ?? 0,
        })),
      ])
    }
    return renderEntries.map((entry, index) => ({
      key: entry.id,
      type: "entry" as const,
      entry,
      entryIndex: index,
    }))
  }, [entryIndexById, general.groupByDate, groupedRenderEntries, renderEntries, useVirtualSocialList])
  const isGridMode = viewDef?.gridMode ?? false
  const listScrollRef = useRef<HTMLDivElement>(null)
  const lastScrollScopeRef = useRef<string>("")
  const useVirtualLinearList = !isGridMode && activeView !== FeedViewType.SocialMedia
  const virtualizerEntries = useMemo(
    () => useVirtualLinearList ? renderEntries : [],
    [renderEntries, useVirtualLinearList],
  )
  const linearListVirtualizer = useVirtualizer({
    count: virtualizerEntries.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 180,
    overscan: 8,
    getItemKey: (index) => virtualizerEntries[index]?.id ?? index,
  })
  const virtualItems = linearListVirtualizer.getVirtualItems()
  // Progressive grid rendering: start with a batch and grow on scroll
  const GRID_INITIAL_COUNT = 40
  const GRID_LOAD_MORE_COUNT = 40
  const [gridVisibleCount, setGridVisibleCount] = useState(GRID_INITIAL_COUNT)
  // Reset visible count when the entries change (e.g. switching feeds/views)
  const gridEntriesKeyRef = useRef("")
  const gridEntriesKey = isGridMode ? `${activeView}:${selectedFeedId ?? ""}:${renderEntries.length}` : ""
  if (gridEntriesKey !== gridEntriesKeyRef.current) {
    gridEntriesKeyRef.current = gridEntriesKey
    if (gridVisibleCount !== GRID_INITIAL_COUNT) setGridVisibleCount(GRID_INITIAL_COUNT)
  }
  const gridEntries = useMemo(() => {
    if (!isGridMode) return []
    return renderEntries.slice(0, gridVisibleCount)
  }, [isGridMode, renderEntries, gridVisibleCount])
  const hasMoreGridEntries = isGridMode && gridVisibleCount < renderEntries.length
  const gridRows = useMemo(() => {
    if (!isGridMode) return []
    const rows: Entry[][] = []
    for (let index = 0; index < gridEntries.length; index += 2) {
      rows.push(gridEntries.slice(index, index + 2))
    }
    return rows
  }, [isGridMode, gridEntries])
  const gridRowVirtualizer = useVirtualizer({
    count: gridRows.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 280,
    overscan: 3,
    getItemKey: (index) => gridRows[index]?.map((entry) => entry.id).join(":") ?? index,
  })
  const gridVirtualRows = gridRowVirtualizer.getVirtualItems()

  const socialListVirtualizer = useVirtualizer({
    count: socialRows.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: (index) => socialRows[index]?.type === "header" ? 40 : 420,
    overscan: 3,
    getItemKey: (index) => socialRows[index]?.key ?? index,
  })
  const socialVirtualRows = socialListVirtualizer.getVirtualItems()

  useEffect(() => {
    const nextScope = `${activeView ?? "all"}:${selectedFeedId ?? "all"}`
    if (lastScrollScopeRef.current === nextScope) return
    lastScrollScopeRef.current = nextScope
    const el = listScrollRef.current
    if (!el) return
    el.scrollTo({ top: 0, behavior: "auto" })
  }, [activeView, selectedFeedId])

  const handleListScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const hasScrolledEnough = el.scrollTop > 120
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 600

    if (isGridMode && hasMoreGridEntries && hasScrolledEnough && nearBottom) {
      setGridVisibleCount((prev) => Math.min(prev + GRID_LOAD_MORE_COUNT, renderEntries.length))
    }
    if (!searchQuery.trim() && hasMoreEntries && !isLoadingMore && hasScrolledEnough && nearBottom) {
      void loadMoreEntries()
    }
  }, [hasMoreEntries, hasMoreGridEntries, isGridMode, isLoadingMore, loadMoreEntries, renderEntries.length, searchQuery])


  const renderLinearEntry = useCallback((entry: Entry) => {
    return (
      <EntryCard
        entry={entry}
        isActive={selectedEntry?.id === entry.id}
        onSelect={() => selectEntry(entry)}
        feedTitle={feedById.get(entry.feedId)?.title}
        dimRead={general.dimRead}
        imageProxy={general.imageProxy}
        onContextMenu={(e) => showMenu(e, entry.id)}
      />
    )
  }, [feedById, general.dimRead, general.imageProxy, selectEntry, selectedEntry?.id, showMenu])

  return (
    <div
      className="flex flex-col border-r bg-white dark:bg-surface-dark flex-shrink-0"
      style={{ width: width ?? (isGridMode ? 480 : 340) }}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold truncate flex items-center gap-2">
            {viewDef && <span className={viewDef.color}>{title}</span>}
            {!viewDef && title}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                if (selectedFeedId && selectedFeedId !== "starred") {
                  await refreshFeed(selectedFeedId)
                } else if (activeView !== null) {
                  const viewFeedIds = feeds
                    .filter((f) => (f.view ?? FeedViewType.Articles) === activeView)
                    .map((f) => f.id)
                  await refreshMultiple(viewFeedIds)
                } else {
                  await refreshAll()
                }
                reloadCurrentListFresh()
              }}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary disabled:opacity-50"
              title={t("common.refresh")}
            >
              <RefreshCw size={16} className={`text-text-secondary dark:text-text-dark-secondary ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => markAllRead(selectedFeedId || undefined)}
              className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              title={t("common.markAllRead")}
            >
              <CheckCheck size={16} className="text-text-secondary dark:text-text-dark-secondary" />
            </button>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative">
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

        {isRefreshing && refreshProgress && refreshProgress.total > 0 && (
          <div className="space-y-1">
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

      {/* Entry list */}
      <div
        ref={listScrollRef}
        className="flex-1 overflow-y-auto"
        id="entry-list-scroll"
        onScroll={handleListScroll}
      >
        {isLoading && !hasStaleEntriesWhileLoading ? (
          <SkeletonList
            count={6}
            type={activeView === FeedViewType.SocialMedia ? "social" :
                  isGridMode ? "grid" : "article"}
          />
        ) : renderEntries.length === 0 ? (
          selectedFeedId && selectedFeedId !== "starred" ? (
            /* A specific feed is selected but has no entries - offer refresh */
            <div className="flex flex-col items-center justify-center py-12 text-text-secondary dark:text-text-dark-secondary">
              <Inbox size={40} className="mb-3 text-text-tertiary" />
              <p className="text-sm">{t("entryList.noArticles")}</p>
              <button
                onClick={async () => {
                  await refreshFeed(selectedFeedId)
                  clearListCache()
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
        ) : activeView === FeedViewType.SocialMedia ? (
          /* Social/Pictures timeline layout: virtualized to avoid mounting the whole feed at once */
          <div className="relative" style={{ height: `${socialListVirtualizer.getTotalSize()}px` }}>
            {socialVirtualRows.map((row) => {
              const item = socialRows[row.index]
              if (!item) return null
              return (
                <div
                  key={row.key}
                  data-index={row.index}
                  ref={socialListVirtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${row.start}px)` }}
                >
                  {item.type === "header" ? (
                    <div className="h-9 flex items-center border-b border-transparent bg-white/80 dark:bg-surface-dark/80 backdrop-blur-sm">
                      <div className="m-auto flex w-full max-w-[clamp(45ch,60vw,65ch)] select-none gap-3 pl-4 text-sm font-bold text-text dark:text-text-dark">
                        <span>{t(item.labelKey, item.labelKey === "entryList.daysAgo" ? { days: item.label.match(/\d+/)?.[0] } : undefined) || item.label}</span>
                      </div>
                    </div>
                  ) : (
                    <SocialMediaItem
                      entry={item.entry}
                      isActive={selectedEntry?.id === item.entry.id}
                      onSelect={() => selectEntry(item.entry)}
                      feedTitle={feedById.get(item.entry.feedId)?.title}
                      feedImage={feedById.get(item.entry.feedId)?.imageUrl}
                      feedSiteUrl={feedById.get(item.entry.feedId)?.siteUrl}
                      feedUrl={feedById.get(item.entry.feedId)?.url}
                      entryIndex={item.entryIndex}
                      totalEntries={renderEntries.length}
                      onMarkAboveRead={() => markAboveRead(item.entry.id)}
                      onMarkBelowRead={() => markBelowRead(item.entry.id)}
                      onContextMenu={(e) => showMenu(e, item.entry.id)}
                dimRead={general.dimRead}
                      onMediaAllFailed={() => handleEntryMediaAllFailed(item.entry)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ) : isGridMode ? (
          /* Grid layout for Videos/Pictures */
          <>
          <div className="relative" style={{ height: `${gridRowVirtualizer.getTotalSize()}px` }}>
            {gridVirtualRows.map((row) => {
              const rowEntries = gridRows[row.index]
              if (!rowEntries || rowEntries.length === 0) return null
              return (
                <div
                  key={row.key}
                  data-index={row.index}
                  ref={gridRowVirtualizer.measureElement}
                  className="absolute left-0 top-0 w-full px-4"
                  style={{ transform: `translateY(${row.start}px)`, paddingTop: row.index === 0 ? "1rem" : "0.375rem" }}
                >
                  <div className="grid grid-cols-2 gap-1.5">
                    {rowEntries.map((entry) => (
                      <GridCard
                        key={entry.id}
                        entry={entry}
                        isActive={selectedEntry?.id === entry.id}
                        onSelect={() => selectEntry(entry)}
                        feedTitle={feedById.get(entry.feedId)?.title}
                        feedImage={feedById.get(entry.feedId)?.imageUrl}
                        isVideo={activeView === FeedViewType.Videos}
                      />
                    ))}
                    {rowEntries.length === 1 && <div aria-hidden="true" />}
                  </div>
                </div>
              )
            })}
          </div>
          {hasMoreGridEntries && (
            <div className="flex items-center justify-center py-4 text-text-tertiary">
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
          </>
        ) : useVirtualLinearList ? (
          <div className="relative" style={{ height: `${linearListVirtualizer.getTotalSize()}px` }}>
            {virtualItems.map((item) => {
              const entry = virtualizerEntries[item.index]
              if (!entry) return null
              return (
                <div
                  key={entry.id}
                  data-index={item.index}
                  ref={linearListVirtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  {renderLinearEntry(entry)}
                </div>
              )
            })}
          </div>
        ) : (
          renderEntries.map((entry) => (
            <div key={entry.id}>
              {renderLinearEntry(entry)}
            </div>
          ))
        )}

        {isLoadingMore && (
          <div className="flex items-center justify-center py-4 text-text-tertiary">
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}

        {/* Context Menu */}
        {menuState.visible && menuState.entryId && (() => {
          const menuEntry = renderEntries.find((e) => e.id === menuState.entryId)
          if (!menuEntry) return null
          const menuIndex = renderEntries.findIndex((e) => e.id === menuState.entryId)
          return (
            <EntryContextMenuWrapper
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
    </div>
  )
}

/** Context menu wrapper for entry items */
function EntryContextMenuWrapper({
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

/** Standard list item card */
function EntryCard({
  entry,
  isActive,
  onSelect,
  feedTitle,
  dimRead,
  imageProxy,
  onContextMenu,
}: {
  entry: Entry
  isActive: boolean
  onSelect: () => void
  feedTitle?: string
  dimRead?: boolean
  imageProxy?: boolean
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const timeAgo = formatDistanceToNow(new Date(entry.publishedAt), {
    addSuffix: true,
    locale: getDateLocale(),
  })

  // Thumbnail: prefer first media photo, then imageUrl, then extract from content.
  // Use previewUrl (stable mirror proxy) when available instead of url (expiring CDN).
  const firstPhoto = entry.media?.find((m) => m.type === "photo")
  const rawThumbnail = firstPhoto?.previewUrl
    ? decodeHtmlEntitiesUrl(firstPhoto.previewUrl)
    : decodeMediaUrl(
        firstPhoto?.url ||
        entry.media?.find((m) => m.type === "video")?.previewUrl ||
        entry.imageUrl ||
        ""
      )
  const thumbnail = rawThumbnail && imageProxy ? getThumbnailUrl(rawThumbnail, 80) : rawThumbnail

  const hasThumbnail = !!thumbnail

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      onContextMenu={onContextMenu}
      className={`w-full text-left px-4 py-3.5 border-b border-surface-secondary dark:border-surface-dark-tertiary transition-colors cursor-pointer ${
        isActive
          ? "bg-accent/5 border-l-2 !border-l-accent"
          : "hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
      } ${dimRead && entry.isRead && !isActive ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Unread indicator */}
        {!entry.isRead && (
          <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />
        )}

        <div className="flex-1 min-w-0" style={{ maxWidth: hasThumbnail ? "calc(100% - 92px)" : undefined }}>
          {/* Feed name + time */}
          <div className="flex items-center gap-1 text-[10px] font-bold text-text-secondary dark:text-text-dark-secondary mb-0.5">
            {feedTitle && <span className="truncate max-w-[120px]">{feedTitle}</span>}
            {feedTitle && <span className="text-text-tertiary">·</span>}
            <span className="text-text-tertiary flex-shrink-0">{timeAgo}</span>
            {entry.isStarred && <Star size={10} className="text-yellow-500 fill-yellow-500 flex-shrink-0" />}
          </div>

          {entry.title ? (
            <h3
              className={`text-sm leading-snug line-clamp-2 ${
                entry.isRead ? "text-text-secondary dark:text-text-dark-secondary" : "font-medium"
              }`}
            >
              {entry.title}
            </h3>
          ) : (() => {
            const fallback = (entry.summary || entry.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            return fallback ? (
              <h3
                className={`text-sm leading-snug line-clamp-2 ${
                  entry.isRead ? "text-text-secondary dark:text-text-dark-secondary" : "font-medium"
                }`}
              >
                {fallback}
              </h3>
            ) : null
          })()}

          {entry.title && entry.summary && !isSummaryRedundant(entry.title, entry.summary) && (() => {
            const cleanSummary = entry.summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            return cleanSummary ? (
              <p className="text-[13px] text-text-secondary dark:text-text-dark-secondary mt-0.5 line-clamp-2 leading-snug">
                {cleanSummary}
              </p>
            ) : null
          })()}
        </div>

        {/* Compact 80x80 thumbnail */}
        {hasThumbnail && (
          <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-surface-tertiary dark:bg-surface-dark-tertiary">
            <img
              src={thumbnail}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                advanceCardImageFallback(e, rawThumbnail, (img) => {
                  img.parentElement!.style.display = "none"
                })
              }}
            />
          </div>
        )}
      </div>
    </article>
  )
}

/** Grid card for media/video view */
export const GridCard = memo(function GridCard({
  entry,
  isActive,
  onSelect,
  onContextMenu,
  feedTitle,
  feedImage,
  isVideo,
}: {
  entry: Entry
  isActive: boolean
  onSelect: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  feedTitle?: string
  feedImage?: string
  isVideo?: boolean
}) {
  const { t } = useTranslation()
  const photoCovers = useMemo(() => {
    const unique: string[] = []
    const push = (value: string) => {
      const candidate = decodeMediaUrl(value || "").trim()
      if (!candidate || !isLikelyImageByUrl(candidate)) return
      const key = normalizeImageCacheKey(candidate)
      if (!key) return
      if (unique.some((u) => normalizeImageCacheKey(u) === key)) return
      unique.push(candidate)
    }

    for (const media of entry.media || []) {
      if (media.type !== "photo") continue
      push(media.previewUrl || "")
      push(media.url || "")
      if (unique.length >= 4) break
    }
    if (unique.length === 0) push(entry.imageUrl || "")
    return unique.slice(0, 4)
  }, [entry.imageUrl, entry.media])

  // Find the best image: first media photo/video, then imageUrl, then YouTube thumbnail from URL
  const coverUrl = (() => {
    const fromValidatedPhotos = photoCovers[0] || ""
    if (fromValidatedPhotos) return fromValidatedPhotos

    const fromMediaCandidates = [
      ...(entry.media || []).flatMap((media) => [media.previewUrl || "", media.url || ""]),
      entry.imageUrl || "",
    ]
      .map((value) => decodeMediaUrl(value))
      .find((value) => !!value && isLikelyImageByUrl(value)) || ""
    if (fromMediaCandidates) return fromMediaCandidates

    // Derive YouTube thumbnail from entry URL
    const ytMatch = (entry.url || "").match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/,
    )
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`
    return ""
  })()
  const cleanFeedAvatar = useMemo(() => {
    const candidate = normalizeInstagramUnavatar(feedImage || "")
    return candidate && !isGenericInstagramIconUrl(candidate) ? candidate : ""
  }, [feedImage])
  const avatarCandidates = useMemo(() => {
    const candidates = [cleanFeedAvatar, extractPixnoyOriginUrl(cleanFeedAvatar)]
    const unique: string[] = []
    for (const c of candidates) {
      const candidate = (c || "").trim()
      if (!candidate || !/^https?:\/\//i.test(candidate)) continue
      const key = normalizeImageCacheKey(candidate)
      if (unique.some((u) => normalizeImageCacheKey(u) === key)) continue
      unique.push(candidate)
    }
    return unique
  }, [cleanFeedAvatar])
  const [avatarCandidateIndex, setAvatarCandidateIndex] = useState(0)
  const [avatarImageFailed, setAvatarImageFailed] = useState(false)
  useEffect(() => {
    setAvatarCandidateIndex(0)
    setAvatarImageFailed(false)
  }, [entry.id, avatarCandidates])
  const avatarUrl = avatarCandidates[avatarCandidateIndex] || ""
  const avatarLetter = (feedTitle || "?")[0]

  return (
    <button
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`w-full text-left rounded-xl overflow-hidden border transition-all ${
        isActive
          ? "border-accent ring-2 ring-accent/30"
          : "border-transparent hover:border-border dark:hover:border-surface-dark-tertiary"
      } bg-surface-secondary dark:bg-surface-dark-secondary`}
    >
      {/* Cover image */}
      <div className="relative aspect-[4/3] bg-surface-tertiary dark:bg-surface-dark-tertiary">
        {!isVideo && photoCovers.length > 1 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[1px] bg-black/10">
            {photoCovers.map((src, idx) => (
              <img
                key={`${entry.id}:photo:${idx}`}
                src={src}
                alt=""
                className="h-full w-full object-cover"
                loading={idx === 0 ? "eager" : "lazy"}
                onError={(e) => {
                  advanceCardImageFallback(e, src, (img) => {
                    img.style.display = "none"
                  })
                }}
              />
            ))}
          </div>
        ) : coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              advanceCardImageFallback(e, coverUrl, (img) => {
                const root = img.closest("button") as HTMLElement | null
                if (root) {
                  root.style.display = "none"
                } else {
                  img.style.display = "none"
                }
              })
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-tertiary">
            {isVideo ? <Play size={32} /> : <Inbox size={32} />}
          </div>
        )}
        {isVideo && coverUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
              <Play size={18} className="text-white ml-0.5" fill="white" />
            </div>
          </div>
        )}
        {/* Video duration badge */}
        {isVideo && (() => {
          const videoMedia = entry.media?.find((m) => m.type === "video")
          if (videoMedia?.duration && videoMedia.duration > 0) {
            const d = videoMedia.duration
            const h = Math.floor(d / 3600)
            const m = Math.floor((d % 3600) / 60)
            const s = Math.floor(d % 60)
            const formatted = h > 0
              ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
              : `${m}:${String(s).padStart(2, "0")}`
            return (
              <div className="absolute bottom-2 left-2 bg-black/75 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                {formatted}
              </div>
            )
          }
          return null
        })()}
        {!entry.isRead && (
          <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-accent" />
        )}
        {entry.media && entry.media.filter((m) => m.type === "photo").length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
            {entry.media.filter((m) => m.type === "photo").length} {t("entryList.images")}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        {(() => {
          const displayTitle = entry.title || (entry.summary || entry.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        return displayTitle ? (
          <h3 className={`text-xs leading-snug truncate whitespace-nowrap ${entry.isRead ? "text-text-secondary dark:text-text-dark-secondary" : "font-medium"}`}>
            {displayTitle}
          </h3>
        ) : null
      })()}
        <div className="flex items-center justify-between mt-1 text-[10px] text-text-tertiary">
          <div className="flex items-center gap-1 min-w-0">
            <span className="w-4 h-4 rounded-full overflow-hidden bg-surface-tertiary dark:bg-surface-dark-tertiary flex-shrink-0 flex items-center justify-center text-[9px] uppercase text-text-secondary dark:text-text-dark-secondary">
              {avatarUrl && !avatarImageFailed ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
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
                avatarLetter
              )}
            </span>
            {feedTitle && <span className="truncate text-[11px] font-medium min-w-0">{feedTitle}</span>}
          </div>
          {entry.publishedAt && (
            <span className="flex-shrink-0 whitespace-nowrap text-[10px] ml-2">
              {cleanRelativeTime(entry.publishedAt)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
})

export const SocialMediaItem = memo(function SocialMediaItem({
  entry,
  isActive,
  onSelect,
  onDoubleClick,
  feedTitle,
  feedImage,
  feedSiteUrl,
  feedUrl,
  entryIndex: _entryIndex,
  totalEntries: _totalEntries,
  onMarkAboveRead: _onMarkAboveRead,
  onMarkBelowRead: _onMarkBelowRead,
  onContextMenu,
  dimRead,
  onOpenBilibiliInPage,
  onMediaAllFailed,
}: {
  entry: Entry
  isActive: boolean
  onSelect: () => void
  onDoubleClick?: () => void
  feedTitle?: string
  feedImage?: string
  feedSiteUrl?: string
  feedUrl?: string
  entryIndex?: number
  totalEntries?: number
  onMarkAboveRead?: () => void
  onMarkBelowRead?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  dimRead?: boolean
  onOpenBilibiliInPage?: (entry: Entry, url: string) => void
  onMediaAllFailed?: () => void
}) {
  const { t } = useTranslation()
  const allEntries = useEntryStore((s) => s.entries)

  // Parse social media handle from URL
  const canonicalEntryUrl = useMemo(() => canonicalizeSocialUrl(entry.url || ""), [entry.url])
  const parsed = parseSocialHandle(canonicalEntryUrl)
  const authorName = useMemo(() => {
    if (parsed.type === "x") {
      const feedDisplayName = extractTwitterDisplayNameFromFeedTitle(feedTitle, parsed.handle)
      if (feedDisplayName) return feedDisplayName
    }
    return (entry.author || feedTitle || parsed.handle || "").replace(/^@+/, "").trim()
  }, [entry.author, feedTitle, parsed.type, parsed.handle])

  const timeAgo = cleanRelativeTime(entry.publishedAt)

  // Content: prefer HTML content, fallback to summary
  const htmlContent = entry.content || entry.summary || ""
  // Sanitize HTML and strip media tags for inline display
  const sanitizedContent = useMemo(() => {
    if (!htmlContent.includes("<")) return ""
    return cleanSocialTextHtml(htmlContent)
  }, [htmlContent])
  // Plain text fallback
  const plainContent = useMemo(() => {
    const source = sanitizedContent || htmlContent
    const cleaned = cleanSocialPlainText(source)
    if (cleaned) return cleaned
    return (entry.title || "").trim()
  }, [sanitizedContent, htmlContent, entry.title])
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
  // Folo-style: trust entry.media directly, only filter truly decorative assets and dedup by URL
  const photos = useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{ url: string; previewUrl?: string; width?: number; height?: number; blurhash?: string }> = []
    for (const m of entry.media || []) {
      if (m.type !== "photo" && !isLikelyImageByUrl(m.url || m.previewUrl || "")) continue
      const decoded = decodeMediaUrls(m)
      if (isDecorativeSocialImageUrl(decoded.url || decoded.previewUrl || "")) continue
      if (hasTinyDecorativeDimensions(decoded.width, decoded.height)) continue
      const key = (decoded.url || "").toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      result.push(decoded)
    }
    if (result.length > 0) return result
    const fallback = entry.imageUrl ? decodeMediaUrl(entry.imageUrl) : ""
    return fallback && isLikelyImageByUrl(fallback) ? [{ url: fallback }] : []
  }, [entry.media, entry.imageUrl])
  const videos = useMemo(
    () => {
      return (entry.media || [])
        .filter((m) => {
          if (m.type !== "video") return false
          const url = decodeMediaUrl(m.url || "").toLowerCase()
          const preview = decodeMediaUrl(m.previewUrl || "").toLowerCase()
          if (isLikelyImageByUrl(url) || isLikelyImageByUrl(preview)) return false
          return true
        })
        .map(decodeMediaUrls)
        .filter((m) => isRenderableVideoMediaItem(m))
    },
    [entry.media],
  )
  const [isMediaExpanded, setIsMediaExpanded] = useState(() => mediaExpandedCache.get(entry.id) ?? false)
  useEffect(() => {
    mediaExpandedCache.set(entry.id, isMediaExpanded)
  }, [entry.id, isMediaExpanded])
  const hasBilibiliPageVideo = useMemo(
    () => videos.some((video) => /(?:^|\.)bilibili\.com\/video\/|(?:^|\.)b23\.tv\//i.test((video.url || "").toLowerCase())),
    [videos],
  )
  const visibleVideos = useMemo(() => {
    if (videos.length === 0) return videos
    const fallbackPreview = photos[0]?.url || relatedEntryFallback?.cover || entry.imageUrl || ""
    return videos.map((video) => {
      const rawPreview = decodeMediaUrl(video.previewUrl || "")
      const validPreview = rawPreview && isLikelyImageByUrl(rawPreview) ? rawPreview : ""
      if (validPreview) return { ...video, previewUrl: validPreview }
      if (!fallbackPreview) return video
      const fallback = decodeMediaUrl(fallbackPreview)
      if (!fallback || !isLikelyImageByUrl(fallback)) return video
      return { ...video, previewUrl: fallback }
    })
  }, [videos, photos, relatedEntryFallback, entry.imageUrl])
  const galleryPhotos = hasBilibiliPageVideo ? [] : photos
  const hasMirrorDerivedPhotoContent = useMemo(
    () => /media\.(?:picnob|pixnoy|piokok|pixwox)\.|sp\d+\.pixnoy\./i.test(`${entry.content || ""}\n${entry.summary || ""}`),
    [entry.content, entry.summary],
  )
  const visibleGalleryPhotos = galleryPhotos.length > 9 && !isMediaExpanded
    ? galleryPhotos.slice(0, 9)
    : galleryPhotos

  // Collapsible content area for long social posts.
  const contentRef = useRef<HTMLDivElement>(null)
  const CONTENT_COLLAPSE_HEIGHT = 220
  const [isOverflow, setIsOverflow] = useState(false)
  const [isExpanded, setIsExpanded] = useState(() => expandedCache.get(entry.id) ?? false)

  useLayoutEffect(() => {
    if (contentRef.current) {
      setIsOverflow(contentRef.current.scrollHeight > CONTENT_COLLAPSE_HEIGHT)
    }
  }, [sanitizedContent, plainContent])

  // Sync expand state to LRU cache
  useEffect(() => {
    expandedCache.set(entry.id, isExpanded)
  }, [isExpanded, entry.id])

  // Smart avatar: use unavatar.io for Twitter/X feeds (always-fresh),
  // Detect from siteUrl (x.com/user) or feedUrl (rsshub /twitter/user/xxx)
  const twitterAvatar = useMemo(() => {
    if (feedSiteUrl) {
      try {
        const { hostname, pathname } = new URL(feedSiteUrl)
        if (hostname === "x.com" || hostname === "twitter.com" || hostname === "www.x.com" || hostname === "www.twitter.com") {
          const username = pathname.split("/").filter(Boolean)[0]
          if (username && /^[a-zA-Z0-9_]+$/.test(username)) {
            return `https://unavatar.io/x/${username}`
          }
        }
      } catch {}
    }
    if (feedUrl) {
      const m = feedUrl.match(/\/twitter\/user\/([a-zA-Z0-9_]+)/i)
      if (m) {
        return `https://unavatar.io/x/${m[1]}`
      }
    }
    return null
  }, [feedSiteUrl, feedUrl])
  const [avatarImageFailed, setAvatarImageFailed] = useState(false)
  const cleanAuthorAvatar = useMemo(() => {
    const candidate = normalizeInstagramUnavatar(entry.authorAvatar || "")
    return candidate && !isGenericInstagramIconUrl(candidate) ? candidate : ""
  }, [entry.authorAvatar])
  const cleanFeedImage = useMemo(() => {
    const candidate = normalizeInstagramUnavatar(feedImage || "")
    return candidate && !isGenericInstagramIconUrl(candidate) ? candidate : ""
  }, [feedImage])
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
  const avatarLetter = (entry.author || feedTitle || "?")[0]

  // AI translation & summary state (per-tweet, with LRU cache persistence)
  const language = useGeneralSettingKey("language")
  const targetLanguage = useTranslationSettingKey("targetLanguage")
  const [tweetTranslatedParagraphs, setTweetTranslatedParagraphs] = useState<string[]>(() => tweetTranslationCache.get(entry.id) ?? [])
  const [tweetSummary, setTweetSummary] = useState<string | null>(() => tweetSummaryCache.get(entry.id) ?? null)
  const [isTranslatingTweet, setIsTranslatingTweet] = useState(false)
  const [isSummarizingTweet, setIsSummarizingTweet] = useState(false)
  const [showTweetTranslation, setShowTweetTranslation] = useState(() => tweetTranslationCache.has(entry.id))
  const [showTweetSummary, setShowTweetSummary] = useState(() => tweetSummaryCache.has(entry.id))

  const tweetTextContent = useMemo(() => {
    const cleaned = cleanSocialPlainText(entry.content || entry.summary || "")
    if (cleaned) return cleaned
    return (entry.title || "").trim()
  }, [entry.content, entry.summary, entry.title])

  // Split content into paragraphs for bilingual translation
  const tweetParagraphs = useMemo(() => {
    const html = sanitizedContent || entry.content || entry.summary || ""
    if (html.includes("<")) {
      const safe = cleanSocialTextHtml(html)
      if (safe.trim()) return splitIntoParagraphs(safe)
    }
    const plain = cleanSocialPlainText(html)
    if (!plain) {
      const titleFallback = (entry.title || "").trim()
      return titleFallback ? [titleFallback] : []
    }
    // Split plain text by newlines so bilingual translation interleaves per paragraph
    const lines = plain.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    return lines.length > 0 ? lines : [plain]
  }, [entry.content, entry.summary, entry.title, sanitizedContent])

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
    const targetLang = targetLanguage || language || "zh-CN"
    const results: string[] = []
    for (let i = 0; i < tweetParagraphs.length; i++) {
      const plainText = tweetParagraphs[i].replace(/<[^>]*>/g, "").trim()
      if (!plainText || plainText.length < 5) {
        results.push("")
        continue
      }
      try {
        const result = await window.api.ai.translate(tweetParagraphs[i], targetLang)
        if (result.success) {
          results.push(result.translation)
        } else {
          results.push(`<span class="text-red-400 text-xs">\u274c</span>`)
        }
      } catch {
        results.push(`<span class="text-red-400 text-xs">\u274c</span>`)
      }
      setTweetTranslatedParagraphs([...results])
    }
    tweetTranslationCache.set(entry.id, results)
    setIsTranslatingTweet(false)
  }, [entry.id, language, showTweetTranslation, targetLanguage, tweetParagraphs, tweetTranslatedParagraphs.length])

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
        language || "zh-CN"
      )
      if (result.success) {
        setTweetSummary(result.summary)
        tweetSummaryCache.set(entry.id, result.summary)
      } else {
        setTweetSummary(`Error: ${result.error}`)
      }
    } catch (err) {
      setTweetSummary(`Error: ${String(err)}`)
    }
    setIsSummarizingTweet(false)
  }, [entry.id, language, showTweetSummary, tweetSummary, tweetTextContent])

  // Hover action bar state
  const [showActionBar, setShowActionBar] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => setShowActionBar(true), 150)
  }, [])
  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    setShowActionBar(false)
  }, [])

  const handleSelect = useCallback(() => {
    pauseInlineVideos()
    onSelect()
  }, [onSelect])

  return (
    <article
      onClick={handleSelect}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.() }}
      onContextMenu={onContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative max-w-[clamp(45ch,60vw,65ch)] mx-auto pl-4 pr-3 cursor-pointer transition-colors duration-200 rounded-md @container ${
        isActive ? "bg-accent/10" : "hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
      } ${dimRead && entry.isRead && !isActive ? "opacity-50" : ""}`}
    >
      {/* Floating hover action bar */}
      {showActionBar && !isActive && (
        <SocialActionBar
          entry={entry}
          browserOpenUrl={browserOpenUrl}
          onContextMenu={onContextMenu}
          onTranslate={handleTranslateTweet}
          onSummarize={handleSummarizeTweet}
          isTranslating={isTranslatingTweet}
          isSummarizing={isSummarizingTweet}
          hasTranslation={tweetTranslatedParagraphs.length > 0}
          showTranslation={showTweetTranslation}
        />
      )}

      <div
        className={`relative flex py-4 group ${
          !entry.isRead
            ? "before:absolute before:-left-3 before:top-8 before:block before:size-2 before:rounded-full before:bg-accent"
            : ""
        }`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          {avatarUrl && !avatarImageFailed ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
              referrerPolicy="no-referrer"
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
            <div className="w-8 h-8 rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary flex items-center justify-center text-sm font-bold text-text-secondary">
              {avatarLetter}
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="ml-2 min-w-0 flex-1">
          {/* Author line */}
          <div className="-mt-0.5 flex-1 text-sm">
            <div className="flex select-none flex-wrap space-x-1 leading-6">
              <span className="inline-flex min-w-0 items-center gap-1 text-base font-semibold">
                {authorName}
                {parsed.type === "x" && (
                  <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#4A99E9] inline-block" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                )}
                {parsed.type === "telegram" && (
                  <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#26A5E4] inline-block" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                )}
                {parsed.type === "bluesky" && (
                  <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#0085FF] inline-block" fill="currentColor">
                    <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.627 3.588 3.476 6.182 3.21l.206-.043c-2.87.482-6.082 1.563-6.082 5.609 0 4.051 4.494 3.693 6.137 3.051 3.09-1.208 4.343-4.514 4.635-6.117l.298.052c.291 1.603 1.542 4.909 4.632 6.117 1.643.642 6.137 1 6.137-3.051 0-4.046-3.212-5.127-6.082-5.609l.206.043c2.594.266 5.397-.583 6.182-3.21.246-.828.624-5.79.624-6.479 0-.688-.139-1.86-.902-2.203-.659-.299-1.664-.621-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8"/>
                  </svg>
                )}
                {parsed.type === "threads" && (
                  <svg viewBox="0 0 24 24" className="w-3 h-3 text-black dark:text-white inline-block" fill="currentColor">
                    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.19.408-2.285 1.33-3.082.88-.762 2.098-1.2 3.528-1.271 1.194-.06 2.3.076 3.29.378-.064-.349-.166-.676-.31-.978-.537-1.132-1.555-1.73-2.943-1.73h-.094c-.86.013-1.593.313-2.114.868l-1.37-1.508c.855-.775 2.006-1.2 3.338-1.23h.142c2.085 0 3.674.984 4.468 2.764.366.82.576 1.758.634 2.8.598.265 1.14.59 1.62.977 1.178.948 1.91 2.21 2.078 3.658.195 1.671-.331 3.396-1.48 4.854C17.95 22.78 15.618 23.976 12.186 24m-1.638-8.758c-1.035.055-1.75.462-2.076.814-.392.432-.575.96-.547 1.53.042.782.44 1.387 1.154 1.75.596.306 1.355.395 2.079.36 1.238-.067 2.198-.55 2.774-1.382.385-.554.639-1.265.748-2.124-.736-.26-1.567-.406-2.5-.401-.551.003-1.081.12-1.632.453"/>
                  </svg>
                )}
              </span>
              {parsed.handle && (
                normalizeSocialHandle(parsed.handle).toLowerCase() !== normalizeSocialHandle(authorName).toLowerCase() && (
                <a
                  href={
                    parsed.type === "x" ? `https://x.com/${normalizeSocialHandle(parsed.handle)}` :
                    parsed.type === "telegram" ? `https://t.me/${parsed.handle}` :
                    parsed.type === "bluesky" ? `https://bsky.app/profile/${parsed.handle}` :
                    parsed.type === "threads" ? `https://www.threads.net/@${normalizeSocialHandle(parsed.handle)}` :
                    parsed.type === "truth" ? `https://truthsocial.com/@${normalizeSocialHandle(parsed.handle)}` :
                    "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  @{normalizeSocialHandle(parsed.handle)}
                </a>
                )
              )}
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-500">{timeAgo}</span>
            </div>

            {/* Content area with masked collapse for long posts */}
            <div className={`relative mt-1 text-base ${entry.isStarred ? "pr-5" : ""}`}>
              <div
                ref={contentRef}
                className={`relative ${!isExpanded && isOverflow ? "max-h-[220px] overflow-hidden" : ""}`}
                style={!isExpanded && isOverflow ? {
                  WebkitMaskImage: "linear-gradient(to bottom, black 72%, transparent 100%)",
                  maskImage: "linear-gradient(to bottom, black 72%, transparent 100%)",
                } : undefined}
              >
                {sanitizedContent ? (
                  <div
                    className="prose align-middle dark:prose-invert cursor-pointer select-text text-sm leading-relaxed prose-blockquote:mt-0 max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                  />
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-line select-text cursor-pointer">
                    {plainContent}
                  </p>
                )}
              </div>
              {isOverflow && !isExpanded && (
                <div className="absolute inset-x-0 -bottom-2 flex select-none justify-center py-2 duration-200">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(true) }}
                    title={t("entryList.expandMore", { defaultValue: "Expand" })}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-border bg-background/95 text-text-secondary shadow-sm transition-colors hover:text-text-primary"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
              {isOverflow && isExpanded && (
                <div className="mt-1 flex justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(false) }}
                    title={t("entryList.collapse", { defaultValue: "Collapse" })}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-border bg-background/95 text-text-secondary shadow-sm transition-colors hover:text-text-primary"
                  >
                    <ChevronUp size={14} />
                  </button>
                </div>
              )}
              {entry.isStarred && (
                <Star size={14} className="absolute right-0 top-0 text-yellow-500 fill-yellow-500" />
              )}
            </div>
          </div>

          {/* Media gallery */}
          {galleryPhotos.length > 0 && (
            <div>
              <div className="relative">
                <SocialMediaGallery
                  photos={visibleGalleryPhotos}
                  cacheScope={entry.id}
                  onAllFailed={onMediaAllFailed}
                  hasMirrorDerivedContent={hasMirrorDerivedPhotoContent}
                />
              </div>
              {galleryPhotos.length > 9 && !isMediaExpanded && (
                <div className="mt-1 flex justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsMediaExpanded(true)
                    }}
                    title={t("entryList.expandMore", { defaultValue: "Expand" })}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-border bg-background/95 text-text-secondary shadow-sm transition-colors hover:text-text-primary"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Video items */}
          {visibleVideos.map((video, i) => (
            <div key={`video-${i}`} className="mt-3">
              <VideoPlayer
                src={video.url}
                previewImage={video.previewUrl}
                className="w-full aspect-video rounded-lg"
                onOpenBilibiliInPage={(url) => onOpenBilibiliInPage?.(entry, url)}
              />
            </div>
          ))}
          {galleryPhotos.length > 9 && isMediaExpanded && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMediaExpanded(false)
                }}
                title={t("entryList.collapse", { defaultValue: "Collapse" })}
                className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-border bg-background/95 text-text-secondary shadow-sm transition-colors hover:text-text-primary"
              >
                <ChevronUp size={14} />
              </button>
            </div>
          )}

          {/* AI Translation result - bilingual paragraph-by-paragraph */}
          {showTweetTranslation && (
            <div className="mt-2 rounded-lg border border-accent/20 bg-accent/5 p-2.5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5 text-xs font-medium text-accent mb-1.5">
                <Languages size={12} />
                {t("social.translation")}
              </div>
              {isTranslatingTweet && tweetTranslatedParagraphs.length === 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Loader2 size={12} className="animate-spin" />
                  {t("entry.translating")}
                </div>
              ) : (
                <div className="space-y-0">
                  {tweetParagraphs.map((para, i) => {
                    const translated = tweetTranslatedParagraphs[i]
                    const isLoading = isTranslatingTweet && i === tweetTranslatedParagraphs.length
                    const plainText = para.replace(/<[^>]*>/g, "").trim()
                    if (!plainText) return null
                    return (
                      <div key={i} className="group border-l-2 border-transparent hover:border-accent/30 transition-colors pl-0 hover:pl-2">
                        {para.includes("<") ? (
                          <div className="text-sm leading-relaxed !mb-0" dangerouslySetInnerHTML={{ __html: para }} />
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-line !mb-0">{para}</p>
                        )}
                        {translated ? (
                          <div className="relative mt-0.5 mb-2">
                            <div className="flex items-start gap-1.5">
                              <Languages size={10} className="text-accent/50 mt-1 flex-shrink-0" />
                              <div
                                className="text-sm leading-relaxed text-accent/80 dark:text-orange-300/80 !mb-0"
                                dangerouslySetInnerHTML={{ __html: translated }}
                              />
                            </div>
                          </div>
                        ) : isLoading ? (
                          <div className="flex items-center gap-1.5 mt-0.5 mb-2 text-xs text-text-tertiary">
                            <Loader2 size={10} className="animate-spin" />
                            {t("entry.translating")}
                          </div>
                        ) : (
                          <div className="mb-2" />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* AI Summary result */}
          {showTweetSummary && (
            <div className="mt-2 rounded-lg border border-amber-300/30 bg-amber-50/50 dark:bg-amber-900/10 p-2.5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 mb-1.5">
                <Sparkles size={12} />
                {t("social.aiSummary")}
              </div>
              {isSummarizingTweet ? (
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Loader2 size={12} className="animate-spin" />
                  {t("entry.generatingSummary")}
                </div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-line">{tweetSummary}</p>
              )}
            </div>
          )}

          {/* Inline AI action buttons - below content */}
          {tweetTextContent && (
            <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleTranslateTweet}
                disabled={isTranslatingTweet}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                  showTweetTranslation && tweetTranslatedParagraphs.length > 0
                    ? "text-accent bg-accent/10"
                    : "text-text-tertiary hover:text-accent hover:bg-accent/5"
                }`}
                title={t("social.translateTweet")}
              >
                {isTranslatingTweet ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                {t("social.translateTweet")}
              </button>
              <button
                onClick={handleSummarizeTweet}
                disabled={isSummarizingTweet}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                  showTweetSummary && tweetSummary
                    ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                    : "text-text-tertiary hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
                }`}
                title={t("social.summarizeTweet")}
              >
                {isSummarizingTweet ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {t("social.summarizeTweet")}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
})

/** Floating action bar on social media items. */
function SocialActionBar({
  entry,
  browserOpenUrl,
  onContextMenu,
  onTranslate,
  onSummarize,
  isTranslating,
  isSummarizing,
  hasTranslation,
  showTranslation,
}: {
  entry: Entry
  browserOpenUrl?: string
  onContextMenu?: (e: React.MouseEvent) => void
  onTranslate?: () => void
  onSummarize?: () => void
  isTranslating?: boolean
  isSummarizing?: boolean
  hasTranslation?: boolean
  showTranslation?: boolean
}) {
  const { markRead, toggleStar } = useEntryStore()
  const { t } = useTranslation()
  const resolvedBrowserOpenUrl = useMemo(() => browserOpenUrl || resolveEntryBrowserOpenUrl(entry), [browserOpenUrl, entry])

  return (
    <div
      className="absolute -right-2 top-0 -translate-y-1/2 z-10 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/90"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5">
        {/* Translate */}
        <button
          onClick={onTranslate}
          disabled={isTranslating}
          className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors ${
            showTranslation && hasTranslation
              ? "text-accent"
              : "text-text-secondary dark:text-text-dark-secondary"
          }`}
          title={t("social.translateTweet")}
        >
          {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
        </button>
        {/* Summarize */}
        <button
          onClick={onSummarize}
          disabled={isSummarizing}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-700 text-text-secondary dark:text-text-dark-secondary transition-colors"
          title={t("social.summarizeTweet")}
        >
          {isSummarizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        </button>
        {/* Open in browser */}
        {resolvedBrowserOpenUrl && (
          <button
            onClick={() => {
              if (window.api?.app?.openExternal) {
                void window.api.app.openExternal(resolvedBrowserOpenUrl)
              } else {
                window.open(resolvedBrowserOpenUrl, "_blank")
              }
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-700 text-text-secondary dark:text-text-dark-secondary transition-colors"
            title={t("contextMenu.openInBrowser")}
          >
            <Globe size={14} />
          </button>
        )}
        {/* Divider */}
        <div className="w-px h-4 bg-gray-200 dark:bg-neutral-600 mx-0.5" />
        {/* Mark read/unread */}
        <button
          onClick={() => markRead(entry.id, !entry.isRead)}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-700 text-text-secondary dark:text-text-dark-secondary transition-colors"
          title={entry.isRead ? t("contextMenu.markUnread") : t("contextMenu.markRead")}
        >
          {entry.isRead ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        {/* Star */}
        <button
          onClick={() => toggleStar(entry.id)}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-700 text-text-secondary dark:text-text-dark-secondary transition-colors"
          title={entry.isStarred ? t("common.unstar") : t("common.star")}
        >
          <Star size={14} className={entry.isStarred ? "text-yellow-500 fill-yellow-500" : ""} />
        </button>
        {/* More (context menu) */}
        <button
          onClick={(e) => onContextMenu?.(e)}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-700 text-text-secondary dark:text-text-dark-secondary transition-colors"
          title={t("contextMenu.more")}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    </div>
  )
}

/** Parse social media platform handle from URL - supports X/Twitter, Telegram, Bluesky, Threads, Truth Social */
function parseSocialHandle(url: string): { type: "x" | "telegram" | "bluesky" | "threads" | "truth" | "other"; handle?: string } {
  // X / Twitter including Nitter mirrors.
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host === "x.com" || host === "twitter.com" || host === "www.twitter.com" || host.includes("nitter")) {
      const first = u.pathname.split("/").filter(Boolean)[0]
      if (first && /^[a-zA-Z0-9_]+$/.test(first)) return { type: "x", handle: normalizeSocialHandle(first) }
    }
  } catch {
    // Ignore parse failure; regex fallbacks below.
  }
  const xMatch = url.match(/(?:twitter\.com|x\.com|nitter\.[^/]+)\/([a-zA-Z0-9_]+)/)
  if (xMatch) return { type: "x", handle: normalizeSocialHandle(xMatch[1]) }
  // RSSHub twitter route
  const xRss = url.match(/\/twitter\/user\/([a-zA-Z0-9_]+)/)
  if (xRss) return { type: "x", handle: normalizeSocialHandle(xRss[1]) }
  // Telegram
  const tgMatch = url.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/)
  if (tgMatch) return { type: "telegram", handle: tgMatch[1] }
  const tgRss = url.match(/\/telegram\/channel\/([a-zA-Z0-9_]+)/)
  if (tgRss) return { type: "telegram", handle: tgRss[1] }
  // Bluesky
  const bskyMatch = url.match(/bsky\.(?:app|social)\/profile\/([a-zA-Z0-9_.]+)/)
  if (bskyMatch) return { type: "bluesky", handle: bskyMatch[1] }
  const bskyRss = url.match(/\/bsky\/profile\/([a-zA-Z0-9_.]+)/)
  if (bskyRss) return { type: "bluesky", handle: bskyRss[1] }
  // Threads
  const threadsMatch = url.match(/threads\.net\/@?([a-zA-Z0-9_.]+)/)
  if (threadsMatch) return { type: "threads", handle: normalizeSocialHandle(threadsMatch[1]) }
  const threadsRss = url.match(/\/threads\/user\/([a-zA-Z0-9_.]+)/)
  if (threadsRss) return { type: "threads", handle: normalizeSocialHandle(threadsRss[1]) }
  // Truth Social
  const truthMatch = url.match(/truthsocial\.com\/@?([a-zA-Z0-9_]+)/)
  if (truthMatch) return { type: "truth", handle: normalizeSocialHandle(truthMatch[1]) }
  const truthRss = url.match(/\/truthsocial\/user\/([a-zA-Z0-9_]+)/)
  if (truthRss) return { type: "truth", handle: normalizeSocialHandle(truthRss[1]) }
  return { type: "other" }
}

function extractTwitterDisplayNameFromFeedTitle(feedTitle?: string, handle?: string): string {
  let cleaned = (feedTitle || "").trim()
  if (!cleaned) return ""

  cleaned = cleaned
    .replace(/\s*-\s*(?:x|twitter)\s*$/i, "")
    .replace(/\s+on\s+(?:x|twitter)\s*$/i, "")
    .replace(/\(\s*@?[a-zA-Z0-9_]{1,15}\s*\)/g, "")
    .trim()

  const slashParts = cleaned.split("/").map((part) => part.trim()).filter(Boolean)
  if (slashParts.length > 1) {
    const nonHandle = slashParts.find((part) => !/^@?[a-zA-Z0-9_]{1,15}$/.test(part))
    if (nonHandle) cleaned = nonHandle
  }
  cleaned = cleaned.replace(/\/\s*@?[a-zA-Z0-9_]{1,15}\s*$/i, "").trim()

  if (!cleaned) return ""
  if (handle && cleaned.replace(/^@/, "").toLowerCase() === handle.replace(/^@/, "").toLowerCase()) return ""
  return cleaned.replace(/^@+/, "").trim()
}

/** Smart media gallery for social items.
 *  Same-ratio: horizontal layout with proportional sizes.
 *  Different-ratio: CSS grid with aspect-square items.
 *  Clicking images bubbles up to open the detail overlay; lightbox is in SocialOverlay.
 */
function SocialMediaGallery({
  photos,
  cacheScope,
  onAllFailed,
  hasMirrorDerivedContent,
}: {
  photos: Array<{ url: string; previewUrl?: string; width?: number; height?: number; blurhash?: string }>
  cacheScope: string
  onAllFailed?: () => void
  hasMirrorDerivedContent?: boolean
}) {
  const allFailedNotifiedRef = useRef(false)
  const [failedPhotoTokens, setFailedPhotoTokens] = useState<Set<string>>(new Set())
  const [loadedPhotoTokens, setLoadedPhotoTokens] = useState<Set<string>>(new Set())
  const [suppressedPhotoTokens, setSuppressedPhotoTokens] = useState<Set<string>>(new Set())
  useEffect(() => {
    allFailedNotifiedRef.current = false
    setFailedPhotoTokens(new Set())
    setLoadedPhotoTokens(new Set())
    setSuppressedPhotoTokens(new Set())
  }, [cacheScope, photos])

  const uniquePhotos = useMemo(() => {
    return dedupeGalleryPhotoVariants(photos)
  }, [photos])

  const getPhotoCacheToken = useCallback((photo: { url: string; previewUrl?: string }) => {
    const key = getPhotoDedupeKey(photo.url || "", photo.previewUrl || "")
    if (key) return key
    return normalizeImageCacheKey(photo.url || photo.previewUrl || "")
  }, [])

  const markPhotoFailed = useCallback((photo: { url: string; previewUrl?: string }) => {
    const token = getPhotoCacheToken(photo)
    if (!token) return
    setFailedPhotoTokens((prev) => {
      if (prev.has(token)) return prev
      const next = new Set(prev)
      next.add(token)
      return next
    })
  }, [getPhotoCacheToken])

  const getInitialSrc = useCallback((photo: { url: string; previewUrl?: string }) => {
    // Prefer previewUrl (mirror/proxy URL) when available — CDN signed URLs expire quickly.
    if (photo.previewUrl) {
      const raw = decodeHtmlEntitiesUrl(photo.previewUrl)
      if (raw && /^https?:\/\//i.test(raw)) {
        return getRememberedMediaSrc(raw, raw)
      }
    }
    const seedUrl = decodeMediaUrl(photo.url || "")
    const primaryUrl = decodeMediaUrl(photo.url || "")
    return getRememberedMediaSrc(seedUrl, primaryUrl || seedUrl)
  }, [])

  const visiblePhotos = useMemo(() => {
    if (suppressedPhotoTokens.size === 0) return uniquePhotos
    return uniquePhotos.filter((photo) => {
      const token = getPhotoCacheToken(photo)
      return !token || !suppressedPhotoTokens.has(token)
    })
  }, [getPhotoCacheToken, suppressedPhotoTokens, uniquePhotos])

  useEffect(() => {
    if (uniquePhotos.length < 2) return
    const lastPhoto = uniquePhotos[uniquePhotos.length - 1]
    const lastToken = getPhotoCacheToken(lastPhoto)
    if (!lastToken || !failedPhotoTokens.has(lastToken) || suppressedPhotoTokens.has(lastToken)) return
    if (!hasMirrorDerivedContent) return
    if (!isInstagramLikeGalleryPhoto(lastPhoto)) return

    let allPreviousLoaded = true
    for (let index = 0; index < uniquePhotos.length - 1; index += 1) {
      const token = getPhotoCacheToken(uniquePhotos[index])
      if (!token || !loadedPhotoTokens.has(token) || failedPhotoTokens.has(token)) {
        allPreviousLoaded = false
        break
      }
    }

    if (!allPreviousLoaded) return
    setSuppressedPhotoTokens((prev) => {
      if (prev.has(lastToken)) return prev
      const next = new Set(prev)
      next.add(lastToken)
      return next
    })
  }, [failedPhotoTokens, getPhotoCacheToken, hasMirrorDerivedContent, loadedPhotoTokens, suppressedPhotoTokens, uniquePhotos])

  useEffect(() => {
    if (visiblePhotos.length === 0) return
    let visibleFailedCount = 0
    for (const photo of visiblePhotos) {
      const token = getPhotoCacheToken(photo)
      if (token && failedPhotoTokens.has(token)) visibleFailedCount += 1
    }
    if (visibleFailedCount !== visiblePhotos.length) return
    if (allFailedNotifiedRef.current) return
    allFailedNotifiedRef.current = true
    onAllFailed?.()
  }, [failedPhotoTokens, getPhotoCacheToken, onAllFailed, visiblePhotos])

  const rememberLoadedSrc = useCallback((photo: { url: string; previewUrl?: string }, _index: number, _img: HTMLImageElement) => {
    const token = getPhotoCacheToken(photo)
    if (!token) return
    rememberMediaSrc(
      decodeMediaUrl(photo.url || photo.previewUrl || ""),
      decodeMediaUrl(_img.currentSrc || _img.src || photo.url || photo.previewUrl || ""),
    )
    setLoadedPhotoTokens((prev) => {
      if (prev.has(token)) return prev
      const next = new Set(prev)
      next.add(token)
      return next
    })
  }, [getPhotoCacheToken])

  const handlePhotoError = useCallback((
    photo: { url: string; previewUrl?: string },
    index: number,
    e: SyntheticEvent<HTMLImageElement>,
  ) => {
    advanceCardImageFallback(e, photo.url || photo.previewUrl || "", (img) => {
      img.style.display = "none"
      markPhotoFailed(photo)
    }, photo.previewUrl)
  }, [markPhotoFailed])


  // Detect whether all photos share the same aspect ratio.
  const allSameRatio = useMemo(() => {
    if (visiblePhotos.length <= 1) return true
    let ratio = 0
    for (const p of visiblePhotos) {
      if (p.width && p.height) {
        const r = p.height / p.width
        if (ratio === 0) ratio = r
        else if (ratio !== r) return false
      } else {
        return false
      }
    }
    return true
  }, [visiblePhotos])

  // Use CSS-driven responsive sizing to avoid one-frame stale-width jumps on window resize.

  return (
    <>
      {allSameRatio && visiblePhotos.every((p) => p.width && p.height) ? (
        /* Same ratio: horizontal layout */
        <div className="mt-4 flex gap-[8px] overflow-x-auto pb-2">
          {visiblePhotos.map((photo, i, list) => {
            const widthClass =
              list.length === 1
                ? "w-full"
                : list.length === 2
                  ? "w-[calc((100%-8px)/2)]"
                  : "w-[calc((100%-16px)/3)]"
            const token = getPhotoCacheToken(photo)
            const isFailed = !!token && failedPhotoTokens.has(token)
            return (
              <div
                key={`${token || "media"}:${i}`}
                className={`relative shrink-0 rounded ${widthClass}`}
                style={{
                  aspectRatio: photo.width && photo.height ? `${photo.width} / ${photo.height}` : undefined,
                  height: "auto",
                  maxHeight: list.length === 1 ? "66vh" : undefined,
                  backgroundColor: photo.blurhash ? blurhashToAverageColor(photo.blurhash) : undefined,
                }}
              >
                {isFailed ? (
                  <div className="flex h-full min-h-[120px] w-full items-center justify-center rounded bg-surface-tertiary text-xs text-text-tertiary dark:bg-surface-dark-tertiary dark:text-text-dark-tertiary">
                    图片加载失败
                  </div>
                ) : (
                  <img
                    src={getInitialSrc(photo)}
                    alt=""
                    className="h-full w-full rounded object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    referrerPolicy="no-referrer"
                    onLoad={(e) => {
                      e.currentTarget.style.display = ""
                      rememberLoadedSrc(photo, i, e.currentTarget)
                    }}
                    onError={(e) => handlePhotoError(photo, i, e)}
                  />
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Different ratios: CSS grid */
        <div className="mt-4">
          {visiblePhotos.length === 1 ? (
            (() => {
              const photo = visiblePhotos[0]
              const token = getPhotoCacheToken(photo)
              const isFailed = !!token && failedPhotoTokens.has(token)
              return isFailed ? (
                <div
                  className="flex w-full items-center justify-center rounded bg-surface-tertiary text-sm text-text-tertiary dark:bg-surface-dark-tertiary dark:text-text-dark-tertiary"
                  style={{ maxHeight: "70vh", minHeight: "240px" }}
                >
                  图片加载失败
                </div>
              ) : (
                <img
                  src={getInitialSrc(photo)}
                  alt=""
                  className="w-full h-auto rounded object-contain"
                  style={{
                    maxHeight: "70vh",
                    backgroundColor: photo.blurhash ? blurhashToAverageColor(photo.blurhash) : undefined,
                  }}
                  loading="eager"
                  fetchPriority="high"
                  referrerPolicy="no-referrer"
                  onLoad={(e) => {
                    e.currentTarget.style.display = ""
                    rememberLoadedSrc(photo, 0, e.currentTarget)
                  }}
                  onError={(e) => handlePhotoError(photo, 0, e)}
                />
              )
            })()
          ) : (
          <div className={`grid gap-2 ${
            visiblePhotos.length === 2 ? "grid-cols-2" :
            visiblePhotos.length === 3 ? "grid-cols-2" :
            visiblePhotos.length === 4 ? "grid-cols-2" :
            visiblePhotos.length >= 5 ? "grid-cols-3" : ""
          }`}>
            {visiblePhotos.map((photo, i) => {
              const token = getPhotoCacheToken(photo)
              const isFailed = !!token && failedPhotoTokens.has(token)
              return (
                <div
                  key={`${token || "media"}:${i}`}
                  className="relative aspect-square w-full"
                  style={{ ...(visiblePhotos.length === 3 && i === 2 ? { gridRow: "span 2" } : {}) }}
                >
                  {isFailed ? (
                    <div className="flex h-full w-full items-center justify-center rounded bg-surface-tertiary text-xs text-text-tertiary dark:bg-surface-dark-tertiary dark:text-text-dark-tertiary">
                      图片加载失败
                    </div>
                  ) : (
                    <img
                      src={getInitialSrc(photo)}
                      alt=""
                      className="aspect-square w-full rounded object-cover"
                      style={{
                        backgroundColor: photo.blurhash ? blurhashToAverageColor(photo.blurhash) : undefined,
                      }}
                      loading={i === 0 ? "eager" : "lazy"}
                      fetchPriority={i === 0 ? "high" : "auto"}
                      referrerPolicy="no-referrer"
                      onLoad={(e) => {
                        e.currentTarget.style.display = ""
                        rememberLoadedSrc(photo, i, e.currentTarget)
                      }}
                      onError={(e) => handlePhotoError(photo, i, e)}
                    />
                  )}
                </div>
              )
            })}
          </div>
          )}
        </div>
      )}
    </>
  )
}

/** Per-view-type configuration for recommendations */
const VIEW_RECOMMENDATIONS_CONFIG: Record<number, {
  feeds: RecommendedFeed[]
  icon: React.ReactNode
  headerIcon: React.ReactNode
  iconBg: string
  cardGradient: string
  discoverKey: string
  subscribeKey: string
}> = {
  [FeedViewType.Articles]: {
    feeds: RECOMMENDED_ARTICLE_FEEDS,
    icon: <FileText size={16} className="text-blue-500" />,
    headerIcon: <FileText size={28} className="text-blue-500" />,
    iconBg: "bg-blue-500/10",
    cardGradient: "from-blue-500/[0.03] to-cyan-500/[0.03]",
    discoverKey: "recommendations.discoverContent",
    subscribeKey: "recommendations.subscribeToStart",
  },
  [FeedViewType.Videos]: {
    feeds: RECOMMENDED_VIDEO_FEEDS as RecommendedFeed[],
    icon: <Play size={16} className="text-rose-500 ml-0.5" />,
    headerIcon: <Play size={28} className="text-rose-500 ml-0.5" />,
    iconBg: "bg-rose-500/10",
    cardGradient: "from-rose-500/[0.03] to-purple-500/[0.03]",
    discoverKey: "recommendations.discoverVideos",
    subscribeKey: "recommendations.subscribeVideos",
  },
  [FeedViewType.SocialMedia]: {
    feeds: RECOMMENDED_SOCIAL_FEEDS,
    icon: <Users size={16} className="text-sky-500" />,
    headerIcon: <Users size={28} className="text-sky-500" />,
    iconBg: "bg-sky-500/10",
    cardGradient: "from-sky-500/[0.03] to-blue-500/[0.03]",
    discoverKey: "recommendations.discoverSocial",
    subscribeKey: "recommendations.subscribeSocial",
  },
}

/** Generic recommendations shown when a view type is empty. */
export function ViewRecommendations({ viewType }: { viewType: FeedViewType }) {
  const { addFeed, updateFeed, feeds: userFeeds } = useFeedStore()
  const { setOpen } = useDiscoverStore()
  const { t } = useTranslation()
  const rsshubInstance = useGeneralSettingKey("rsshubInstance") || DEFAULT_RSSHUB_INSTANCE
  const [subscribingUrls, setSubscribingUrls] = useState<Set<string>>(new Set())
  const [subscribedUrls, setSubscribedUrls] = useState<Set<string>>(new Set())
  const rsshubBase = rsshubInstance.replace(/\/+$/, "")

  const config = VIEW_RECOMMENDATIONS_CONFIG[viewType]

  // Sync subscribed status
  useEffect(() => {
    setSubscribedUrls(new Set(
      userFeeds
        .filter((f) => f.category !== RECOMMENDED_CATEGORY)
        .map((f) => f.url),
    ))
  }, [userFeeds])

  const getFullUrl = useCallback((feed: RecommendedFeed) =>
    feed.isRSSHub ? `${rsshubBase}${feed.url}` : feed.url,
  [rsshubBase])

  const resolveRecommendedUrl = useCallback(async (feed: RecommendedFeed) => {
    const fullUrl = getFullUrl(feed)
    if (!feed.isRSSHub) return fullUrl
    const instagramMatch = feed.url.match(/^\/instagram\/user\/([^/?#]+)/i)
    if (!instagramMatch) return fullUrl
    try {
      const username = decodeURIComponent(instagramMatch[1])
      const result = await window.api.discover.probeInstagramUser(username)
      if (result.valid && result.feedUrl) return result.feedUrl
    } catch {
      // Fallback to configured RSSHub URL.
    }
    return fullUrl
  }, [getFullUrl])

  const handleSubscribe = async (feed: RecommendedFeed) => {
    const fullUrl = getFullUrl(feed)
    setSubscribingUrls((prev) => new Set(prev).add(fullUrl))
    try {
      const resolvedUrl = await resolveRecommendedUrl(feed)
      const instagramMatch = feed.url.match(/^\/instagram\/user\/([^/?#]+)/i)
      const existing = userFeeds.find((f) => {
        if (f.url === fullUrl || f.url === resolvedUrl) return true
        if (!instagramMatch) return false
        const m = f.url.match(/\/instagram\/user\/([^/?#]+)/i)
        return !!(m && decodeURIComponent(m[1]).toLowerCase() === decodeURIComponent(instagramMatch[1]).toLowerCase())
      })
      if (existing) {
        // "Subscribe" from recommended means move to normal subscriptions.
        const updates: { category: string; url?: string } = { category: "" }
        if (existing.url !== resolvedUrl) updates.url = resolvedUrl
        await updateFeed(existing.id, updates)
        setSubscribedUrls((prev) => new Set(prev).add(resolvedUrl))
      } else {
        const result = await addFeed(resolvedUrl, "", viewType, feed.title)
        if (result.success) {
          setSubscribedUrls((prev) => new Set(prev).add(resolvedUrl))
        }
      }
    } finally {
      setSubscribingUrls((prev) => {
        const next = new Set(prev)
        next.delete(fullUrl)
        return next
      })
    }
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-secondary dark:text-text-dark-secondary">
        <Inbox size={40} className="mb-3 text-text-tertiary" />
        <p className="text-sm">{t("entryList.noArticles")}</p>
        <p className="text-xs mt-1">{t("entryList.addFeedToStart")}</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Empty state header */}
      <div className="flex flex-col items-center text-center pt-4 pb-2">
        <div className={`w-14 h-14 rounded-2xl ${config.iconBg} flex items-center justify-center mb-3`}>
          {config.headerIcon}
        </div>
        <p className="text-sm font-medium">{t(config.discoverKey)}</p>
        <p className="text-xs text-text-tertiary mt-1">{t(config.subscribeKey)}</p>
      </div>

      {/* Recommended feeds */}
      <div className="space-y-2">
        {config.feeds.map((feed) => {
          const fullUrl = getFullUrl(feed)
          const instagramMatch = feed.url.match(/^\/instagram\/user\/([^/?#]+)/i)
          const isSubscribed = subscribedUrls.has(fullUrl) || (
            !!instagramMatch &&
            userFeeds.some((f) => {
              if (f.category === RECOMMENDED_CATEGORY) return false
              const m = f.url.match(/\/instagram\/user\/([^/?#]+)/i)
              return !!(m && decodeURIComponent(m[1]).toLowerCase() === decodeURIComponent(instagramMatch[1]).toLowerCase())
            })
          )
          const isCurrentlySubscribing = subscribingUrls.has(fullUrl)

          return (
            <div
              key={feed.url}
              className={`flex items-center gap-3 p-3 rounded-xl border bg-gradient-to-r ${config.cardGradient} hover:border-accent/30 transition-colors`}
            >
              <div className={`w-9 h-9 flex-shrink-0 rounded-lg ${config.iconBg} flex items-center justify-center`}>
                {config.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{feed.title}</span>
                  {feed.isRSSHub && (
                    <span className="flex-shrink-0 px-1 py-0.5 rounded text-[9px] font-medium bg-accent/10 text-accent">
                      RSSHub
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-tertiary truncate mt-0.5">{feed.description}</p>
              </div>
              <button
                onClick={() => handleSubscribe(feed)}
                disabled={isCurrentlySubscribing}
                className={`flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSubscribed
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                    : "bg-accent text-white hover:bg-accent-hover active:scale-95"
                } disabled:opacity-60`}
              >
                {isCurrentlySubscribing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : isSubscribed ? (
                  <>
                    <Check size={12} />
                    <span>{t("common.subscribed")}</span>
                  </>
                ) : (
                  <>
                    <Plus size={12} />
                    <span>{t("common.subscribe")}</span>
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Open Discover for more */}
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2.5 rounded-xl border border-dashed text-sm text-text-secondary hover:border-accent hover:text-accent transition-colors"
      >
        {t("recommendations.browseMore")}
      </button>
    </div>
  )
}


