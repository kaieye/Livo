/**
 * Web-compatible implementation of the Electron API.
 * Provides the same interface as the preload `window.api` object,
 * but uses browser-native APIs (IndexedDB, fetch with CORS proxy, etc.)
 */

import type { ElectronAPI } from "../preload/index"
import type { Feed, Entry, FeedWithCount, FeedViewType, AppSettings, AccountProvider } from "../shared/types"
import { DEFAULT_SETTINGS, FeedViewType as FVT } from "../shared/types"
import { resolveProfileUrlToCandidates } from "../shared/profile-resolver"
import {
  CURATED_FEEDS,
  DISCOVER_CATEGORIES,
  RSSHUB_ROUTES,
  DEFAULT_RSSHUB_INSTANCE,
  searchCuratedFeeds,
} from "../shared/discover-data"
import {
  initWebDB,
  getAllFeeds,
  getFeedByUrl,
  insertFeed as dbInsertFeed,
  updateFeed as dbUpdateFeed,
  deleteFeed as dbDeleteFeed,
  getEntries as dbGetEntries,
  getEntryById as dbGetEntryById,
  insertEntry as dbInsertEntry,
  updateEntry as dbUpdateEntry,
  markAllRead as dbMarkAllRead,
  searchEntries as dbSearchEntries,
  getUnreadCount,
  getSettings,
  saveSettings,
} from "./storage"

// ====== CORS Proxy ======
const DEFAULT_CORS_PROXY = "https://api.allorigins.win/raw?url="

function getCorsProxyUrl(): string {
  try {
    const stored = localStorage.getItem("livo-cors-proxy")
    if (stored) return stored
  } catch { /* ignore */ }
  return DEFAULT_CORS_PROXY
}

function proxiedUrl(url: string): string {
  return getCorsProxyUrl() + encodeURIComponent(url)
}

function normalizeDiscoverQueryToFeedUrl(query: string, rsshubInstance: string): string {
  const trimmed = query.trim()
  if (!trimmed) return trimmed
  const rsshubMatch = trimmed.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) {
    const route = rsshubMatch[1].replace(/^\/+/, "")
    const base = rsshubInstance.replace(/\/+$/, "")
    return `${base}/${route}`
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function toRsshubProtocolUrl(rawUrl: string): string {
  const trimmed = (rawUrl || "").trim()
  if (!trimmed) return trimmed
  const rsshubMatch = trimmed.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) return `rsshub://${rsshubMatch[1].replace(/^\/+/, "")}`
  try {
    const parsed = new URL(trimmed)
    const route = parsed.pathname.replace(/^\/+/, "")
    if (route && /^(?:twitter|instagram|picnob(?:\.info)?|youtube|bilibili|github|weibo|zhihu)\//i.test(route)) {
      return `rsshub://${route}${parsed.search || ""}`
    }
  } catch {
    // Ignore parse failures.
  }
  return trimmed
}

function toFetchableFeedUrl(rawUrl: string, rsshubInstance: string): string {
  const trimmed = (rawUrl || "").trim()
  if (!trimmed) return trimmed
  const rsshubMatch = trimmed.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) {
    const route = rsshubMatch[1].replace(/^\/+/, "")
    const base = rsshubInstance.replace(/\/+$/, "")
    return `${base}/${route}`
  }
  return trimmed
}

function extractBilibiliUid(feedUrl: string): string | null {
  try {
    const u = new URL(feedUrl)
    const m = u.pathname.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i)
    return m?.[1] || null
  } catch {
    return null
  }
}

function extractTwitterUsernameFromUrl(value: string): string {
  try {
    const u = new URL(value)
    const rsshubMatch = u.pathname.match(/\/twitter\/user\/([^/?#]+)/i)
    if (rsshubMatch?.[1]) return decodeURIComponent(rsshubMatch[1]).replace(/^@/, "")
    if (u.hostname.toLowerCase().includes("nitter")) {
      const parts = u.pathname.split("/").filter(Boolean)
      if (parts.length >= 2 && parts[1].toLowerCase() === "rss") {
        return decodeURIComponent(parts[0]).replace(/^@/, "")
      }
    }
    if (/^(www\.)?(x\.com|twitter\.com)$/i.test(u.hostname)) {
      return (u.pathname.split("/").filter(Boolean)[0] || "").replace(/^@/, "")
    }
  } catch {
    // Ignore malformed URL.
  }
  return ""
}

function decodeBasicHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function extractTwitterDisplayNameFromText(text: string, username: string): string {
  const raw = (text || "").trim()
  if (!raw) return ""
  const escapedUser = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const withHandle = new RegExp(`^(.+?)\\s*\\(\\s*@?${escapedUser}\\s*\\)\\s*(?:\\/|[-\\u2013\\u2014]|on)\\s*(?:x|twitter)\\s*$`, "i")
  const m1 = raw.match(withHandle)
  if (m1?.[1]) return m1[1].trim()
  const withoutHandle = raw.match(/^(.+?)\s*(?:\/|[-\u2013\u2014]|on)\s*(?:x|twitter)\s*$/i)
  if (withoutHandle?.[1]) {
    const name = withoutHandle[1].trim().replace(/^@/, "")
    if (name && name.toLowerCase() !== username.toLowerCase()) return name
  }
  return ""
}

function isGenericTwitterTitle(title: string, username: string): boolean {
  const cleaned = (title || "").trim().toLowerCase()
  const user = username.trim().replace(/^@/, "").toLowerCase()
  if (!cleaned || !user) return true
  return cleaned === user || cleaned === `@${user}` || cleaned === `${user} - x` || cleaned === `@${user} - x`
}

async function fetchXDisplayNameByUsername(username: string): Promise<string> {
  const clean = username.trim().replace(/^@/, "")
  if (!clean) return ""
  try {
    const profileUrl = `https://x.com/${encodeURIComponent(clean)}`
    const res = await fetch(proxiedUrl(profileUrl), {
      signal: AbortSignal.timeout(8000),
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })
    if (!res.ok) return ""
    const html = await res.text()
    const ogTitle =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1]
      || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
      || ""
    const decoded = decodeBasicHtmlEntities(ogTitle)
    return extractTwitterDisplayNameFromText(decoded, clean)
  } catch {
    return ""
  }
}

async function inferDiscoverResultTitle(feedUrl: string, parsedTitle?: string): Promise<string> {
  const twitterUsername = extractTwitterUsernameFromUrl(feedUrl)
  if (twitterUsername) {
    const candidate = (parsedTitle || "").trim()
    const parsedName = extractTwitterDisplayNameFromText(candidate, twitterUsername)
    if (parsedName) return `${parsedName} - X`
    if (candidate && !isGenericTwitterTitle(candidate, twitterUsername)) return candidate
    const fetchedName = await fetchXDisplayNameByUsername(twitterUsername)
    if (fetchedName) return `${fetchedName} - X`
    return `${twitterUsername} - X`
  }

  if (parsedTitle) {
    const m = parsedTitle.match(/^(.+?)\s+的\s+bilibili\s+/i)
    if (m?.[1]) return `${m[1].trim()} - Bilibili`
    return parsedTitle
  }

  const bilibiliUid = extractBilibiliUid(feedUrl)
  if (bilibiliUid) return `UID ${bilibiliUid} - Bilibili`

  try {
    const u = new URL(feedUrl)
    return `${u.hostname.replace(/^www\./i, "")} - RSS`
  } catch {
    return feedUrl
  }
}

function getProbeImageFromParsed(parsed: {
  image?: { url?: string }
  items?: Array<{ content?: string; enclosure?: { url?: string; type?: string } }>
} | null | undefined): string {
  const imageUrl = parsed?.image?.url?.trim()
  if (imageUrl) return imageUrl
  const items = parsed?.items || []
  for (const item of items.slice(0, 5)) {
    const enclosureUrl = item.enclosure?.url?.trim()
    const enclosureType = (item.enclosure?.type || "").toLowerCase()
    if (enclosureUrl && enclosureType.startsWith("image/")) return enclosureUrl
    const content = item.content || ""
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i)
    if (imgMatch?.[1]) return imgMatch[1]
  }
  return ""
}

async function fetchInstagramAvatarByUsername(username: string): Promise<string> {
  const clean = username.trim().replace(/^@/, "")
  if (!clean) return ""
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(clean)}/`
  try {
    const res = await fetch(proxiedUrl(profileUrl), {
      signal: AbortSignal.timeout(8000),
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })
    if (!res.ok) return ""
    const html = await res.text()
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (og?.[1] && /^https?:\/\//i.test(og[1])) return og[1]
    const hd = html.match(/"profile_pic_url_hd":"(https?:\\\/\\\/[^"]+)"/i)
    if (hd?.[1]) {
      const decoded = hd[1].replace(/\\\//g, "/")
      if (/^https?:\/\//i.test(decoded)) return decoded
    }
  } catch {
    // Ignore fallback failure.
  }
  return ""
}

// ====== RSS Parsing in Browser ======

/** Minimal RSS parser for the browser (no external dependency needed) */
async function parseFeedFromUrl(feedUrl: string): Promise<{
  title: string
  link: string
  description: string
  image?: { url: string }
  items: Array<{
    title: string
    link: string
    content: string
    contentSnippet: string
    creator: string
    isoDate: string
    enclosure?: { url: string; type: string }
  }>
}> {
  let url = feedUrl.trim()
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url
  }

  const response = await fetch(proxiedUrl(url), {
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const text = await response.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, "text/xml")

  // Check for parse errors
  const parseError = doc.querySelector("parsererror")
  if (parseError) throw new Error("Invalid XML")

  // Detect RSS vs Atom
  const isAtom = !!doc.querySelector("feed")

  if (isAtom) return parseAtom(doc)
  return parseRSS(doc)
}

function parseRSS(doc: Document) {
  const channel = doc.querySelector("channel")
  const items = Array.from(doc.querySelectorAll("item")).map((item) => {
    const contentEncoded = item.querySelector("content\\:encoded, encoded")?.textContent || ""
    const description = item.querySelector("description")?.textContent || ""
    const content = contentEncoded || description
    const date = item.querySelector("pubDate")?.textContent
    const enclosure = item.querySelector("enclosure")
    const creator = item.querySelector("dc\\:creator, creator")?.textContent || item.querySelector("author")?.textContent || ""
    return {
      title: item.querySelector("title")?.textContent || "Untitled",
      link: item.querySelector("link")?.textContent || "",
      content,
      contentSnippet: stripHTML(content).slice(0, 200),
      creator,
      isoDate: date ? new Date(date).toISOString() : "",
      enclosure: enclosure
        ? { url: enclosure.getAttribute("url") || "", type: enclosure.getAttribute("type") || "" }
        : undefined,
    }
  })

  return {
    title: channel?.querySelector("title")?.textContent || "",
    link: channel?.querySelector("link")?.textContent || "",
    description: channel?.querySelector("description")?.textContent || "",
    image: channel?.querySelector("image > url")?.textContent
      ? { url: channel.querySelector("image > url")!.textContent! }
      : undefined,
    items,
  }
}

function parseAtom(doc: Document) {
  const feed = doc.querySelector("feed")
  const items = Array.from(doc.querySelectorAll("entry")).map((entry) => {
    const content =
      entry.querySelector("content")?.textContent ||
      entry.querySelector("summary")?.textContent ||
      ""
    const link =
      entry.querySelector("link[rel='alternate']")?.getAttribute("href") ||
      entry.querySelector("link")?.getAttribute("href") ||
      ""
    const date = entry.querySelector("published, updated")?.textContent || ""
    return {
      title: entry.querySelector("title")?.textContent || "Untitled",
      link,
      content,
      contentSnippet: stripHTML(content).slice(0, 200),
      creator: entry.querySelector("author > name")?.textContent || "",
      isoDate: date ? new Date(date).toISOString() : "",
      enclosure: undefined,
    }
  })

  const altLink =
    feed?.querySelector("link[rel='alternate']")?.getAttribute("href") ||
    feed?.querySelector("link")?.getAttribute("href") ||
    ""

  return {
    title: feed?.querySelector("title")?.textContent || "",
    link: altLink,
    description: feed?.querySelector("subtitle")?.textContent || "",
    image: feed?.querySelector("icon")?.textContent
      ? { url: feed.querySelector("icon")!.textContent! }
      : undefined,
    items,
  }
}

function stripHTML(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim()
}

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Auto-detect view type from feed items */
function detectViewType(items: Array<{ content: string; enclosure?: { type: string } }>): FVT {
  let videoCount = 0, imageCount = 0
  for (const item of items.slice(0, 10)) {
    const enc = item.enclosure
    if (enc?.type?.startsWith("video/") || item.content.includes("<video") || item.content.includes("youtube.com/embed")) videoCount++
    else if ((item.content.match(/<img/g) || []).length >= 3) imageCount++
  }
  const total = items.length || 1
  if (videoCount / total > 0.5) return FVT.Videos
  if (imageCount / total > 0.5) return FVT.SocialMedia
  return FVT.Articles
}

// ====== OpenAI Client for Browser ======

async function callAI(
  messages: Array<{ role: string; content: string }>,
  options: { temperature?: number; max_tokens?: number; stream?: false }
): Promise<{ content: string }> {
  const settings = await getSettings()
  const ai = settings.ai
  if (!ai.apiKey && ai.provider !== "ollama") throw new Error("请先在设置中配置 AI API Key")

  const baseUrl = ai.baseUrl || getDefaultBaseUrl(ai.provider)
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ai.apiKey || "ollama"}`,
    },
    body: JSON.stringify({
      model: ai.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2000,
      stream: false,
    }),
  })

  if (!response.ok) throw new Error(`AI API Error: ${response.status} ${response.statusText}`)
  const data = await response.json()
  return { content: data.choices?.[0]?.message?.content || "" }
}

async function callAIStream(
  messages: Array<{ role: string; content: string }>,
  onChunk: (content: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): Promise<void> {
  const settings = await getSettings()
  const ai = settings.ai
  if (!ai.apiKey && ai.provider !== "ollama") {
    onError("请先在设置中配置 AI API Key")
    return
  }

  const baseUrl = ai.baseUrl || getDefaultBaseUrl(ai.provider)
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ai.apiKey || "ollama"}`,
      },
      body: JSON.stringify({
        model: ai.model,
        messages,
        temperature: 0.7,
        max_tokens: 4000,
        stream: true,
      }),
    })

    if (!response.ok) throw new Error(`AI API Error: ${response.status}`)

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim()
          if (data === "[DONE]") { onDone(); return }
          try {
            const json = JSON.parse(data)
            const content = json.choices?.[0]?.delta?.content || ""
            if (content) onChunk(content)
          } catch { /* skip invalid JSON */ }
        }
      }
    }
    onDone()
  } catch (error) {
    onError(String(error))
  }
}

function getDefaultBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    deepseek: "https://api.deepseek.com/v1",
    glm: "https://open.bigmodel.cn/api/paas/v4",
    ollama: "http://localhost:11434/v1",
  }
  return urls[provider] || "https://api.openai.com/v1"
}

// ====== Readability for Web ======

async function fetchReadableContent(url: string) {
  const response = await fetch(proxiedUrl(url), { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const html = await response.text()

  // Parse with DOMParser
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  // Remove unwanted elements
  const removeSelectors = [
    "script", "style", "noscript", "svg", "nav", "header", "footer", "aside",
    "form", "iframe", ".sidebar", ".widget", ".ad", ".ads", ".advert",
    ".social-share", ".related-posts", ".comments", ".newsletter", ".popup",
    ".modal", ".cookie", ".banner",
  ]
  for (const sel of removeSelectors) {
    doc.querySelectorAll(sel).forEach((el) => el.remove())
  }

  // Find main content
  const contentEl =
    doc.querySelector("article") ||
    doc.querySelector("[role='main']") ||
    doc.querySelector(".article-content, .post-content, .entry-content") ||
    doc.querySelector("main") ||
    doc.body

  const title =
    doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
    doc.querySelector("title")?.textContent?.replace(/\s*[|\-–—].*$/, "") ||
    ""

  const siteName =
    doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ||
    new URL(url).hostname.replace(/^www\./, "")

  const content = contentEl?.innerHTML || ""
  const textContent = contentEl?.textContent?.trim() || ""

  return {
    success: true,
    title: title.trim(),
    content,
    excerpt: textContent.slice(0, 200),
    siteName,
    length: textContent.length,
  }
}

// ====== OPML Parsing for Web ======

function parseOPMLContent(xml: string): Array<{ title: string; xmlUrl: string; htmlUrl?: string; category?: string }> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "text/xml")
  const feeds: Array<{ title: string; xmlUrl: string; htmlUrl?: string; category?: string }> = []

  function traverse(outlines: NodeListOf<Element> | Element[], parentCategory = "") {
    for (const outline of outlines) {
      const xmlUrl = outline.getAttribute("xmlUrl") || outline.getAttribute("xmlurl")
      const title = outline.getAttribute("title") || outline.getAttribute("text") || ""
      const htmlUrl = outline.getAttribute("htmlUrl") || outline.getAttribute("htmlurl")

      if (xmlUrl) {
        feeds.push({ title: title || xmlUrl, xmlUrl, htmlUrl: htmlUrl || undefined, category: parentCategory || undefined })
      } else {
        // Folder — recurse
        const children = outline.querySelectorAll(":scope > outline")
        if (children.length > 0) {
          traverse(children, title || parentCategory)
        }
      }
    }
  }

  const body = doc.querySelector("body")
  if (body) {
    traverse(body.querySelectorAll(":scope > outline"))
  }

  return feeds
}

function generateOPMLContent(feeds: Feed[]): string {
  const cats = new Map<string, Feed[]>()
  for (const f of feeds) {
    const cat = f.category || ""
    if (!cats.has(cat)) cats.set(cat, [])
    cats.get(cat)!.push(f)
  }
  let body = ""
  for (const [cat, catFeeds] of cats) {
    if (cat) {
      body += `    <outline text="${escXML(cat)}" title="${escXML(cat)}">\n`
      for (const f of catFeeds) body += `      <outline type="rss" text="${escXML(f.title)}" title="${escXML(f.title)}" xmlUrl="${escXML(f.url)}"${f.siteUrl ? ` htmlUrl="${escXML(f.siteUrl)}"` : ""} />\n`
      body += `    </outline>\n`
    } else {
      for (const f of catFeeds) body += `    <outline type="rss" text="${escXML(f.title)}" title="${escXML(f.title)}" xmlUrl="${escXML(f.url)}"${f.siteUrl ? ` htmlUrl="${escXML(f.siteUrl)}"` : ""} />\n`
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n    <title>Livo Subscriptions</title>\n    <dateCreated>${new Date().toUTCString()}</dateCreated>\n  </head>\n  <body>\n${body}  </body>\n</opml>`
}

function escXML(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") }

// ====== Event System ======

type EventCallback = (...args: unknown[]) => void
const eventListeners = new Map<string, Set<EventCallback>>()

function emit(channel: string, ...args: unknown[]) {
  const listeners = eventListeners.get(channel)
  if (listeners) listeners.forEach((cb) => cb(...args))
}

// ====== Build the WebAPI object ======

export function createWebAPI(): ElectronAPI {
  const api = {
    feeds: {
      add: async (url: string, category?: string, view?: FeedViewType) => {
        try {
          const storedUrl = toRsshubProtocolUrl(url)
          const fetchUrl = toFetchableFeedUrl(storedUrl, DEFAULT_RSSHUB_INSTANCE)
          const parsed = await parseFeedFromUrl(fetchUrl)
          const id = generateId()
          const now = Date.now()
          const detectedView = view ?? detectViewType(parsed.items)

          const feed: Feed = {
            id,
            title: parsed.title || storedUrl,
            url: storedUrl,
            siteUrl: parsed.link,
            description: parsed.description,
            imageUrl: parsed.image?.url,
            category: category || "",
            view: detectedView,
            showInAll: true,
            lastFetched: now,
            errorCount: 0,
            createdAt: now,
          }

          await dbInsertFeed(feed)

          for (const item of parsed.items || []) {
            await dbInsertEntry({
              id: generateId(),
              feedId: id,
              title: item.title || "Untitled",
              url: item.link || "",
              content: item.content || "",
              summary: item.contentSnippet || "",
              author: item.creator || "",
              imageUrl: item.enclosure?.url || "",
              publishedAt: item.isoDate ? new Date(item.isoDate).getTime() : now,
              isRead: false,
              isStarred: false,
              createdAt: now,
            })
          }

          return { success: true, feed }
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },

      remove: async (feedId: string) => {
        await dbDeleteFeed(feedId)
        return { success: true }
      },

      list: async (): Promise<FeedWithCount[]> => {
        const feeds = await getAllFeeds()
        const result: FeedWithCount[] = []
        for (const f of feeds) {
          const unreadCount = await getUnreadCount(f.id)
          result.push({ ...f, unreadCount })
        }
        return result.sort((a, b) => a.title.localeCompare(b.title))
      },

      refresh: async (feedId: string) => {
        const feeds = await getAllFeeds()
        const feed = feeds.find((f) => f.id === feedId)
        if (!feed) return { success: false, error: "Feed not found" }
        try {
          const parsed = await parseFeedFromUrl(toFetchableFeedUrl(feed.url, DEFAULT_RSSHUB_INSTANCE))
          const now = Date.now()
          await dbUpdateFeed(feedId, { title: parsed.title || feed.title, description: parsed.description, imageUrl: parsed.image?.url, lastFetched: now, errorCount: 0 })
          let newCount = 0
          for (const item of parsed.items || []) {
            const added = await dbInsertEntry({ id: generateId(), feedId, title: item.title || "Untitled", url: item.link || "", content: item.content || "", summary: item.contentSnippet || "", author: item.creator || "", imageUrl: item.enclosure?.url || "", publishedAt: item.isoDate ? new Date(item.isoDate).getTime() : now, isRead: false, isStarred: false, createdAt: now })
            if (added) newCount++
          }
          const refreshed = (await getAllFeeds()).find((f) => f.id === feedId)
          const unreadCount = await getUnreadCount(feedId)
          return { success: true, newEntries: newCount, feed: refreshed, unreadCount }
        } catch (error) {
          await dbUpdateFeed(feedId, { errorCount: feed.errorCount + 1 })
          return { success: false, error: String(error) }
        }
      },

      refreshAll: async () => {
        const feeds = await getAllFeeds()
        const results: Array<{ feedId: string; success: boolean; newEntries?: number }> = []
        for (const feed of feeds) {
          try {
            const parsed = await parseFeedFromUrl(toFetchableFeedUrl(feed.url, DEFAULT_RSSHUB_INSTANCE))
            const now = Date.now()
            await dbUpdateFeed(feed.id, { title: parsed.title || feed.title, description: parsed.description, imageUrl: parsed.image?.url, lastFetched: now, errorCount: 0 })
            let newCount = 0
            for (const item of parsed.items || []) {
              const added = await dbInsertEntry({ id: generateId(), feedId: feed.id, title: item.title || "Untitled", url: item.link || "", content: item.content || "", summary: item.contentSnippet || "", author: item.creator || "", imageUrl: item.enclosure?.url || "", publishedAt: item.isoDate ? new Date(item.isoDate).getTime() : now, isRead: false, isStarred: false, createdAt: now })
              if (added) newCount++
            }
            results.push({ feedId: feed.id, success: true, newEntries: newCount })
          } catch {
            await dbUpdateFeed(feed.id, { errorCount: feed.errorCount + 1 })
            results.push({ feedId: feed.id, success: false })
          }
        }
        return results
      },

      update: async (feedId: string, updates: Partial<Feed>) => {
        await dbUpdateFeed(feedId, updates)
        return { success: true }
      },

      importOPML: async () => {
        // Web: use file input
        return new Promise((resolve) => {
          const input = document.createElement("input")
          input.type = "file"
          input.accept = ".opml,.xml"
          input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) { resolve({ success: false, canceled: true }); return }
            try {
              const content = await file.text()
              const opmlFeeds = parseOPMLContent(content)
              if (opmlFeeds.length === 0) { resolve({ success: false, error: "OPML 文件中没有找到订阅源" }); return }
              let imported = 0, skipped = 0
              const errors: string[] = []
              for (const opmlFeed of opmlFeeds) {
                const storedXmlUrl = toRsshubProtocolUrl(opmlFeed.xmlUrl)
                const fetchXmlUrl = toFetchableFeedUrl(storedXmlUrl, DEFAULT_RSSHUB_INSTANCE)
                const existing = await getFeedByUrl(storedXmlUrl)
                if (existing) { skipped++; continue }
                try {
                  const parsed = await parseFeedFromUrl(fetchXmlUrl)
                  const id = generateId()
                  const now = Date.now()
                  await dbInsertFeed({ id, title: opmlFeed.title || parsed.title || storedXmlUrl, url: storedXmlUrl, siteUrl: opmlFeed.htmlUrl || parsed.link, description: parsed.description, imageUrl: parsed.image?.url, category: opmlFeed.category || "", view: detectViewType(parsed.items), showInAll: true, lastFetched: now, errorCount: 0, createdAt: now })
                  for (const item of parsed.items || []) {
                    await dbInsertEntry({ id: generateId(), feedId: id, title: item.title || "Untitled", url: item.link || "", content: item.content || "", summary: item.contentSnippet || "", author: item.creator || "", imageUrl: item.enclosure?.url || "", publishedAt: item.isoDate ? new Date(item.isoDate).getTime() : now, isRead: false, isStarred: false, createdAt: now })
                  }
                  imported++
                } catch (err) { errors.push(`${opmlFeed.title}: ${String(err).slice(0, 100)}`) }
              }
              resolve({ success: true, total: opmlFeeds.length, imported, skipped, errors: errors.length > 0 ? errors : undefined })
            } catch (err) { resolve({ success: false, error: String(err) }) }
          }
          input.click()
        })
      },

      exportOPML: async () => {
        const feeds = await getAllFeeds()
        if (feeds.length === 0) return { success: false, error: "没有可导出的订阅源" }
        const opml = generateOPMLContent(feeds)
        const blob = new Blob([opml], { type: "application/xml" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "livo-subscriptions.opml"
        a.click()
        URL.revokeObjectURL(url)
        return { success: true, count: feeds.length }
      },
    },

    entries: {
      list: async (options: { feedId?: string; feedIds?: string[]; starred?: boolean; unreadOnly?: boolean; limit?: number; offset?: number }): Promise<Entry[]> => {
        return dbGetEntries(options)
      },
      get: async (entryId: string): Promise<Entry | null> => {
        return (await dbGetEntryById(entryId)) || null
      },
      markRead: async (entryId: string, isRead: boolean) => {
        await dbUpdateEntry(entryId, { isRead })
        return { success: true }
      },
      markAllRead: async (feedId?: string) => {
        await dbMarkAllRead(feedId)
        return { success: true }
      },
      toggleStar: async (entryId: string) => {
        const entry = await dbGetEntryById(entryId)
        if (!entry) return { success: false, isStarred: false }
        const newStarred = !entry.isStarred
        await dbUpdateEntry(entryId, { isStarred: newStarred })
        return { success: true, isStarred: newStarred }
      },
      search: async (query: string, limit?: number): Promise<Entry[]> => {
        return dbSearchEntries(query, limit)
      },
    },

    ai: {
      summarize: async (content: string, language?: string) => {
        const settings = await getSettings()
        if (!settings.ai.apiKey && settings.ai.provider !== "ollama") return { success: false, error: "请先在设置中配置 AI API Key" }
        try {
          const lang = language || settings.general.language || "zh-CN"
          const result = await callAI([
            { role: "system", content: `You are a helpful assistant that summarizes articles. Provide a concise summary in ${lang}. Keep it under 200 words. Focus on key points and main ideas.` },
            { role: "user", content: `Please summarize the following article:\n\n${content.slice(0, 8000)}` },
          ], { temperature: 0.3, max_tokens: 500 })
          return { success: true, summary: result.content }
        } catch (error) { return { success: false, error: String(error) } }
      },

      translate: async (content: string, targetLanguage: string) => {
        const settings = await getSettings()
        if (!settings.ai.apiKey && settings.ai.provider !== "ollama") return { success: false, error: "请先在设置中配置 AI API Key" }
        try {
          const result = await callAI([
            { role: "system", content: `You are a professional translator. Translate the following content to ${targetLanguage}. Preserve original HTML formatting and tags. Only output the translation, no explanations.` },
            { role: "user", content: content.slice(0, 6000) },
          ], { temperature: 0.2, max_tokens: 4000 })
          return { success: true, translation: result.content }
        } catch (error) { return { success: false, error: String(error) } }
      },

      chat: async (messages: Array<{ role: string; content: string }>) => {
        try {
          const result = await callAI(messages, { temperature: 0.7, max_tokens: 2000 })
          return { success: true, message: result.content }
        } catch (error) { return { success: false, error: String(error) } }
      },

      chatStream: async (messages: Array<{ role: string; content: string }>, requestId: string) => {
        try {
          await callAIStream(
            messages,
            (content) => emit("ai:chat-stream-chunk", { requestId, content }),
            () => emit("ai:chat-stream-done", { requestId }),
            (error) => emit("ai:chat-stream-error", { requestId, error })
          )
          return { success: true }
        } catch (error) { return { success: false, error: String(error) } }
      },

      onStreamChunk: (callback: (data: { requestId: string; content: string }) => void) => {
        const cb = (...args: unknown[]) => callback(args[0] as { requestId: string; content: string })
        if (!eventListeners.has("ai:chat-stream-chunk")) eventListeners.set("ai:chat-stream-chunk", new Set())
        eventListeners.get("ai:chat-stream-chunk")!.add(cb)
        return () => eventListeners.get("ai:chat-stream-chunk")?.delete(cb)
      },
      onStreamDone: (callback: (data: { requestId: string }) => void) => {
        const cb = (...args: unknown[]) => callback(args[0] as { requestId: string })
        if (!eventListeners.has("ai:chat-stream-done")) eventListeners.set("ai:chat-stream-done", new Set())
        eventListeners.get("ai:chat-stream-done")!.add(cb)
        return () => eventListeners.get("ai:chat-stream-done")?.delete(cb)
      },
      onStreamError: (callback: (data: { requestId: string; error: string }) => void) => {
        const cb = (...args: unknown[]) => callback(args[0] as { requestId: string; error: string })
        if (!eventListeners.has("ai:chat-stream-error")) eventListeners.set("ai:chat-stream-error", new Set())
        eventListeners.get("ai:chat-stream-error")!.add(cb)
        return () => eventListeners.get("ai:chat-stream-error")?.delete(cb)
      },
    },

    settings: {
      get: async (): Promise<AppSettings> => {
        return getSettings()
      },
      set: async (updates: Partial<AppSettings>) => {
        const current = await getSettings()
        const merged: AppSettings = {
          ...current,
          ...updates,
          ai: { ...current.ai, ...(updates.ai || {}) },
          general: { ...current.general, ...(updates.general || {}) },
          translation: { ...current.translation, ...(updates.translation || {}) },
        }
        await saveSettings(merged)
        return { success: true, settings: merged }
      },
    },

    data: {
      cleanup: async () => ({
        removed: 0,
        removedByCap: 0,
        removedByAge: 0,
        remaining: (await dbGetEntries({})).length,
      }),
      stats: async () => {
        const [feeds, entries] = await Promise.all([getAllFeeds(), dbGetEntries({})])
        return {
          totalFeeds: feeds.length,
          totalEntries: entries.length,
          readEntries: entries.filter((entry) => entry.isRead).length,
          starredEntries: entries.filter((entry) => entry.isStarred).length,
          cacheSizeBytes: 0,
        }
      },
    },

    app: {},

    // Readability
    readability: {
      fetch: async (url: string) => {
        try {
          return await fetchReadableContent(url)
        } catch (error) {
          return { success: false, error: `无法获取原文: ${String(error)}` }
        }
      },
    },

    // Discover
    discover: {
      categories: async () => DISCOVER_CATEGORIES,
      popular: async (category?: string) => category ? CURATED_FEEDS.filter((f) => f.category === category) : CURATED_FEEDS,
      search: async (query: string) => {
        const results: Array<{ title: string; url: string; siteUrl: string; description: string; source: "curated" | "url" | "rsshub" }> = []
        const curated = searchCuratedFeeds(query)
        for (const f of curated) results.push({ title: f.title, url: f.url, siteUrl: f.siteUrl, description: f.description, source: "curated" })
        const q = query.toLowerCase()
        for (const r of RSSHUB_ROUTES.filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))) {
          results.push({ title: r.name, url: `${DEFAULT_RSSHUB_INSTANCE}${r.url}`, siteUrl: `${DEFAULT_RSSHUB_INSTANCE}${r.url}`, description: `${r.description} (RSSHub)`, source: "rsshub" })
        }
        const trimmedQuery = query.trim()
        const looksLikeUrl =
          /^rsshub:\/\//i.test(trimmedQuery) ||
          /^https?:\/\//i.test(trimmedQuery) ||
          (trimmedQuery.includes(".") && !trimmedQuery.includes(" "))
        if (looksLikeUrl) {
          const feedUrl = normalizeDiscoverQueryToFeedUrl(trimmedQuery, DEFAULT_RSSHUB_INSTANCE)
          try {
            const parsed = await parseFeedFromUrl(feedUrl)
            if (!results.some((r) => r.url === feedUrl)) {
              const displayTitle = await inferDiscoverResultTitle(feedUrl, parsed.title || undefined)
              results.push({ title: displayTitle, url: feedUrl, siteUrl: parsed.link || feedUrl, description: parsed.description || "直接 URL 订阅", source: "url" })
            }
          } catch {
            if (!results.some((r) => r.url === feedUrl)) {
              const displayTitle = await inferDiscoverResultTitle(feedUrl)
              results.push({ title: displayTitle, url: feedUrl, siteUrl: feedUrl, description: "直接 URL 订阅", source: "url" })
            }
          }
        }
        return results
      },
      rsshubRoutes: async (category?: string) => category ? RSSHUB_ROUTES.filter((r) => r.category === category) : RSSHUB_ROUTES,
      rsshubInstance: async () => DEFAULT_RSSHUB_INSTANCE,
      validateFeed: async (url: string) => {
        try {
          const fetchUrl = toFetchableFeedUrl(url, DEFAULT_RSSHUB_INSTANCE)
          const parsed = await parseFeedFromUrl(fetchUrl)
          const fallbackImage = parsed.items.find((i) => i.enclosure?.type?.startsWith("image/"))?.enclosure?.url || ""
          return {
            valid: true,
            title: parsed.title,
            description: parsed.description,
            image: parsed.image?.url || fallbackImage,
            itemCount: parsed.items.length,
          }
        } catch (error) { return { valid: false, error: String(error) } }
      },
      resolveProfileUrl: async (url: string) => {
        const resolved = resolveProfileUrlToCandidates(url, DEFAULT_RSSHUB_INSTANCE)
        if (resolved.platform === "x") {
          const usernames = new Set<string>()
          for (const c of resolved.candidates) {
            const m = c.feedUrl.match(/\/twitter\/user\/([^/?#]+)/i)
            if (m?.[1]) usernames.add(decodeURIComponent(m[1]))
          }
          if (usernames.size === 0 && resolved.normalizedUrl) {
            try {
              const u = new URL(resolved.normalizedUrl)
              const maybeUser = u.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "")
              if (maybeUser) usernames.add(maybeUser)
            } catch {
              // Ignore malformed URLs.
            }
          }
          const existing = new Set(resolved.candidates.map((x) => x.feedUrl))
          for (const username of usernames) {
            const nitterUrl = `https://nitter.net/${encodeURIComponent(username)}/rss`
            if (existing.has(nitterUrl)) continue
            resolved.candidates.push({
              feedUrl: nitterUrl,
              title: `@${username}`,
              source: "derived",
              siteUrl: `https://x.com/${username}`,
              description: "Nitter RSS fallback for X/Twitter user",
            })
            existing.add(nitterUrl)
          }
          if (resolved.candidates.length > 0) {
            resolved.matched = true
            resolved.reason = null
          }
        }
        if (resolved.candidates.some((c) => c.requiresAccount?.includes("youtube"))) {
          resolved.accountStates = [{ provider: "youtube", linked: false, displayName: null }]
        } else {
          resolved.accountStates = []
        }
        return resolved
      },
      probeVideoSources: async (query: string) => {
        const clean = query.trim().replace(/^@/, "")
        if (!clean) return { valid: false, query: clean, candidates: [] }
        const candidates: Array<{
          platform: "youtube" | "bilibili"
          title: string
          description: string
          image: string
          feedUrl: string
        }> = []
        try {
          const yt = await (window as any).api?.discover?.probeYouTubeChannel?.(clean)
          if (yt?.valid && yt.feedUrl) {
            candidates.push({
              platform: "youtube",
              title: yt.title || `${clean} - YouTube`,
              description: yt.description || "YouTube",
              image: yt.image || "",
              feedUrl: yt.feedUrl,
            })
          }
        } catch {
          // Ignore.
        }
        return { valid: candidates.length > 0, query: clean, candidates }
      },
      probeBilibiliUid: async (uid: string) => {
        const clean = (uid || "").trim().match(/^(\d{3,})$/)?.[1]
        if (!clean) return { valid: false, uid }
        const feedUrl = `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/video/${clean}`
        return {
          valid: true,
          uid: clean,
          title: `UID ${clean} - Bilibili`,
          description: `UID ${clean}`,
          image: "",
          feedUrl,
        }
      },
      probeBilibiliUsers: async (query: string) => {
        const clean = (query || "").trim()
        if (!clean) return { valid: false, query: clean, candidates: [] }
        const candidates: Array<{ uid: string; title: string; description: string; image: string; feedUrl: string }> = []
        try {
          const endpoint = `https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(clean)}`
          const res = await fetch(endpoint)
          if (res.ok) {
            const json = await res.json() as {
              code?: number
              data?: { result?: Array<{ mid?: number; uname?: string; usign?: string; upic?: string }> }
            }
            if (json.code === 0) {
              const q = clean.toLowerCase()
              const seen = new Set<string>()
              for (const user of (json.data?.result || []).slice(0, 6)) {
                const uid = user.mid ? String(user.mid) : ""
                if (!uid || seen.has(uid)) continue
                seen.add(uid)
                const uname = (user.uname || `UID ${uid}`).replace(/<[^>]+>/g, "").trim()
                const usign = (user.usign || "").replace(/<[^>]+>/g, "").trim()
                const searchable = `${uname} ${usign} ${uid}`.toLowerCase()
                if (!searchable.includes(q)) continue
                candidates.push({
                  uid,
                  title: `${uname} - Bilibili`,
                  description: usign || `UID ${uid}`,
                  image: user.upic || "",
                  feedUrl: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/dynamic/${uid}`,
                })
              }
            }
          }
        } catch {
          // Ignore.
        }
        return { valid: candidates.length > 0, query: clean, candidates }
      },
      probeTwitterUser: async (username: string) => {
        const clean = username.trim().replace(/^@/, "")
        const fallbackTitle = `${clean} - X`
        const candidates = [
          `${DEFAULT_RSSHUB_INSTANCE}/twitter/user/${encodeURIComponent(clean)}`,
          `https://nitter.net/${encodeURIComponent(clean)}/rss`,
        ]
        for (const feedUrl of candidates) {
          try {
            const parsed = await parseFeedFromUrl(feedUrl)
            const parsedName = extractTwitterDisplayNameFromText(parsed.title || "", clean)
            const fetchedName = parsedName ? "" : await fetchXDisplayNameByUsername(clean)
            return {
              valid: true,
              username: clean,
              title: parsedName ? `${parsedName} - X` : (fetchedName ? `${fetchedName} - X` : (parsed.title || fallbackTitle)),
              description: parsed.description || "",
              image: `https://unavatar.io/x/${encodeURIComponent(clean)}`,
              feedUrl,
            }
          } catch {
            continue
          }
        }
        return { valid: false, username: clean }
      },
      probeYouTubeChannel: async (query: string) => {
        const clean = query.trim().replace(/^@/, "")
        if (!clean) return { valid: false, query: clean }
        const routes = [`/youtube/user/@${clean}`, `/youtube/user/${clean}`, `/youtube/channel/${clean}`]
        for (const route of routes) {
          try {
            const feedUrl = `${DEFAULT_RSSHUB_INSTANCE}${route}`
            const parsed = await parseFeedFromUrl(feedUrl)
            return { valid: true, query: clean, title: parsed.title || clean, description: parsed.description || "", image: (parsed as any).image?.url || "", feedUrl, feedRoute: route }
          } catch { continue }
        }
        return { valid: false, query: clean }
      },
      probeInstagramUser: async (username: string) => {
        const clean = username.trim().replace(/^@/, "")
        if (!clean) return { valid: false, username: clean }
        const routes = [`/instagram/user/${encodeURIComponent(clean)}`]
        const profileAvatar = await fetchInstagramAvatarByUsername(clean)
        for (const route of routes) {
          try {
            const feedUrl = `${DEFAULT_RSSHUB_INSTANCE}${route}`
            const parsed = await parseFeedFromUrl(feedUrl)
            const image =
              getProbeImageFromParsed(parsed)
              || profileAvatar
              || `https://unavatar.io/instagram/${encodeURIComponent(clean)}`
            return {
              valid: true,
              username: clean,
              title: parsed.title || `@${clean}`,
              description: parsed.description || "",
              image,
              feedUrl,
            }
          } catch {
            continue
          }
        }
        return { valid: false, username: clean }
      },
    },

    // Video resolution & YouTube account — web platform stubs
    video: {
      resolve: async (_url: string) => ({ success: false as const, error: "Not available on web platform" }),
      openInApp: async (url: string) => {
        try {
          window.open(url, "_blank", "noopener,noreferrer")
          return { success: true }
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },
      ytLogin: async () => ({ success: false, error: "Not available on web" }),
      ytStatus: async () => ({ loggedIn: false, name: null }),
      ytLogout: async () => ({ success: false, error: "Not available on web" }),
    },

    accounts: {
      status: async (provider: AccountProvider) => ({ provider, linked: false as const, displayName: null }),
      link: async (_provider: AccountProvider) => ({ success: false as const, error: "Not available on web" }),
      unlink: async (_provider: AccountProvider) => ({ success: false as const, error: "Not available on web" }),
      setDisplayName: async (_provider: AccountProvider, _displayName: string) => ({ success: false as const, error: "Not available on web" }),
    },

    on: (channel: string, callback: (...args: unknown[]) => void) => {
      if (!eventListeners.has(channel)) eventListeners.set(channel, new Set())
      eventListeners.get(channel)!.add(callback)
      return () => eventListeners.get(channel)?.delete(callback)
    },
  }

  return api as unknown as ElectronAPI
}

/** Initialize the web platform and return the API */
export async function initWebPlatform(): Promise<ElectronAPI> {
  await initWebDB()
  return createWebAPI()
}
