import router from '@ohos.router'
import { AppRepository } from '../common/data/AppRepository'
import { EntryCardModel, FeedCardModel } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'

@Entry
@Component
struct FeedDetail {
  @State feedId: string = ''
  @State feed: FeedCardModel | undefined = undefined
  @State entries: EntryCardModel[] = []
  @State isRefreshing: boolean = false
  @State theme: ThemePalette = ThemeService.darkPalette()

  aboutToAppear(): void {
    console.info('Livo Harmony FeedDetail aboutToAppear')
    const params = router.getParams() as Record<string, string>
    if (params && params.feedId) {
      this.feedId = params.feedId
      void this.loadData()
    }
  }

  private async loadData(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
    
    if (this.feedId) {
      this.feed = await AppRepository.feedById(this.feedId)
      this.entries = await AppRepository.entriesByFeed(this.feedId)
    }
  }

  private async refreshFeed(): Promise<void> {
    if (!this.feedId) return
    this.isRefreshing = true
    try {
      await AppRepository.refreshFeed(this.feedId)
      this.feed = await AppRepository.feedById(this.feedId)
      this.entries = await AppRepository.entriesByFeed(this.feedId)
    } finally {
      this.isRefreshing = false
    }
  }

  private openEntry(entryId: string): void {
    router.pushUrl({
      url: 'pages/ArticleDetail',
      params: { entryId },
    })
  }

  @Builder
  private EntryCard(entry: EntryCardModel) {
    Column({ space: 8 }) {
      // Feed 信息行（在单独的源页面里，也可隐藏 sources 名字，但展示时间比较好）
      Row({ space: 6 }) {
        Text(entry.publishedLabel)
          .fontSize(12)
          .fontColor(this.theme.textMuted)

        if (entry.readingLabel) {
          Row({ space: 4 }) {
            Text('·')
              .fontSize(12)
              .fontColor(this.theme.textMuted)
            Text(entry.readingLabel)
              .fontSize(12)
              .fontColor(this.theme.textMuted)
          }
        }
      }
      .width('100%')

      // 标题
      Text(entry.title)
        .fontSize(16)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
        .lineHeight(24)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      // 摘要（可选）
      if (entry.summary && entry.summary.length > 50) {
        Text(entry.summary)
          .fontSize(14)
          .lineHeight(22)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }

      // 标签和作者
      Row({ space: 8 }) {
        if (entry.tags.length > 0) {
          ForEach(entry.tags.slice(0, 2), (tag: string) => {
            Text(`#${tag}`)
              .fontSize(12)
              .fontColor(this.theme.textSecondary)
              .padding({ left: 8, right: 8, top: 4, bottom: 4 })
              .backgroundColor(this.theme.elevated)
              .borderRadius(8)
          }, (tag: string) => tag)
        }

        if (entry.author) {
          Text(entry.author)
            .fontSize(12)
            .fontColor(this.theme.textSecondary)
            .margin({ left: 8 })
        }
      }
    }
    .alignItems(HorizontalAlign.Start)
    .padding({ left: 16, right: 16, top: 16, bottom: 16 })
    .borderRadius(16)
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => this.openEntry(entry.id))
  }

  @Builder
  private EntrySeparator() {
    Row()
      .width('100%')
      .height(0.5)
      .backgroundColor(this.theme.divider)
      .margin({ left: 16, right: 16 })
  }

  @Builder
  private PageHeader() {
    Row({ space: 16 }) {
      SymbolGlyph($r('sys.symbol.chevron_left'))
        .fontSize(28)
        .fontColor([this.theme.textPrimary])
        .padding(8)
        .clickEffect({ level: ClickEffectLevel.LIGHT })
        .onClick(() => router.back())

      if (this.feed) {
        if (this.feed.imageUrl) {
          Image(this.feed.imageUrl)
            .width(36).height(36).borderRadius(18).objectFit(ImageFit.Cover)
        } else {
          Row() {
            Text(this.feed.title.charAt(0).toUpperCase())
              .fontSize(18).fontWeight(FontWeight.Bold).fontColor('#ffffff')
          }
          .width(36).height(36).borderRadius(18)
          .backgroundColor(this.theme.accent)
          .justifyContent(FlexAlign.Center)
        }

        Text(this.feed.title)
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(1)
      } else {
        Text('加载中')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
          .layoutWeight(1)
      }
    }
    .width('100%')
    .padding({ left: 12, right: 16, top: 12, bottom: 12 })
  }

  build() {
    Column() {
      this.PageHeader()

      if (this.feed) {
        List({ space: 12 }) {
          ListItem() {
            Column({ space: 10 }) {
              if (this.feed.description) {
                Text(this.feed.description)
                  .fontSize(14)
                  .fontColor(this.theme.textSecondary)
              }
              Row() {
                Text(`${this.entries.length} 篇文章`)
                  .fontSize(13)
                  .fontColor(this.theme.textMuted)
                  .layoutWeight(1)

                Button(this.isRefreshing ? '刷新中' : '刷新')
                  .type(ButtonType.Capsule)
                  .backgroundColor(this.theme.elevated)
                  .fontColor(this.theme.textPrimary)
                  .enabled(!this.isRefreshing)
                  .clickEffect({ level: ClickEffectLevel.LIGHT })
                  .onClick(() => { void this.refreshFeed() })
              }
              .width('100%')
            }
            .padding({ left: 18, right: 18, bottom: 12 })
            .alignItems(HorizontalAlign.Start)
          }

          ForEach(this.entries, (entry: EntryCardModel, index: number) => {
            ListItem() {
              Column() {
                this.EntryCard(entry)
                if (index < this.entries.length - 1) {
                  this.EntrySeparator()
                }
              }
            }
          }, (entry: EntryCardModel) => entry.id)

          ListItem() {
            Row().height(40).width('100%')
          }
        }
        .width('100%')
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.Spring)
      } else {
        Column() {
          LoadingProgress().width(48).height(48).color(this.theme.accent)
        }.width('100%').layoutWeight(1).justifyContent(FlexAlign.Center)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
