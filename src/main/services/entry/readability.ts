import { Readability } from '@mozilla/readability'
import chardet from 'chardet'
import createDOMPurify from 'dompurify'
import { parseHTML } from 'linkedom'
import { assertNetworkFetchUrl } from '../system/network-url-policy'

export interface ReadabilityResult {
  title: string
  content: string
  excerpt: string
  siteName: string
  length: number
}

const READABILITY_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'

const MAX_CONTENT_BYTES = 2 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000

function sanitizeHTMLString(dirtyDocumentString: string): string {
  const { window } = parseHTML(dirtyDocumentString)
  const DOMPurify = createDOMPurify(window as any)
  return DOMPurify.sanitize(dirtyDocumentString)
}

function decodeHtmlBytes(bytes: Buffer, contentTypeHeader: string): string {
  const charsetFromHeader = contentTypeHeader.match(/charset=([\w-]+)/i)?.[1]
  const detectedCharset = charsetFromHeader || chardet.detect(bytes) || 'utf-8'

  try {
    return new TextDecoder(detectedCharset, { fatal: false }).decode(bytes)
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  }
}

function assertSupportedContentType(contentTypeHeader: string): void {
  const ct = contentTypeHeader.toLowerCase()
  if (!ct) return // Some servers omit the header; let the parser attempt anyway.
  if (
    !/(?:text\/html|application\/xhtml\+xml|application\/xml|text\/xml)/.test(
      ct,
    )
  ) {
    throw new Error(`返回内容不是网页 (content-type: ${contentTypeHeader})`)
  }
}

async function readBodyWithLimit(
  response: Response,
  controller: AbortController,
  maxBytes: number,
): Promise<Buffer> {
  const reader = response.body?.getReader()
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength > maxBytes) {
      throw new Error('页面体积超过 2MB 上限，已停止抓取')
    }
    return buffer
  }

  const chunks: Buffer[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > maxBytes) {
      controller.abort()
      throw new Error('页面体积超过 2MB 上限，已停止抓取')
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

function looksLikeVerificationPage(html: string, response: Response): boolean {
  if (response.headers.get('cf-mitigated')) return true
  const head = html.slice(0, 4000).toLowerCase()
  const signals = [
    'cf-browser-verification',
    'cf_chl_opt',
    '/cdn-cgi/challenge-platform',
    'just a moment',
    'checking your browser before',
    'attention required! | cloudflare',
    'please enable javascript and cookies',
    'g-recaptcha',
    'h-captcha',
  ]
  return signals.some((signal) => head.includes(signal))
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
  const safeUrl = await assertNetworkFetchUrl(url)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(safeUrl, {
      headers: {
        'User-Agent': READABILITY_USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch page: ${response.status} ${response.statusText}`,
      )
    }

    const contentTypeHeader = response.headers.get('content-type') || ''
    assertSupportedContentType(contentTypeHeader)

    const bytes = await readBodyWithLimit(
      response,
      controller,
      MAX_CONTENT_BYTES,
    )
    const html = decodeHtmlBytes(bytes, contentTypeHeader)

    if (looksLikeVerificationPage(html, response)) {
      throw new Error(
        '该页面需要人工验证（如 Cloudflare 人机校验），请在浏览器中打开',
      )
    }

    return extractReadableContent(html, safeUrl)
  } finally {
    clearTimeout(timeout)
  }
}

export function resolveRelativeUrls(html: string, baseUrl: string): string {
  const { document } = parseHTML(html)
  resolveDocumentRelativeUrls(document, baseUrl)
  return document.toString()
}
