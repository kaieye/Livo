import { SymbolGlyphModifier } from '@kit.ArkUI'
import {
  HdsTabs,
  HdsTabsController,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { AvatarTile } from './AvatarTile'
import { FeedCardModel } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { HOME_MODES, HomeMode, resolveHomeModeSymbol, resolveHomeModeTitle } from '../utils/HomeModeMeta'
import { resolveSocialFeedDisplayTitle } from '../utils/SocialFeedPresentation'
import {
  buildSubscriptionFeedIconCandidates,
  resolveSubscriptionFeedIconSource,
} from '../utils/SubscriptionsAvatarPolicy'
import {
  subscriptionSceneOpacity,
  subscriptionSceneVisibility,
  subscriptionSceneZIndex,
} from '../utils/SubscriptionsModePresentation'
import {
  CARD_RADIUS_LG,
  BOTTOM_TAB_BAR_HEIGHT,
  CARD_RADIUS_MD,
  LIST_ROW_DIVIDER_INSET,
  LIST_ROW_HORIZONTAL_PADDING,
  LIST_ROW_TITLE_SIZE,
  LIST_ROW_VERTICAL_PADDING,
  PAGE_BOTTOM_GAP,
  PAGE_HORIZONTAL_PADDING,
} from '../ui/UiTokens'
import { ROOT_MODE_RAIL_TOP_GAP } from './FloatingRootPageLayout'
import {
  SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER,
  SubscriptionMode,
} from './SubscriptionsConstants'

@Component
export struct SubscriptionsFeedListSection {
  @Prop sceneMode: SubscriptionMode = 'articles'
  @Prop activeMode: SubscriptionMode = 'articles'
  @Prop feeds: FeedCardModel[] = []
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop interactionLocked: boolean = false
  @Prop emptyTitle: string = ''
  private modeTabsController: HdsTabsController = new HdsTabsController()
  @Prop enableRootEnterTransition: boolean = true
  scroller: Scroller = new Scroller()
  onModeChange: (mode: SubscriptionMode) => void = () => {}
  onFeedClick: (feedId: string) => void = () => {}
  onScrollDelta: (yOffset: number) => void = () => {}

  private rowEnterTransition(delay: number): TransitionEffect | undefined {
    return this.enableRootEnterTransition ? livoMotion.enterScale(delay) : undefined
  }

  private feedDisplayTitle(feed: FeedCardModel): string {
    return resolveSocialFeedDisplayTitle(feed.title, feed.url, feed.siteUrl || '')
  }

  private modeIndex(mode: SubscriptionMode): number {
    const i = HOME_MODES.indexOf(mode as HomeMode)
    return i >= 0 ? i : 0
  }

  @Builder
  private ModeTabs() {
    HdsTabs({ controller: this.modeTabsController, index: this.modeIndex(this.activeMode) }) {
      ForEach(HOME_MODES, (mode: HomeMode) => {
        TabContent() {
          Row().width(0).height(0)
        }
        .tabBar(BottomTabBarStyle.of({
          normal: new SymbolGlyphModifier(resolveHomeModeSymbol(mode)),
          selected: new SymbolGlyphModifier(resolveHomeModeSymbol(mode)),
        }, resolveHomeModeTitle(mode)))
      }, (mode: HomeMode) => mode)
    }
    .vertical(false)
    .scrollable(false)
    .animationDuration(0)
    .barPosition(BarPosition.End)
    .barOverlap(true)
    .barHeight(BOTTOM_TAB_BAR_HEIGHT)
    .barFloatingStyle({
      barBottomMargin: 0,
      systemMaterialEffect: {
        materialType: hdsMaterial.MaterialType.ADAPTIVE,
        materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
      },
    })
    .enabled(!this.interactionLocked)
    .onChange((index: number) => {
      const mode = HOME_MODES[index]
      if (mode) { this.onModeChange(mode) }
    })
    .width('100%')
    .height(BOTTOM_TAB_BAR_HEIGHT)
    .hitTestBehavior(HitTestMode.Block)
  }

  @Builder
  private FeedAvatar(feed: FeedCardModel | undefined) {
    AvatarTile({
      imageUrl: resolveSubscriptionFeedIconSource(feed),
      fallbackImageUrls: buildSubscriptionFeedIconCandidates(feed),
      refreshToken: 0,
      fallbackLabel: feed ? feed.title : 'Livo',
      accent: this.theme.elevated,
      theme: this.theme,
      avatarSize: 22,
      radius: 6,
      textSize: 11,
    })
  }

  @Builder
  private FeedRow(feed: FeedCardModel, index: number, showDivider: boolean) {
    Column() {
      Row({ space: 12 }) {
        this.FeedAvatar(feed)

        Column() {
          Text(this.feedDisplayTitle(feed))
            .fontSize(LIST_ROW_TITLE_SIZE)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        Row()
          .width(4)
          .height(4)
          .borderRadius(999)
          .backgroundColor(this.theme.textMuted)
      }
      .width('100%')
      .height(52)
      .padding({
        left: LIST_ROW_HORIZONTAL_PADDING,
        right: LIST_ROW_HORIZONTAL_PADDING,
        top: LIST_ROW_VERTICAL_PADDING,
        bottom: LIST_ROW_VERTICAL_PADDING,
      })
      .clickEffect({ level: ClickEffectLevel.MIDDLE })
      .onClick(() => {
        this.onFeedClick(feed.id)
      })

      if (showDivider) {
        Divider()
          .strokeWidth(1)
          .color(this.theme.divider)
          .margin({ left: LIST_ROW_DIVIDER_INSET, right: LIST_ROW_DIVIDER_INSET })
      }
    }
    .width('100%')
    .transition(this.rowEnterTransition(index * 18 + 30))
  }

  @Builder
  private FeedSectionContent() {
    Column({ space: 0 }) {
      Blank().height(SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER)

      Column({ space: ROOT_MODE_RAIL_TOP_GAP }) {
        Row().width('100%').height(0)

        Column() {
          this.ModeTabs()
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)

      Column({ space: 20 }) {
        if (this.feeds.length === 0) {
          Column({ space: 10 }) {
            Text(`您还没有收藏任何${this.emptyTitle}源`)
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme.textPrimary)

            Text('先添加对应类型的订阅源，或者刷新现有订阅后再回来看看。')
              .fontSize(14)
              .lineHeight(22)
              .fontColor(this.theme.textSecondary)
          }
          .width('100%')
          .alignItems(HorizontalAlign.Start)
          .padding(18)
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_MD)
          .border({ width: 0.8, color: this.theme.divider })
          .transition(this.rowEnterTransition(70))
        } else {
          Column() {
            ForEach(this.feeds, (feed: FeedCardModel, index: number) => {
              this.FeedRow(feed, index, index < this.feeds.length - 1)
            }, (feed: FeedCardModel) => feed.id)
          }
          .width('100%')
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_LG)
          .border({ width: 0.8, color: this.theme.divider })
          .clip(true)
          .transition(this.rowEnterTransition(70))
        }

        Row().height(88).width('100%')
      }
      .width('100%')
      .padding({ top: 12 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .justifyContent(FlexAlign.Start)
    .constraintSize({ minHeight: '100%' })
    .padding({
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
      top: 0,
      bottom: PAGE_BOTTOM_GAP,
    })
  }

  build() {
    Scroll(this.scroller) {
      this.FeedSectionContent()
    }
    .width('100%')
    .height('100%')
    .nestedScroll({
      scrollForward: NestedScrollMode.SELF_FIRST,
      scrollBackward: NestedScrollMode.SELF_FIRST,
    })
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.Spring)
    .onWillScroll((_xOffset: number, yOffset: number, _scrollState: ScrollState, _scrollSource: ScrollSource) => {
      this.onScrollDelta(yOffset)
    })
    .visibility(subscriptionSceneVisibility(this.sceneMode, this.activeMode))
    .opacity(subscriptionSceneOpacity(this.sceneMode, this.activeMode))
    .zIndex(subscriptionSceneZIndex(this.sceneMode, this.activeMode))
  }
}