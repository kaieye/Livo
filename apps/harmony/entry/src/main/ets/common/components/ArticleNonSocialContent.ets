import webview from '@ohos.web.webview'
import { MovingPhotoViewController, photoAccessHelper } from '@kit.MediaLibraryKit'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { ArticleDetailModel, ArticleContentBlock } from '../models/LivoModels'
import { PictureCarouselMediaItem } from '../utils/PictureGallery'
import { ContentBlockItemBuilder } from './ContentBlockItemBuilder'
import { ArticlePictureDetailMedia } from './ArticlePictureDetailMedia'

/**
 * Renders the non-social article body: optional picture-detail title,
 * picture media carousel, summary, and the structured content blocks.
 *
 * Inline video state lives on the page (because @State must) and is
 * forwarded into each ContentBlockItemBuilder instance.
 */
@Component
export struct ArticleNonSocialContent {
  @Prop entry: ArticleDetailModel = {} as ArticleDetailModel
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop mediaAspectRatios: number[] = []
  @Prop shouldRenderSummary: boolean = false
  @Prop isPictureDetail: boolean = false
  @Prop pictureDetailMediaItems: PictureCarouselMediaItem[] = []
  @Prop textBlocks: ArticleContentBlock[] = []

  @Prop activeVideoBlockId: string = ''
  @Prop activeVideoPlayableUrl: string = ''
  @Prop activeVideoFallbackUrl: string = ''
  @Prop isResolvingActiveVideo: boolean = false
  @Prop inlineVideoPreparingBlockId: string = ''
  @Prop activeMovingPhoto: photoAccessHelper.MovingPhoto | undefined = undefined

  nativeVideoController: VideoController = new VideoController()
  movingPhotoController: MovingPhotoViewController = new MovingPhotoViewController()
  videoWebController: webview.WebviewController = new webview.WebviewController()

  shouldUseInlineMovingPhotoFor: (block: ArticleContentBlock) => boolean = () => false
  renderBlockCheck: (block: ArticleContentBlock, index: number) => boolean = () => false
  onMediaAspectRatio: (index: number, width: number, height: number) => void = () => {}
  onActionHint: (hint: string) => void = () => {}
  onClearMovingPhoto: () => void = () => {}
  onClearInlineVideoPreparing: (blockId: string) => void = () => {}
  onOpenVideo: (block: ArticleContentBlock) => void = () => {}
  onOpenGallery: (url: string) => void = () => {}

  @Builder
  private ContentBlocksList() {
    if (this.entry.contentBlocks.length > 0) {
      ForEach(this.textBlocks, (block: ArticleContentBlock, index: number) => {
        if (this.renderBlockCheck(block, index)) {
          ContentBlockItemBuilder({
            block: block,
            index: index,
            theme: this.theme,
            contentBlocks: this.entry.contentBlocks,
            mediaAspectRatios: this.mediaAspectRatios,
            activeVideoBlockId: this.activeVideoBlockId,
            activeVideoPlayableUrl: this.activeVideoPlayableUrl,
            activeVideoFallbackUrl: this.activeVideoFallbackUrl,
            isResolvingActiveVideo: this.isResolvingActiveVideo,
            inlineVideoPreparingBlockId: this.inlineVideoPreparingBlockId,
            activeMovingPhoto: this.activeMovingPhoto,
            shouldUseInlineMovingPhoto: this.shouldUseInlineMovingPhotoFor(block),
            nativeVideoController: this.nativeVideoController,
            movingPhotoController: this.movingPhotoController,
            videoWebController: this.videoWebController,
            onMediaAspectRatio: (idx: number, w: number, h: number) => this.onMediaAspectRatio(idx, w, h),
            onActionHint: (hint: string) => this.onActionHint(hint),
            onClearMovingPhoto: () => this.onClearMovingPhoto(),
            onClearInlineVideoPreparing: (blockId: string) => this.onClearInlineVideoPreparing(blockId),
            onOpenVideo: (b: ArticleContentBlock) => this.onOpenVideo(b),
            onOpenGallery: (url: string) => this.onOpenGallery(url),
          })
        }
      }, (block: ArticleContentBlock) => block.id)
    } else {
      ForEach(this.entry.contentParagraphs, (paragraph: string) => {
        Text(paragraph)
          .fontSize(16)
          .lineHeight(29)
          .fontColor(this.theme.textPrimary)
          .width('100%')
          .textAlign(TextAlign.Start)
      }, (paragraph: string, index: number) => `${index}-${paragraph}`)
    }
  }

  build() {
    Column({ space: 20 }) {
      if (this.isPictureDetail && (this.entry.title || '').trim()) {
        Text(this.entry.title)
          .fontSize(16)
          .lineHeight(29)
          .fontColor(this.theme.textPrimary)
          .width('100%')
          .textAlign(TextAlign.Start)
      }

      if (this.isPictureDetail) {
        ArticlePictureDetailMedia({
          mediaItems: this.pictureDetailMediaItems,
          theme: this.theme,
          onOpenGallery: (url: string) => this.onOpenGallery(url),
        })
      }

      if (this.shouldRenderSummary) {
        Text(this.entry.summary)
          .fontSize(16)
          .lineHeight(27)
          .fontColor(this.theme.textSecondary)
          .fontWeight(FontWeight.Medium)
          .width('100%')
      }

      this.ContentBlocksList()
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
