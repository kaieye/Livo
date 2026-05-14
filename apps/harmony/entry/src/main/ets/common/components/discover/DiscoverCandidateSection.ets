import { ThemePalette } from '../../services/ThemeService'
import { ResolvedDiscoverCandidate } from '../../services/discover/DiscoverTypes'
import { DiscoverCandidateRow } from './DiscoverCandidateRow'
import { DiscoverSectionHeader } from './DiscoverSectionHeader'
import { CARD_RADIUS_XL } from '../../ui/UiTokens'

@Component
export struct DiscoverCandidateSection {
  @Prop title: string
  @Prop items: ResolvedDiscoverCandidate[]
  @Prop compact: boolean = false
  @Prop separateCards: boolean = false
  @Prop showActionButton: boolean = true
  @Prop showMoreButton: boolean = false
  @Prop theme: ThemePalette
  @Prop feedsChangedAt: number = 0
  @Prop overlayLevel: number = 0
  @Prop showBottomTabs: boolean = false
  leadingIcon?: Resource
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
    if (this.items.length > 0) {
      Column({ space: 12 }) {
        DiscoverSectionHeader({
          title: this.title,
          trailingText: '',
          showMoreButton: this.showMoreButton,
          theme: this.theme,
          showBottomTabs: this.showBottomTabs,
          leadingIcon: this.leadingIcon,
        })

        if (this.separateCards) {
          Column({ space: 6 }) {
            ForEach(this.items, (candidate: ResolvedDiscoverCandidate) => {
              Column() {
                DiscoverCandidateRow({
                  candidate: candidate,
                  showDivider: false,
                  compact: this.compact,
                  showActionButton: this.showActionButton,
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
                candidate: candidate,
                showDivider: index < this.items.length - 1,
                compact: this.compact,
                showActionButton: this.showActionButton,
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
