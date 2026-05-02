import { ThemePalette } from '../../services/ThemeService'

/**
 * Header card showing the target feed's icon, title, URL and description.
 *
 * Display-only — no state, no callbacks. The parent passes the resolved image
 * URL (favicon-or-feed-image fallback already applied) so this component
 * doesn't need to know about cached previews or social-feed presentation.
 */
@Component
export struct FeedSubscribeInfoCard {
  @Prop theme: ThemePalette
  @Prop title: string = ''
  @Prop url: string = ''
  @Prop description: string = ''
  @Prop imageUrl: string = ''

  build() {
    Column({ space: 12 }) {
      Row({ space: 12 }) {
        Stack({ alignContent: Alignment.Center }) {
          if (this.imageUrl) {
            Image(this.imageUrl)
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

            Text(this.title.substring(0, 1).toUpperCase())
              .fontSize(24)
              .fontWeight(FontWeight.Bold)
              .fontColor('#FFFFFF')
          }
        }

        Column({ space: 4 }) {
          Text(this.title)
            .fontSize(18)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          Text(this.url)
            .fontSize(12)
            .fontColor(this.theme.textMuted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
      }
      .width('100%')

      if (this.description) {
        Text(this.description)
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
}
