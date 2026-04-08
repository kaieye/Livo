import { PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'

export const SECONDARY_PAGE_HEADER_TOP_GAP: number = 20
export const SECONDARY_PAGE_HEADER_BOTTOM_GAP: number = 8
export const SECONDARY_PAGE_HEADER_FALLBACK_TOP_AVOID_AREA: number = 14

@Component
export struct SecondaryPageHeaderShell {

  @Builder
  private EmptyContent() {
  }

  @BuilderParam content: () => void = this.EmptyContent

  private resolvedTopAvoidArea(): number {
    return SECONDARY_PAGE_HEADER_FALLBACK_TOP_AVOID_AREA
  }

  build() {
    Column() {
      this.content()
    }
      .width('100%')
              .padding({
                left: PAGE_HORIZONTAL_PADDING,
                right: PAGE_HORIZONTAL_PADDING,
                top: this.resolvedTopAvoidArea() + SECONDARY_PAGE_HEADER_TOP_GAP,
                bottom: SECONDARY_PAGE_HEADER_BOTTOM_GAP,
              })
          }
        }
