import https from "https"

interface BilibiliCardResponse {
  code?: number
  data?: {
    card?: {
      name?: string
    }
  }
}

function extractBilibiliUidFromFeedUrl(feedUrl: string): string | null {
  try {
    const parsed = new URL(feedUrl)
    const m = parsed.pathname.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i)
    if (m?.[1]) return m[1]
  } catch {
    // Ignore malformed URL
  }
  return null
}

function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          ...headers,
        },
        timeout: 8000,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (chunk) => chunks.push(chunk))
        res.on("end", () => {
          try {
            const text = Buffer.concat(chunks).toString("utf-8")
            resolve(JSON.parse(text))
          } catch (err) {
            reject(err)
          }
        })
      },
    )
    req.on("timeout", () => {
      req.destroy(new Error("request timeout"))
    })
    req.on("error", reject)
    req.end()
  })
}

async function resolveBilibiliNameByUid(uid: string): Promise<string | undefined> {
  try {
    const json = (await fetchJson(`https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(uid)}`, {
      Referer: `https://space.bilibili.com/${uid}`,
    })) as BilibiliCardResponse
    if (json?.code !== 0) return undefined
    const name = json?.data?.card?.name?.trim()
    if (!name) return undefined
    return name
  } catch {
    return undefined
  }
}

export async function resolveFeedTitleFallback(feedUrl: string): Promise<string | undefined> {
  const bilibiliUid = extractBilibiliUidFromFeedUrl(feedUrl)
  if (bilibiliUid) {
    const name = await resolveBilibiliNameByUid(bilibiliUid)
    if (name) return `${name} (Bilibili)`
  }
  return undefined
}

