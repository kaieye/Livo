import { EntryCardModel } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { resolveHomeModeTitle } from '../utils/HomeModeMeta'
import { HomeInlineSearchOverlay } from './HomeInlineSearchOverlay'
import { HomeRootOverlayControls } from './HomeRootOverlayControls'
import { SubscriptionMode } from './HomeRootConfig'

@Component
export struct IndexHomeOverlayLayer {
  @Prop isHomeRootTab: boolean = false
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop mode: SubscriptionMode = 'articles'
  @Prop interactionLocked: boolean = false
  @Prop isRefreshing: boolean = false
  @Prop refreshTotalCount: number = 0
  @Prop displayRefreshPercent: number = 0
  @Prop showSearch: boolean = false
  @Prop searchOverlayVisible: boolean = false
  @Prop searchQuery: string = ''
  @Prop searchAllHomeCategories: boolean = false
  @Prop collapsedModeRailTopPadding: number = 0
  @Prop collapseProgress: number = 0
  @Prop modeRailTopPadding: number = 0
  @Prop modeRailLeftPadding: number = 0
  @Prop modeRailRightInset: number = 0
  @Prop modeRailDismissTranslateY: number = 0
  @Prop modeRailDismissOpacity: number = 1
  @Prop modeRailDismissScale: number = 1
  @Prop modeRailCollapsed: boolean = false
  @Prop horizontalPadding: number = 0
  @Prop searchFieldOffsetY: number = 0
  @Prop searchResultEntries: EntryCardModel[] = []
  @Prop searchShowEmptyState: boolean = false

  inputController: TextInputController = new TextInputController()
  onExpandRequest: () => void = () => {}
  onModeChange: (mode: SubscriptionMode) => void = () => {}
  onQueryChange: (value: string) => void = () => {}
  onSearchClose: (clearQuery: boolean) => void = () => {}
  onEntryClick: (entry: EntryCardModel) => void = () => {}
  onSearchInputAppear: () => void = () => {}
  summaryTextForEntry: (entry: EntryCardModel) => string = () => ''

  @Builder
  private OverlayControls() {
    HomeRootOverlayControls({
      theme: this.theme,
      mode: this.mode,
      interactionLocked: this.interactionLocked,
      showSearch: this.showSearch,
      collapsedModeRailTopPadding: this.collapsedModeRailTopPadding,
      collapseProgress: this.collapseProgress,
      modeRailTopPadding: this.modeRailTopPadding,
      modeRailLeftPadding: this.modeRailLeftPadding,
      modeRailRightInset: this.modeRailRightInset,
      modeRailDismissTranslateY: this.modeRailDismissTranslateY,
      modeRailDismissOpacity: this.modeRailDismissOpacity,
      modeRailDismissScale: this.modeRailDismissScale,
      modeRailCollapsed: this.modeRailCollapsed,
      horizontalPadding: this.horizontalPadding,
      onExpandRequest: () => {
        this.onExpandRequest()
      },
      onModeChange: (mode: SubscriptionMode) => {
        this.onModeChange(mode)
      },
    })
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
          this.SearchOverlay()
        }
        .width('100%')
        .height('100%')
      } else {
        this.OverlayControls()
      }
    } else {
      Row()
        .width(0)
        .height(0)
        .hitTestBehavior(HitTestMode.None)
    }
  }
}
