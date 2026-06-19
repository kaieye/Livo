import {
  isAbortError,
  scopedSignalWithTimeout,
  throwIfAborted,
} from '../../utils/abort-signal'

/**
 * Minimal DuckDuckGo HTML search (no API key required), used by the agent's
 * web_search tool to fetch fresh information not present in local feeds.
 */
export interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

const SEARCH_ENDPOINT = 'https://html.duckduckgo.com/html/'
const MAX_RESULTS = 8
const REQUEST_TIMEOUT_MS = 12000

export interface WebSearchOptions {
  signal?: AbortSignal
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * DuckDuckGo wraps outbound links in a redirect like
 * `//duckduckgo.com/l/?uddg=<encoded-url>`. Unwrap it back to the real target.
 */
function normalizeResultUrl(raw: string): string {
  const trimmed = raw.trim()
  try {
    const url = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed)
    const uddg = url.searchParams.get('uddg')
    if (uddg) return decodeURIComponent(uddg)
    return url.toString()
  } catch {
    return trimmed
  }
}

export async function webSearch(
  query: string,
  options: WebSearchOptions = {},
): Promise<WebSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  throwIfAborted(options.signal)

  const scoped = scopedSignalWithTimeout(REQUEST_TIMEOUT_MS, options.signal)
  try {
    const body = new URLSearchParams({ q: trimmed, kl: 'wt-wt' }).toString()
    const response = await fetch(SEARCH_ENDPOINT, {
      method: 'POST',
      signal: scoped.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      body,
    })
    if (!response.ok) return []
    const html = await response.text()
    throwIfAborted(scoped.signal)
    return parseSearchResults(html)
  } catch (error) {
    if (isAbortError(error)) throw error
    return []
  } finally {
    scoped.dispose()
  }
}

function parseSearchResults(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = []
  const linkRegex =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g

  const snippets: string[] = []
  let snippetMatch = snippetRegex.exec(html)
  while (snippetMatch) {
    snippets.push(stripTags(snippetMatch[1]))
    snippetMatch = snippetRegex.exec(html)
  }

  let index = 0
  let match = linkRegex.exec(html)
  while (match && results.length < MAX_RESULTS) {
    const url = normalizeResultUrl(match[1])
    const title = stripTags(match[2])
    if (title && url) {
      results.push({ title, url, snippet: snippets[index] || '' })
    }
    index += 1
    match = linkRegex.exec(html)
  }

  return results
}

export function formatWebSearchResultsForAI(
  results: WebSearchResult[],
  query: string,
): string {
  if (results.length === 0) {
    return `没有找到关于「${query}」的网络搜索结果。`
  }
  let text = `「${query}」的网络搜索结果（共 ${results.length} 条）：\n\n`
  for (let i = 0; i < results.length; i += 1) {
    const r = results[i]
    text += `[${i + 1}] ${r.title}\n`
    if (r.snippet) text += `   摘要: ${r.snippet}\n`
    text += `   链接: ${r.url}\n\n`
  }
  return text.trim()
}
