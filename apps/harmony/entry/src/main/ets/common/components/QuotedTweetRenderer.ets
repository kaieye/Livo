import { ThemePalette, ThemeService } from '../services/ThemeService'
import { TweetQuotedPresentation } from '../utils/TweetEntryPresentation'
import { PictureCarouselMediaItem } from '../utils/PictureGallery'
import { QUOTED_TILE_SIZE } from '../utils/InlineMediaLayout'
import {
  emptyQuotedTweetPresentation,
  QuotedTweetMediaView,
  quotedResolvedTextMaxLines,
  quotedShouldShowExpandAction,
  quotedTweetMediaView,
} from '../utils/QuotedTweetMediaModel'
import { InlineMediaGrid } from './quoted-tweet/InlineMediaGrid'
import { InlineMediaSingleVideo } from './quoted-tweet/InlineMediaSingleVideo'

const OUTER_SECTION_TAG: string = 'quoted'
const NESTED_SECTION_TAG: string = 'quoted-nested'

const OUTER_TEXT_FONT_SIZE: number = 16
const OUTER_TEXT_LINE_HEIGHT: number = 24
const OUTER_SINGLE_VIDEO_HEIGHT: number = 208

const NESTED_TEXT_FONT_SIZE: number = 15
const NESTED_TEXT_LINE_HEIGHT: number = 22
const NESTED_SINGLE_VIDEO_HEIGHT: number = 192

@Component
export struct QuotedTweetRenderer {
  @Prop quotedTweet: TweetQuotedPresentation = emptyQuotedTweetPresentation()
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop flatMode: boolean = false
  @Prop isTextExpanded: boolean = false

  onExpandText: () => void = () => {}
  isInlineVideoActive: (sectionTag: string, item: PictureCarouselMediaItem, index: number) => boolean = () => false
  inlineVideoControllerFor: (sectionTag: string, item: PictureCarouselMediaItem, index: number) => VideoController = () => new VideoController()
  onPlayInlineVideo: (sectionTag: string, item: PictureCarouselMediaItem, index: number) => void = () => {}

  private outerView(): QuotedTweetMediaView {
    return quotedTweetMediaView(this.quotedTweet)
  }

  private nestedView(): QuotedTweetMediaView {
    return quotedTweetMediaView(this.quotedTweet.nestedQuotedTweet || emptyQuotedTweetPresentation())
  }

  private hasNestedQuotedTweet(): boolean {
    return !!this.quotedTweet.nestedQuotedTweet
  }

  private outerText(): string {
    return (this.quotedTweet.text || '').trim()
  }

  private nestedText(): string {
    return ((this.quotedTweet.nestedQuotedTweet?.text) || '').trim()
  }

  private outerShouldShowExpand(): boolean {
    return quotedShouldShowExpandAction(this.outerText(), this.isTextExpanded)
  }

  private outerMaxLines(): number {
    return quotedResolvedTextMaxLines(this.outerText(), this.isTextExpanded)
  }

  @Builder
  private QuotedTextLine(label: string, content: string, fontSize: number, lineHeight: number, maxLines: number) {
    Text() {
      Span(label).fontWeight(FontWeight.Bold)
      if (content) {
        Span(` ${content}`).fontWeight(FontWeight.Regular)
      }
    }
      .fontSize(fontSize)
      .lineHeight(lineHeight)
      .fontColor(this.theme.textPrimary)
      .width('100%')
      .maxLines(maxLines)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
  }

  @Builder
  private OuterBlock() {
    Column({ space: 8 }) {
      Text('RT')
        .fontSize(12)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textMuted)
        .width('100%')

      this.QuotedTextLine(
        this.outerView().inlineNameLabel,
        this.outerText(),
        OUTER_TEXT_FONT_SIZE,
        OUTER_TEXT_LINE_HEIGHT,
        this.outerMaxLines(),
      )

      if (this.outerShouldShowExpand()) {
        Text('显示更多')
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor('#1677FF')
          .margin({ top: -2 })
          .onClick(() => {
            this.onExpandText()
          })
      }

      if (!this.outerView().hasSingleVideoMedia && this.outerView().mediaItems.length > 0) {
        InlineMediaGrid({
          items: this.outerView().mediaItems,
          theme: this.theme,
          tileSize: QUOTED_TILE_SIZE,
          tileBorderRadius: 0,
          containerBorderRadius: 10,
          isVideoActive: (item: PictureCarouselMediaItem, index: number): boolean => {
            return this.isInlineVideoActive(OUTER_SECTION_TAG, item, index)
          },
          controllerFor: (item: PictureCarouselMediaItem, index: number): VideoController => {
            return this.inlineVideoControllerFor(OUTER_SECTION_TAG, item, index)
          },
          onTap: (item: PictureCarouselMediaItem, index: number): void => {
            this.onPlayInlineVideo(OUTER_SECTION_TAG, item, index)
          },
        })
      }
    }
    .width('100%')
    .padding({
      left: 12,
      right: 12,
      top: 12,
      bottom: this.outerView().hasSingleVideoMedia ? 10 : 12,
    })
  }

  @Builder
  private OuterSingleVideo() {
    if (this.outerView().hasSingleVideoMedia) {
      InlineMediaSingleVideo({
        item: this.outerView().primaryMediaItem,
        theme: this.theme,
        videoHeight: OUTER_SINGLE_VIDEO_HEIGHT,
        containerBorderRadius: 0,
        containerPadding: 0,
        isVideoActive: this.isInlineVideoActive(OUTER_SECTION_TAG, this.outerView().primaryMediaItem, 0),
        videoController: this.isInlineVideoActive(OUTER_SECTION_TAG, this.outerView().primaryMediaItem, 0)
          ? this.inlineVideoControllerFor(OUTER_SECTION_TAG, this.outerView().primaryMediaItem, 0)
          : undefined,
        onTap: (): void => {
          this.onPlayInlineVideo(OUTER_SECTION_TAG, this.outerView().primaryMediaItem, 0)
        },
      })
    }
  }

  @Builder
  private NestedBlockBody() {
    Column({ space: 8 }) {
      Text('RT')
        .fontSize(12)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textMuted)
        .width('100%')

      this.QuotedTextLine(
        this.nestedView().inlineNameLabel,
        this.nestedText(),
        NESTED_TEXT_FONT_SIZE,
        NESTED_TEXT_LINE_HEIGHT,
        99,
      )
    }
    .width('100%')
    .padding({
      left: 10,
      right: 10,
      top: 10,
      bottom: this.nestedView().mediaItems.length > 0 ? 8 : 10,
    })

    if (!this.nestedView().hasSingleVideoMedia && this.nestedView().mediaItems.length > 0) {
      InlineMediaGrid({
        items: this.nestedView().mediaItems,
        theme: this.theme,
        tileSize: QUOTED_TILE_SIZE,
        tileBorderRadius: 0,
        containerBorderRadius: 0,
        isVideoActive: (item: PictureCarouselMediaItem, index: number): boolean => {
          return this.isInlineVideoActive(NESTED_SECTION_TAG, item, index)
        },
        controllerFor: (item: PictureCarouselMediaItem, index: number): VideoController => {
          return this.inlineVideoControllerFor(NESTED_SECTION_TAG, item, index)
        },
        onTap: (item: PictureCarouselMediaItem, index: number): void => {
          this.onPlayInlineVideo(NESTED_SECTION_TAG, item, index)
        },
        keyOf: (item: PictureCarouselMediaItem, index: number): string => {
          return `nested_${item.imageUrl}_${item.videoUrl}_${index}`
        },
      })
    }

    if (this.nestedView().hasSingleVideoMedia) {
      InlineMediaSingleVideo({
        item: this.nestedView().primaryMediaItem,
        theme: this.theme,
        videoHeight: NESTED_SINGLE_VIDEO_HEIGHT,
        containerBorderRadius: 0,
        containerPadding: 1,
        isVideoActive: this.isInlineVideoActive(NESTED_SECTION_TAG, this.nestedView().primaryMediaItem, 0),
        videoController: this.isInlineVideoActive(NESTED_SECTION_TAG, this.nestedView().primaryMediaItem, 0)
          ? this.inlineVideoControllerFor(NESTED_SECTION_TAG, this.nestedView().primaryMediaItem, 0)
          : undefined,
        onTap: (): void => {
          this.onPlayInlineVideo(NESTED_SECTION_TAG, this.nestedView().primaryMediaItem, 0)
        },
      })
    }
  }

  @Builder
  private NestedBlock() {
    if (this.hasNestedQuotedTweet()) {
      Column() {
        Column({ space: 0 }) {
          this.NestedBlockBody()
        }
        .width('100%')
        .borderRadius(10)
        .border({ width: 0.8, color: this.theme.divider })
        .backgroundColor(this.theme.surface)
        .clip(true)
      }
      .width('100%')
      .padding({ left: 12, right: 12, top: 10, bottom: 12 })
    }
  }

  build() {
    Column({ space: 0 }) {
      this.OuterBlock()
      this.OuterSingleVideo()
      this.NestedBlock()
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(this.flatMode ? this.theme.surface : '#00000000')
    .borderRadius(12)
    .border({ width: this.flatMode ? 0.8 : 0, color: this.theme.divider })
    .clip(true)
  }
}
