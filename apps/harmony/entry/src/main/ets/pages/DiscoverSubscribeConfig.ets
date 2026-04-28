import { curves } from '@kit.ArkUI'
import { AppRepository } from '../common/data/AppRepository'
import { FeedSubscribeConfigView } from '../common/components/FeedSubscribeConfigView'
import { getStringParams, goBack } from '../common/navigation/AppRouter'
import { FeedViewType } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'

@Entry
@Component
struct DiscoverSubscribeConfig {
  @State theme: ThemePalette = ThemeService.lightPalette()
  @State targetUrl: string = ''
  @State targetTitle: string = ''
  @State targetSiteUrl: string = ''
  @State targetImageUrl: string = ''
  @State targetDescription: string = ''
  @State targetCategory: string = ''
  @State sourceKind: string = ''
  @State selectedView: FeedViewType = FeedViewType.Articles

  aboutToAppear(): void {
    void this.loadPage()
  }

  private async loadPage(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)

    const params = getStringParams()
    this.targetUrl = params.targetUrl ?? ''
    this.targetTitle = params.targetTitle ?? ''
    this.targetSiteUrl = params.siteUrl ?? ''
    this.targetImageUrl = params.imageUrl ?? ''
    this.targetDescription = params.description ?? ''
    this.targetCategory = params.category ?? ''
    this.sourceKind = params.sourceKind ?? ''
    this.selectedView = Number(params.view ?? FeedViewType.Articles) as FeedViewType
  }

  build() {
    Column() {
      FeedSubscribeConfigView({
        targetUrl: this.targetUrl,
        targetTitle: this.targetTitle,
        targetSiteUrl: this.targetSiteUrl,
        targetImageUrl: this.targetImageUrl,
        targetDescription: this.targetDescription,
        targetCategory: this.targetCategory,
        sourceKind: this.sourceKind,
        initialSelectedView: this.selectedView,
        theme: this.theme,
        onBack: () => { void goBack() },
        onSubscribed: () => { void goBack() },
        onSaved: () => { void goBack() },
        onUnsubscribed: () => { void goBack() },
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  pageTransition() {
    PageTransitionEnter({ type: RouteType.Push, duration: 260, curve: curves.springMotion(0.82, 0.94) })
      .opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut })
      .opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut })
      .opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut })
      .opacity(0)
  }
}
