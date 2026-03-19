export function formatFeedTitle(feedUrl: string, parsedTitle?: string, fallbackTitle?: string): string {
  const title = (parsedTitle || fallbackTitle || "").trim()

  const bilibiliName = extractBilibiliNameFromTitle(title)
  if (isBilibiliFeedUrl(feedUrl) && bilibiliName) {
    return `${bilibiliName} - Bilibili`
  }

  if (isTwitterFeedUrl(feedUrl)) {
    const twitterName =
      extractTwitterNameFromTitle(title)
      || extractTwitterUsernameFromFeedUrl(feedUrl)
    if (twitterName) {
      return `${twitterName} - X`
    }
  }

  if (isInstagramFeedUrl(feedUrl)) {
    const instagramName =
      extractInstagramNameFromTitle(title)
      || extractInstagramUsernameFromFeedUrl(feedUrl)
    if (instagramName) {
      return `${instagramName} - Ins`
    }
  }

  return title || fallbackTitle || feedUrl
}

function getPathLike(feedUrl: string): string {
  try {
    const u = new URL(feedUrl)
    if (u.protocol.toLowerCase() === "rsshub:") {
      return `/${u.hostname}${u.pathname}`
    }
    return u.pathname
  } catch {
    return feedUrl
  }
}

function isBilibiliFeedUrl(feedUrl: string): boolean {
  return /\/bilibili\//i.test(getPathLike(feedUrl))
}

function extractBilibiliNameFromTitle(title: string): string {
  if (!title) return ""

  // Common RSSHub title patterns:
  // "褰辫椋撻 鐨?bilibili 绌洪棿"
  // "褰辫椋撻 鐨?bilibili 鎶曠"
  const m1 = title.match(/^(.+?)\s+鐨刓s+bilibili\s+/i)
  if (m1?.[1]) return m1[1].trim()

  // Fallback: remove common suffix markers
  const m2 = title
    .replace(/\s*bilibili\s*(?:space|\u7A7A\u95F4|\u6295\u7A3F|\u89C6\u9891|\u52A8\u6001)?\s*$/i, "")
    .trim()
  if (m2 && m2 !== title) return m2

  return ""
}

function isTwitterFeedUrl(feedUrl: string): boolean {
  try {
    const u = new URL(feedUrl)
    const host = u.hostname.toLowerCase()
    if (/\/twitter\/user\//i.test(getPathLike(feedUrl))) return true
    if (host.includes("nitter")) {
      const parts = u.pathname.split("/").filter(Boolean)
      return parts.length >= 2 && parts[1].toLowerCase() === "rss"
    }
    return false
  } catch {
    return /\/twitter\/user\//i.test(feedUrl)
  }
}

function extractTwitterNameFromTitle(title: string): string {
  if (!title) return ""
  let cleaned = title
    .trim()
  if (!cleaned || /^https?:\/\/\S+$/i.test(cleaned)) return ""
  const stripHandleFragment = (value: string): string =>
    value
      .replace(/\s*(?:\/|\||\uFF0F)\s*@?[a-zA-Z0-9_]{1,15}\s*$/i, "")
      .replace(/\s*\(\s*@?[a-zA-Z0-9_]{1,15}\s*\)\s*$/i, "")
      .trim()

  // "Elon Musk / @elonmusk - X" => "Elon Musk"
  const slashHandlePattern = cleaned.match(
    /^(.+?)\s*\/\s*@?[a-zA-Z0-9_]{1,15}\s*(?:[-\u2013\u2014]\s*(?:x|twitter)|\/\s*(?:x|twitter)|on\s*(?:x|twitter))?\s*$/i,
  )
  if (slashHandlePattern?.[1]) {
    const normalized = stripHandleFragment(slashHandlePattern[1].trim())
    if (normalized) return normalized
  }
  const handleMatch = cleaned.match(/^(.+?)\s*\(\s*@([a-zA-Z0-9_]{1,15})\s*\)\s*(?:\/|[-\u2013\u2014]|on)\s*(?:x|twitter)\s*$/i)
  if (handleMatch?.[1]) return handleMatch[1].trim()
  const slashMatch = cleaned.match(/^(.+?)\s*(?:\/|[-\u2013\u2014]|on)\s*(?:x|twitter)\s*$/i)
  if (slashMatch?.[1]) {
    const fromSlash = stripHandleFragment(slashMatch[1].trim()).replace(/^@/, "")
    if (fromSlash) return fromSlash
  }
  cleaned = cleaned
    .replace(/^twitter\s*@?/i, "")
    .replace(/^x\s*@?/i, "")
    .replace(/^(?:x|twitter)\s*-\s*/i, "")
    .trim()
  cleaned = cleaned
    .replace(/\s*-\s*(?:x|twitter)\s*$/i, "")
    .replace(/\s+on\s+(?:x|twitter)\s*$/i, "")
    .trim()
  cleaned = stripHandleFragment(cleaned)
  cleaned = cleaned.replace(/^@/, "").trim()
  return cleaned
}

function extractTwitterUsernameFromFeedUrl(feedUrl: string): string {
  try {
    const u = new URL(feedUrl)
    const rsshubMatch = getPathLike(feedUrl).match(/\/twitter\/user\/([^/?#]+)/i)
    if (rsshubMatch?.[1]) return decodeURIComponent(rsshubMatch[1]).replace(/^@/, "")
    if (u.hostname.toLowerCase().includes("nitter")) {
      const parts = u.pathname.split("/").filter(Boolean)
      if (parts.length >= 2 && parts[1].toLowerCase() === "rss") {
        return decodeURIComponent(parts[0]).replace(/^@/, "")
      }
    }
  } catch {
    // ignore
  }
  return ""
}

function isInstagramFeedUrl(feedUrl: string): boolean {
  const p = getPathLike(feedUrl).toLowerCase()
  return /\/instagram\/user\//i.test(p) || /\/picnob(?:\.info)?\/user\//i.test(p) || /\/pixnoy\/user\//i.test(p) || /\/piokok\/user\//i.test(p)
}

function extractInstagramNameFromTitle(title: string): string {
  if (!title) return ""
  let cleaned = title.trim()
  if (!cleaned || /^https?:\/\/\S+$/i.test(cleaned)) return ""

  // Picnob/RSSHub common pattern:
  // "nana (@NanaOuYang) public posts - Picnob ..."
  const fromAt = cleaned.match(/@([a-zA-Z0-9._]{1,30})/)
  if (fromAt?.[1]) return fromAt[1]
  const fromPicnobSuffix = cleaned.match(/^([a-zA-Z0-9._]{1,30})\s*-\s*picnob(?:\.[^\s]+)?/i)
  if (fromPicnobSuffix?.[1]) return fromPicnobSuffix[1]
  const fromPicnobLead = cleaned.match(/^([a-zA-Z0-9._]{1,30})\s+\([^)]*\)\s+public\s+posts/i)
  if (fromPicnobLead?.[1]) return fromPicnobLead[1]

  cleaned = cleaned
    .replace(/^instagram\s*@?/i, "")
    .replace(/^ins\s*@?/i, "")
    .replace(/^(?:instagram|ins)\s*-\s*/i, "")
    .replace(/\s*-\s*(?:instagram|ins)\s*$/i, "")
    .replace(/\s*-\s*picnob(?:\.[^\s]+)?[\s\S]*$/i, "")
    .replace(/\s+public\s+posts[\s\S]*$/i, "")
    .replace(/^@/, "")
    .trim()

  const fromParen = cleaned.match(/^([a-zA-Z0-9._]{1,30})\s+\([^)]*\)$/)
  if (fromParen?.[1]) return fromParen[1]

  const lowered = cleaned.toLowerCase()
  if (
    lowered === "rss"
    || lowered === "feed"
    || lowered === "rss feed"
    || lowered === "atom"
    || lowered === "atom feed"
  ) return ""

  return cleaned
}

function extractInstagramUsernameFromFeedUrl(feedUrl: string): string {
  try {
    const u = new URL(feedUrl)
    const pathLike = getPathLike(feedUrl)
    const instagram = pathLike.match(/\/instagram\/user\/([^/?#]+)/i)
    if (instagram?.[1]) return decodeURIComponent(instagram[1]).replace(/^@/, "")
    const picnob = pathLike.match(/\/picnob(?:\.info)?\/user\/([^/?#]+)/i)
    if (picnob?.[1]) return decodeURIComponent(picnob[1]).replace(/^@/, "")
    const pixnoy = pathLike.match(/\/pixnoy\/user\/([^/?#]+)/i)
    if (pixnoy?.[1]) return decodeURIComponent(pixnoy[1]).replace(/^@/, "")
    const piokok = pathLike.match(/\/piokok\/user\/([^/?#]+)/i)
    if (piokok?.[1]) return decodeURIComponent(piokok[1]).replace(/^@/, "")
    if (/^(www\.)?instagram\.com$/i.test(u.hostname)) {
      return (u.pathname.split("/").filter(Boolean)[0] || "").replace(/^@/, "")
    }
  } catch {
    // ignore
  }
  return ""
}

