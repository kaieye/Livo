import { EntryCardModel } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { resolveHomeModeTitle } from '../coordinators/home/HomeModeMeta'
import { HomeInlineSearchOverlay } from './HomeInlineSearchOverlay'
import { HomeRootOverlayControls } from './HomeRootOverlayControls'
import { HOME_MODE_RAIL_COLLAPSE_DISMISS_TRAVEL, SubscriptionMode } from './HomeRootConfig'
import { HOME_MODE_RAIL_EFFECTIVE_PROGRESS_KEY } from '../coordinators/index-home/HomeChromeProgressStore'

// 通过 @StorageProp 订阅模式栏折叠进度,自己在节点上跑 .animation(),
// 避免父层 (Index) 因 @State 进度变化而触发整树 rebuild。
@Component
struct HomeAnimatedModeRail {
  @StorageProp(HOME_MODE_RAIL_EFFECTIVE_PROGRESS_KEY) private railProgress: number = 0
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop mode: SubscriptionMode = 'articles'
  @Prop interactionLocked: boolean = false
  onModeChange: (mode: SubscriptionMode) => void = () => {}

  build() {
    Stack() {
      HomeRootOverlayControls({
        theme: this.theme,
        mode: this.mode,
        interactionLocked: this.interactionLocked,
        onModeChange: (mode: SubscriptionMode) => {
          this.onModeChange(mode)
        },
      })
    }
    .width('100%')
    .translate({ y: -1 * HOME_MODE_RAIL_COLLAPSE_DISMISS_TRAVEL * this.railProgress })
    .opacity(Math.max(0, 1 - this.railProgress))
    .animation({ duration: 80, curve: Curve.EaseInOut })
  }
}

@Component
export struct IndexHomeOverlayLayer {
  @Prop isHomeRootTab: boolean = false
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop mode: SubscriptionMode = 'articles'
  @Prop interactionLocked: boolean = false
  @Prop isRefreshing: boolean = false
  @Prop refreshTotalCount: number = 0
  @Prop displayRefreshPercent: number = 0
  @Prop homePostRefreshReloadPending: boolean = false
  @Prop showSearch: boolean = false
  @Prop searchOverlayVisible: boolean = false
  @Prop searchQuery: string = ''
  @Prop searchAllHomeCategories: boolean = false
  @Prop collapsedModeRailTopPadding: number = 0
  @Prop horizontalPadding: number = 0
  @Prop searchFieldOffsetY: number = 0
  @Prop searchResultEntries: EntryCardModel[] = []
  @Prop searchShowEmptyState: boolean = false

  inputController: TextInputController = new TextInputController()
  onModeChange: (mode: SubscriptionMode) => void = () => {}
  onQueryChange: (value: string) => void = () => {}
  onSearchClose: (clearQuery: boolean) => void = () => {}
  onEntryClick: (entry: EntryCardModel) => void = () => {}
  onSearchInputAppear: () => void = () => {}
  summaryTextForEntry: (entry: EntryCardModel) => string = () => ''

  @Builder
  private OverlayControls() {
    HomeAnimatedModeRail({
      theme: this.theme,
      mode: this.mode,
      interactionLocked: this.interactionLocked,
      onModeChange: (mode: SubscriptionMode) => {
        this.onModeChange(mode)
      },
    })
  }

  private refreshStatusText(): string {
    if (!this.isRefreshing && this.homePostRefreshReloadPending) {
      return '正在更新'
    }

    if (this.refreshTotalCount > 0) {
      return `刷新中 ${this.displayRefreshPercent}%`
    }

    return '正在刷新'
  }

  @Builder
  private RefreshStatusPill() {
    Row() {
      Row({ space: 6 }) {
        SymbolGlyph($r('sys.symbol.arrow_clockwise'))
          .fontSize(14)
          .fontColor([this.theme.accent])

        Text(this.refreshStatusText())
          .fontSize(13)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .maxLines(1)
      }
      .height(30)
      .padding({ left: 12, right: 12 })
      .borderRadius(15)
      .backgroundColor(this.theme.isDark ? 'rgba(20,22,28,0.78)' : 'rgba(255,255,255,0.86)')
      .backdropBlur(this.theme.isDark ? 10 : 16)
      .border({ width: 0.8, color: this.theme.divider })
      .shadow({
        radius: this.theme.isDark ? 8 : 12,
        color: this.theme.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(15,23,42,0.1)',
        offsetX: 0,
        offsetY: 2,
      })
    }
    .width('100%')
    .justifyContent(FlexAlign.Center)
    .padding({
      top: 50,
      left: this.horizontalPadding,
      right: this.horizontalPadding,
    })
    .hitTestBehavior(HitTestMode.None)
    .zIndex(150)
  }

  @Builder
  private SearchOverlay() {
    HomeInlineSearchOverlay({
      visible: this.searchOverlayVisible,
      showSearch: this.showSearch,
      query: this.searchQuery,
      placeholder: this.searchAllHomeCategories ? '搜索全部内容' : `搜索「${resolveHomeModeTitle(this.mode)}」`,
      topPadding: this.collapsedModeRailTopPadding,
      horizontalPadding: this.horizontalPadding,
      searchFieldOffsetY: this.searchFieldOffsetY,
      isRefreshing: this.isRefreshing,
      refreshTotalCount: this.refreshTotalCount,
      displayRefreshPercent: this.displayRefreshPercent,
      theme: this.theme,
      resultEntries: this.searchResultEntries,
      showEmptyState: this.searchShowEmptyState,
      inputController: this.inputController,
      onQueryChange: (value: string) => {
        this.onQueryChange(value)
      },
      onClose: (clearQuery: boolean) => {
        this.onSearchClose(clearQuery)
      },
      onEntryClick: (entry: EntryCardModel) => {
        this.onEntryClick(entry)
      },
      onInputAppear: () => {
        this.onSearchInputAppear()
      },
      summaryTextForEntry: (entry: EntryCardModel) => this.summaryTextForEntry(entry),
    })
  }

  build() {
    if (this.isHomeRootTab) {
      if (this.searchOverlayVisible) {
        Stack({ alignContent: Alignment.TopStart }) {
          this.OverlayControls()
          if (this.isRefreshing || this.homePostRefreshReloadPending) {
            this.RefreshStatusPill()
          }
          this.SearchOverlay()
        }
        .width('100%')
        .height('100%')
      } else {
        Stack({ alignContent: Alignment.TopStart }) {
          this.OverlayControls()
          if (this.isRefreshing || this.homePostRefreshReloadPending) {
            this.RefreshStatusPill()
          }
        }
        .width('100%')
        .hitTestBehavior(HitTestMode.Transparent)
      }
    } else {
      Row()
        .width(0)
        .height(0)
        .hitTestBehavior(HitTestMode.None)
    }
  }
}
