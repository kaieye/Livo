import router from '@ohos.router'
import { AppRepository } from '../common/data/AppRepository'
import { BottomTabs } from '../common/components/BottomTabs'
import { EntryCardModel } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'

type SubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos'

@Entry
@Component
struct Index {
  @State featuredEntries: EntryCardModel[] = []
  @State feedSourceLabel: string = '准备加载本地内容'
  @State isRefreshing: boolean = false
  @State searchQuery: string = ''
  @State showSearch: boolean = false
  @State mode: SubscriptionMode = 'articles'
  @State theme: ThemePalette = ThemeService.darkPalette()

  aboutToAppear(): void {
    console.info('Livo Harmony Index aboutToAppear')
    void this.loadInitialData()
  }

  private async loadInitialData(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
    this.featuredEntries = await AppRepository.featuredEntries()
    this.feedSourceLabel = '本地内容已加载'
    if (settings.autoRefresh) {
      await this.refreshFeaturedEntries()
    }
  }

  private async refreshFeaturedEntries(): Promise<void> {
    this.isRefreshing = true

    try {
      const result = await AppRepository.refreshAllFeeds()
      this.featuredEntries = result.entries
      this.feedSourceLabel = result.sourceLabel
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

  private filteredEntries(): EntryCardModel[] {
    let list = this.featuredEntries.filter((entry: EntryCardModel) =>
      entry.viewLabel === this.getModeTitle(this.mode)
    )

    const keyword = this.searchQuery.trim().toLowerCase()
    if (keyword) {
      list = list.filter((entry: EntryCardModel) =>
        entry.title.toLowerCase().includes(keyword)
        || entry.summary.toLowerCase().includes(keyword)
        || entry.feedTitle.toLowerCase().includes(keyword)
      )
    }

    return list
  }

  private modeIndex(): number {
    switch (this.mode) {
      case 'social': return 1
      case 'pictures': return 2
      case 'videos': return 3
      default: return 0
    }
  }

  private modeHighlightOffsetPercent(): string {
    return `${this.modeIndex() * 25}%`
  }

  private getModeTitle(mode: SubscriptionMode): string {
    switch (mode) {
      case 'articles': return '文章'
      case 'social': return '社交'
      case 'pictures': return '图片'
      case 'videos': return '视频'
      default: return ''
    }
  }

  @Builder
  private ModeIcon(mode: SubscriptionMode, active: boolean) {
    if (mode === 'articles') {
      Image(active ? $r('app.media.sub_articles_active') : $r('app.media.sub_articles_inactive'))
        .width(16).height(16).objectFit(ImageFit.Contain)
    } else if (mode === 'social') {
      Image(active ? $r('app.media.sub_social_active') : $r('app.media.sub_social_inactive'))
        .width(16).height(16).objectFit(ImageFit.Contain)
    } else if (mode === 'pictures') {
      Image(active ? $r('app.media.sub_pictures_active') : $r('app.media.sub_pictures_inactive'))
        .width(16).height(16).objectFit(ImageFit.Contain)
    } else {
      Image(active ? $r('app.media.sub_videos_active') : $r('app.media.sub_videos_inactive'))
        .width(16).height(16).objectFit(ImageFit.Contain)
    }
  }

  @Builder
  private ModeTab(mode: SubscriptionMode) {
    Row({ space: 6 }) {
      this.ModeIcon(mode, this.mode === mode)
      
      Text(this.getModeTitle(mode))
        .fontSize(14)
        .fontWeight(this.mode === mode ? FontWeight.Medium : FontWeight.Regular)
        .fontColor(this.mode === mode ? '#FFFFFF' : this.theme.textSecondary)
        .animation({ duration: 220, curve: Curve.EaseInOut })
    }
    .layoutWeight(1)
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .onClick(() => { this.mode = mode })
  }

  @Builder
  private ModeRail() {
    Stack({ alignContent: Alignment.Start }) {
      Row() {
        Row()
          .width('100%')
          .height('100%')
          .borderRadius(14)
          .backgroundColor(this.theme.accent)
          .shadow({ radius: 8, color: 'rgba(255, 106, 0, 0.25)', offsetY: 2 })
      }
      .width('25%')
      .height('100%')
      .padding(4)
      .offset({ x: this.modeHighlightOffsetPercent(), y: 0 })
      .animation({ duration: 280, curve: Curve.FastOutSlowIn })

      Row() {
        this.ModeTab('articles')
        this.ModeTab('social')
        this.ModeTab('pictures')
        this.ModeTab('videos')
      }
      .width('100%')
      .height('100%')
    }
    .width('100%')
    .height(46)
    .backgroundColor(this.theme.surface)
    .borderRadius(18)
  }

  @Builder
  private EntryCard(entry: EntryCardModel) {
    Column({ space: 8 }) {
      // Feed 信息行
      Row({ space: 6 }) {
        Text(entry.feedTitle)
          .fontSize(13)
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

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        List({ space: 14 }) {
          ListItem() {
            Column({ space: 14 }) {
              Row() {
                Text('今日推荐')
                  .fontSize(28)
                  .fontWeight(FontWeight.Bold)
                  .fontColor(this.theme.textPrimary)

                Blank()

                SymbolGlyph($r('sys.symbol.magnifyingglass'))
                  .fontSize(26)
                  .fontColor([this.theme.textPrimary])
                  .padding(8)
                  .clickEffect({ level: ClickEffectLevel.LIGHT })
                  .onClick(() => { this.showSearch = !this.showSearch })
              }
              .width('100%')
              .padding({ top: 12 })

              this.ModeRail()

              Row() {
                Text(this.feedSourceLabel)
                  .fontSize(12)
                  .fontColor(this.theme.textSecondary)
                  .layoutWeight(1)

                Button(this.isRefreshing ? '刷新中' : '刷新')
                  .type(ButtonType.Capsule)
                  .backgroundColor(this.theme.elevated)
                  .fontColor(this.theme.textPrimary)
                  .enabled(!this.isRefreshing)
                  .clickEffect({ level: ClickEffectLevel.LIGHT })
                  .onClick(() => { void this.refreshFeaturedEntries() })
              }
              .width('100%')
              .padding({ left: 4, right: 4 })

              if (this.showSearch) {
                TextInput({ text: this.searchQuery, placeholder: '搜索标题、摘要或来源' })
                  .backgroundColor(this.theme.surface)
                  .fontColor(this.theme.textPrimary)
                  .borderRadius(18)
                  .padding({ left: 14, right: 14, top: 10, bottom: 10 })
                  .onChange((value: string) => { this.searchQuery = value })

                if (this.searchQuery.trim()) {
                  Text(`搜索结果：${this.filteredEntries().length} 条`)
                    .fontSize(12)
                    .fontColor(this.theme.textSecondary)
                }
              }
            }
            .width('100%')
            .padding({ top: 12, bottom: 6 })
          }
          .width('100%')

          ForEach(this.filteredEntries(), (entry: EntryCardModel, index: number) => {
            ListItem() {
              Column() {
                this.EntryCard(entry)
                if (index < this.filteredEntries().length - 1) {
                  this.EntrySeparator()
                }
              }
            }
            .width('100%')
          }, (entry: EntryCardModel) => entry.id)

          if (this.filteredEntries().length === 0) {
            ListItem() {
              Text('还没有可展示的条目，请先到订阅页添加或刷新订阅源。')
                .fontSize(14)
                .fontColor(this.theme.textSecondary)
                .padding(18)
                .backgroundColor(this.theme.surface)
                .borderRadius(20)
                .width('100%')
            }
          }

          ListItem() {
            Row().height(100).width('100%')
          }
        }
        .width('100%')
        .height('100%')
        .padding({ left: 18, right: 18 })
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.Spring)
      }
      .width('100%')
      .height('100%')

      BottomTabs({ activeTab: 'home', theme: this.theme })
        .align(Alignment.Bottom)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
