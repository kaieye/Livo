import { AppRepository } from '../data/AppRepository'
import { Feed, FeedViewType } from '../models/LivoModels'
import { FeedDraft } from '../repositories/FeedRepository'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { DiscoverRemoteSearchService } from '../services/DiscoverRemoteSearchService'
import { FeedRefreshPayload } from '../services/RssFeedService'
import { canonicalInstagramFeedUrl } from '../utils/SocialFeedTitles'
import { resolveSocialFeedDisplayImageUrl } from '../utils/SocialFeedPresentation'
import { PageHeader } from './PageHeader'
import { SecondaryPageHeaderShell } from './SecondaryPageHeaderShell'
import {
  CARD_RADIUS_SM,
  CHIP_RADIUS,
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
  @Prop targetImageUrl: string = ''
  @Prop targetDescription: string = ''
  @Prop targetCategory: string = ''
  @Prop sourceKind: string = ''
  @Prop initialSelectedView: FeedViewType = FeedViewType.Articles
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  onBack: () => void = () => {}
  onSubscribed: () => void | Promise<void> = () => {}
  onSaved: () => void | Promise<void> = () => {}
  onUnsubscribed: () => void | Promise<void> = () => {}

  @State selectedView: FeedViewType = FeedViewType.Articles
  @State customTitle: string = ''
  @State customCategory: string = ''
  @State hideInTimeline: boolean = false
  @State isEditMode: boolean = false
  @State hasChanges: boolean = false
  @State existingFeed: Feed | undefined = undefined
  @State railWidth: number = 0
  @State isSubmitting: boolean = false

  aboutToAppear(): void {
    this.selectedView = this.initialSelectedView
    this.customTitle = this.targetTitle
    this.customCategory = this.targetCategory
    this.isEditMode = this.sourceKind === '编辑'
    void this.loadExistingFeed()
  }

  private async loadExistingFeed(): Promise<void> {
    const feeds = await AppRepository.feedEntities()
    this.existingFeed = feeds.find((feed: Feed) => this.feedMatchesTarget(feed))

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

  private feedMatchesTarget(feed: Feed): boolean {
    const normalizedFeedUrl = this.normalizeUrl(feed.url)
    const normalizedFeedSiteUrl = this.normalizeUrl(feed.siteUrl || '')
    const normalizedTargetUrl = this.normalizeUrl(this.targetUrl)
    const normalizedMappedUrl = this.normalizeUrl(this.mappedTargetUrl())
    const normalizedTargetSiteUrl = this.normalizeUrl(this.targetSiteUrl)

    return normalizedFeedUrl === normalizedMappedUrl
      || (!!normalizedTargetUrl && normalizedFeedUrl === normalizedTargetUrl)
      || (!!normalizedFeedSiteUrl && normalizedFeedSiteUrl === normalizedMappedUrl)
      || (!!normalizedTargetUrl && !!normalizedFeedSiteUrl && normalizedFeedSiteUrl === normalizedTargetUrl)
      || (!!normalizedTargetSiteUrl && normalizedFeedUrl === normalizedTargetSiteUrl)
      || (!!normalizedTargetSiteUrl && !!normalizedFeedSiteUrl && normalizedFeedSiteUrl === normalizedTargetSiteUrl)
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

  private effectiveSubscribedUrl(targetUrl: string, siteUrl: string): string {
    return canonicalInstagramFeedUrl(targetUrl, siteUrl) || targetUrl
  }

  private hostOf(url: string): string {
    const matched = url.match(/^https?:\/\/([^/]+)/i)
    return matched?.[1] ? matched[1].replace(/^www\./i, '') : ''
  }

  private faviconUrl(): string {
    const host = this.hostOf(this.targetSiteUrl || this.targetUrl)
    return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` : ''
  }

  private cachedPreviewPayload() {
    return DiscoverRemoteSearchService.cachedPreviewPayload(this.targetUrl)
      ?? DiscoverRemoteSearchService.cachedPreviewPayload(this.mappedTargetUrl())
      ?? DiscoverRemoteSearchService.cachedPreviewPayload(this.targetSiteUrl)
  }

  private resolvedFeedImageUrl(): string {
    const cachedPreview = this.cachedPreviewPayload()
    const resolvedImageUrl = resolveSocialFeedDisplayImageUrl(
      cachedPreview?.imageUrl || this.targetImageUrl || this.existingFeed?.imageUrl || '',
      cachedPreview?.resolvedFeedUrl || this.mappedTargetUrl(),
      cachedPreview?.siteUrl || this.targetSiteUrl,
      this.customTitle || cachedPreview?.feedTitle || this.targetTitle,
    )
    if (resolvedImageUrl) {
      return resolvedImageUrl
    }

    return this.faviconUrl()
  }

  private async runCompletion(action: () => void | Promise<void>, label: string): Promise<void> {
    try {
      await action()
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

    await this.runCompletion(this.onUnsubscribed, 'unsubscribe')
  }

  private async handleSave(): Promise<void> {
    if (!this.existingFeed || this.isSubmitting) {
      return
    }

    this.isSubmitting = true
    try {
      const draft: FeedDraft = {
        url: this.mappedTargetUrl(),
        title: this.customTitle || this.targetTitle,
        siteUrl: this.targetSiteUrl,
        imageUrl: this.resolvedFeedImageUrl() || this.existingFeed?.imageUrl || '',
        description: this.targetDescription,
        category: this.customCategory,
        view: this.selectedView,
        showInAll: !this.hideInTimeline,
      }

      const updatedFeed = await AppRepository.updateFeed(this.existingFeed.id, draft)
      const cachedPreview = this.cachedPreviewPayload()
      if (cachedPreview) {
        const saveSeedPayload: FeedRefreshPayload = {
          etag: cachedPreview.etag,
          lastModified: cachedPreview.lastModified,
          feedTitle: draft.title || cachedPreview.feedTitle,
          siteUrl: cachedPreview.siteUrl,
          imageUrl: cachedPreview.imageUrl,
          description: cachedPreview.description,
          resolvedFeedUrl: cachedPreview.resolvedFeedUrl,
          entries: cachedPreview.entries,
        }
        void this.seedPreviewAfterSave(updatedFeed.id, saveSeedPayload)
      }
      AppStorage.setOrCreate('feedsChangedAt', Date.now())
      this.showToast('保存成功', 2000)
      await this.runCompletion(this.onSaved, 'save')
    } catch (e) {
      this.showToast(`保存失败: ${e}`, 3000)
    } finally {
      this.isSubmitting = false
    }
  }

  private async seedPreviewAfterSave(feedId: string, payload: FeedRefreshPayload): Promise<void> {
    try {
      await AppRepository.seedFeedFromPreview(feedId, payload)
    } catch (error) {
      console.error(`seed preview after save failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  private async handleSubscribe(): Promise<void> {
    if (this.isSubmitting) {
      return
    }

    this.isSubmitting = true
    try {
      const cachedPreview = this.cachedPreviewPayload()
      const effectiveTargetUrl = this.effectiveSubscribedUrl(
        cachedPreview?.resolvedFeedUrl?.trim() || this.mappedTargetUrl(),
        cachedPreview?.siteUrl?.trim() || this.targetSiteUrl.trim(),
      )
      const effectiveSiteUrl = cachedPreview?.siteUrl?.trim() || this.targetSiteUrl.trim()
      const latestExistingFeed = this.existingFeed
        ?? await AppRepository.feedEntityByUrl(this.mappedTargetUrl())
        ?? await AppRepository.feedEntityByUrl(effectiveTargetUrl)
        ?? await AppRepository.feedEntityBySiteUrl(effectiveSiteUrl)
      const draft: FeedDraft = {
        url: effectiveTargetUrl,
        title: this.customTitle || cachedPreview?.feedTitle || this.targetTitle,
        siteUrl: effectiveSiteUrl,
        imageUrl: this.resolvedFeedImageUrl() || latestExistingFeed?.imageUrl || '',
        description: cachedPreview?.description || this.targetDescription,
        category: this.customCategory,
        view: this.selectedView,
        showInAll: !this.hideInTimeline,
      }
      const hasSeededPreview = !!cachedPreview && (cachedPreview.entries?.length ?? 0) > 0
      let subscribedFeedId: string = ''
      let successMessage: string = ''

      if (latestExistingFeed) {
        const updatedFeed = await AppRepository.updateFeed(latestExistingFeed.id, draft)
        subscribedFeedId = updatedFeed.id
        successMessage = '订阅已更新'
        if (cachedPreview) {
          await AppRepository.seedFeedFromPreview(updatedFeed.id, cachedPreview)
        }
      } else {
        const createdFeed = await AppRepository.createFeed(draft)
        subscribedFeedId = createdFeed.id
        successMessage = '订阅成功'
        if (cachedPreview) {
          await AppRepository.seedFeedFromPreview(createdFeed.id, cachedPreview)
        }
      }

      this.showToast(successMessage, 2000)
      this.isSubmitting = false
      await this.runCompletion(this.onSubscribed, 'subscribe')
      if (!hasSeededPreview && subscribedFeedId) {
        void this.refreshFeedAfterSubscribe(subscribedFeedId, successMessage)
      }
      return
    } catch (e) {
      this.showToast(`订阅失败: ${e}`, 3000)
      this.isSubmitting = false
      return
    }
  }

  private async refreshFeedAfterSubscribe(feedId: string, successMessage: string): Promise<void> {
    try {
      const refreshResult = await AppRepository.refreshFeed(feedId)
      if (refreshResult.fallbackUsed) {
        this.showToast(`${successMessage}，内容将在稍后刷新`, 2000)
      }
    } catch (error) {
      console.error(`subscribe refresh failed: ${error instanceof Error ? error.message : error}`)
    }
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
    SecondaryPageHeaderShell() {
      PageHeader({
        title: `订阅 - ${this.targetTitle}`,
        theme: this.theme,
        showBackButton: true,
        trailingText: this.isEditMode ? '保存' : '',
        titleSize: 18,
        topPadding: 0,
        bottomPadding: 0,
        onBack: () => {
          this.onBack()
        },
        onTrailingClick: () => {
          if (this.isEditMode) {
            void this.handleSave()
          }
        },
      })
        .width('100%')
    }
  }

  @Builder
  private FeedInfoCard() {
    Column({ space: 12 }) {
      Row({ space: 12 }) {
        Stack({ alignContent: Alignment.Center }) {
          if (this.resolvedFeedImageUrl()) {
            Image(this.resolvedFeedImageUrl())
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

      if (description.trim()) {
        Text(description)
          .fontSize(13)
          .lineHeight(18)
          .fontColor(this.theme.textSecondary)
      }
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
        this.checkForChanges()
      })
  }

  @Builder
  private BottomActions() {
    if (!this.isEditMode) {
      Button(this.isSubmitting ? '订阅中...' : '订阅')
        .type(ButtonType.Capsule)
        .width('80%')
        .height(50)
        .fontSize(16)
        .fontWeight(FontWeight.Bold)
        .backgroundColor(this.theme.accent)
        .fontColor('#FFFFFF')
        .margin({ bottom: 24 })
        .opacity(0.92)
        .enabled(!this.isSubmitting)
        .onClick(() => {
          void this.handleSubscribe()
        })
    } else if (this.isEditMode && this.hasChanges) {
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

        Button(this.isSubmitting ? '保存中...' : '保存')
          .type(ButtonType.Capsule)
          .layoutWeight(1)
          .height(50)
          .fontSize(16)
          .fontWeight(FontWeight.Bold)
          .backgroundColor(this.theme.accent)
          .fontColor('#FFFFFF')
          .enabled(!this.isSubmitting)
          .onClick(() => {
            void this.handleSave()
          })
      }
      .width('90%')
      .margin({ bottom: 24 })
      .opacity(0.92)
    } else if (this.isEditMode) {
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
              this.ConfigSection('名称', '')
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
                    .hitTestBehavior(HitTestMode.None)
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
