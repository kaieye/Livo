import { AppRepository } from '../common/data/AppRepository'
import { getStringParams, goBack, openDiscoverPreview } from '../common/navigation/AppRouter'
import { FeedViewType } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'

interface ConfigOption {
  view: FeedViewType
  label: string
  description: string
}

@Entry
@Component
struct DiscoverSubscribeConfig {
  @State theme: ThemePalette = ThemeService.darkPalette()
  @State targetUrl: string = ''
  @State targetTitle: string = ''
  @State targetSiteUrl: string = ''
  @State targetDescription: string = ''
  @State sourceKind: string = ''
  @State selectedView: FeedViewType = FeedViewType.Articles

  aboutToAppear(): void {
    void this.loadPage()
  }

  private async loadPage(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)

    const params = getStringParams()
    this.targetUrl = params.targetUrl ?? ''
    this.targetTitle = params.targetTitle ?? ''
    this.targetSiteUrl = params.siteUrl ?? ''
    this.targetDescription = params.description ?? ''
    this.sourceKind = params.sourceKind ?? ''
    this.selectedView = Number(params.view ?? FeedViewType.Articles) as FeedViewType
  }

  private options(): ConfigOption[] {
    if (this.isBilibiliSource()) {
      return [
        { view: FeedViewType.SocialMedia, label: '社交', description: '订阅 Bilibili 动态更新' },
        { view: FeedViewType.Videos, label: '视频', description: '订阅 Bilibili 视频更新' },
      ]
    }

    return [
      { view: FeedViewType.Articles, label: '文章', description: '适合博客、资讯和长文内容' },
      { view: FeedViewType.SocialMedia, label: '社交', description: '适合动态流、短内容和讨论' },
      { view: FeedViewType.Pictures, label: '图片', description: '适合图片集、摄影和视觉内容' },
      { view: FeedViewType.Videos, label: '视频', description: '适合频道更新、视频和播客' },
    ]
  }

  private isBilibiliSource(): boolean {
    const site = this.targetSiteUrl.toLowerCase()
    const target = this.targetUrl.toLowerCase()
    return site.includes('space.bilibili.com')
      || site.includes('bilibili.com')
      || target.includes('/bilibili/user/video/')
      || target.includes('/bilibili/user/dynamic/')
  }

  private mappedTargetUrl(): string {
    if (!this.isBilibiliSource()) {
      return this.targetUrl
    }

    const matched = this.targetUrl.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i)
    const uid = matched?.[1] ?? ''
    if (!uid) {
      return this.targetUrl
    }

    const instanceMatch = this.targetUrl.match(/^(https?:\/\/[^/]+)/i)
    const instance = instanceMatch?.[1] ?? 'https://rsshub.pseudoyu.com'

    if (this.selectedView === FeedViewType.SocialMedia) {
      return `${instance}/bilibili/user/dynamic/${uid}`
    }

    if (this.selectedView === FeedViewType.Videos) {
      return `${instance}/bilibili/user/video/${uid}`
    }

    return this.targetUrl
  }

  private continueToPreview(): void {
    void openDiscoverPreview({
      targetUrl: this.mappedTargetUrl(),
      targetTitle: this.targetTitle,
      targetView: this.selectedView,
      siteUrl: this.targetSiteUrl,
      description: this.targetDescription,
      sourceKind: this.sourceKind,
      category: '',
    })
  }

  @Builder
  private HeaderSection() {
    Row() {
      Text('‹')
        .fontSize(28)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .width(40)
        .height(40)
        .textAlign(TextAlign.Center)
        .onClick(() => { void goBack() })

      Blank()
    }
    .width('100%')
  }

  @Builder
  private OptionCard(option: ConfigOption) {
    Column({ space: 6 }) {
      Text(option.label)
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.selectedView === option.view ? '#FFFFFF' : this.theme.textPrimary)
        .width('100%')

      Text(option.description)
        .fontSize(12)
        .lineHeight(20)
        .fontColor(this.selectedView === option.view ? 'rgba(255,255,255,0.82)' : this.theme.textSecondary)
        .width('100%')
    }
    .width('100%')
    .padding(16)
    .backgroundColor(this.selectedView === option.view ? this.theme.accent : this.theme.surface)
    .borderRadius(22)
    .alignItems(HorizontalAlign.Start)
    .animation({ duration: 180, curve: Curve.EaseInOut })
    .onClick(() => {
      this.selectedView = option.view
    })
  }

  build() {
    Column({ space: 18 }) {
      this.HeaderSection()

      Column({ space: 6 }) {
        Text('订阅到哪个栏目')
          .fontSize(28)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
          .width('100%')

        Text(this.targetTitle || '选择一个最合适的栏目，然后继续预览。')
          .fontSize(14)
          .fontColor(this.theme.textSecondary)
          .width('100%')
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)

      Column({ space: 12 }) {
        ForEach(this.options(), (option: ConfigOption) => {
          this.OptionCard(option)
        }, (option: ConfigOption) => `${option.view}`)
      }
      .width('100%')

      Blank()

      Button('继续')
        .type(ButtonType.Capsule)
        .width('100%')
        .height(54)
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .backgroundColor(this.theme.accent)
        .fontColor('#FFFFFF')
        .onClick(() => {
          this.continueToPreview()
        })
    }
    .width('100%')
    .height('100%')
    .padding({ left: 18, right: 18, top: 20, bottom: 24 })
    .backgroundColor(this.theme.background)
  }
}
