import { ThemePalette } from '../../services/ThemeService'
import { ResolvedDiscoverCandidate } from '../../services/DiscoverService'
import { AvatarTile } from '../AvatarTile'
import {
  CARD_RADIUS_LG,
  LIST_ACTION_HEIGHT,
  LIST_ROW_DIVIDER_INSET,
  LIST_ROW_HORIZONTAL_PADDING,
  LIST_ROW_META_SIZE,
  LIST_ROW_TITLE_SIZE,
  LIST_ROW_VERTICAL_PADDING,
} from '../../ui/UiTokens'

@Component
export struct DiscoverCandidateRow {
  @Prop candidate: ResolvedDiscoverCandidate
  @Prop showDivider: boolean
  @Prop compact: boolean = false
  @Prop showActionButton: boolean = true
  @Prop theme: ThemePalette
  @Prop feedsChangedAt: number = 0
  @Prop overlayLevel: number = 0
  @Prop avatarUrl: string = ''
  @Prop platformColor: string = ''
  @Prop platformLabel: string = ''
  @Prop isSubscribed: boolean = false
  @Prop metaText: string = ''
  @Prop hasMetaText: boolean = false
  @Prop fallbackImageUrls: string[] = []
  onCandidateClick: () => void = () => {}
  onActionClick: () => void = () => {}

  private actionLabel(): string {
    return this.isSubscribed ? '已订阅' : '订阅'
  }

  private actionBackground(): string {
    return this.isSubscribed ? this.theme.elevated : this.theme.accent
  }

  private actionFontColor(): string {
    return this.isSubscribed ? this.theme.textPrimary : '#FFFFFF'
  }

  @Builder
  private AvatarBox() {
    AvatarTile({
      imageUrl: this.avatarUrl,
      fallbackImageUrls: this.fallbackImageUrls,
      refreshToken: this.feedsChangedAt + this.overlayLevel,
      fallbackLabel: this.candidate.targetTitle,
      accent: this.platformColor,
      theme: this.theme,
      avatarSize: this.compact ? 30 : 38,
      radius: this.compact ? 8 : 10,
      textSize: this.compact ? 12 : 14,
      useAccentFallback: true,
    })
  }

  build() {
    Column() {
      Row({ space: this.compact ? 10 : 12 }) {
        Row({ space: this.compact ? 10 : 12 }) {
          this.AvatarBox()

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
          this.onCandidateClick()
        })

        if (this.showActionButton) {
          Button(this.actionLabel())
            .type(ButtonType.Capsule)
            .fontSize(LIST_ROW_META_SIZE)
            .fontWeight(FontWeight.Medium)
            .height(LIST_ACTION_HEIGHT)
            .backgroundColor(this.actionBackground())
            .fontColor(this.actionFontColor())
            .onClick(() => {
              this.onActionClick()
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
