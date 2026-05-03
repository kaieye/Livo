import { ThemePalette } from '../../services/ThemeService'
import { DiscoverSearchPlatform } from '../../services/discover/DiscoverTypes'
import { discoverPlatformLabel } from '../../services/discover/DiscoverLabels'
import { CARD_RADIUS_XL, CHIP_FONT_SIZE, CHIP_RADIUS } from '../../ui/UiTokens'
import { livoMotion } from '../../ui/Motion'

const DISCOVER_SEARCH_INPUT_ID: string = 'discover-search-input'

@Component
export struct DiscoverSearchPanel {
  @Link query: string
  @Link searchPlatform: DiscoverSearchPlatform
  @Link showPlatformChips: boolean
  @Link isInteractingWithPlatformChips: boolean
  @Link keepPlatformChipsOnBlur: boolean
  @Link searchInputFocusable: boolean
  @Link searchInputHasFocus: boolean
  @Prop theme: ThemePalette
  @Prop showBottomTabs: boolean
  searchInputController: TextInputController
  onQueryChange: (value: string) => void = () => {}
  onPlatformSwitch: (platform: DiscoverSearchPlatform) => void = () => {}
  onSearchInputFocus: () => void = () => {}
  onSearchInputBlur: () => void = () => {}
  onSearchInputClick: () => void = () => {}
  onSearchInputTouchDown: () => void = () => {}
  onClearQuery: () => void = () => {}

  private rootEnterTransition(delay: number) {
    return this.showBottomTabs ? livoMotion.enterScale(delay) : undefined
  }

  private shouldShowPlatformChips(): boolean {
    return this.showPlatformChips || !this.query.trim()
  }

  private platformOptions(): DiscoverSearchPlatform[] {
    return ['all', 'youtube', 'bilibili', 'x', 'instagram']
  }

  @Builder
  private PlatformChip(platform: DiscoverSearchPlatform) {
    Text(discoverPlatformLabel(platform))
      .fontSize(CHIP_FONT_SIZE)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.searchPlatform === platform ? '#FFFFFF' : this.theme.textSecondary)
      .padding({ left: 13, right: 13, top: 8, bottom: 8 })
      .backgroundColor(this.searchPlatform === platform ? this.theme.accent : this.theme.surface)
      .border({ width: 0.8, color: this.searchPlatform === platform ? this.theme.accent : this.theme.divider })
      .borderRadius(CHIP_RADIUS)
      .shadow(this.searchPlatform === platform ? {
        radius: 8,
        color: this.theme.isDark ? 'rgba(219,39,119,0.24)' : 'rgba(219,39,119,0.18)',
        offsetY: 1,
      } : undefined)
      .animation({ duration: 180, curve: Curve.EaseInOut })
      .onTouch((event: TouchEvent) => {
        if (event.type === TouchType.Down) {
          this.isInteractingWithPlatformChips = true
          return
        }
        this.isInteractingWithPlatformChips = false
      })
      .onClick(() => {
        this.onPlatformSwitch(platform)
      })
  }

  build() {
    Column({ space: 8 }) {
      Row({ space: 8 }) {
        SymbolGlyph($r('sys.symbol.magnifyingglass'))
          .fontSize(20)
          .fontColor([this.theme.textMuted])

        TextInput({ text: this.query, placeholder: '搜索订阅源 / RSS / 关键词或链接', controller: this.searchInputController })
          .defaultFocus(false)
          .id(DISCOVER_SEARCH_INPUT_ID)
          .focusable(this.searchInputFocusable)
          .backgroundColor('transparent')
          .fontColor(this.theme.textPrimary)
          .placeholderColor(this.theme.textMuted)
          .caretColor(this.theme.textPrimary)
          .padding(0)
          .layoutWeight(1)
          .onTouch((event: TouchEvent) => {
            if (event.type === TouchType.Down) {
              if (this.searchInputHasFocus) {
                return
              }
              this.onSearchInputTouchDown()
            }
          })
          .onClick(() => {
            this.onSearchInputClick()
          })
          .onFocus(() => {
            this.searchInputHasFocus = true
            this.onSearchInputFocus()
          })
          .onBlur(() => {
            this.searchInputHasFocus = false
            this.onSearchInputBlur()
          })
          .onChange((value: string) => {
            this.query = value
            this.onQueryChange(value)
          })

        if (this.query.trim()) {
          Text('×')
            .fontSize(19)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textMuted)
            .width(30)
            .height(30)
            .textAlign(TextAlign.Center)
            .borderRadius(CHIP_RADIUS)
            .backgroundColor(this.theme.elevated)
            .onClick(() => {
              this.onClearQuery()
            })
        }
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 13, bottom: 13 })
      .backgroundColor(this.theme.surface)
      .borderRadius(CARD_RADIUS_XL)
      .border({ width: 0.8, color: this.theme.divider })
      .shadow({
        radius: 14,
        color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.08)',
        offsetY: 3,
      })

      Column() {
        Row({ space: 10 }) {
          ForEach(this.platformOptions(), (platform: DiscoverSearchPlatform) => {
            this.PlatformChip(platform)
          }, (platform: DiscoverSearchPlatform) => platform)
        }
        .width('100%')
      }
      .width('100%')
      .height(this.shouldShowPlatformChips() ? 36 : 0)
      .opacity(this.shouldShowPlatformChips() ? 1 : 0)
      .translate({ y: this.shouldShowPlatformChips() ? 0 : -10 })
      .padding({ top: this.shouldShowPlatformChips() ? 6 : 0 })
      .clip(true)
      .animation({ duration: 260, curve: Curve.FastOutSlowIn })
    }
    .width('100%')
    .margin({ bottom: 4 })
    .transition(this.rootEnterTransition(40))
  }
}
