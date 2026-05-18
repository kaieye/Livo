import { openArticleDetail } from '../navigation/AppRouter'
import { articleDetailModelFromCard, EntryCardModel } from '../models/LivoModels'
import { EntryRepository } from '../repositories/EntryRepository'
import { FeedRepository } from '../repositories/FeedRepository'
import { buildEntryCardsChunked } from '../data/AppRepositoryEntryHelpers'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import {
  PANEL_ICON_SIZE,
  PANEL_ROW_MIN_HEIGHT,
  PANEL_ROW_PADDING_HORIZONTAL,
  PANEL_ROW_PADDING_VERTICAL,
  PANEL_ROW_TEXT_SPACING,
  PANEL_SECTION_SPACING,
  PANEL_SUBTITLE_SIZE,
  PANEL_TITLE_SIZE,
  SettingsPanelSheetHandle,
  SettingsPanelTitle,
} from './SettingsPanelShared'

@Component
export struct FavoritesPanel {
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State starredEntries: EntryCardModel[] = []
  @State isLoading: boolean = true

  aboutToAppear(): void {
    this.theme = ThemeService.currentPalette()
    void this.loadStarredEntries()
  }

  private async loadStarredEntries(): Promise<void> {
    this.isLoading = true
    try {
      const entries = await EntryRepository.default.listStarred(100)
      const feeds = await FeedRepository.default.list()
      const feedMap = new Map<string, import('../models/LivoModels').Feed>()
      feeds.forEach((feed: import('../models/LivoModels').Feed) => feedMap.set(feed.id, feed))
      this.starredEntries = await buildEntryCardsChunked(entries, (entry) => feedMap.get(entry.feedId))
    } finally {
      this.isLoading = false
    }
  }

  private async toggleStar(entryId: string): Promise<void> {
    await EntryRepository.default.toggleStar(entryId)
    this.starredEntries = this.starredEntries.filter((entry: EntryCardModel) => entry.id !== entryId)
  }

  private favoritePreviewImages(entry: EntryCardModel): string[] {
    if (entry.viewLabel !== '图片') {
      return []
    }

    const candidates = (entry.mediaUrls && entry.mediaUrls.length > 0)
      ? entry.mediaUrls
      : (entry.imageUrl ? [entry.imageUrl] : [])
    return candidates.slice(0, 5)
  }

  @Builder
  private PictureThumbStrip(entry: EntryCardModel) {
    if (this.favoritePreviewImages(entry).length > 0) {
      Row({ space: 8 }) {
        ForEach(this.favoritePreviewImages(entry), (url: string, index: number) => {
          Image(url)
            .width(58)
            .height(58)
            .objectFit(ImageFit.Cover)
            .borderRadius(10)
            .backgroundColor(this.theme.elevated)
            .border({ width: index === 0 ? 1 : 0.6, color: this.theme.divider })
        }, (url: string, index: number) => `${url}-${index}`)
      }
      .width('100%')
    }
  }

  @Builder
  private SheetHandle() {
    SettingsPanelSheetHandle({ theme: this.theme })
  }

  @Builder
  private PanelHeader() {
    SettingsPanelTitle({ title: '收藏', theme: this.theme })
  }

  @Builder
  private StatusCard(symbol: Resource, title: string, subtitle: string) {
    Row({ space: 12 }) {
      SymbolGlyph(symbol)
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])

      Column({ space: PANEL_ROW_TEXT_SPACING }) {
        Text(title)
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(subtitle)
          .fontSize(PANEL_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: PANEL_ROW_PADDING_HORIZONTAL,
      right: PANEL_ROW_PADDING_HORIZONTAL,
      top: PANEL_ROW_PADDING_VERTICAL,
      bottom: PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private EntryCard(entry: EntryCardModel, index: number) {
    Column({ space: 8 }) {
      Row({ space: 6 }) {
        Text(entry.feedTitle)
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.accent)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        Text('·')
          .fontSize(12)
          .fontColor(this.theme.textMuted)

        Text(entry.publishedLabel)
          .fontSize(12)
          .fontColor(this.theme.textMuted)

        Blank()

        SymbolGlyph($r('sys.symbol.star_fill'))
          .fontSize(18)
          .fontColor(['#F59E0B'])
          .padding(4)
          .clickEffect({ level: ClickEffectLevel.LIGHT })
          .onClick(() => {
            void this.toggleStar(entry.id)
          })
      }
      .width('100%')

      Text(entry.title)
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')

      if (entry.summary) {
        Text(entry.summary)
          .fontSize(14)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
      }

      this.PictureThumbStrip(entry)
    }
    .width('100%')
    .padding(16)
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
      offsetX: 0,
      offsetY: 4,
    })
    .transition(livoMotion.enterSoft(index * 20 + 40))
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => {
      const model = articleDetailModelFromCard(entry)
      void openArticleDetail(entry.id, JSON.stringify(model))
    })
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        if (this.isLoading) {
          Column({ space: 10 }) {
            LoadingProgress()
              .width(28)
              .height(28)
              .color(this.theme.accent)

            Text('正在加载收藏')
              .fontSize(13)
              .fontColor(this.theme.textSecondary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .width('100%')
          .padding({ top: 24, bottom: 12 })
          .alignItems(HorizontalAlign.Center)
          .transition(livoMotion.enterSoft(20))
        } else if (this.starredEntries.length === 0) {
          Column() {
            this.StatusCard($r('sys.symbol.star'), '暂无收藏内容', '在文章详情里点亮星标后，会出现在这里')
          }
          .width('100%')
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_LG)
          .border({ width: 0.8, color: this.theme.divider })
          .transition(livoMotion.enterSoft(40))
        } else {
          Column({ space: 12 }) {
            ForEach(this.starredEntries, (entry: EntryCardModel, index: number) => {
              this.EntryCard(entry, index)
            }, (entry: EntryCardModel) => entry.id)
          }
          .width('100%')
          .padding({ top: 8 })
        }

        Row()
          .height(28)
          .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
    .edgeEffect(EdgeEffect.Spring)
  }
}
