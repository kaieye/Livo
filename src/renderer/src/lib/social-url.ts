function decodeHtmlEntities(input: string): string {
  return (input || "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

function trimTrailingUrlPunctuation(input: string): string {
  return (input || "").replace(/[)\]}>，。,;；!！?？]+$/g, "")
}

export function normalizeExternalUrl(rawUrl: string): string {
  const decoded = trimTrailingUrlPunctuation(decodeHtmlEntities((rawUrl || "").trim()).replace(/\\\//g, "/"))
  if (!decoded) return ""
  try {
    return new URL(decoded).toString()
  } catch {
    try {
      return new URL(encodeURI(decoded)).toString()
    } catch {
      return ""
    }
  }
}

export function extractFirstHttpUrl(rawText: string): string {
  const text = decodeHtmlEntities((rawText || "").replace(/\\\//g, "/"))
  const match = text.match(/https?:\/\/[^\s"'<>]+/i)
  if (!match?.[0]) return ""
  return normalizeExternalUrl(match[0])
}

function isLikelyMediaUrl(url: string): boolean {
  const raw = (url || "").toLowerCase()
  if (!raw) return false
  if (/\.(jpg|jpeg|png|webp|gif|bmp|avif|mp4|webm|mov|m3u8)(\?|$)/i.test(raw)) return true
  return (
    raw.includes("cdninstagram.com/") ||
    raw.includes("fbcdn.net/") ||
    raw.includes("scontent.") ||
    raw.includes("media.picnob.info/get") ||
    raw.includes("media.pixnoy.com/get") ||
    raw.includes("pixnoy.com/p/pt") ||
    /sp\d+\.pixnoy\.com\/p\/pt/i.test(raw) ||
    raw.includes("images.weserv.nl/") ||
    raw.includes("wsrv.nl/")
  )
}

export function extractFirstNonMediaUrl(rawText: string): string {
  const text = decodeHtmlEntities((rawText || "").replace(/\\\//g, "/"))
  const matches = text.match(/https?:\/\/[^\s"'<>]+/gi) || []
  for (const candidate of matches) {
    const normalized = normalizeExternalUrl(candidate)
    if (!normalized) continue
    if (isLikelyMediaUrl(normalized)) continue
    return normalized
  }
  return ""
}

export function canonicalizeSocialUrl(rawUrl: string): string {
  const raw = normalizeExternalUrl(rawUrl)
  if (!raw) return ""

  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()

    // Convert Nitter/Twitter variants to canonical X links.
    if (host.includes("nitter") || host === "twitter.com" || host === "www.twitter.com") {
      const next = new URL(parsed.toString())
      next.hostname = "x.com"
      next.protocol = "https:"
      next.port = ""
      return next.toString()
    }
  } catch {
    // Ignore URL parse failure and continue with route parsing.
  }

  // rsshub://twitter/user/{username}
  const rssUser = raw.match(/^rsshub:\/\/twitter\/user\/([^/?#]+)/i) || raw.match(/\/twitter\/user\/([^/?#]+)/i)
  if (rssUser?.[1]) {
    return `https://x.com/${decodeURIComponent(rssUser[1]).replace(/^@+/, "")}`
  }

  return normalizeExternalUrl(raw)
}

export function normalizeSocialHandle(handle?: string): string {
  return (handle || "").replace(/^@+/, "").trim()
}
