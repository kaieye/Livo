import { app, dialog } from 'electron'
import { createWriteStream } from 'fs'
import { mkdir, rm, writeFile } from 'fs/promises'
import { request as httpRequest } from 'http'
import type { IncomingMessage, RequestOptions } from 'http'
import { request as httpsRequest } from 'https'
import { isIP } from 'net'
import { basename, dirname, extname, join } from 'path'
import type {
  DownloadUrlOptions,
  DownloadUrlResult,
  SaveTextFileOptions,
  SaveTextFileResult,
} from '../../../shared/types/index'
import { assertNetworkFetchTarget } from './network-url-policy'

const MAX_TEXT_FILE_BYTES = 10 * 1024 * 1024
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 60_000
const MAX_SUGGESTED_FILE_NAME_LENGTH = 180

export function sanitizeSuggestedFileName(fileName: string): string {
  const normalized = Array.from((fileName || '').trim())
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code <= 31 || '<>:"/\\|?*'.includes(char)) {
        return '-'
      }
      return char
    })
    .join('')
  const collapsed = normalized.replace(/\s+/g, ' ').replace(/-+/g, '-').trim()
  const fallback = collapsed || 'livo-export.txt'
  if (fallback.length <= MAX_SUGGESTED_FILE_NAME_LENGTH) return fallback

  const extension = extname(fallback)
  const stem = extension ? fallback.slice(0, -extension.length) : fallback
  const maxStemLength = Math.max(
    1,
    MAX_SUGGESTED_FILE_NAME_LENGTH - extension.length,
  )
  return `${stem.slice(0, maxStemLength)}${extension}`
}

export async function saveTextFile(
  options: SaveTextFileOptions,
): Promise<SaveTextFileResult> {
  if (Buffer.byteLength(options.content || '', 'utf-8') > MAX_TEXT_FILE_BYTES) {
    return { success: false, error: 'content_too_large' }
  }

  const defaultDir = app.getPath('downloads')
  const safeName = sanitizeSuggestedFileName(options.defaultFileName)
  const result = await dialog.showSaveDialog({
    title: options.title || '保存文件',
    defaultPath: join(defaultDir, safeName),
    filters:
      options.filters && options.filters.length > 0
        ? options.filters
        : [{ name: 'Text Files', extensions: ['txt'] }],
  })

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true }
  }

  try {
    await mkdir(dirname(result.filePath), { recursive: true })
    await writeFile(result.filePath, options.content, 'utf-8')
    return {
      success: true,
      filePath: result.filePath,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function inferExtensionFromContentType(contentType: string): string {
  const lower = (contentType || '').toLowerCase()
  if (lower.includes('image/jpeg')) return '.jpg'
  if (lower.includes('image/png')) return '.png'
  if (lower.includes('image/webp')) return '.webp'
  if (lower.includes('image/gif')) return '.gif'
  if (lower.includes('video/mp4')) return '.mp4'
  if (lower.includes('video/webm')) return '.webm'
  if (lower.includes('audio/mpeg')) return '.mp3'
  return ''
}

function inferFileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const name = basename(parsed.pathname)
    return sanitizeSuggestedFileName(name || 'livo-download')
  } catch {
    return 'livo-download'
  }
}

type PinnedLookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | Array<{ address: string; family: number }>,
  family?: number,
) => void

function createPinnedLookup(
  address: string,
): NonNullable<RequestOptions['lookup']> {
  return ((...args: unknown[]) => {
    const options =
      typeof args[1] === 'object' && args[1] !== null
        ? (args[1] as { all?: boolean })
        : undefined
    const callback = (
      typeof args[1] === 'function' ? args[1] : args[2]
    ) as PinnedLookupCallback
    const family = isIP(address) || 4
    if (options?.all) {
      callback(null, [{ address, family }])
      return
    }
    callback(null, address, family)
  }) as NonNullable<RequestOptions['lookup']>
}

function getHeaderValue(
  headers: IncomingMessage['headers'],
  name: string,
): string {
  const value = headers[name.toLowerCase()]
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

async function fetchDownloadResponse(
  targetUrl: string,
  signal: AbortSignal,
): Promise<{ response: IncomingMessage; safeUrl: string }> {
  const target = await assertNetworkFetchTarget(targetUrl)
  const parsed = new URL(target.url)
  const request =
    parsed.protocol === 'https:'
      ? httpsRequest
      : parsed.protocol === 'http:'
        ? httpRequest
        : null
  if (!request) {
    throw new Error('URL 已被安全策略阻止：unsupported-protocol')
  }

  return new Promise((resolve, reject) => {
    const requestOptions: RequestOptions & { servername?: string } = {
      headers: {
        Accept: '*/*',
        'User-Agent': `Livo/${app.getVersion()}`,
      },
      lookup: createPinnedLookup(target.pinnedAddress),
      signal,
    }
    if (parsed.protocol === 'https:' && isIP(parsed.hostname) === 0) {
      requestOptions.servername = parsed.hostname
    }

    const req = request(parsed, requestOptions, (response) => {
      resolve({ response, safeUrl: target.url })
    })
    req.once('error', reject)
    req.end()
  })
}

export async function downloadUrlToFile(
  options: DownloadUrlOptions,
): Promise<DownloadUrlResult> {
  return downloadUrlToFileWithRedirectDepth(options, 0)
}

async function downloadUrlToFileWithRedirectDepth(
  options: DownloadUrlOptions,
  redirectDepth: number,
): Promise<DownloadUrlResult> {
  const targetUrl = (options.url || '').trim()
  if (!targetUrl) {
    return { success: false, error: 'missing_url' }
  }
  if (redirectDepth > 5) {
    return { success: false, error: 'too_many_redirects' }
  }

  try {
    const abortController = new AbortController()
    const timeout = setTimeout(() => {
      abortController.abort()
    }, DOWNLOAD_TIMEOUT_MS)
    let response: IncomingMessage
    let safeUrl: string
    try {
      ;({ response, safeUrl } = await fetchDownloadResponse(
        targetUrl,
        abortController.signal,
      ))
    } finally {
      clearTimeout(timeout)
    }

    const statusCode = response.statusCode || 0
    const redirectLocation = getHeaderValue(response.headers, 'location')
    if (statusCode >= 300 && statusCode < 400 && redirectLocation) {
      response.resume()
      const redirectUrl = new URL(redirectLocation, safeUrl).href
      return downloadUrlToFileWithRedirectDepth(
        { ...options, url: redirectUrl },
        redirectDepth + 1,
      )
    }

    if (statusCode < 200 || statusCode >= 300) {
      response.resume()
      return { success: false, error: `HTTP ${statusCode}` }
    }

    const contentLength = Number.parseInt(
      getHeaderValue(response.headers, 'content-length'),
      10,
    )
    if (Number.isFinite(contentLength) && contentLength > MAX_DOWNLOAD_BYTES) {
      response.resume()
      return { success: false, error: 'download_too_large' }
    }

    const contentType = getHeaderValue(response.headers, 'content-type')
    let suggestedName = sanitizeSuggestedFileName(
      options.suggestedFileName || inferFileNameFromUrl(targetUrl),
    )
    if (!extname(suggestedName)) {
      const inferredExt = inferExtensionFromContentType(contentType)
      if (inferredExt) {
        suggestedName += inferredExt
      }
    }

    const saveResult = await dialog.showSaveDialog({
      title: options.title || '保存文件',
      defaultPath: join(app.getPath('downloads'), suggestedName),
      filters: options.filters,
    })

    if (saveResult.canceled || !saveResult.filePath) {
      response.resume()
      return { success: false, canceled: true }
    }

    await mkdir(dirname(saveResult.filePath), { recursive: true })
    await writeResponseToFileWithLimit(response, saveResult.filePath)
    return {
      success: true,
      filePath: saveResult.filePath,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function writeResponseToFileWithLimit(
  response: IncomingMessage,
  filePath: string,
): Promise<void> {
  const writer = createWriteStream(filePath)
  let writtenBytes = 0

  try {
    for await (const chunk of response) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      writtenBytes += data.byteLength
      if (writtenBytes > MAX_DOWNLOAD_BYTES) {
        throw new Error('download_too_large')
      }
      await new Promise<void>((resolve, reject) => {
        writer.write(data, (error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    }
    await new Promise<void>((resolve, reject) => {
      writer.once('error', reject)
      writer.end(() => {
        writer.off('error', reject)
        resolve()
      })
    })
  } catch (error) {
    response.destroy()
    writer.destroy()
    await rm(filePath, { force: true }).catch(() => {})
    throw error
  }
}
