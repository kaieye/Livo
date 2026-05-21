import { ThemePalette, ThemeService } from '../services/ThemeService'
import { buildInlineHighlightSegments, InlineHighlightSegment } from '../utils/home/HomeInlineSearch'

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

  private resolvedTextColor(): string {
    return this.defaultColor || this.theme.textPrimary
  }

  build() {
    // 大多数列表场景下 query 为空,走单 Text 快速路径:不再每帧分配 segments
    // 数组、不再为单段触发 ForEach + Span 树构造。这是文章/社交/视频卡每张能
    // 减少 16-40 次临时对象分配的关键。
    if (!this.query) {
      Text(this.text)
        .fontSize(this.fontSize)
        .lineHeight(this.lineHeight)
        .fontWeight(this.fontWeight)
        .fontColor(this.resolvedTextColor())
        .maxLines(this.maxLines)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    } else {
      Text() {
        ForEach(this.segments(), (segment: InlineHighlightSegment, index: number) => {
          Span(segment.text)
            .fontColor(segment.matched ? this.theme.accent : this.resolvedTextColor())
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
}
