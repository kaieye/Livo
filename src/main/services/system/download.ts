import { app, dialog, session } from 'electron'
import { createWriteStream } from 'fs'
import { mkdir, rm, writeFile } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import type {
  DownloadUrlOptions,
  DownloadUrlResult,
  SaveTextFileOptions,
  SaveTextFileResult,
} from '../../../shared/types/index'
import { assertNetworkFetchUrl } from './network-url-policy'

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
    const safeUrl = await assertNetworkFetchUrl(targetUrl)
    const abortController = new AbortController()
    const timeout = setTimeout(() => {
      abortController.abort()
    }, DOWNLOAD_TIMEOUT_MS)
    let response: Response
    try {
      response = await session.defaultSession.fetch(safeUrl, {
        headers: {
          Accept: '*/*',
          'User-Agent': `Livo/${app.getVersion()}`,
        },
        redirect: 'manual',
        signal: abortController.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get('location')
    ) {
      const redirectUrl = new URL(
        response.headers.get('location') || '',
        safeUrl,
      ).href
      await assertNetworkFetchUrl(redirectUrl)
      return downloadUrlToFileWithRedirectDepth(
        { ...options, url: redirectUrl },
        redirectDepth + 1,
      )
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const contentLength = Number.parseInt(
      response.headers.get('content-length') || '',
      10,
    )
    if (Number.isFinite(contentLength) && contentLength > MAX_DOWNLOAD_BYTES) {
      return { success: false, error: 'download_too_large' }
    }

    const contentType = response.headers.get('content-type') || ''
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
  response: Response,
  filePath: string,
): Promise<void> {
  const body = response.body
  if (!body) {
    const data = Buffer.from(await response.arrayBuffer())
    if (data.byteLength > MAX_DOWNLOAD_BYTES) {
      throw new Error('download_too_large')
    }
    await writeFile(filePath, data)
    return
  }

  const writer = createWriteStream(filePath)
  const reader = body.getReader()
  let writtenBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      writtenBytes += value.byteLength
      if (writtenBytes > MAX_DOWNLOAD_BYTES) {
        throw new Error('download_too_large')
      }
      await new Promise<void>((resolve, reject) => {
        writer.write(Buffer.from(value), (error) => {
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
    writer.destroy()
    await rm(filePath, { force: true }).catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
}
