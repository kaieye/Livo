function extractBilibiliUid(feedUrl: string): string | null {
  try {
    const u = new URL(feedUrl)
    const m = u.pathname.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i)
    return m?.[1] || null
  } catch {
    return null
  }
}

function extractInstagramUsername(feedUrl: string): string | null {
  try {
    const u = new URL(feedUrl)
    const path = u.pathname || ""
    const ig = path.match(/\/instagram\/user\/([^/?#]+)/i)
    if (ig?.[1]) return decodeURIComponent(ig[1]).replace(/^@/, "")
    const picnob = path.match(/\/picnob(?:\.info)?\/user\/([^/?#]+)/i)
    if (picnob?.[1]) return decodeURIComponent(picnob[1]).replace(/^@/, "")
    const pixnoy = path.match(/\/pixnoy\/user\/([^/?#]+)/i)
    if (pixnoy?.[1]) return decodeURIComponent(pixnoy[1]).replace(/^@/, "")
    const piokok = path.match(/\/piokok\/user\/([^/?#]+)/i)
    if (piokok?.[1]) return decodeURIComponent(piokok[1]).replace(/^@/, "")
    // rsshub://picnob/user/{name} or rsshub://instagram/user/{name}
    if (/^(picnob|picnob\.info|pixnoy|piokok|instagram)$/i.test(u.hostname)) {
      const hostRoute = path.match(/\/user\/([^/?#]+)/i)
      if (hostRoute?.[1]) return decodeURIComponent(hostRoute[1]).replace(/^@/, "")
    }
    if (/^(www\.)?instagram\.com$/i.test(u.hostname)) {
      const user = path.split("/").filter(Boolean)[0]
      if (user) return decodeURIComponent(user).replace(/^@/, "")
    }
  } catch {
    // Ignore malformed feed URL.
  }
  // Fallback for non-standard URL parse cases.
  const raw = feedUrl.trim()
  const protoHostRoute = raw.match(/^rsshub:\/\/(?:picnob(?:\.info)?|pixnoy|piokok|instagram)\/user\/([^/?#]+)/i)
  if (protoHostRoute?.[1]) return decodeURIComponent(protoHostRoute[1]).replace(/^@/, "")
  const protoPathRoute = raw.match(/^rsshub:\/\/(?:[^/]+\/)?(?:picnob(?:\.info)?|pixnoy|piokok|instagram)\/user\/([^/?#]+)/i)
  if (protoPathRoute?.[1]) return decodeURIComponent(protoPathRoute[1]).replace(/^@/, "")
  return null
}

function isPlaceholderAvatar(url?: string): boolean {
  const raw = (url || "").trim().toLowerCase()
  if (!raw) return true
  return (
    raw.includes("unavatar.io/instagram/") ||
    raw.includes("instagram.com/static/images/ico") ||
    raw.includes("instagram_static/images/ico") ||
    raw.includes("instagram_logo") ||
    raw.includes("instagram-logo") ||
    raw.includes("/apple-touch-icon") ||
    raw.includes("favicon") ||
    ((raw.includes("picnob") || raw.includes("pixnoy")) && raw.includes("logo"))
  )
}

async function tryConvertImageUrlToDataUri(imageUrl: string): Promise<string | undefined> {
  if (!/^https?:\/\//i.test(imageUrl)) return undefined
  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": "https://www.instagram.com/",
        "Origin": "https://www.instagram.com",
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return undefined
    const contentType = (res.headers.get("content-type") || "").toLowerCase()
    if (contentType && !contentType.startsWith("image/")) return undefined
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.length < 64) return undefined
    const ext = imageUrl.split(".").pop()?.split("?")[0]?.toLowerCase()
    const mime = contentType.startsWith("image/")
      ? contentType.split(";")[0]
      : ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "png"
      ? "image/png"
      : ext === "webp"
      ? "image/webp"
      : ext === "gif"
      ? "image/gif"
      : "image/jpeg"
    return `data:${mime};base64,${buffer.toString("base64")}`
  } catch {
    return undefined
  }
}

async function fetchInstagramAvatar(username: string): Promise<string | undefined> {
  const clean = username.trim().replace(/^@/, "")
  if (!clean) return undefined
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(clean)}/`
  try {
    const res = await fetch(profileUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return undefined
    const html = await res.text()
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (og?.[1] && /^https?:\/\//i.test(og[1])) {
      const inlined = await tryConvertImageUrlToDataUri(og[1])
      if (inlined) return inlined
    }
    const hd = html.match(/"profile_pic_url_hd":"(https?:\\\/\\\/[^"]+)"/i)
    if (hd?.[1]) {
      const decoded = hd[1].replace(/\\\//g, "/")
      if (/^https?:\/\//i.test(decoded)) {
        const inlined = await tryConvertImageUrlToDataUri(decoded)
        if (inlined) return inlined
      }
    }
  } catch {
    // Ignore single-source avatar resolution failures.
  }
  return undefined
}

async function fetchBilibiliAvatar(uid: string): Promise<string | undefined> {
  const referer = `https://space.bilibili.com/${encodeURIComponent(uid)}`
  const endpoints = [
    `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(uid)}`,
    `https://api.bilibili.com/x/space/acc/info?mid=${encodeURIComponent(uid)}`,
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json, text/plain, */*",
          "Referer": referer,
          "Origin": "https://www.bilibili.com",
        },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue

      const json = await res.json() as {
        code?: number
        data?: {
          card?: { face?: string }
          face?: string
        }
      }
      if (json.code !== 0) continue

      const face = json.data?.card?.face || json.data?.face
      if (face && /^https?:\/\//i.test(face)) return face
    } catch {
      // Ignore single-endpoint failure.
    }
  }

  return undefined
}

/**
 * Resolve a best-effort feed avatar.
 * Prefer the latest non-placeholder image exposed by the feed itself, and
 * otherwise probe platform-specific sources that may change over time.
 */
export async function resolveFeedAvatar(
  feedUrl: string,
  incomingImageUrl?: string,
  existingImageUrl?: string,
): Promise<string | undefined> {
  if (incomingImageUrl && !isPlaceholderAvatar(incomingImageUrl)) return incomingImageUrl

  const bilibiliUid = extractBilibiliUid(feedUrl)
  if (bilibiliUid) {
    const resolved = await fetchBilibiliAvatar(bilibiliUid)
    return resolved || incomingImageUrl || existingImageUrl
  }

  const instagramUsername = extractInstagramUsername(feedUrl)
  if (instagramUsername) {
    const resolved = await fetchInstagramAvatar(instagramUsername)
    if (resolved) return resolved
    // Fallback to SVG data URI for Instagram (no external network request needed)
    const svgAvatar = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect fill="#E1306C" width="128" height="128" rx="24"/><text x="64" y="80" text-anchor="middle" fill="white" font-family="system-ui" font-size="48" font-weight="600">${instagramUsername.charAt(0).toUpperCase()}</text></svg>`)}`
    return svgAvatar
  }

  return incomingImageUrl || existingImageUrl
}
