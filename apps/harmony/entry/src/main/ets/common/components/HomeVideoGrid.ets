import { EntryCardModel } from '../models/LivoModels'
import { HighlightedInlineText } from './HighlightedInlineText'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { CARD_RADIUS_MD } from '../ui/UiTokens'
import {
  chunkHomeVideoEntries,
  resolveHomeVideoCardSubtitle,
  resolveHomeVideoCardTokens,
  resolveHomeVideoGridColumns,
} from '../utils/HomeVideoGrid'

@Component
export struct HomeVideoGrid {
  @Prop entries: EntryCardModel[] = []
  @Prop highlightQuery: string = ''
  onOpenEntry: (entry: EntryCardModel) => void = () => {}
  @State theme: ThemePalette = ThemeService.currentPalette()
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()

  aboutToAppear(): void {
    this.theme = this.inheritedTheme
  }

  private syncInheritedTheme(): void {
    this.theme = this.inheritedTheme
  }

  private cardMeta(entry: EntryCardModel): string {
    return resolveHomeVideoCardSubtitle({
      feedTitle: entry.feedTitle,
      author: entry.author,
      publishedLabel: entry.publishedLabel,
    })
  }

  private rows(): EntryCardModel[][] {
    return chunkHomeVideoEntries(this.entries, resolveHomeVideoGridColumns())
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
  private VideoCard(entry: EntryCardModel) {
    Column({ space: 8 }) {
      if (entry.imageUrl) {
        Image(entry.imageUrl)
          .width('100%')
          .aspectRatio(16 / 9)
          .objectFit(ImageFit.Cover)
          .borderRadius(18)
      } else {
        Column()
          .width('100%')
          .aspectRatio(16 / 9)
          .backgroundColor(this.cardTokens().placeholderBackground)
          .borderRadius(18)
      }

      Column({ space: 4 }) {
        HighlightedInlineText({
          text: entry.title,
          query: this.highlightQuery,
          theme: this.theme,
          fontSize: 14,
          lineHeight: 18,
          fontWeight: FontWeight.Medium,
          defaultColor: this.cardTokens().titleColor,
          maxLines: 2,
        })
          .width('100%')

        if (this.cardMeta(entry)) {
          Text(this.cardMeta(entry))
            .width('100%')
            .fontSize(11)
            .fontColor(this.cardTokens().metaColor)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .onClick(() => {
      this.onOpenEntry(entry)
    })
  }

  build() {
    Column({ space: 12 }) {
      if (this.entries.length === 0) {
        Column({ space: 8 }) {
          Text('还没有可展示的条目')
            .fontSize(18)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)

          Text('请先到订阅页添加或刷新订阅源，然后回到首页查看整理后的内容流。')
            .fontSize(14)
            .lineHeight(22)
            .fontColor(this.theme.textSecondary)
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .padding(20)
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_MD)
        .border({ width: 0.8, color: this.theme.divider })
      } else {
        ForEach(this.rows(), (rowEntries: EntryCardModel[], rowIndex: number) => {
          Row({ space: 12 }) {
            ForEach(rowEntries, (entry: EntryCardModel) => {
              Column() {
                this.VideoCard(entry)
              }
              .layoutWeight(1)
            }, (entry: EntryCardModel) => entry.id)

            if (rowEntries.length < resolveHomeVideoGridColumns()) {
              Blank()
                .layoutWeight(1)
            }
          }
          .width('100%')
        }, (_rowEntries: EntryCardModel[], rowIndex: number) => `video-row-${rowIndex}`)
      }
    }
    .width('100%')
  }
}
