import { HighlightedInlineText } from './HighlightedInlineText'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { TweetEntryPresentation, TweetQuotedPresentation } from '../utils/TweetEntryPresentation'
import { AvatarTile } from './AvatarTile'

@Component
export struct TweetEntryCard {
  @Prop presentation: TweetEntryPresentation = {} as TweetEntryPresentation
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop enableEnterTransition: boolean = true
  @Prop highlightQuery: string = ''

  onOpen: () => void = () => {}

  private usernameLabel(): string {
    return (this.presentation.username || '').trim()
  }

  private retweetLabel(): string {
    return (this.presentation.retweetByLabel || '').trim()
  }

  private normalizedMediaUrls(): string[] {
    return (this.presentation.mediaUrls || [])
      .map((url: string) => url.trim())
      .filter((url: string) => !!url)
      .slice(0, 4)
  }

  private hasQuotedTweet(): boolean {
    return this.presentation.kind === 'quote' && !!this.presentation.quotedTweet
  }

  private quotedTweet(): TweetQuotedPresentation {
    return this.presentation.quotedTweet || {
      displayName: '',
      username: '',
      avatarUrl: '',
      text: '',
      mediaUrls: [],
    }
  }

  private quotedUsernameLabel(): string {
    return (this.quotedTweet().username || '').trim()
  }

  private mediaTileWidth(index: number, count: number): string {
    if (count <= 1) {
      return '100%'
    }

    if (count === 3 && index === 0) {
      return '100%'
    }

    return '49.2%'
  }

  private mediaTileHeight(index: number, count: number): number {
    if (count <= 1) {
      return 208
    }

    if (count === 3 && index === 0) {
      return 148
    }

    return 136
  }

  @Builder
  private RetweetBanner() {
    if (this.presentation.kind === 'retweet' && this.retweetLabel()) {
      Row({ space: 6 }) {
        Text('转')
          .fontSize(10)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textMuted)
          .width(16)
          .height(16)
          .textAlign(TextAlign.Center)
          .backgroundColor(this.theme.elevated)
          .borderRadius(999)

        Text(`${this.retweetLabel()} 已转帖`)
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textMuted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .padding({ left: 48, bottom: 2 })
    }
  }

  @Builder
  private MediaGrid() {
    if (this.normalizedMediaUrls().length > 0) {
      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
        ForEach(this.normalizedMediaUrls(), (mediaUrl: string, index: number) => {
          Image(mediaUrl)
            .width(this.mediaTileWidth(index, this.normalizedMediaUrls().length))
            .height(this.mediaTileHeight(index, this.normalizedMediaUrls().length))
            .borderRadius(14)
            .objectFit(ImageFit.Cover)
            .backgroundColor(this.theme.elevated)
            .margin({ bottom: this.normalizedMediaUrls().length > 1 ? 6 : 0 })
        }, (mediaUrl: string, index: number) => `${mediaUrl}_${index}`)
      }
      .width('100%')
      .clip(true)
    }
  }

  @Builder
  private QuoteCard() {
    if (this.hasQuotedTweet()) {
      Column({ space: 8 }) {
        Row({ space: 8 }) {
          AvatarTile({
            imageUrl: this.quotedTweet().avatarUrl,
            fallbackLabel: this.quotedTweet().displayName,
          accent: this.theme.accent,
          theme: this.theme,
          avatarSize: 28,
          radius: 999,
          textSize: 11,
          showFallbackLabel: false,
        })

          Row({ space: 4 }) {
            Text(this.quotedTweet().displayName || '未知来源')
              .fontSize(13)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme.textPrimary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })

            if (this.quotedUsernameLabel()) {
              Text(this.quotedUsernameLabel())
                .fontSize(12)
                .fontColor(this.theme.textMuted)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
            }
          }
          .layoutWeight(1)
        }
        .width('100%')

        if (this.quotedTweet().text) {
          Text(this.quotedTweet().text)
            .fontSize(13)
            .lineHeight(20)
            .fontColor(this.theme.textPrimary)
            .maxLines(4)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
      .padding({ left: 12, right: 12, top: 10, bottom: 10 })
      .border({ width: 1, color: this.theme.divider })
      .borderRadius(16)
      .backgroundColor(this.theme.isDark ? '#171C22' : '#F9FBFC')
    }
  }

  build() {
    Column({ space: 8 }) {
      this.RetweetBanner()

      Row({ space: 8 }) {
        AvatarTile({
          imageUrl: this.presentation.avatarUrl,
          fallbackLabel: this.presentation.displayName,
          accent: this.theme.accent,
          theme: this.theme,
          avatarSize: 17,
          radius: 999,
          textSize: 11,
          showFallbackLabel: false,
        })

        Row({ space: 4 }) {
          HighlightedInlineText({
            text: this.presentation.displayName || '未知来源',
            query: this.highlightQuery,
            theme: this.theme,
            fontSize: 16,
            lineHeight: 20,
            fontWeight: FontWeight.Bold,
            defaultColor: this.theme.textPrimary,
            maxLines: 1,
          })

          if (this.usernameLabel()) {
            HighlightedInlineText({
              text: this.usernameLabel(),
              query: this.highlightQuery,
              theme: this.theme,
              fontSize: 14,
              lineHeight: 18,
              defaultColor: this.theme.textMuted,
              maxLines: 1,
            })
          }

          if (this.presentation.publishedLabel) {
            Text(`· ${this.presentation.publishedLabel}`)
              .fontSize(13)
              .fontColor(this.theme.textMuted)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .layoutWeight(1)
          }
        }
        .layoutWeight(1)
      }
      .width('100%')
      .alignItems(VerticalAlign.Top)

      if (this.presentation.text) {
        HighlightedInlineText({
          text: this.presentation.text,
          query: this.highlightQuery,
          theme: this.theme,
          fontSize: 16,
          lineHeight: 24,
          defaultColor: this.theme.textPrimary,
          maxLines: 99,
        })
          .width('100%')
      }

      this.QuoteCard()
      this.MediaGrid()
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 12, bottom: 10 })
    .backgroundColor(this.theme.surface)
    .borderRadius(18)
    .border({ width: 0.8, color: this.theme.divider })
    .alignItems(HorizontalAlign.Start)
    .transition(this.enableEnterTransition ? livoMotion.enterSoft(24) : TransitionEffect.IDENTITY)
    .onClick(() => {
      this.onOpen()
    })
  }
}
