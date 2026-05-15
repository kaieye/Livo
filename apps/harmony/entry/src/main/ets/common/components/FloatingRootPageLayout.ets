import { ThemePalette, ThemeService } from '../services/ThemeService'
import { HEADER_MIN_HEIGHT, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import { PageHeader } from './PageHeader'

const FLOATING_ROOT_HEADER_BOTTOM_GAP: number = 6
const FLOATING_ROOT_SPACER_EXTRA_HEIGHT: number = 8
export const ROOT_MODE_RAIL_SPACER_EXTRA_HEIGHT: number = -8
export const ROOT_MODE_RAIL_TOP_GAP: number = 0
export const ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT: number = 68
export const ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING: number = 24
export const ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET: number = 4
export const ROOT_PAGE_MODE_TOP_OFFSET: number = -26
export const ROOT_PAGE_PRIMARY_TITLE_FONT_SIZE: number = 28
export const ROOT_PAGE_SECONDARY_TITLE_FONT_SIZE: number = 24

@Component
export struct FloatingRootPageLayout {
  @Prop title: string = ''
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop topAvoidArea: number = 0
  @Prop scrollBlurProgress: number = 0
  @Prop trailingImage: Resource | null = null
  @Prop trailingSymbol: Resource | null = null
  @Prop trailingButtonCircular: boolean = false
  @Prop trailingSymbolSize: number = 22
  @Prop trailingSymbolColor: string = ''
  @Prop trailingButtonBackground: string = ''
  @Prop showTrailingBuilder: boolean = false
  onTrailingClick: () => void = () => {}

  @Builder
  private EmptyTrailingBuilder() {
  }

  @BuilderParam trailingBuilder: () => void = this.EmptyTrailingBuilder

  build() {
    Column() {
      PageHeader({
        title: this.title,
        theme: this.theme,
        trailingImage: this.trailingImage,
        trailingSymbol: this.trailingSymbol,
        trailingButtonCircular: this.trailingButtonCircular,
        trailingSymbolSize: this.trailingSymbolSize,
        trailingSymbolColor: this.trailingSymbolColor,
        trailingButtonBackground: this.trailingButtonBackground,
        showTrailingBuilder: this.showTrailingBuilder,
        onTrailingClick: this.onTrailingClick,
      }) {
        this.trailingBuilder()
      }
    }
      .width('100%')
      .backgroundColor(this.theme.background)
      .padding({
        left: PAGE_HORIZONTAL_PADDING,
        right: PAGE_HORIZONTAL_PADDING,
        top: this.topAvoidArea,
        bottom: FLOATING_ROOT_HEADER_BOTTOM_GAP,
      })
  }
}

@Component
export struct FloatingRootPageSpacer {
  @Prop topAvoidArea: number = 0
  @Prop extraHeight: number = FLOATING_ROOT_SPACER_EXTRA_HEIGHT

  build() {
    Row()
      .width('100%')
      .height(
        this.topAvoidArea
        + HEADER_MIN_HEIGHT
        + FLOATING_ROOT_HEADER_BOTTOM_GAP
        + this.extraHeight,
      )
  }
}
