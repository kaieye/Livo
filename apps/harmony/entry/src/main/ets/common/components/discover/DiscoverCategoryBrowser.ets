import { ThemePalette } from '../../services/ThemeService'
import { FeedViewType } from '../../models/LivoModels'
import { categoryCardSymbol, discoverCategoryCards, DiscoverCategoryCard } from '../DiscoverCatalog'
import { DiscoverSectionHeader } from './DiscoverSectionHeader'

@Component
export struct DiscoverCategoryBrowser {
  @Prop theme: ThemePalette
  @Prop showBottomTabs: boolean = false
  onCategoryClick: (view: FeedViewType, label: string, sourceKey: string) => void = () => {}

  build() {
    if (discoverCategoryCards().length > 0) {
      Column({ space: 12 }) {
        DiscoverSectionHeader({
          title: '分类精选',
          trailingText: '',
          showMoreButton: false,
          theme: this.theme,
          showBottomTabs: this.showBottomTabs,
          leadingIcon: $r('app.media.MingcuteClassify2Line'),
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
            .shadow({
              radius: 6,
              color: this.theme.isDark ? 'rgba(0,0,0,0.12)' : 'rgba(15,23,42,0.04)',
              offsetY: 2,
            })
            .clickEffect({ level: ClickEffectLevel.MIDDLE })
            .onClick(() => {
              this.onCategoryClick(card.view, card.label, card.sourceKey || '')
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
