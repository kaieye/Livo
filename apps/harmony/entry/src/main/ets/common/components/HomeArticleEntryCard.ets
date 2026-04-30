import { EntryCardModel, selectPictureMediaUrls } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { CARD_RADIUS_MD } from '../ui/UiTokens'
import { AvatarTile } from './AvatarTile'
import { HighlightedInlineText } from './HighlightedInlineText'

@Component
export struct HomeArticleEntryCard {
  @Prop entry: EntryCardModel = {} as EntryCardModel
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop showUnreadDot: boolean = true
  @Prop highlightQuery: string = ''

  onOpen: () => void = () => {}

  private articlePreviewImage(): string {
    const candidateUrls = [
      ...(this.entry.mediaUrls ?? []),
      this.entry.imageUrl || '',
      this.entry.feedImageUrl || '',
      this.extractFirstImageUrlFromText(this.entry.summary || ''),
      this.extractFirstImageUrlFromText(this.entry.title || ''),
    ].filter((url: string) => !!url.trim())

    const pictureMediaCandidates = selectPictureMediaUrls(candidateUrls)
    if (pictureMediaCandidates.length > 0) {
      return pictureMediaCandidates[0]
    }

    const firstLikelyImage = candidateUrls.find((url: string) => this.isLikelyImageUrl(url))
    return firstLikelyImage || ''
  }

  private extractFirstImageUrlFromText(text: string): string {
    const raw = (text || '').trim()
    if (!raw) {
      return ''
    }

    const htmlMatch = raw.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)
    if (htmlMatch?.[1]) {
      return htmlMatch[1].trim()
    }

    const twimgMatch = raw.match(/https?:\/\/pbs\.twimg\.com\/[^\s"'<>]+/i)
    if (twimgMatch?.[0]) {
      return twimgMatch[0].trim()
    }

    const imageMatch = raw.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif|bmp|avif)(?:\?[^\s"'<>]*)?/i)
    return imageMatch?.[0]?.trim() || ''
  }

  private isLikelyImageUrl(url: string): boolean {
    const normalized = (url || '').trim().toLowerCase()
    if (!normalized) {
      return false
    }
    return /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|#|$)/i.test(normalized)
      || normalized.includes('pbs.twimg.com/media/')
      || normalized.includes('twimg.com/media/')
      || normalized.includes('scontent.')
  }

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Row({ space: this.articlePreviewImage() ? 10 : 0 }) {
        Column({ space: 6 }) {
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

            Row({ space: 6 }) {
              HighlightedInlineText({
                text: this.entry.feedTitle,
                query: this.highlightQuery,
                theme: this.theme,
                fontSize: 12,
                lineHeight: 16,
                fontWeight: FontWeight.Medium,
                defaultColor: this.theme.accent,
                maxLines: 1,
              })

              Text('·')
                .fontSize(12)
                .fontColor(this.theme.textMuted)

              Text(this.entry.publishedLabel)
                .fontSize(12)
                .fontColor(this.theme.textMuted)
            }
            .layoutWeight(1)
          }
          .width('100%')
          .alignItems(VerticalAlign.Center)

          HighlightedInlineText({
            text: this.entry.title,
            query: this.highlightQuery,
            theme: this.theme,
            fontSize: 15,
            lineHeight: 22,
            fontWeight: FontWeight.Bold,
            defaultColor: this.theme.textPrimary,
            maxLines: 2,
          })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        if (this.articlePreviewImage()) {
          Image(this.articlePreviewImage())
            .width(72)
            .height(72)
            .borderRadius(8)
            .objectFit(ImageFit.Cover)
            .backgroundColor(this.theme.elevated)
        }
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      if (!this.entry.isRead && this.showUnreadDot) {
        Row()
          .width(8)
          .height(8)
          .borderRadius(999)
          .backgroundColor(this.theme.accent)
          .margin({ right: 8, top: 8 })
      }
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 10, bottom: 10 })
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_MD)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
      offsetX: 0,
      offsetY: 4,
    })
    .onClick(() => this.onOpen())
  }
}
