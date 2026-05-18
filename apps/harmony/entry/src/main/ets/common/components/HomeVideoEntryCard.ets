import { EntryCardModel } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { resolveHomeVideoCardTokens } from '../utils/home/HomeVideoGrid'
import { AvatarTile } from './AvatarTile'
import { HighlightedInlineText } from './HighlightedInlineText'

const HOME_VIDEO_CARD_TITLE_HEIGHT: number = 36
const HOME_VIDEO_CARD_META_HEIGHT: number = 16

@Component
export struct HomeVideoEntryCard {
  @Prop entry: EntryCardModel = {} as EntryCardModel
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop highlightQuery: string = ''
  @Prop showUnreadDot: boolean = true
  onOpen: () => void = () => {}

  private cardMeta(entry: EntryCardModel): string {
    const feedTitle = (entry.feedTitle || '').trim()
    if (feedTitle) {
      return feedTitle
    }
    return (entry.author || '').trim()
  }

  private cardPublishedLabel(entry: EntryCardModel): string {
    return (entry.publishedLabel || '').trim()
  }

  private hasMeta(entry: EntryCardModel): boolean {
    return !!this.cardMeta(entry) || !!this.cardPublishedLabel(entry)
  }

  private cardTokens() {
    return resolveHomeVideoCardTokens({
      isDark: this.theme.isDark,
      elevated: this.theme.elevated,
      textPrimary: this.theme.textPrimary,
      textSecondary: this.theme.textSecondary,
    })
  }

  @Builder
  private Cover() {
    Stack({ alignContent: Alignment.TopEnd }) {
      if (this.entry.imageUrl) {
        Image(this.entry.imageUrl)
          .width('100%')
          .aspectRatio(16 / 9)
          .objectFit(ImageFit.Cover)
          .borderRadius(14)
          .draggable(false)
      } else {
        Column()
          .width('100%')
          .aspectRatio(16 / 9)
          .backgroundColor(this.cardTokens().placeholderBackground)
          .borderRadius(14)
      }

      if (!this.entry.isRead && this.showUnreadDot) {
        Row()
          .width(8)
          .height(8)
          .borderRadius(999)
          .backgroundColor(this.theme.accent)
          .margin({ right: 8, top: 8 })
      }
    }
  }

  @Builder
  private MetaLine() {
    if (this.hasMeta(this.entry)) {
      Row({ space: 6 }) {
        AvatarTile({
          imageUrl: this.entry.feedImageUrl,
          fallbackLabel: this.entry.feedTitle || this.entry.author,
          theme: this.theme,
          avatarSize: 16,
          radius: 8,
          textSize: 9,
        })
          .width(16)
          .height(16)

        if (this.cardMeta(this.entry)) {
          HighlightedInlineText({
            text: this.cardMeta(this.entry),
            query: this.highlightQuery,
            theme: this.theme,
            fontSize: 11,
            lineHeight: 16,
            fontWeight: FontWeight.Medium,
            defaultColor: this.cardTokens().metaColor,
            maxLines: 1,
          })
            .layoutWeight(1)
        } else {
          Blank().layoutWeight(1)
        }

        if (this.cardPublishedLabel(this.entry)) {
          Text(this.cardPublishedLabel(this.entry))
            .fontSize(11)
            .fontColor(this.cardTokens().metaColor)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .flexShrink(0)
        }
      }
      .width('100%')
      .height(HOME_VIDEO_CARD_META_HEIGHT)
      .alignItems(VerticalAlign.Center)
    } else {
      Blank()
        .width('100%')
        .height(HOME_VIDEO_CARD_META_HEIGHT)
    }
  }

  build() {
    Column({ space: 8 }) {
      this.Cover()

      Column({ space: 4 }) {
        HighlightedInlineText({
          text: this.entry.title,
          query: this.highlightQuery,
          theme: this.theme,
          fontSize: 14,
          lineHeight: 18,
          fontWeight: FontWeight.Medium,
          defaultColor: this.cardTokens().titleColor,
          maxLines: 2,
        })
          .width('100%')
          .height(HOME_VIDEO_CARD_TITLE_HEIGHT)

        this.MetaLine()
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .onClick(() => {
      this.onOpen()
    })
  }
}
