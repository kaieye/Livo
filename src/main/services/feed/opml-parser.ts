/**
 * OPML parser for importing/exporting RSS feed lists.
 * Parses OPML XML into a flat list of feeds with categories.
 */

import { sanitizePersistedUrl } from '../../../shared/persisted-url-policy'

export interface OPMLFeed {
  title: string
  xmlUrl: string // RSS feed URL
  htmlUrl?: string // Website URL
  category?: string
}

export interface ParseOPMLOptions {
  maxFeeds?: number
  maxOutlineTags?: number
  maxCategoryDepth?: number
  maxAttributeTextLength?: number
}

const DEFAULT_MAX_FEEDS = 1000
const DEFAULT_MAX_OUTLINE_TAGS = 10_000
const DEFAULT_MAX_CATEGORY_DEPTH = 32
const DEFAULT_MAX_ATTRIBUTE_TEXT_LENGTH = 2048

export class OPMLParseLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OPMLParseLimitError'
  }
}

/**
 * Parse OPML XML string into a list of feeds.
 * Supports arbitrarily nested outline elements (folders as categories).
 *
 * Uses a tag-by-tag state machine instead of regex to correctly handle
 * nested `<outline>` groups at any depth.
 */
export function parseOPML(
  xml: string,
  options: ParseOPMLOptions = {},
): OPMLFeed[] {
  const limits = {
    maxFeeds: options.maxFeeds ?? DEFAULT_MAX_FEEDS,
    maxOutlineTags: options.maxOutlineTags ?? DEFAULT_MAX_OUTLINE_TAGS,
    maxCategoryDepth: options.maxCategoryDepth ?? DEFAULT_MAX_CATEGORY_DEPTH,
    maxAttributeTextLength:
      options.maxAttributeTextLength ?? DEFAULT_MAX_ATTRIBUTE_TEXT_LENGTH,
  }
  const feeds: OPMLFeed[] = []

  // Extract <body> content
  const bodyMatch = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (!bodyMatch) return feeds

  const body = bodyMatch[1]

  // Tokenize: find every <outline ...>, <outline ... />, and </outline> tag
  const tagRegex =
    /<outline\s([^>]*?)\/\s*>|<outline\s([^>]*?)>|<\/outline\s*>/gi

  // Walk tokens with a category stack
  const categoryStack: string[] = []
  let outlineTagCount = 0

  let m: RegExpExecArray | null
  while ((m = tagRegex.exec(body)) !== null) {
    outlineTagCount += 1
    if (outlineTagCount > limits.maxOutlineTags) {
      throw new OPMLParseLimitError(
        `OPML contains too many outline tags (max ${limits.maxOutlineTags})`,
      )
    }

    const token:
      | { type: 'self-close'; attrs: string }
      | { type: 'open'; attrs: string }
      | { type: 'close' } =
      m[1] !== undefined
        ? { type: 'self-close', attrs: m[1] }
        : m[2] !== undefined
          ? { type: 'open', attrs: m[2] }
          : { type: 'close' }

    if (token.type === 'close') {
      categoryStack.pop()
      continue
    }

    const attrs = token.type === 'self-close' ? token.attrs : token.attrs
    const xmlUrl =
      getBoundedAttr(attrs, 'xmlUrl', limits.maxAttributeTextLength) ||
      getBoundedAttr(attrs, 'xmlurl', limits.maxAttributeTextLength)
    const title =
      getBoundedAttr(attrs, 'title', limits.maxAttributeTextLength) ||
      getBoundedAttr(attrs, 'text', limits.maxAttributeTextLength) ||
      ''
    const htmlUrl =
      getBoundedAttr(attrs, 'htmlUrl', limits.maxAttributeTextLength) ||
      getBoundedAttr(attrs, 'htmlurl', limits.maxAttributeTextLength)

    if (xmlUrl) {
      if (feeds.length >= limits.maxFeeds) {
        throw new OPMLParseLimitError(
          `OPML contains too many feeds (max ${limits.maxFeeds})`,
        )
      }
      // This is a feed leaf
      feeds.push({
        title: title || xmlUrl,
        xmlUrl,
        htmlUrl: htmlUrl || undefined,
        category:
          categoryStack.length > 0
            ? categoryStack[categoryStack.length - 1]
            : undefined,
      })
      // If it was an opening tag (unusual but possible), treat as self-closing for feeds
      // by NOT pushing to stack — the matching </outline> will just pop nothing extra
      if (token.type === 'open') {
        categoryStack.push(title || '')
      }
    } else if (token.type === 'open') {
      if (categoryStack.length >= limits.maxCategoryDepth) {
        throw new OPMLParseLimitError(
          `OPML category nesting is too deep (max ${limits.maxCategoryDepth})`,
        )
      }
      // This is a folder/category
      categoryStack.push(
        title ||
          (categoryStack.length > 0
            ? categoryStack[categoryStack.length - 1]
            : ''),
      )
    }
    // self-close without xmlUrl = empty folder, ignore
  }

  return feeds
}

function getBoundedAttr(
  attrs: string,
  name: string,
  maxLength: number,
): string {
  const value = getAttr(attrs, name)
  if (value.length > maxLength) {
    throw new OPMLParseLimitError(
      `OPML attribute "${name}" is too large (max ${maxLength})`,
    )
  }
  return value
}

function getAttr(attrs: string, name: string): string {
  // Match attribute value (handles both single and double quotes)
  const regex = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
  const m = attrs.match(regex)
  return m ? decodeXMLEntities(m[1] || m[2] || '') : ''
}

function decodeXMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
}

/**
 * Generate OPML XML from a list of feeds.
 */
export function generateOPML(
  feeds: Array<{
    title: string
    url: string
    siteUrl?: string
    category?: string
  }>,
  title = 'Livo Subscriptions',
): string {
  const categories = new Map<string, typeof feeds>()
  for (const feed of feeds) {
    const cat = feed.category || ''
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(feed)
  }

  let body = ''
  const renderFeed = (f: (typeof feeds)[number], indent: string): string => {
    const xmlUrl = sanitizePersistedUrl(f.url)
    const htmlUrl = f.siteUrl ? sanitizePersistedUrl(f.siteUrl) : ''
    return `${indent}<outline type="rss" text="${escapeXML(f.title)}" title="${escapeXML(f.title)}" xmlUrl="${escapeXML(xmlUrl)}"${htmlUrl ? ` htmlUrl="${escapeXML(htmlUrl)}"` : ''} />\n`
  }
  for (const [category, catFeeds] of categories) {
    if (category) {
      body += `    <outline text="${escapeXML(category)}" title="${escapeXML(category)}">\n`
      for (const f of catFeeds) {
        body += renderFeed(f, '      ')
      }
      body += `    </outline>\n`
    } else {
      for (const f of catFeeds) {
        body += renderFeed(f, '    ')
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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
