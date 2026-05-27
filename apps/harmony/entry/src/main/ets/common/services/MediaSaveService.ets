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

export type MediaSaveKind = 'image' | 'video'

function resolveMediaFileExtension(mediaUrl: string, kind: MediaSaveKind): string {
  const normalized = (mediaUrl || '')
    .split('?')[0]
    .split('#')[0]
    .trim()
    .toLowerCase()

  const matched = normalized.match(/\.([a-z0-9]+)$/i)?.[1] ?? ''
  if (kind === 'image') {
    if (matched === 'png' || matched === 'webp' || matched === 'gif' || matched === 'bmp' || matched === 'jpeg' || matched === 'jpg' || matched === 'avif') {
      return matched === 'jpeg' ? 'jpg' : matched
    }
    return 'jpg'
  }

  if (matched === 'mov' || matched === 'm4v' || matched === 'webm' || matched === 'mp4') {
    return matched
  }
  return 'mp4'
}

function resolveMediaAssetTitle(kind: MediaSaveKind): string {
  return `${kind === 'image' ? 'image' : 'video'}_${Date.now()}`
}

function resolvePhotoType(kind: MediaSaveKind): photoAccessHelper.PhotoType {
  return kind === 'video'
    ? photoAccessHelper.PhotoType.VIDEO
    : photoAccessHelper.PhotoType.IMAGE
}

export class MediaSaveService {
  static async saveRemoteMedia(
    context: common.UIAbilityContext,
    mediaUrl: string,
    kind: MediaSaveKind,
  ): Promise<void> {
    const trimmedUrl = (mediaUrl || '').trim()
    if (!trimmedUrl) {
      throw new Error('未找到可保存的媒体地址')
    }

    const sourceFileUri = await MediaSaveService.downloadToSandbox(context, trimmedUrl, kind)
    const extension = resolveMediaFileExtension(trimmedUrl, kind)
    const helper = photoAccessHelper.getPhotoAccessHelper(context)
    const photoCreationConfigs: Array<photoAccessHelper.PhotoCreationConfig> = [{
      title: resolveMediaAssetTitle(kind),
      fileNameExtension: extension,
      photoType: resolvePhotoType(kind),
      subtype: photoAccessHelper.PhotoSubtype.DEFAULT,
    }]
    let destinationUris: Array<string> | undefined = undefined
    try {
      destinationUris = await helper.showAssetsCreationDialog(
        [sourceFileUri],
        photoCreationConfigs,
      )
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '打开保存对话框失败')
    }

    if (!destinationUris || destinationUris.length === 0 || !destinationUris[0]) {
      throw new Error('用户取消保存')
    }

    let sourceFile: fileIo.File | undefined = undefined
    let destinationFile: fileIo.File | undefined = undefined
    try {
      sourceFile = await fileIo.open(
        sourceFileUri,
        fileIo.OpenMode.READ_ONLY,
      )
      destinationFile = await fileIo.open(
        destinationUris[0],
        fileIo.OpenMode.WRITE_ONLY,
      )
      await fileIo.copyFile(sourceFile.fd, destinationFile.fd)
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '保存媒体失败')
    } finally {
      if (sourceFile) {
        try {
          fileIo.closeSync(sourceFile)
        } catch (_error) {}
      }
      if (destinationFile) {
        try {
          fileIo.closeSync(destinationFile)
        } catch (_error) {}
      }
    }
  }

  private static async downloadToSandbox(
    context: common.UIAbilityContext,
    mediaUrl: string,
    kind: MediaSaveKind,
  ): Promise<string> {
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
        throw new Error('下载失败：媒体数据格式无效')
      }

      const extension = resolveMediaFileExtension(mediaUrl, kind)
      const filePath = `${context.filesDir}/${resolveMediaAssetTitle(kind)}.${extension}`
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
      throw new Error(error instanceof Error ? error.message : '媒体下载失败')
    } finally {
      request.destroy()
    }
  }
}
