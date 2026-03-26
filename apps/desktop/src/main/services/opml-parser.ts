/**
 * OPML parser for importing/exporting RSS feed lists.
 * Parses OPML XML into a flat list of feeds with categories.
 */

export interface OPMLFeed {
  title: string
  xmlUrl: string // RSS feed URL
  htmlUrl?: string // Website URL
  category?: string
}

/**
 * Parse OPML XML string into a list of feeds.
 * Supports arbitrarily nested outline elements (folders as categories).
 *
 * Uses a tag-by-tag state machine instead of regex to correctly handle
 * nested `<outline>` groups at any depth.
 */
export function parseOPML(xml: string): OPMLFeed[] {
  const feeds: OPMLFeed[] = []

  // Extract <body> content
  const bodyMatch = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (!bodyMatch) return feeds

  const body = bodyMatch[1]

  // Tokenize: find every <outline ...>, <outline ... />, and </outline> tag
  const tagRegex = /<outline\s([^>]*?)\/\s*>|<outline\s([^>]*?)>|<\/outline\s*>/gi
  const tokens: Array<
    | { type: "self-close"; attrs: string }
    | { type: "open"; attrs: string }
    | { type: "close" }
  > = []

  let m: RegExpExecArray | null
  while ((m = tagRegex.exec(body)) !== null) {
    if (m[1] !== undefined) {
      // Self-closing: <outline ... />
      tokens.push({ type: "self-close", attrs: m[1] })
    } else if (m[2] !== undefined) {
      // Opening: <outline ...>
      tokens.push({ type: "open", attrs: m[2] })
    } else {
      // Closing: </outline>
      tokens.push({ type: "close" })
    }
  }

  // Walk tokens with a category stack
  const categoryStack: string[] = []

  for (const token of tokens) {
    if (token.type === "close") {
      categoryStack.pop()
      continue
    }

    const attrs = token.type === "self-close" ? token.attrs : token.attrs
    const xmlUrl = getAttr(attrs, "xmlUrl") || getAttr(attrs, "xmlurl")
    const title = getAttr(attrs, "title") || getAttr(attrs, "text") || ""
    const htmlUrl = getAttr(attrs, "htmlUrl") || getAttr(attrs, "htmlurl")

    if (xmlUrl) {
      // This is a feed leaf
      feeds.push({
        title: title || xmlUrl,
        xmlUrl,
        htmlUrl: htmlUrl || undefined,
        category: categoryStack.length > 0 ? categoryStack[categoryStack.length - 1] : undefined,
      })
      // If it was an opening tag (unusual but possible), treat as self-closing for feeds
      // by NOT pushing to stack — the matching </outline> will just pop nothing extra
      if (token.type === "open") {
        categoryStack.push(title || "")
      }
    } else if (token.type === "open") {
      // This is a folder/category
      categoryStack.push(title || (categoryStack.length > 0 ? categoryStack[categoryStack.length - 1] : ""))
    }
    // self-close without xmlUrl = empty folder, ignore
  }

  return feeds
}

function getAttr(attrs: string, name: string): string {
  // Match attribute value (handles both single and double quotes)
  const regex = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i")
  const m = attrs.match(regex)
  return m ? decodeXMLEntities(m[1] || m[2] || "") : ""
}

function decodeXMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Generate OPML XML from a list of feeds.
 */
export function generateOPML(
  feeds: Array<{ title: string; url: string; siteUrl?: string; category?: string }>,
  title = "Livo Subscriptions"
): string {
  const categories = new Map<string, typeof feeds>()
  for (const feed of feeds) {
    const cat = feed.category || ""
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(feed)
  }

  let body = ""
  for (const [category, catFeeds] of categories) {
    if (category) {
      body += `    <outline text="${escapeXML(category)}" title="${escapeXML(category)}">\n`
      for (const f of catFeeds) {
        body += `      <outline type="rss" text="${escapeXML(f.title)}" title="${escapeXML(f.title)}" xmlUrl="${escapeXML(f.url)}"${f.siteUrl ? ` htmlUrl="${escapeXML(f.siteUrl)}"` : ""} />\n`
      }
      body += `    </outline>\n`
    } else {
      for (const f of catFeeds) {
        body += `    <outline type="rss" text="${escapeXML(f.title)}" title="${escapeXML(f.title)}" xmlUrl="${escapeXML(f.url)}"${f.siteUrl ? ` htmlUrl="${escapeXML(f.siteUrl)}"` : ""} />\n`
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXML(title)}</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
${body}  </body>
</opml>`
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
