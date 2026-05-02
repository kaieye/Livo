import { AppRepository } from '../data/AppRepository'
import { Feed, FeedViewType } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { DiscoverRemoteSearchService } from '../services/DiscoverRemoteSearchService'
import { FeedRefreshPayload } from '../services/RssFeedService'
import { resolveSocialFeedDisplayImageUrl } from '../utils/SocialFeedPresentation'
import {
  feedFaviconUrl,
  isBilibiliFeedSource,
  mapBilibiliTargetUrl,
} from '../utils/FeedSubscribeTargetUrl'
import { feedMatchesTarget } from '../utils/FeedSubscribeTargetMatcher'
import { FeedSubscribeAction, FeedSubscribeRequest } from '../utils/FeedSubscribeAction'
import { PageHeader } from './PageHeader'
import { SecondaryPageHeaderShell } from './SecondaryPageHeaderShell'
import { FeedSubscribeInfoCard } from './feed-subscribe-config/FeedSubscribeInfoCard'
import { FeedSubscribeViewTypeRail } from './feed-subscribe-config/FeedSubscribeViewTypeRail'
import { FeedSubscribeBottomActions } from './feed-subscribe-config/FeedSubscribeBottomActions'

const TOAST_DURATION_OK: number = 2000
const TOAST_DURATION_ERROR: number = 3000
const EDIT_MODE_BOTTOM_SPACER: number = 80
const SUBSCRIBE_MODE_BOTTOM_SPACER: number = 20

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
    const mappedTargetUrl = this.mappedTargetUrl()
    this.existingFeed = feeds.find((feed: Feed) => feedMatchesTarget(feed, {
      targetUrl: this.targetUrl,
      mappedTargetUrl,
      targetSiteUrl: this.targetSiteUrl,
    }))

    if (this.existingFeed) {
      this.customTitle = this.existingFeed.title
      this.customCategory = this.existingFeed.category || ''
      this.selectedView = this.existingFeed.view
      this.hideInTimeline = !this.existingFeed.showInAll
    }
  }

  private mappedTargetUrl(): string {
    if (!isBilibiliFeedSource(this.targetUrl, this.targetSiteUrl)) {
      return this.targetUrl
    }
    return mapBilibiliTargetUrl(this.targetUrl, this.targetSiteUrl, this.selectedView)
  }

  private cachedPreviewPayload(): FeedRefreshPayload | undefined {
    return DiscoverRemoteSearchService.cachedPreviewPayload(this.targetUrl)
      ?? DiscoverRemoteSearchService.cachedPreviewPayload(this.mappedTargetUrl())
  }

  private resolvedFeedImageUrl(): string {
    const cachedPreview = this.cachedPreviewPayload()
    const resolvedImageUrl = resolveSocialFeedDisplayImageUrl(
      cachedPreview?.imageUrl || this.targetImageUrl || this.existingFeed?.imageUrl || '',
      cachedPreview?.resolvedFeedUrl || this.mappedTargetUrl(),
      cachedPreview?.siteUrl || this.targetSiteUrl,
      this.customTitle || cachedPreview?.feedTitle || this.targetTitle,
    )
    return resolvedImageUrl || feedFaviconUrl(this.targetSiteUrl, this.targetUrl)
  }

  private buildSubscribeRequest(): FeedSubscribeRequest {
    return {
      targetUrl: this.targetUrl,
      targetTitle: this.targetTitle,
      targetSiteUrl: this.targetSiteUrl,
      targetDescription: this.targetDescription,
      customTitle: this.customTitle,
      customCategory: this.customCategory,
      selectedView: this.selectedView,
      hideInTimeline: this.hideInTimeline,
      mappedTargetUrl: this.mappedTargetUrl(),
      resolvedImageUrl: this.resolvedFeedImageUrl(),
      cachedPreview: this.cachedPreviewPayload(),
    }
  }

  private checkForChanges(): void {
    if (!this.existingFeed) {
      this.hasChanges = false
      return
    }
    this.hasChanges =
      this.customTitle !== this.existingFeed.title
      || this.customCategory !== this.existingFeed.category
      || this.selectedView !== this.existingFeed.view
      || this.hideInTimeline !== !this.existingFeed.showInAll
  }

  private async handleSubscribe(): Promise<void> {
    if (this.isSubmitting) {
      return
    }
    this.isSubmitting = true
    try {
      const outcome = await FeedSubscribeAction.subscribe(
        this.buildSubscribeRequest(),
        this.existingFeed,
      )
      this.showToast(outcome.message, TOAST_DURATION_OK)
      await fireCallback(this.onSubscribed, 'subscribe')
      if (!outcome.hasSeededPreview && outcome.feedId) {
        void FeedSubscribeAction.refreshAfterSubscribe(outcome.feedId)
      }
    } catch (error) {
      this.showToast(`订阅失败: ${error}`, TOAST_DURATION_ERROR)
    } finally {
      this.isSubmitting = false
    }
  }

  private async handleSave(): Promise<void> {
    if (!this.existingFeed || this.isSubmitting) {
      return
    }
    this.isSubmitting = true
    try {
      const outcome = await FeedSubscribeAction.save(this.buildSubscribeRequest(), this.existingFeed)
      this.showToast(outcome.message, TOAST_DURATION_OK)
      await fireCallback(this.onSaved, 'save')
    } catch (error) {
      this.showToast(`保存失败: ${error}`, TOAST_DURATION_ERROR)
    } finally {
      this.isSubmitting = false
    }
  }

  private async handleUnsubscribe(): Promise<void> {
    if (!this.existingFeed) {
      return
    }
    try {
      await FeedSubscribeAction.unsubscribe(this.existingFeed.id)
      this.showToast('已取消订阅', TOAST_DURATION_OK)
    } catch (error) {
      this.showToast(`取消订阅失败: ${error}`, TOAST_DURATION_ERROR)
      return
    }
    await fireCallback(this.onUnsubscribed, 'unsubscribe')
  }

  private showToast(message: string, duration: number = TOAST_DURATION_OK): void {
    try {
      this.getUIContext().getPromptAction().showToast({
        message,
        duration,
      })
    } catch (error) {
      console.error(`showToast failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  private showUnsubscribeConfirm(): void {
    this.getUIContext().showAlertDialog({
      title: '取消订阅',
      message: '确定要取消订阅这个订阅源吗？',
      primaryButton: { value: '取消', action: () => {} },
      secondaryButton: {
        value: '确定',
        fontColor: '#EF4444',
        action: () => { void this.handleUnsubscribe() },
      },
    })
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
        onBack: () => { this.onBack() },
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
    TextInput({ text: value, placeholder })
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

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        this.TopBar()

        Scroll() {
          Column({ space: 20 }) {
            FeedSubscribeInfoCard({
              theme: this.theme,
              title: this.targetTitle,
              url: this.targetUrl,
              description: this.targetDescription,
              imageUrl: this.resolvedFeedImageUrl(),
            })

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
              },
            )

            Column({ space: 12 }) {
              this.ConfigSection('栏目', '')
              FeedSubscribeViewTypeRail({
                theme: this.theme,
                selectedView: this.selectedView,
                onSelect: (view: FeedViewType) => {
                  this.selectedView = view
                  this.checkForChanges()
                },
              })
            }
            .width('100%')

            Row().height(this.isEditMode ? EDIT_MODE_BOTTOM_SPACER : SUBSCRIBE_MODE_BOTTOM_SPACER)
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

      FeedSubscribeBottomActions({
        theme: this.theme,
        isEditMode: this.isEditMode,
        hasChanges: this.hasChanges,
        isSubmitting: this.isSubmitting,
        onSubscribe: () => { void this.handleSubscribe() },
        onSave: () => { void this.handleSave() },
        onUnsubscribe: () => { this.showUnsubscribeConfirm() },
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}

async function fireCallback(callback: () => void | Promise<void>, label: string): Promise<void> {
  try {
    await callback()
  } catch (error) {
    console.error(`${label} completion failed: ${error instanceof Error ? error.message : error}`)
  }
}
