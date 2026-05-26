import { common } from '@kit.AbilityKit'
import { MovingPhotoViewController, photoAccessHelper } from '@kit.MediaLibraryKit'
import { ArticleContentBlock } from '../../models/LivoModels'
import { MovingPhotoService } from '../../services/MovingPhotoService'
import { VideoResolverService } from '../../services/VideoResolverService'
import { ExternalUrlService } from '../../services/ExternalUrlService'
import { openVideoPlayer } from '../../navigation/AppRouter'
import { resolveYouTubePlaybackDisplay } from '../../utils/platform/YouTubePlaybackDisplay'
import { resolveVideoPlaybackTarget } from '../../utils/VideoPlaybackTarget'
import {
  shouldOpenYouTubeExternallyOnFallback,
  shouldUseYouTubeWebFallback,
} from '../../utils/platform/YouTubePlaybackMode'
import { isArticleDirectVideo, isArticleYouTubeVideo } from './ArticleVideoUrlClassifier'

export interface ArticleInlineVideoOwner {
  activeVideoBlockId: string
  activeVideoPlayableUrl: string
  activeVideoFallbackUrl: string
  isResolvingActiveVideo: boolean
  inlineVideoPreparingBlockId: string
  activeMovingPhoto: photoAccessHelper.MovingPhoto | undefined
  actionHint: string
  isPictureDetail(): boolean
  getHostContext(): common.UIAbilityContext
}

/**
 * Coordinates inline playback of an article's video block: youtube link
 * resolution, native moving-photo loading, fallback selection, and stop().
 *
 * Owns the per-page native VideoController and MovingPhotoViewController
 * (these aren't observed state, they're just imperative handles), but
 * writes all observable @State through the owner.
 */
export class ArticleInlineVideoPlaybackController {
  private readonly owner: ArticleInlineVideoOwner
  private readonly nativeVideoController: VideoController = new VideoController()
  private readonly movingPhotoController: MovingPhotoViewController = new MovingPhotoViewController()

  constructor(owner: ArticleInlineVideoOwner) {
    this.owner = owner
  }

  get nativeVideo(): VideoController {
    return this.nativeVideoController
  }

  get movingPhoto(): MovingPhotoViewController {
    return this.movingPhotoController
  }

  shouldInlineVideoPlayback(block: ArticleContentBlock): boolean {
    return this.owner.isPictureDetail() && isArticleDirectVideo(block.videoUrl)
  }

  shouldUseNativeMovingPhoto(block: ArticleContentBlock): boolean {
    return this.shouldInlineVideoPlayback(block) && !!block.imageUrl
  }

  open(block: ArticleContentBlock, openFullscreen: () => void): void {
    if (this.shouldInlineVideoPlayback(block)) {
      this.play(block)
      return
    }

    const playbackTarget = resolveVideoPlaybackTarget(
      isArticleYouTubeVideo(block.videoUrl),
      isArticleDirectVideo(block.videoUrl),
    )
    if (playbackTarget === 'dedicated') {
      openFullscreen()
      return
    }

    this.play(block)
  }

  play(block: ArticleContentBlock): void {
    const normalizedVideoUrl = (block.videoUrl || '').trim()
    if (
      this.owner.activeVideoBlockId === block.id
      && (this.owner.activeVideoPlayableUrl === normalizedVideoUrl || this.owner.isResolvingActiveVideo || !!this.owner.activeVideoFallbackUrl)
    ) {
      return
    }

    this.owner.activeVideoBlockId = block.id
    this.owner.activeVideoPlayableUrl = ''
    this.owner.activeVideoFallbackUrl = ''
    this.owner.isResolvingActiveVideo = false
    this.owner.activeMovingPhoto = undefined
    this.owner.inlineVideoPreparingBlockId = this.shouldInlineVideoPlayback(block) ? block.id : ''
    this.owner.actionHint = ''

    if (isArticleDirectVideo(normalizedVideoUrl)) {
      this.loadMovingPhotoForBlock(block)
      this.owner.activeVideoPlayableUrl = normalizedVideoUrl
      return
    }
    if (isArticleYouTubeVideo(normalizedVideoUrl)) {
      this.owner.isResolvingActiveVideo = true
      this.owner.actionHint = '正在解析视频地址...'
      void this.resolveAndPlayYouTube(normalizedVideoUrl)
    }
  }

  stop(): void {
    this.owner.activeVideoBlockId = ''
    this.owner.activeVideoPlayableUrl = ''
    this.owner.activeVideoFallbackUrl = ''
    this.owner.isResolvingActiveVideo = false
    this.owner.inlineVideoPreparingBlockId = ''
    this.owner.activeMovingPhoto = undefined
    try {
      this.nativeVideoController.stop()
    } catch (_) {
    }
    try {
      this.movingPhotoController.stopPlayback()
    } catch (_) {
    }
  }

  loadMovingPhotoForBlock(block: ArticleContentBlock): void {
    if (!this.shouldUseNativeMovingPhoto(block)) {
      this.owner.activeMovingPhoto = undefined
      return
    }

    const context = this.owner.getHostContext()
    const expectedBlockId = block.id
    this.owner.activeMovingPhoto = undefined

    void MovingPhotoService.loadRemoteMovingPhoto(context, block.imageUrl, block.videoUrl)
      .then((movingPhoto: photoAccessHelper.MovingPhoto) => {
        if (this.owner.activeVideoBlockId !== expectedBlockId) {
          return
        }
        this.owner.activeMovingPhoto = movingPhoto
      })
      .catch((error: Error) => {
        if (this.owner.activeVideoBlockId !== expectedBlockId) {
          return
        }
        this.owner.activeMovingPhoto = undefined
        this.owner.inlineVideoPreparingBlockId = ''
        this.owner.actionHint = error instanceof Error ? error.message : '动态照片加载失败'
      })
  }

  private async resolveAndPlayYouTube(videoUrl: string): Promise<void> {
    const expectedVideoUrl = videoUrl
    const resolution = await VideoResolverService.resolveYouTubePlayback(videoUrl)

    if (!isArticleYouTubeVideo(expectedVideoUrl) || this.owner.activeVideoBlockId.length === 0) {
      return
    }

    this.owner.isResolvingActiveVideo = false
    const displayState = resolveYouTubePlaybackDisplay(
      resolution.playableUrl,
      shouldUseYouTubeWebFallback() ? resolution.fallbackUrl : '',
    )
    this.owner.activeVideoPlayableUrl = displayState.playableUrl
    this.owner.activeVideoFallbackUrl = displayState.fallbackUrl

    if (displayState.playableUrl) {
      this.owner.actionHint = displayState.actionHint
      return
    }

    if (shouldOpenYouTubeExternallyOnFallback()) {
      this.stop()
      this.owner.actionHint = '正在外部打开 YouTube 视频'
      await ExternalUrlService.open(videoUrl)
      this.owner.actionHint = '已在外部打开 YouTube 视频'
      return
    }

    this.owner.actionHint = displayState.actionHint
  }

  static openVideoFullscreen(title: string, block: ArticleContentBlock): void {
    void openVideoPlayer(title || '视频播放', block.videoUrl, block.imageUrl || '')
  }
}
