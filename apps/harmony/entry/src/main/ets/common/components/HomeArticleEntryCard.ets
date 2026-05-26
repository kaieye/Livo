import { EntryCardModel, selectPictureMediaUrls } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { CARD_RADIUS_MD } from '../ui/UiTokens'
import { AvatarTile } from './AvatarTile'
import { HighlightedInlineText } from './HighlightedInlineText'
import { isTweetLikeEntry } from '../utils/home/HomeEntryUtils'

// 预览图缓存:LazyForEach 复用本卡片时,aboutToReuse + @Watch 都会重算 computePreviewImage,
// 内部对 summary/title 做多次正则匹配 + selectPictureMediaUrls 过滤,单卡 ~10 次正则。
// 滑动期间每条卡复用一次就是一份开销,按 entry id 缓存后只有首次计算一次。
const _articlePreviewImageCache: Map<string, string> = new Map<string, string>()

function articlePreviewImageCacheKey(entry: EntryCardModel): string {
  const id = (entry.id || '').trim()
  if (id) {
    return id
  }
  return `${entry.feedId}|${entry.articleUrl}|${entry.title}`
}

@Reusable
@Component
export struct HomeArticleEntryCard {
  // entry 变更时重算预览图缓存。原实现是 articlePreviewImage() 在 build 中调用 3
  // 次(Row.space、if、Image),每次都要做 8 字段 cacheKey 拼接 + 比对,在
  // LazyForEach 复用时是热点。改为 @Watch 在 entry 变化的瞬间算一次,build 只读取
  // @State,完全避开 build 中的字符串拼接。
  @Watch('handleEntryChanged') @Prop entry: EntryCardModel = {} as EntryCardModel
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop showUnreadDot: boolean = true
  @Prop highlightQuery: string = ''
  @Prop flatMode: boolean = false
  @State private cachedPreviewImageUrl: string = ''

  onOpen: () => void = () => {}

  aboutToAppear(): void {
    this.cachedPreviewImageUrl = this.computePreviewImage()
  }

  // LazyForEach 复用本组件时,@Prop 由 ArkUI 自动重新赋值;在此显式重算
  // 派生缓存,避免依赖 @Watch 在 reuse 路径上的触发时序。
  aboutToReuse(_params: ESObject): void {
    this.cachedPreviewImageUrl = this.computePreviewImage()
  }

  private handleEntryChanged(_propName: string): void {
    this.cachedPreviewImageUrl = this.computePreviewImage()
  }

  private computePreviewImage(): string {
    const cacheKey = articlePreviewImageCacheKey(this.entry)
    const cached = _articlePreviewImageCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }
    const result = this.computePreviewImageUncached()
    _articlePreviewImageCache.set(cacheKey, result)
    return result
  }

  private computePreviewImageUncached(): string {
    const lightweightCandidates = [
      ...(this.entry.mediaUrls ?? []),
      this.entry.imageUrl || '',
      this.entry.feedImageUrl || '',
    ].filter((url: string) => !!url.trim())
    if (isTweetLikeEntry(this.entry)) {
      const pictureMediaCandidates = selectPictureMediaUrls(lightweightCandidates)
      return pictureMediaCandidates[0] || lightweightCandidates[0] || ''
    }

    const candidateUrls = [
      ...lightweightCandidates,
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

  private cardPadding(): Padding {
    if (this.flatMode) {
      return { left: 0, right: 0, top: 12, bottom: 12 }
    }
    return { left: 14, right: 14, top: 10, bottom: 10 }
  }

  private cardBackgroundColor(): string {
    return this.flatMode ? '#00000000' : this.theme.surface
  }

  private cardBorderWidth(): number {
    return this.flatMode ? 0 : 0.8
  }

  private cardBorderRadius(): number {
    return this.flatMode ? 0 : CARD_RADIUS_MD
  }

  private cardShadowRadius(): number {
    return this.flatMode ? 0 : (this.theme.isDark ? 10 : 14)
  }

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Row({ space: this.cachedPreviewImageUrl ? 10 : 0 }) {
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

        if (this.cachedPreviewImageUrl) {
          Image(this.cachedPreviewImageUrl)
            .width(72)
            .height(72)
            .borderRadius(8)
            .objectFit(ImageFit.Cover)
            .backgroundColor(this.theme.elevated)
            .draggable(false)
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
    .padding(this.cardPadding())
    .backgroundColor(this.cardBackgroundColor())
    .borderRadius(this.cardBorderRadius())
    .border({ width: this.cardBorderWidth(), color: this.theme.divider })
    .shadow({
      radius: this.cardShadowRadius(),
      color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
      offsetX: 0,
      offsetY: this.flatMode ? 0 : 4,
    })
    .onClick(() => this.onOpen())
  }
}
