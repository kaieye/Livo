import { FeedViewType, type ResolvedProfileFeedCandidate } from "../../shared/types"

function toUrl(input: string): URL | null {
  try {
    return new URL(input)
  } catch {
    return null
  }
}

function htmlEntityDecode(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
}

function extractChannelIdFromHtml(html: string): string | null {
  const patterns = [
    /"channelId":"(UC[\w-]{20,})"/,
    /"externalId":"(UC[\w-]{20,})"/,
    /\/channel\/(UC[\w-]{20,})/,
    /itemprop="identifier"\s+content="(UC[\w-]{20,})"/,
  ]
  for (const pattern of patterns) {
    const matched = html.match(pattern)
    if (matched?.[1]) {
      return matched[1]
    }
  }
  return null
}

function extractChannelTitleFromHtml(html: string): string | null {
  const patterns = [
    /<meta\s+property="og:title"\s+content="([^"]+)"/i,
    /<title>([^<]+)<\/title>/i,
  ]
  for (const pattern of patterns) {
    const matched = html.match(pattern)
    if (matched?.[1]) {
      const parsed = htmlEntityDecode(matched[1].trim())
      if (parsed) return parsed.replace(/\s*-\s*YouTube\s*$/i, "").trim()
    }
  }
  return null
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function resolveYouTubeProfileToOfficialFeed(
  inputUrl: string,
): Promise<ResolvedProfileFeedCandidate | null> {
  const url = toUrl(inputUrl)
  if (!url) return null
  const host = url.hostname.toLowerCase()
  if (!(host.includes("youtube.com") || host.includes("youtu.be"))) return null

  const segments = url.pathname.split("/").filter(Boolean)
  const directChannelId = segments[0] === "channel" && segments[1]?.startsWith("UC") ? segments[1] : null
  let channelId = directChannelId ?? null
  let title: string | null = null

  if (!channelId) {
    const html = await fetchHtml(url.toString())
    if (!html) return null
    channelId = extractChannelIdFromHtml(html)
    title = extractChannelTitleFromHtml(html)
  }

  if (!channelId) return null

  return {
    feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
    title: title ? `${title} (YouTube)` : `YouTube ${channelId}`,
    source: "rss",
    siteUrl: url.toString(),
    description: "Official YouTube channel RSS",
    view: FeedViewType.Videos,
    requiresAccount: ["youtube"],
  }
}
