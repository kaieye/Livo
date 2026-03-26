import { Readability } from '@mozilla/readability'
import chardet from 'chardet'
import createDOMPurify from 'dompurify'
import { parseHTML } from 'linkedom'

export interface ReadabilityResult {
  title: string
  content: string
  excerpt: string
  siteName: string
  length: number
}

const READABILITY_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'

function sanitizeHTMLString(dirtyDocumentString: string): string {
  const { window } = parseHTML(dirtyDocumentString)
  const DOMPurify = createDOMPurify(window as any)
  return DOMPurify.sanitize(dirtyDocumentString)
}

async function decodeResponseBody(response: Response): Promise<string> {
  const buffer = await response.arrayBuffer()
  const bytes = Buffer.from(buffer)
  const contentType = response.headers.get('content-type') || ''
  const charsetFromHeader = contentType.match(/charset=([\w-]+)/i)?.[1]
  const detectedCharset = charsetFromHeader || chardet.detect(bytes) || 'utf-8'

  try {
    return new TextDecoder(detectedCharset, { fatal: false }).decode(bytes)
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  }
}

function extractTitleFromDocument(document: Document): string {
  const candidates = [
    document
      .querySelector("meta[property='og:title']")
      ?.getAttribute('content'),
    document
      .querySelector("meta[name='twitter:title']")
      ?.getAttribute('content'),
    document.title,
  ]

  for (const candidate of candidates) {
    const normalized = candidate?.trim()
    if (normalized) return normalized
  }

  return ''
}

function extractSiteName(document: Document, url: string): string {
  const metaSiteName = document
    .querySelector("meta[property='og:site_name']")
    ?.getAttribute('content')
    ?.trim()
  if (metaSiteName) return metaSiteName

  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function resolveDocumentRelativeUrls(
  document: Document,
  baseUrl: string,
): void {
  const rewriteAttribute = (selector: string, attribute: 'href' | 'src') => {
    document.querySelectorAll(selector).forEach((node) => {
      const current = node.getAttribute(attribute)
      if (!current) return
      if (/^(?:https?:|data:|blob:|mailto:|tel:|javascript:|#)/i.test(current))
        return

      try {
        node.setAttribute(attribute, new URL(current, baseUrl).href)
      } catch {
        // Keep original value when URL resolution fails.
      }
    })
  }

  rewriteAttribute('a[href]', 'href')
  rewriteAttribute('img[src]', 'src')
  rewriteAttribute('audio[src]', 'src')
  rewriteAttribute('video[src]', 'src')
  rewriteAttribute('source[src]', 'src')
}

function sanitizeExtractedContent(html: string): string {
  const { window } = parseHTML(html)
  const DOMPurify = createDOMPurify(window as any)
  return DOMPurify.sanitize(html)
}

export function extractReadableContent(
  html: string,
  url: string,
): ReadabilityResult {
  const sanitizedDocument = sanitizeHTMLString(html)
  const { document } = parseHTML(sanitizedDocument)
  resolveDocumentRelativeUrls(document, url)

  const reader = new Readability(document, {
    keepClasses: true,
  })
  const parsed = reader.parse()

  const title = parsed?.title?.trim() || extractTitleFromDocument(document)
  const content = parsed?.content?.trim() || ''
  const excerpt =
    parsed?.excerpt?.trim() ||
    content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240)
  const siteName = parsed?.siteName?.trim() || extractSiteName(document, url)
  const sanitizedContent = sanitizeExtractedContent(content)
  const textContent = sanitizedContent
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    title,
    content: sanitizedContent,
    excerpt,
    siteName,
    length: textContent.length,
  }
}

export async function fetchReadableContent(
  url: string,
): Promise<ReadabilityResult> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': READABILITY_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch page: ${response.status} ${response.statusText}`,
    )
  }

  const html = await decodeResponseBody(response)
  return extractReadableContent(html, url)
}

export function resolveRelativeUrls(html: string, baseUrl: string): string {
  const { document } = parseHTML(html)
  resolveDocumentRelativeUrls(document, baseUrl)
  return document.toString()
}
