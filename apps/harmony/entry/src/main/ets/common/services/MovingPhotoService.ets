import { common } from '@kit.AbilityKit'
import { fileIo, fileUri } from '@kit.CoreFileKit'
import { photoAccessHelper } from '@kit.MediaLibraryKit'
import http from '@ohos.net.http'
import {
  BASIC_BROWSER_USER_AGENT,
  ACCEPT_ANY,
  MEDIUM_REQUEST_TIMEOUT_MS,
  RSS_REQUEST_TIMEOUT_MS,
} from '../config/NetworkConfig'

function normalizeRemoteMediaUrl(url: string): string {
  return (url || '').trim()
}

function resolveRemoteFileExtension(mediaUrl: string, fallback: string): string {
  const normalized = normalizeRemoteMediaUrl(mediaUrl)
    .split('?')[0]
    .split('#')[0]
    .toLowerCase()
  const extension = normalized.match(/\.([a-z0-9]+)$/i)?.[1] ?? ''
  return extension || fallback
}

function buildSandboxFilePath(
  context: common.UIAbilityContext,
  prefix: string,
  mediaUrl: string,
  fallbackExtension: string,
): string {
  const extension = resolveRemoteFileExtension(mediaUrl, fallbackExtension)
  return `${context.filesDir}/${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}.${extension}`
}

export class MovingPhotoService {
  private static readonly movingPhotoCache: Map<string, Promise<photoAccessHelper.MovingPhoto>> = new Map()

  static async loadRemoteMovingPhoto(
    context: common.UIAbilityContext,
    imageUrl: string,
    videoUrl: string,
  ): Promise<photoAccessHelper.MovingPhoto> {
    const normalizedImageUrl = normalizeRemoteMediaUrl(imageUrl)
    const normalizedVideoUrl = normalizeRemoteMediaUrl(videoUrl)
    if (!normalizedImageUrl || !normalizedVideoUrl) {
      throw new Error('动态照片资源不完整')
    }

    const cacheKey = `${normalizedImageUrl}::${normalizedVideoUrl}`
    const cached = MovingPhotoService.movingPhotoCache.get(cacheKey)
    if (cached) {
      return await cached
    }

    const loadingTask = MovingPhotoService.loadAndCacheRemoteMovingPhoto(
      context,
      normalizedImageUrl,
      normalizedVideoUrl,
    )
    MovingPhotoService.movingPhotoCache.set(cacheKey, loadingTask)

    try {
      return await loadingTask
    } catch (error) {
      MovingPhotoService.movingPhotoCache.delete(cacheKey)
      throw new Error(error instanceof Error ? error.message : '动态照片加载失败')
    }
  }

  private static async loadAndCacheRemoteMovingPhoto(
    context: common.UIAbilityContext,
    imageUrl: string,
    videoUrl: string,
  ): Promise<photoAccessHelper.MovingPhoto> {
    const imageFileUri = await MovingPhotoService.downloadRemoteFileToSandbox(
      context,
      imageUrl,
      'moving_photo_image',
      'jpg',
    )
    const videoFileUri = await MovingPhotoService.downloadRemoteFileToSandbox(
      context,
      videoUrl,
      'moving_photo_video',
      'mp4',
    )

    try {
      return await photoAccessHelper.MediaAssetManager.loadMovingPhoto(
        context,
        imageFileUri,
        videoFileUri,
      )
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '动态照片加载失败')
    }
  }

  private static async downloadRemoteFileToSandbox(
    context: common.UIAbilityContext,
    mediaUrl: string,
    fileNamePrefix: string,
    fallbackExtension: string,
  ): Promise<string> {
    const request = http.createHttp()
    const filePath = buildSandboxFilePath(
      context,
      fileNamePrefix,
      mediaUrl,
      fallbackExtension,
    )

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
        throw new Error('下载失败：资源数据格式无效')
      }

      const file = fileIo.openSync(
        filePath,
        fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE,
      )
      try {
        fileIo.writeSync(file.fd, result)
      } finally {
        fileIo.closeSync(file)
      }

      return fileUri.getUriFromPath(filePath)
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '远程动态照片资源下载失败')
    } finally {
      request.destroy()
    }
  }
}
