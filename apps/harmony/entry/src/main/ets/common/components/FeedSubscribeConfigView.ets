import { AppRepository } from '../data/AppRepository'
import { Feed, FeedViewType } from '../models/LivoModels'
import { FeedDraft } from '../repositories/FeedRepository'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { PageHeader } from './PageHeader'
import {
  CARD_RADIUS_SM,
  CHIP_RADIUS,
  PAGE_HORIZONTAL_PADDING,
} from '../ui/UiTokens'

interface ConfigOption {
  view: FeedViewType
  label: string
  description: string
}

@Component
export struct FeedSubscribeConfigView {
  @Prop targetUrl: string = ''
  @Prop targetTitle: string = ''
  @Prop targetSiteUrl: string = ''
  @Prop targetDescription: string = ''
  @Prop targetCategory: string = ''
  @Prop sourceKind: string = ''
  @Prop initialSelectedView: FeedViewType = FeedViewType.Articles
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  onBack: () => void = () => {}
  onSubscribed: () => void = () => {}
  onSaved: () => void = () => {}
  onUnsubscribed: () => void = () => {}

  @State selectedView: FeedViewType = FeedViewType.Articles
  @State customTitle: string = ''
  @State customCategory: string = ''
  @State hideInTimeline: boolean = false
  @State isEditMode: boolean = false
  @State hasChanges: boolean = false
  @State existingFeed: Feed | undefined = undefined
  @State railWidth: number = 0

  aboutToAppear(): void {
    this.selectedView = this.initialSelectedView
    this.customTitle = this.targetTitle
    this.customCategory = this.targetCategory
    this.isEditMode = this.sourceKind === '编辑'
    void this.loadExistingFeed()
  }

  private async loadExistingFeed(): Promise<void> {
    const feeds = await AppRepository.feedEntities()
    const mappedUrl = this.normalizeUrl(this.mappedTargetUrl())
    this.existingFeed = feeds.find((feed: Feed) =>
      this.normalizeUrl(feed.url) === mappedUrl
    )

    if (this.existingFeed) {
      this.customTitle = this.existingFeed.title
      this.customCategory = this.existingFeed.category || ''
      this.selectedView = this.existingFeed.view
      this.hideInTimeline = !this.existingFeed.showInAll
    }
  }

  private normalizeUrl(url: string): string {
    return url.trim().replace(/\/+$/, '').toLowerCase()
  }

  private checkForChanges(): void {
    if (!this.existingFeed) {
      this.hasChanges = false
      return
    }

    this.hasChanges =
      this.customTitle !== this.existingFeed.title ||
      this.customCategory !== this.existingFeed.category ||
      this.selectedView !== this.existingFeed.view ||
      this.hideInTimeline !== !this.existingFeed.showInAll
  }

  private viewOptions(): ConfigOption[] {
    return [
      { view: FeedViewType.Articles, label: '文章', description: '' },
      { view: FeedViewType.SocialMedia, label: '社交', description: '' },
      { view: FeedViewType.Pictures, label: '图片', description: '' },
      { view: FeedViewType.Videos, label: '视频', description: '' },
    ]
  }

  private getViewLabel(view: FeedViewType): string {
    switch (view) {
      case FeedViewType.Articles:
        return '文章'
      case FeedViewType.SocialMedia:
        return '社交'
      case FeedViewType.Pictures:
        return '图片'
      case FeedViewType.Videos:
        return '视频'
      default:
        return '文章'
    }
  }

  private getViewIcon(view: FeedViewType): Resource {
    switch (view) {
      case FeedViewType.Articles:
        return $r('app.media.sub_articles_inactive')
      case FeedViewType.SocialMedia:
        return $r('app.media.sub_social_inactive')
      case FeedViewType.Pictures:
        return $r('app.media.sub_pictures_inactive')
      case FeedViewType.Videos:
        return $r('app.media.sub_videos_inactive')
      default:
        return $r('app.media.sub_articles_inactive')
    }
  }

  private activeTextColor(): string {
    return this.theme.isDark ? '#F5F8FF' : '#14213D'
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

  private hostOf(url: string): string {
    const matched = url.match(/^https?:\/\/([^/]+)/i)
    return matched?.[1] ? matched[1].replace(/^www\./i, '') : ''
  }

  private faviconUrl(): string {
    const host = this.hostOf(this.targetSiteUrl || this.targetUrl)
    return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` : ''
  }

  private runCompletion(action: () => void, label: string): void {
    try {
      action()
    } catch (error) {
      console.error(`${label} completion failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  private async handleUnsubscribe(): Promise<void> {
    if (!this.existingFeed) {
      return
    }

    try {
      await AppRepository.removeFeed(this.existingFeed.id)
      this.showToast('已取消订阅', 2000)
    } catch (e) {
      this.showToast(`取消订阅失败: ${e}`, 3000)
      return
    }

    this.runCompletion(this.onUnsubscribed, 'unsubscribe')
  }

  private async handleSave(): Promise<void> {
    if (!this.existingFeed) {
      return
    }

    try {
      const draft: FeedDraft = {
        url: this.mappedTargetUrl(),
        title: this.customTitle || this.targetTitle,
        siteUrl: this.targetSiteUrl,
        description: this.targetDescription,
        category: this.customCategory,
        view: this.selectedView,
        showInAll: !this.hideInTimeline,
      }

      await AppRepository.updateFeed(this.existingFeed.id, draft)
      this.showToast('保存成功', 2000)
    } catch (e) {
      this.showToast(`保存失败: ${e}`, 3000)
      return
    }

    this.runCompletion(this.onSaved, 'save')
  }

  private async handleSubscribe(): Promise<void> {
    try {
      const draft: FeedDraft = {
        url: this.mappedTargetUrl(),
        title: this.customTitle || this.targetTitle,
        siteUrl: this.targetSiteUrl,
        description: this.targetDescription,
        category: this.customCategory,
        view: this.selectedView,
        showInAll: !this.hideInTimeline,
      }

      if (this.existingFeed) {
        await AppRepository.updateFeed(this.existingFeed.id, draft)
        this.showToast('订阅已更新', 2000)
      } else {
        await AppRepository.createFeed(draft)
        this.showToast('订阅成功', 2000)
      }
    } catch (e) {
      this.showToast(`订阅失败: ${e}`, 3000)
      return
    }

    this.runCompletion(this.onSubscribed, 'subscribe')
  }

  private showToast(message: string, duration: number = 2000): void {
    try {
      this.getUIContext().getPromptAction().showToast({
        message,
        duration,
      })
    } catch (error) {
      console.error(`showToast failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  private indicatorColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.92)'
  }

  private indicatorBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)'
  }

  private indicatorShadowColor(): string {
    return this.theme.isDark ? 'rgba(0,0,0,0.12)' : 'rgba(15,23,42,0.08)'
  }

  private viewOptionIndex(view: FeedViewType): number {
    const options = this.viewOptions()
    for (let i = 0; i < options.length; i++) {
      if (options[i].view === view) {
        return i
      }
    }
    return 0
  }

  private indicatorSlotWidth(): number {
    if (this.railWidth <= 0) {
      return 0
    }
    return (this.railWidth - 8) / this.viewOptions().length
  }

  private indicatorOffsetX(): number {
    return this.indicatorSlotWidth() * this.viewOptionIndex(this.selectedView)
  }

  @Builder
  private TopBar() {
    PageHeader({
      title: `订阅 - ${this.targetTitle}`,
      theme: this.theme,
      showBackButton: true,
      trailingText: this.isEditMode ? '保存' : '订阅',
      titleSize: 18,
      topPadding: 0,
      bottomPadding: 0,
      onBack: () => {
        this.onBack()
      },
      onTrailingClick: () => {
        if (this.isEditMode) {
          void this.handleSave()
          return
        }
        void this.handleSubscribe()
      },
    })
      .width('100%')
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 12, bottom: 8 })
  }

  @Builder
  private FeedInfoCard() {
    Column({ space: 12 }) {
      Row({ space: 12 }) {
        Stack({ alignContent: Alignment.Center }) {
          if (this.faviconUrl()) {
            Image(this.faviconUrl())
              .width(56)
              .height(56)
              .borderRadius(14)
              .backgroundColor(this.theme.elevated)
          } else {
            Row()
              .width(56)
              .height(56)
              .borderRadius(14)
              .backgroundColor(this.theme.accent)

            Text(this.targetTitle.substring(0, 1).toUpperCase())
              .fontSize(24)
              .fontWeight(FontWeight.Bold)
              .fontColor('#FFFFFF')
          }
        }

        Column({ space: 4 }) {
          Text(this.targetTitle)
            .fontSize(18)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          Text(this.targetUrl)
            .fontSize(12)
            .fontColor(this.theme.textMuted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
      }
      .width('100%')

      if (this.targetDescription) {
        Text(this.targetDescription)
          .fontSize(14)
          .lineHeight(20)
          .fontColor(this.theme.textSecondary)
          .width('100%')
      }
    }
    .width('100%')
    .padding(16)
    .backgroundColor(this.theme.surface)
    .borderRadius(16)
  }

  @Builder
  private ConfigSection(title: string, description: string) {
    Column({ space: 8 }) {
      Text(title)
        .fontSize(16)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)

      Text(description)
        .fontSize(13)
        .lineHeight(18)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  private TextInputField(placeholder: string, value: string, onChange: (value: string) => void) {
    TextInput({ text: value, placeholder: placeholder })
      .backgroundColor(this.theme.elevated)
      .fontColor(this.theme.textPrimary)
      .placeholderColor(this.theme.textMuted)
      .borderRadius(12)
      .padding({ left: 16, right: 16, top: 12, bottom: 12 })
      .width('100%')
      .onChange((newValue: string) => {
        onChange(newValue)
        this.checkForChanges()
      })
  }

  @Builder
  private ToggleRow(label: string, description: string, value: boolean, onChange: (value: boolean) => void) {
    Row() {
      Column({ space: 4 }) {
        Text(label)
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(description)
          .fontSize(12)
          .lineHeight(16)
          .fontColor(this.theme.textSecondary)
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      Toggle({ type: ToggleType.Switch, isOn: value })
        .selectedColor(this.theme.accent)
        .onChange((isOn: boolean) => {
          onChange(isOn)
          this.checkForChanges()
        })
    }
    .width('100%')
    .padding({ top: 8, bottom: 8 })
  }

  @Builder
  private ViewTypeButton(option: ConfigOption) {
    Row({ space: 6 }) {
      Image(this.getViewIcon(option.view))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)

      Text(this.getViewLabel(option.view))
        .fontSize(14)
        .fontWeight(this.selectedView === option.view ? FontWeight.Medium : FontWeight.Regular)
        .fontColor(this.selectedView === option.view ? this.activeTextColor() : this.theme.textSecondary)
    }
    .layoutWeight(1)
    .height(38)
    .justifyContent(FlexAlign.Center)
    .borderRadius(CHIP_RADIUS)
    .animation({ duration: 160, curve: Curve.EaseInOut })
      .clickEffect({ level: ClickEffectLevel.MIDDLE })
      .onClick(() => {
        this.selectedView = option.view
        void this.loadExistingFeed()
        this.checkForChanges()
      })
  }

  @Builder
  private BottomActions() {
    if (this.isEditMode) {
      if (this.hasChanges) {
        Row({ space: 12 }) {
          Button('取消订阅')
            .type(ButtonType.Capsule)
            .layoutWeight(1)
            .height(50)
            .fontSize(16)
            .fontWeight(FontWeight.Bold)
            .backgroundColor(this.theme.elevated)
            .fontColor('#EF4444')
            .onClick(() => {
              this.showUnsubscribeConfirm()
            })

          Button('保存')
            .type(ButtonType.Capsule)
            .layoutWeight(1)
            .height(50)
            .fontSize(16)
            .fontWeight(FontWeight.Bold)
            .backgroundColor(this.theme.accent)
            .fontColor('#FFFFFF')
            .onClick(() => {
              void this.handleSave()
            })
        }
        .width('90%')
        .margin({ bottom: 24 })
        .opacity(0.92)
      } else {
        Button('取消订阅')
          .type(ButtonType.Capsule)
          .width('80%')
          .height(50)
          .fontSize(16)
          .fontWeight(FontWeight.Bold)
          .backgroundColor(this.theme.elevated)
          .fontColor('#EF4444')
          .margin({ bottom: 24 })
          .opacity(0.92)
          .onClick(() => {
            this.showUnsubscribeConfirm()
          })
      }
    }
  }

  private showUnsubscribeConfirm(): void {
    this.getUIContext().showAlertDialog({
      title: '取消订阅',
      message: '确定要取消订阅这个订阅源吗？',
      primaryButton: {
        value: '取消',
        action: () => {}
      },
      secondaryButton: {
        value: '确定',
        fontColor: '#EF4444',
        action: () => {
          void this.handleUnsubscribe()
        }
      }
    })
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        this.TopBar()

        Scroll() {
          Column({ space: 20 }) {
            this.FeedInfoCard()

            Column({ space: 12 }) {
              this.ConfigSection('标题', '此订阅源的自定义标题，留空则使用默认标题。')
              this.TextInputField('', this.customTitle, (value: string) => {
                this.customTitle = value
              })
            }
            .width('100%')

            this.ToggleRow(
              '在时间线中隐藏',
              '开启后，此订阅将不再显示在主时间线中。',
              this.hideInTimeline,
              (value: boolean) => {
                this.hideInTimeline = value
              }
            )

            Column({ space: 12 }) {
              this.ConfigSection('栏目', '')

              Stack({ alignContent: Alignment.Center }) {
                Row() {
                  Row()
                    .width(this.indicatorSlotWidth())
                    .height(38)
                    .translate({ x: this.indicatorOffsetX() })
                    .backgroundColor(this.indicatorColor())
                    .borderRadius(CHIP_RADIUS)
                    .border({ width: 0.6, color: this.indicatorBorderColor() })
                    .shadow({
                      radius: 8,
                      color: this.indicatorShadowColor(),
                      offsetX: 0,
                      offsetY: 2,
                    })
                    .animation({ duration: 100, curve: Curve.EaseOut })
                }
                .width('100%')
                .height('100%')
                .justifyContent(FlexAlign.Start)

                Row({ space: 0 }) {
                  ForEach(this.viewOptions(), (option: ConfigOption) => {
                    this.ViewTypeButton(option)
                  }, (option: ConfigOption) => `view-${option.view}`)
                }
                .width('100%')
                .height('100%')
              }
              .width('100%')
              .height(46)
              .padding(4)
              .backgroundColor(this.theme.elevated)
              .borderRadius(CARD_RADIUS_SM)
              .border({ width: 0.8, color: this.theme.divider })
              .onSizeChange((_, newValue) => {
                if (typeof newValue.width === 'number') {
                  this.railWidth = newValue.width
                }
              })
            }
            .width('100%')

            Row().height(this.isEditMode ? 80 : 20)
          }
          .width('100%')
          .padding({ left: 16, right: 16, top: 8, bottom: 16 })
        }
        .layoutWeight(1)
        .scrollBar(BarState.Auto)
        .edgeEffect(EdgeEffect.Spring)
      }
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)

      this.BottomActions()
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
