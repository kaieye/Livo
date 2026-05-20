import { AvatarTile } from './AvatarTile'
import { categoryCardSymbol, discoverCategoryCards } from './DiscoverCatalog'
import { DirectUrlResult, DiscoverCategoryCard, DiscoverOverlayRoute } from './DiscoverTypes'
import { DiscoverSearchPlatform, ResolvedDiscoverCandidate } from '../services/discover/DiscoverTypes'
import { ThemePalette } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { platformColor } from '../utils/discover/DiscoverCandidatePresentation'
import {
  CARD_RADIUS_LG,
  CARD_RADIUS_XL,
  LIST_ACTION_HEIGHT,
  LIST_ROW_DIVIDER_INSET,
  LIST_ROW_HORIZONTAL_PADDING,
  LIST_ROW_META_SIZE,
  LIST_ROW_TITLE_SIZE,
  LIST_ROW_VERTICAL_PADDING,
  SECTION_TITLE_FONT_SIZE,
} from '../ui/UiTokens'

@Component
export struct DiscoverSectionHeader {
  @Prop title: string = ''
  @Prop trailingText: string = ''
  @Prop showMoreButton: boolean = false
  @Prop leadingIcon: Resource | undefined = undefined
  @Prop theme: ThemePalette
  @Prop showBottomTabs: boolean = false

  build() {
    Row() {
      if (this.leadingIcon) {
        Image(this.leadingIcon)
          .width(20)
          .height(20)
          .objectFit(ImageFit.Contain)
          .margin({ right: 6 })
      }
      Text(this.title)
        .fontSize(SECTION_TITLE_FONT_SIZE)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
      Blank().layoutWeight(1)
      if (this.trailingText) {
        Text(this.trailingText)
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textMuted)
      }
      if (this.showMoreButton) {
        Text('更多')
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textMuted)
          .padding({ left: 8, right: 4, top: 2, bottom: 2 })
          .clickEffect({ level: ClickEffectLevel.LIGHT })
          .onClick(() => {})
      }
    }
    .width('100%')
    .transition(this.showBottomTabs ? livoMotion.enterFromRight(20) : TransitionEffect.IDENTITY)
  }
}

@Component
export struct DiscoverAvatarBox {
  @Prop imageUrl: string = ''
  @Prop fallbackLabel: string = ''
  @Prop accent: string = ''
  @Prop compact: boolean = false
  @Prop fallbackImageUrls: string[] = []
  @Prop theme: ThemePalette
  @Prop refreshToken: number = 0

  build() {
    AvatarTile({
      imageUrl: this.imageUrl,
      fallbackImageUrls: this.fallbackImageUrls,
      refreshToken: this.refreshToken,
      fallbackLabel: this.fallbackLabel,
      accent: this.accent,
      theme: this.theme,
      avatarSize: this.compact ? 30 : 38,
      radius: this.compact ? 8 : 10,
      textSize: this.compact ? 12 : 14,
      useAccentFallback: true,
    })
  }
}

@Component
export struct DiscoverResultMeta {
  @Prop primary: string = ''
  @Prop secondary: string = ''
  @Prop tertiary: string = ''
  @Prop theme: ThemePalette
  @Prop accentColor: string = ''

  build() {
    Row({ space: 6 }) {
      Text(this.primary)
        .fontSize(9)
        .fontColor('#FFFFFF')
        .padding({ left: 8, right: 8, top: 4, bottom: 4 })
        .backgroundColor(platformColor(this.primary, this.accentColor))
        .borderRadius(999)
      Text(this.secondary)
        .fontSize(10)
        .fontColor(this.theme.textMuted)
      if (this.tertiary) {
        Text(this.tertiary)
          .fontSize(10)
          .fontColor(this.theme.textMuted)
      }
    }
    .width('100%')
  }
}

@Component
export struct DiscoverDirectUrlRow {
  @Prop result: DirectUrlResult | undefined = undefined
  @Prop theme: ThemePalette
  @Prop refreshToken: number = 0
  onOpen: (result: DirectUrlResult) => void = () => {}
  getCandidateAvatarFallbackUrls: (imageUrl: string, targetUrl: string, siteUrl: string, title: string) => string[] = () => []

  build() {
    if (this.result) {
      Row({ space: 12 }) {
        DiscoverAvatarBox({
          imageUrl: '',
          fallbackLabel: this.result.title,
          accent: this.theme.accent,
          compact: false,
          fallbackImageUrls: this.getCandidateAvatarFallbackUrls('', this.result.targetUrl, this.result.siteUrl, this.result.title),
          theme: this.theme,
          refreshToken: this.refreshToken,
        })
        Column({ space: 4 }) {
          Text(this.result.title)
            .fontSize(LIST_ROW_TITLE_SIZE)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(this.result.targetUrl)
            .fontSize(LIST_ROW_META_SIZE)
            .fontColor(this.theme.textSecondary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .padding({ left: LIST_ROW_HORIZONTAL_PADDING, right: LIST_ROW_HORIZONTAL_PADDING, top: LIST_ROW_VERTICAL_PADDING, bottom: LIST_ROW_VERTICAL_PADDING })
      .backgroundColor(this.theme.surface)
      .borderRadius(CARD_RADIUS_LG)
      .border({ width: 0.8, color: this.theme.divider })
      .shadow({ radius: 8, color: this.theme.isDark ? 'rgba(0,0,0,0.14)' : 'rgba(15,23,42,0.05)', offsetY: 2 })
      .onClick(() => {
        if (this.result) {
          this.onOpen(this.result)
        }
      })
    }
  }
}

@Component
export struct DiscoverDirectUrlLoadingRow {
  @Prop theme: ThemePalette

  build() {
    Row({ space: 10 }) {
      LoadingProgress()
        .width(20)
        .height(20)
        .color(this.theme.accent)
      Text('正在解析订阅源...')
        .fontSize(LIST_ROW_META_SIZE)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .padding({
      left: LIST_ROW_HORIZONTAL_PADDING,
      right: LIST_ROW_HORIZONTAL_PADDING,
      top: LIST_ROW_VERTICAL_PADDING,
      bottom: LIST_ROW_VERTICAL_PADDING,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }
}

@Component
export struct DiscoverCandidateRow {
  @Prop candidate: ResolvedDiscoverCandidate
  @Prop showDivider: boolean = false
  @Prop compact: boolean = false
  @Prop showActionButton: boolean = true
  @Prop theme: ThemePalette
  @Prop actionLabel: string = '订阅'
  @Prop actionBackground: string = ''
  @Prop actionFontColor: string = '#FFFFFF'
  @Prop avatarUrl: string = ''
  @Prop platformLabel: string = ''
  @Prop metaText: string = ''
  @Prop hasMetaText: boolean = false
  @Prop fallbackAvatarUrls: string[] = []
  @Prop refreshToken: number = 0
  onOpen: (candidate: ResolvedDiscoverCandidate) => void = () => {}
  onSubscribe: (candidate: ResolvedDiscoverCandidate) => void = () => {}
  getPlatformColor: (label: string) => string = () => ''

  build() {
    Column() {
      Row({ space: this.compact ? 10 : 12 }) {
        Row({ space: this.compact ? 10 : 12 }) {
          DiscoverAvatarBox({
            imageUrl: this.avatarUrl,
            fallbackLabel: this.candidate.targetTitle,
            accent: this.getPlatformColor(this.platformLabel),
            compact: this.compact,
            fallbackImageUrls: this.fallbackAvatarUrls,
            theme: this.theme,
            refreshToken: this.refreshToken,
          })
          Column({ space: this.compact ? 2 : 6 }) {
            Text(this.candidate.targetTitle)
              .fontSize(LIST_ROW_TITLE_SIZE)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme.textPrimary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
            if (this.hasMetaText) {
              Text(this.metaText)
                .fontSize(LIST_ROW_META_SIZE)
                .fontColor(this.theme.textSecondary)
                .maxLines(this.compact ? 1 : 2)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
            }
          }
          .layoutWeight(1)
          .alignItems(HorizontalAlign.Start)
        }
        .layoutWeight(1)
        .onClick(() => {
          this.onOpen(this.candidate)
        })

        if (this.showActionButton) {
          Button(this.actionLabel)
            .type(ButtonType.Capsule)
            .fontSize(LIST_ROW_META_SIZE)
            .fontWeight(FontWeight.Medium)
            .height(LIST_ACTION_HEIGHT)
            .backgroundColor(this.actionBackground)
            .fontColor(this.actionFontColor)
            .onClick(() => {
              this.onSubscribe(this.candidate)
            })
        }
      }
      .width('100%')
      .padding({
        left: LIST_ROW_HORIZONTAL_PADDING,
        right: LIST_ROW_HORIZONTAL_PADDING,
        top: this.compact ? 8 : LIST_ROW_VERTICAL_PADDING,
        bottom: this.compact ? 8 : LIST_ROW_VERTICAL_PADDING,
      })

      if (this.showDivider) {
        Divider()
          .strokeWidth(1)
          .color(this.theme.divider)
          .margin({ left: LIST_ROW_DIVIDER_INSET, right: LIST_ROW_DIVIDER_INSET })
      }
    }
    .width('100%')
  }
}

@Component
export struct DiscoverCategoryBrowserSection {
  @Prop theme: ThemePalette
  @Prop showBottomTabs: boolean = false
  onOpenBrowse: (view: number, label: string, sourceKey: string) => void = () => {}

  build() {
    if (discoverCategoryCards().length > 0) {
      Column({ space: 12 }) {
        DiscoverSectionHeader({
          title: '分类精选',
          leadingIcon: $r('app.media.MingcuteClassify2Line'),
          theme: this.theme,
          showBottomTabs: this.showBottomTabs,
        })
        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween, alignItems: ItemAlign.Start }) {
          ForEach(discoverCategoryCards(), (card: DiscoverCategoryCard) => {
            Row({ space: 8 }) {
              if (card.icon) {
                Image(card.icon)
                  .width(18)
                  .height(18)
                  .objectFit(ImageFit.Contain)
              } else {
                SymbolGlyph(categoryCardSymbol(card.view))
                  .fontSize(19)
                  .fontColor([card.accent])
              }
              Text(card.label)
                .fontSize(13)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.theme.textPrimary)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
            }
            .width('24%')
            .height(46)
            .padding({ left: 10, right: 10, top: 8, bottom: 8 })
            .justifyContent(FlexAlign.Start)
            .alignItems(VerticalAlign.Center)
            .borderRadius(16)
            .backgroundColor(this.theme.surface)
            .border({ width: 0.8, color: this.theme.divider })
            .shadow({ radius: 6, color: this.theme.isDark ? 'rgba(0,0,0,0.12)' : 'rgba(15,23,42,0.04)', offsetY: 2 })
            .clickEffect({ level: ClickEffectLevel.MIDDLE })
            .onClick(() => {
              this.onOpenBrowse(card.view, card.label, card.sourceKey || '')
            })
            .margin({ bottom: 6 })
          }, (card: DiscoverCategoryCard) => card.id)
        }
        .width('100%')
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
  }
}

@Component
export struct DiscoverCandidateSection {
  @Prop title: string = ''
  @Prop items: ResolvedDiscoverCandidate[] = []
  @Prop compact: boolean = false
  @Prop separateCards: boolean = false
  @Prop showActionButton: boolean = true
  @Prop showMoreButton: boolean = false
  @Prop leadingIcon: Resource | undefined = undefined
  @Prop theme: ThemePalette
  @Prop showBottomTabs: boolean = false
  @Prop refreshToken: number = 0
  onOpen: (c: ResolvedDiscoverCandidate) => void = () => {}
  onSubscribe: (c: ResolvedDiscoverCandidate) => void = () => {}
  getActionLabel: (c: ResolvedDiscoverCandidate) => string = () => ''
  getActionBackground: (c: ResolvedDiscoverCandidate) => string = () => ''
  getActionFontColor: (c: ResolvedDiscoverCandidate) => string = () => '#FFFFFF'
  getAvatarUrl: (c: ResolvedDiscoverCandidate) => string = () => ''
  getPlatformLabel: (c: ResolvedDiscoverCandidate) => string = () => ''
  getMetaText: (c: ResolvedDiscoverCandidate) => string = () => ''
  getHasMetaText: (c: ResolvedDiscoverCandidate) => boolean = () => false
  getFallbackAvatarUrls: (c: ResolvedDiscoverCandidate) => string[] = () => []
  getPlatformColor: (label: string) => string = () => ''

  build() {
    if (this.items.length > 0) {
      Column({ space: 12 }) {
        DiscoverSectionHeader({ title: this.title, showMoreButton: this.showMoreButton, leadingIcon: this.leadingIcon,
          theme: this.theme, showBottomTabs: this.showBottomTabs })
        if (this.separateCards) {
          Column({ space: 6 }) {
            ForEach(this.items, (candidate: ResolvedDiscoverCandidate) => {
              Column() {
                DiscoverCandidateRow({
                  candidate: candidate, showDivider: false, compact: this.compact,
                  showActionButton: this.showActionButton, theme: this.theme,
                  actionLabel: this.getActionLabel(candidate),
                  actionBackground: this.getActionBackground(candidate),
                  actionFontColor: this.getActionFontColor(candidate),
                  avatarUrl: this.getAvatarUrl(candidate),
                  platformLabel: this.getPlatformLabel(candidate),
                  metaText: this.getMetaText(candidate),
                  hasMetaText: this.getHasMetaText(candidate),
                  fallbackAvatarUrls: this.getFallbackAvatarUrls(candidate),
                  refreshToken: this.refreshToken,
                  onOpen: this.onOpen, onSubscribe: this.onSubscribe,
                  getPlatformColor: this.getPlatformColor,
                })
              }
              .width('100%')
              .backgroundColor(this.theme.surface)
              .borderRadius(14)
              .border({ width: 0.8, color: this.theme.divider })
              .clip(true)
            }, (candidate: ResolvedDiscoverCandidate) => `${this.title}-${candidate.targetUrl}`)
          }
          .width('100%')
        } else {
          Column() {
            ForEach(this.items, (candidate: ResolvedDiscoverCandidate, index: number) => {
              DiscoverCandidateRow({
                candidate: candidate, showDivider: index < this.items.length - 1, compact: this.compact,
                showActionButton: this.showActionButton, theme: this.theme,
                actionLabel: this.getActionLabel(candidate),
                actionBackground: this.getActionBackground(candidate),
                actionFontColor: this.getActionFontColor(candidate),
                avatarUrl: this.getAvatarUrl(candidate),
                platformLabel: this.getPlatformLabel(candidate),
                metaText: this.getMetaText(candidate),
                hasMetaText: this.getHasMetaText(candidate),
                fallbackAvatarUrls: this.getFallbackAvatarUrls(candidate),
                refreshToken: this.refreshToken,
                onOpen: this.onOpen, onSubscribe: this.onSubscribe,
                getPlatformColor: this.getPlatformColor,
              })
            }, (candidate: ResolvedDiscoverCandidate) => `${this.title}-${candidate.targetUrl}`)
          }
          .width('100%')
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_XL)
          .border({ width: 0.8, color: this.theme.divider })
          .clip(true)
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
  }
}

@Component
export struct DiscoverSearchResultSection {
  @Prop items: ResolvedDiscoverCandidate[] = []
  @Prop isLoading: boolean = false
  @Prop isPlatformSwitchSearching: boolean = false
  @Prop theme: ThemePalette
  @Prop refreshToken: number = 0
  onOpen: (c: ResolvedDiscoverCandidate) => void = () => {}
  onSubscribe: (c: ResolvedDiscoverCandidate) => void = () => {}
  getActionLabel: (c: ResolvedDiscoverCandidate) => string = () => ''
  getActionBackground: (c: ResolvedDiscoverCandidate) => string = () => ''
  getActionFontColor: (c: ResolvedDiscoverCandidate) => string = () => '#FFFFFF'
  getAvatarUrl: (c: ResolvedDiscoverCandidate) => string = () => ''
  getPlatformLabel: (c: ResolvedDiscoverCandidate) => string = () => ''
  getMetaText: (c: ResolvedDiscoverCandidate) => string = () => ''
  getHasMetaText: (c: ResolvedDiscoverCandidate) => boolean = () => false
  getFallbackAvatarUrls: (c: ResolvedDiscoverCandidate) => string[] = () => []
  getPlatformColor: (label: string) => string = () => ''

  build() {
    Column({ space: 12 }) {
      DiscoverSectionHeader({ title: '搜索结果', trailingText: `${this.items.length}`, theme: this.theme })
      if ((this.isLoading || this.isPlatformSwitchSearching) && this.items.length === 0) {
        Row({ space: 10 }) {
          LoadingProgress().width(20).height(20).color(this.theme.accent)
          Text('搜索中...').fontSize(LIST_ROW_META_SIZE).fontColor(this.theme.textSecondary)
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 16, bottom: 16 })
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })
      } else {
        Column() {
          ForEach(this.items, (candidate: ResolvedDiscoverCandidate, index: number) => {
            DiscoverCandidateRow({
              candidate: candidate, showDivider: index < this.items.length - 1, theme: this.theme,
              actionLabel: this.getActionLabel(candidate),
              actionBackground: this.getActionBackground(candidate),
              actionFontColor: this.getActionFontColor(candidate),
              avatarUrl: this.getAvatarUrl(candidate),
              platformLabel: this.getPlatformLabel(candidate),
              metaText: this.getMetaText(candidate),
              hasMetaText: this.getHasMetaText(candidate),
              fallbackAvatarUrls: this.getFallbackAvatarUrls(candidate),
              refreshToken: this.refreshToken,
              onOpen: this.onOpen, onSubscribe: this.onSubscribe,
              getPlatformColor: this.getPlatformColor,
            })
          }, (candidate: ResolvedDiscoverCandidate) => `search-${candidate.targetUrl}`)
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_XL)
        .border({ width: 0.8, color: this.theme.divider })
        .clip(true)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
