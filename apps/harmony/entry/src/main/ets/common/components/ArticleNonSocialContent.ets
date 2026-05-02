import { ThemePalette, ThemeService } from '../services/ThemeService'
import { ArticleDetailModel, ArticleContentBlock } from '../models/LivoModels'
import { PictureCarouselMediaItem } from '../utils/PictureGallery'
import { ContentBlockItemBuilder } from './ContentBlockItemBuilder'
import { ArticlePictureDetailMedia } from './ArticlePictureDetailMedia'

@Component
export struct ArticleNonSocialContent {
  @Prop entry: ArticleDetailModel = {} as ArticleDetailModel
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop mediaAspectRatios: number[] = []
  @Prop shouldRenderSummary: boolean = false
  @Prop isPictureDetail: boolean = false
  @Prop pictureDetailMediaItems: PictureCarouselMediaItem[] = []
  @Prop textBlocks: ArticleContentBlock[] = []

  onMediaAspectRatioChange: (index: number, width: number, height: number) => void = () => {}
  onActionHintChange: (hint: string) => void = () => {}
  renderBlockCheck: (block: ArticleContentBlock, index: number) => boolean = () => false

  @Builder
  private ContentBlocksList() {
    if (this.entry.contentBlocks.length > 0) {
      ForEach(this.textBlocks, (block: ArticleContentBlock, index: number) => {
        if (this.renderBlockCheck(block, index)) {
          ContentBlockItemBuilder({
            block: block,
            index: index,
            theme: this.theme,
            mediaAspectRatio: 4 / 5,
            mediaAspectRatios: this.mediaAspectRatios,
            contentBlocks: this.entry.contentBlocks,
            onMediaAspectRatioChange: (idx, w, h) => this.onMediaAspectRatioChange(idx, w, h),
            onActionHintChange: (hint) => this.onActionHintChange(hint),
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
    Column() {
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
          title: this.entry.title || '图片预览',
          theme: this.theme,
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
  }
}
