/**
 * Network request configuration: timeouts, user agents and HTTP headers.
 */

// ── Browser user agents ──

export const DESKTOP_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export const BASIC_BROWSER_USER_AGENT = 'Mozilla/5.0'

export const MOBILE_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'

// ── Accept headers ──

export const ACCEPT_JSON = 'application/json, text/plain, */*'
export const ACCEPT_HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
export const ACCEPT_TEXT_OR_HTML = 'text/plain,text/html;q=0.9,*/*;q=0.8'
export const ACCEPT_RSS_XML = 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*'
export const ACCEPT_ANY = '*/*'

// ── Accept-Language ──

export const DEFAULT_ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9,en;q=0.8'
export const RSS_ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'

// ── Request timeouts (milliseconds) ──

export const DIRECT_PLAYBACK_TIMEOUT_MS = 7000
export const REQUEST_CONNECT_TIMEOUT_MS = 3500
export const REQUEST_READ_TIMEOUT_MS = 4500

export const SHORT_REQUEST_TIMEOUT_MS = 5000
export const MEDIUM_REQUEST_TIMEOUT_MS = 8000
export const LONG_REQUEST_TIMEOUT_MS = 10000

export const INSTAGRAM_SEARCH_TIMEOUT_MS = 3500

export const RSS_REQUEST_TIMEOUT_MS = 15000
export const RSSHUB_REQUEST_TIMEOUT_MS = 3000
export const RSSHUB_INSTAGRAM_REQUEST_TIMEOUT_MS = 8000

export const AI_REQUEST_CONNECT_TIMEOUT_MS = 10000
export const AI_REQUEST_READ_TIMEOUT_MS = 20000
