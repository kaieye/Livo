import { ThemePalette, ThemeService } from '../services/ThemeService'
import { HEADER_MIN_HEIGHT, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import { PageHeader } from './PageHeader'

const FLOATING_ROOT_HEADER_BOTTOM_GAP: number = 6
const FLOATING_ROOT_SPACER_EXTRA_HEIGHT: number = 8
export const ROOT_MODE_RAIL_SPACER_EXTRA_HEIGHT: number = -8
export const ROOT_MODE_RAIL_TOP_GAP: number = 8

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
  onTrailingClick: () => void = () => {}

  build() {
    PageHeader({
      title: this.title,
      theme: this.theme,
      trailingImage: this.trailingImage,
      trailingSymbol: this.trailingSymbol,
      trailingButtonCircular: this.trailingButtonCircular,
      trailingSymbolSize: this.trailingSymbolSize,
      trailingSymbolColor: this.trailingSymbolColor,
      trailingButtonBackground: this.trailingButtonBackground,
      onTrailingClick: this.onTrailingClick,
    })
      .width('100%')
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
