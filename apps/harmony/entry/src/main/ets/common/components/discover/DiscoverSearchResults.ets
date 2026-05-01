import { ThemePalette } from '../../services/ThemeService'
import { ResolvedDiscoverCandidate } from '../../services/DiscoverService'
import { DiscoverCandidateRow } from './DiscoverCandidateRow'
import { DiscoverSectionHeader } from './DiscoverSectionHeader'
import { CARD_RADIUS_LG, CARD_RADIUS_XL, LIST_ROW_META_SIZE } from '../../ui/UiTokens'

@Component
export struct DiscoverSearchResults {
  @Prop searchResults: ResolvedDiscoverCandidate[]
  @Prop isSearching: boolean
  @Prop theme: ThemePalette
  @Prop feedsChangedAt: number = 0
  @Prop overlayLevel: number = 0
  @Prop showBottomTabs: boolean = true
  getCandidateAvatarUrl: (candidate: ResolvedDiscoverCandidate) => string = () => ''
  getCandidatePlatformColor: (candidate: ResolvedDiscoverCandidate) => string = () => ''
  getCandidatePlatformLabel: (candidate: ResolvedDiscoverCandidate) => string = () => ''
  isCandidateSubscribed: (candidate: ResolvedDiscoverCandidate) => boolean = () => false
  getCandidateMetaText: (candidate: ResolvedDiscoverCandidate) => string = () => ''
  hasCandidateMetaText: (candidate: ResolvedDiscoverCandidate) => boolean = () => false
  getCandidateFallbackUrls: (candidate: ResolvedDiscoverCandidate) => string[] = () => []
  onCandidateClick: (candidate: ResolvedDiscoverCandidate) => void = () => {}
  onCandidateActionClick: (candidate: ResolvedDiscoverCandidate) => void = () => {}

  build() {
    if (this.searchResults.length > 0 || this.isSearching) {
      Column({ space: 12 }) {
        DiscoverSectionHeader({
          title: '搜索结果',
          trailingText: `${this.searchResults.length}`,
          showMoreButton: false,
          theme: this.theme,
          showBottomTabs: this.showBottomTabs,
        })

        if (this.isSearching && this.searchResults.length === 0) {
          Row({ space: 10 }) {
            LoadingProgress()
              .width(20)
              .height(20)
              .color(this.theme.accent)

            Text('搜索中...')
              .fontSize(LIST_ROW_META_SIZE)
              .fontColor(this.theme.textSecondary)
          }
          .width('100%')
          .padding({ left: 16, right: 16, top: 16, bottom: 16 })
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_LG)
          .border({ width: 0.8, color: this.theme.divider })
        } else {
          Column() {
            ForEach(this.searchResults, (candidate: ResolvedDiscoverCandidate, index: number) => {
              DiscoverCandidateRow({
                candidate: candidate,
                showDivider: index < this.searchResults.length - 1,
                compact: false,
                showActionButton: true,
                theme: this.theme,
                feedsChangedAt: this.feedsChangedAt,
                overlayLevel: this.overlayLevel,
                avatarUrl: this.getCandidateAvatarUrl(candidate),
                platformColor: this.getCandidatePlatformColor(candidate),
                platformLabel: this.getCandidatePlatformLabel(candidate),
                isSubscribed: this.isCandidateSubscribed(candidate),
                metaText: this.getCandidateMetaText(candidate),
                hasMetaText: this.hasCandidateMetaText(candidate),
                fallbackImageUrls: this.getCandidateFallbackUrls(candidate),
                onCandidateClick: () => this.onCandidateClick(candidate),
                onActionClick: () => this.onCandidateActionClick(candidate),
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
}
