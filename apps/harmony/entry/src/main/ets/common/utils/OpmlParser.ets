export interface OpmlFeedItem {
  title: string
  xmlUrl: string
  htmlUrl?: string
  category?: string
}

export interface OpmlExportFeedItem {
  title: string
  url: string
  siteUrl?: string
  category?: string
}

interface OpmlToken {
  type: 'self-close' | 'open' | 'close'
  attrs: string
}

function decodeXmlEntities(value: string): string {
  return (value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&#(\d+);/g, (_all: string, num: string) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_all: string, hex: string) => String.fromCharCode(parseInt(hex, 16)))
}

function escapeXml(value: string): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function getAttr(attrs: string, name: string): string {
  const regex = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
  const match = attrs.match(regex)
  if (!match) {
    return ''
  }
  return decodeXmlEntities(match[1] || match[2] || '')
}

export function parseOpml(xml: string): OpmlFeedItem[] {
  const feeds: OpmlFeedItem[] = []
  const bodyMatch = (xml || '').match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (!bodyMatch) {
    return feeds
  }

  const body = bodyMatch[1] || ''
  const tagRegex = /<outline\s([^>]*?)\/\s*>|<outline\s([^>]*?)>|<\/outline\s*>/gi
  const tokens: OpmlToken[] = []

  let matched: RegExpExecArray | null = null
  while ((matched = tagRegex.exec(body)) !== null) {
    if (matched[1] !== undefined) {
      tokens.push({ type: 'self-close', attrs: matched[1] })
    } else if (matched[2] !== undefined) {
      tokens.push({ type: 'open', attrs: matched[2] })
    } else {
      tokens.push({ type: 'close', attrs: '' })
    }
  }

  const categoryStack: string[] = []
  tokens.forEach((token: OpmlToken) => {
    if (token.type === 'close') {
      if (categoryStack.length > 0) {
        categoryStack.pop()
      }
      return
    }

    const attrs = token.attrs
    const xmlUrl = getAttr(attrs, 'xmlUrl') || getAttr(attrs, 'xmlurl')
    const title = getAttr(attrs, 'title') || getAttr(attrs, 'text') || ''
    const htmlUrl = getAttr(attrs, 'htmlUrl') || getAttr(attrs, 'htmlurl')

    if (xmlUrl) {
      feeds.push({
        title: title || xmlUrl,
        xmlUrl,
        htmlUrl: htmlUrl || undefined,
        category: categoryStack.length > 0 ? categoryStack[categoryStack.length - 1] : undefined,
      })
      return
    }

    if (token.type === 'open') {
      const fallbackCategory = categoryStack.length > 0 ? categoryStack[categoryStack.length - 1] : ''
      categoryStack.push(title || fallbackCategory)
    }
  })

  return feeds
}

export function generateOpml(
  feeds: OpmlExportFeedItem[],
  title: string = 'Livo Subscriptions',
): string {
  const categoryMap: Map<string, OpmlExportFeedItem[]> = new Map()
  feeds.forEach((feed) => {
    const category = (feed.category || '').trim()
    const current = categoryMap.get(category) || []
    current.push(feed)
    categoryMap.set(category, current)
  })

  let body = ''
  categoryMap.forEach((groupFeeds, category) => {
    if (category) {
      body += `    <outline text="${escapeXml(category)}" title="${escapeXml(category)}">\n`
      groupFeeds.forEach((feed) => {
        const titleValue = escapeXml(feed.title || feed.url)
        const siteAttr = (feed.siteUrl || '').trim() ? ` htmlUrl="${escapeXml(feed.siteUrl || '')}"` : ''
        body += `      <outline type="rss" text="${titleValue}" title="${titleValue}" xmlUrl="${escapeXml(feed.url)}"${siteAttr} />\n`
      })
      body += '    </outline>\n'
      return
    }

    groupFeeds.forEach((feed) => {
      const titleValue = escapeXml(feed.title || feed.url)
      const siteAttr = (feed.siteUrl || '').trim() ? ` htmlUrl="${escapeXml(feed.siteUrl || '')}"` : ''
      body += `    <outline type="rss" text="${titleValue}" title="${titleValue}" xmlUrl="${escapeXml(feed.url)}"${siteAttr} />\n`
    })
  })

  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<opml version="2.0">\n`
    + `  <head>\n`
    + `    <title>${escapeXml(title)}</title>\n`
    + `    <dateCreated>${new Date().toUTCString()}</dateCreated>\n`
    + `  </head>\n`
    + `  <body>\n`
    + `${body}`
    + `  </body>\n`
    + `</opml>`
}
