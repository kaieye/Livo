import { ThemePalette } from '../services/ThemeService'
import { parseMarkdown, MdLine, MdLineKind, MdSpan } from '../utils/MarkdownParser'

@Component
export struct AIChatMarkdownText {
  @Prop content: string = ''
  @Prop theme: ThemePalette = {} as ThemePalette

  private parsedLines(content: string): MdLine[] {
    return parseMarkdown(content)
  }

  private isHeaderKind(kind: MdLineKind): boolean {
    return kind === MdLineKind.H1 || kind === MdLineKind.H2 || kind === MdLineKind.H3
  }

  private headerSizeOf(kind: MdLineKind): number {
    switch (kind) {
      case MdLineKind.H1:
        return 20
      case MdLineKind.H2:
        return 18
      case MdLineKind.H3:
        return 16
      default:
        return 15
    }
  }

  build() {
    Text() {
      ForEach(this.parsedLines(this.content), (line: MdLine, idx: number) => {
        if (line.kind === MdLineKind.Blank) {
          Span('\n')
        } else if (line.kind === MdLineKind.CodeBlock) {
          if (line.spans.length > 0) {
            Span(line.spans[0].text)
              .fontSize(13)
              .fontColor('#E879F9')
          }
          Span('\n')
        } else {
          if (line.kind === MdLineKind.Bullet) {
            Span('• ')
              .fontColor(this.theme.textMuted)
          } else if (line.kind === MdLineKind.Ordered) {
            Span(`${line.orderedIndex}. `)
              .fontColor(this.theme.textMuted)
          }
          ForEach(line.spans, (span: MdSpan, si: number) => {
            Span(span.text)
              .fontSize(this.headerSizeOf(line.kind))
              .fontWeight(span.bold || this.isHeaderKind(line.kind) ? FontWeight.Bold : FontWeight.Normal)
              .fontColor(span.code ? '#E879F9' : this.theme.textPrimary)
              .fontStyle(span.italic ? FontStyle.Italic : FontStyle.Normal)
          }, (span: MdSpan, si: number) => `s_${idx}_${si}`)
          Span('\n')
        }
      }, (line: MdLine, idx: number) => `l_${idx}`)
    }
    .copyOption(CopyOptions.LocalDevice)
    .fontSize(15)
    .fontColor(this.theme.textPrimary)
    .lineHeight(22)
  }
}
