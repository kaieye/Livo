import { ThemePalette, ThemeService } from '../services/ThemeService'
import { buildInlineHighlightSegments, InlineHighlightSegment } from '../utils/HomeInlineSearch'

@Component
export struct HighlightedInlineText {
  @Prop text: string = ''
  @Prop query: string = ''
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop fontSize: number = 14
  @Prop lineHeight: number = 20
  @Prop fontWeight: FontWeight | number | string = FontWeight.Regular
  @Prop defaultColor: string = ''
  @Prop maxLines: number = 1

  private highlightBackgroundColor(): string {
    return this.theme.isDark ? `${this.theme.accent}33` : `${this.theme.accent}22`
  }

  private segments(): InlineHighlightSegment[] {
    return buildInlineHighlightSegments(this.text, this.query)
  }

  build() {
    Text() {
      ForEach(this.segments(), (segment: InlineHighlightSegment, index: number) => {
        Span(segment.text)
          .fontColor(segment.matched ? this.theme.accent : (this.defaultColor || this.theme.textPrimary))
          .backgroundColor(segment.matched ? this.highlightBackgroundColor() : '#00000000')
      }, (_segment: InlineHighlightSegment, index: number) => `${index}`)
    }
    .fontSize(this.fontSize)
    .lineHeight(this.lineHeight)
    .fontWeight(this.fontWeight)
    .maxLines(this.maxLines)
    .textOverflow({ overflow: TextOverflow.Ellipsis })
  }
}
