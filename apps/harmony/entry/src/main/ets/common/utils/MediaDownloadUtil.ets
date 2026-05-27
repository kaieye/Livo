import { common } from '@kit.AbilityKit'
import { fileIo, fileUri } from '@kit.CoreFileKit'
import http from '@ohos.net.http'
import {
  BASIC_BROWSER_USER_AGENT,
  ACCEPT_ANY,
  MEDIUM_REQUEST_TIMEOUT_MS,
  RSS_REQUEST_TIMEOUT_MS,
} from '../config/NetworkConfig'

function resolveFileExtension(mediaUrl: string, fallback: string): string {
  const normalized = (mediaUrl || '').split('?')[0].split('#')[0].toLowerCase()
  return normalized.match(/\.([a-z0-9]+)$/i)?.[1] ?? fallback
}

export async function downloadToSandbox(
  context: common.UIAbilityContext,
  mediaUrl: string,
  fileNamePrefix: string,
  fallbackExtension: string,
): Promise<string> {
  const extension = resolveFileExtension(mediaUrl, fallbackExtension)
  const filePath = `${context.filesDir}/${fileNamePrefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}.${extension}`
  const request = http.createHttp()
  try {
    const response = await request.request(mediaUrl, {
      method: http.RequestMethod.GET,
      connectTimeout: MEDIUM_REQUEST_TIMEOUT_MS,
      readTimeout: RSS_REQUEST_TIMEOUT_MS,
      header: {
        'User-Agent': BASIC_BROWSER_USER_AGENT,
        'Accept': ACCEPT_ANY,
      },
    })
    if (response.responseCode !== 200) {
      throw new Error(`下载失败：HTTP ${response.responseCode}`)
    }
    const result = response.result
    if (!(result instanceof ArrayBuffer)) {
      throw new Error('下载失败：数据格式无效')
    }
    const file = fileIo.openSync(filePath, fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE)
    try {
      fileIo.writeSync(file.fd, result)
    } finally {
      fileIo.closeSync(file)
    }
    return fileUri.getUriFromPath(filePath)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '媒体下载失败')
  } finally {
    request.destroy()
  }
}
