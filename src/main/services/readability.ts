/**
 * Readability service - extracts clean readable content from web pages.
 * Uses a custom extraction approach without external dependencies.
 */

/** Result from readability extraction */
export interface ReadabilityResult {
  title: string
  content: string
  excerpt: string
  siteName: string
  length: number
}

/**
 * Fetch a URL and extract readable content.
 */
export async function fetchReadableContent(url: string): Promise<ReadabilityResult> {
  // Fetch the page HTML
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  return extractReadableContent(html, url)
}

/**
 * Extract readable content from raw HTML.
 */
export function extractReadableContent(html: string, url: string): ReadabilityResult {
  // Extract title
  const title = extractTitle(html)

  // Extract site name
  const siteName = extractSiteName(html, url)

  // Remove unwanted elements
  let content = removeUnwantedElements(html)

  // Find the main content area
  content = findMainContent(content)

  // Clean up the content
  content = cleanContent(content)

  // Extract text for excerpt
  const textContent = content.replace(/<[^>]*>/g, "").trim()
  const excerpt = textContent.slice(0, 200).trim()

  return {
    title,
    content,
    excerpt,
    siteName,
    length: textContent.length,
  }
}

/** Extract page title */
function extractTitle(html: string): string {
  // Try <meta property="og:title">
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
  if (ogTitle?.[1]) return decodeHTMLEntities(ogTitle[1])

  // Try <title>
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (titleTag?.[1]) {
    let t = decodeHTMLEntities(titleTag[1]).trim()
    // Strip common separators (e.g., "Article Title - Site Name")
    t = t.replace(/\s*[|\-–—·•]\s*[^|\-–—·•]*$/, "").trim()
    return t
  }

  return ""
}

/** Extract site name */
function extractSiteName(html: string, url: string): string {
  const ogSite = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["']/i)
  if (ogSite?.[1]) return decodeHTMLEntities(ogSite[1])

  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

/** Remove unwanted elements from HTML */
function removeUnwantedElements(html: string): string {
  // Remove scripts
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "")
  // Remove styles
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "")
  // Remove noscript
  html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
  // Remove comments
  html = html.replace(/<!--[\s\S]*?-->/g, "")
  // Remove SVG
  html = html.replace(/<svg[\s\S]*?<\/svg>/gi, "")
  // Remove nav
  html = html.replace(/<nav[\s\S]*?<\/nav>/gi, "")
  // Remove header (but not h1-h6)
  html = html.replace(/<header[\s\S]*?<\/header>/gi, "")
  // Remove footer
  html = html.replace(/<footer[\s\S]*?<\/footer>/gi, "")
  // Remove aside
  html = html.replace(/<aside[\s\S]*?<\/aside>/gi, "")
  // Remove forms
  html = html.replace(/<form[\s\S]*?<\/form>/gi, "")
  // Remove iframes (except YouTube/Vimeo)
  html = html.replace(/<iframe(?![^>]*(?:youtube|vimeo|bilibili))[^>]*>[\s\S]*?<\/iframe>/gi, "")
  // Remove ads and common non-content classes
  html = html.replace(/<(?:div|section|aside)[^>]*class=["'][^"']*(?:sidebar|widget|ad-|ads-|advert|sponsor|social-share|related-posts|comment|newsletter|popup|modal|cookie|banner|promo)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section|aside)>/gi, "")

  return html
}

/** Find the main content area */
function findMainContent(html: string): string {
  // Strategy: try common content selectors in order of specificity
  const contentPatterns = [
    // article tag
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    // role="main"
    /<[^>]*role=["']main["'][^>]*>([\s\S]*?)<\/[^>]*>/i,
    // Common content ID/class patterns
    /<(?:div|main|section)[^>]*(?:id|class)=["'][^"']*(?:article-content|post-content|entry-content|article-body|post-body|story-body|content-body|main-content|page-content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|main|section)>/i,
    // content/post classes
    /<(?:div|main|section)[^>]*(?:id|class)=["'][^"']*(?:content|post|entry|article|story)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|main|section)>/i,
    // main tag
    /<main[^>]*>([\s\S]*?)<\/main>/i,
  ]

  for (const pattern of contentPatterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      const text = match[1].replace(/<[^>]*>/g, "").trim()
      // Only use if it has substantial content (>100 chars)
      if (text.length > 100) {
        return match[1]
      }
    }
  }

  // Fallback: extract body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch?.[1]) return bodyMatch[1]

  return html
}

/** Clean up extracted content */
function cleanContent(html: string): string {
  // Remove inline style attributes
  html = html.replace(/\sstyle=["'][^"']*["']/gi, "")
  // Remove class attributes (keep for minimal styling hints)
  // html = html.replace(/\sclass=["'][^"']*["']/gi, "")
  // Remove onclick and other event handlers
  html = html.replace(/\son\w+=["'][^"']*["']/gi, "")
  // Remove empty elements
  html = html.replace(/<(p|div|span|section)(?:\s[^>]*)?>[\s]*<\/\1>/gi, "")
  // Remove data attributes
  html = html.replace(/\sdata-[\w-]+=["'][^"']*["']/gi, "")
  // Clean up multiple whitespace/newlines but preserve structure
  html = html.replace(/\n{3,}/g, "\n\n")
  // Ensure images have proper src (convert relative to absolute)
  // This would need the base URL — handled elsewhere

  return html.trim()
}

/** Decode HTML entities */
function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Convert relative URLs in HTML content to absolute URLs.
 */
export function resolveRelativeUrls(html: string, baseUrl: string): string {
  try {
    const base = new URL(baseUrl)
    // Fix src attributes
    html = html.replace(/(src=["'])(?!https?:\/\/|data:|blob:)(\/?)([^"']*)(["'])/gi, (_, prefix, slash, path, suffix) => {
      try {
        const resolved = slash ? `${base.origin}/${path}` : new URL(path, baseUrl).href
        return `${prefix}${resolved}${suffix}`
      } catch {
        return `${prefix}${path}${suffix}`
      }
    })
    // Fix href attributes
    html = html.replace(/(href=["'])(?!https?:\/\/|mailto:|tel:|javascript:|#)(\/?)([^"']*)(["'])/gi, (_, prefix, slash, path, suffix) => {
      try {
        const resolved = slash ? `${base.origin}/${path}` : new URL(path, baseUrl).href
        return `${prefix}${resolved}${suffix}`
      } catch {
        return `${prefix}${path}${suffix}`
      }
    })
  } catch {
    // If URL parsing fails, return as-is
  }
  return html
}
