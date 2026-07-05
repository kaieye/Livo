const FRESHRSS_FEVER_API_PATH = '/api/fever.php'
const FRESHRSS_GOOGLE_READER_API_PATH = '/api/greader.php'

function stripTrailingSlash(pathname: string): string {
  return pathname.replace(/\/+$/, '')
}

function appendPath(basePath: string, suffix: string): string {
  const cleanBase = stripTrailingSlash(basePath)
  return `${cleanBase || ''}${suffix}`
}

function normalizeFreshRssPath(pathname: string): string {
  let path = stripTrailingSlash(pathname || '/')
  const lowerPath = path.toLowerCase()

  if (lowerPath.endsWith('/api/fever.php')) return path
  if (lowerPath.endsWith(FRESHRSS_GOOGLE_READER_API_PATH)) {
    return `${path.slice(0, -'/greader.php'.length)}/fever.php`
  }
  if (lowerPath.endsWith('/api')) return appendPath(path, '/fever.php')

  // FreshRSS UI URLs often end in /i or /p/i. Those are not API roots.
  if (lowerPath.endsWith('/p/i')) path = path.slice(0, -'/p/i'.length) || '/'
  else if (lowerPath.endsWith('/i')) path = path.slice(0, -'/i'.length) || '/'

  return appendPath(path, FRESHRSS_FEVER_API_PATH)
}

export function normalizeFeverBaseUrl(rawBaseUrl: string): string {
  const trimmed = rawBaseUrl.trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    url.hash = ''
    url.search = ''
    url.pathname = normalizeFreshRssPath(url.pathname)
    return url.toString().replace(/\/+$/, '')
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

export function normalizeFeverAccountBaseUrl(rawBaseUrl: string): string {
  const trimmed = rawBaseUrl.trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}
