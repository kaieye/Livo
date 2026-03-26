export class ArticleAssistService {
  static summarize(title: string, summary: string, paragraphs: string[]): string {
    const compactParagraphs = paragraphs
      .map((paragraph: string) => paragraph.trim())
      .filter((paragraph: string) => paragraph.length > 0)

    const lead = compactParagraphs.slice(0, 2).join(' ')
    const source = summary.trim() || lead || title
    const trimmed = source.length > 140 ? `${source.slice(0, 140)}...` : source

    return `摘要重点：${trimmed}`
  }
}
