import { ThemePalette, ThemeService } from '../services/ThemeService'

@Component
export struct ArticleAIAssistResultPanel {
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop isProcessing: boolean = false
  @Prop summary: string = ''
  @Prop translation: string = ''
  @Prop summaryError: string = ''
  @Prop translationError: string = ''
  @Prop targetLanguageLabel: string = ''

  private compactErrorMessage(message: string, maxLength: number = 120): string {
    const normalized = (message || '').replace(/\s+/g, ' ').trim()
    if (!normalized) {
      return '未知错误'
    }
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
  }

  @Builder
  private ResultCard(title: string, content: string) {
    Column({ space: 8 }) {
      Text(title)
        .fontSize(13)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.accent)
        .width('100%')

      Text(content)
        .fontSize(14)
        .lineHeight(22)
        .fontColor(this.theme.textPrimary)
        .width('100%')
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 12, bottom: 12 })
    .backgroundColor(this.theme.elevated)
    .borderRadius(14)
  }

  build() {
    Column({ space: 10 }) {
      if (this.isProcessing) {
        Row({ space: 8 }) {
          LoadingProgress()
            .width(14)
            .height(14)
            .color(this.theme.accent)

          Text('正在生成摘要与翻译...')
            .fontSize(12)
            .fontColor(this.theme.textSecondary)
            .width('100%')
            .layoutWeight(1)
        }
        .width('100%')
      }

      if (this.summary.trim()) {
        this.ResultCard('AI 摘要', this.summary)
      }

      if (this.translation.trim()) {
        this.ResultCard(`AI 翻译（${this.targetLanguageLabel}）`, this.translation)
      }

      if (this.summaryError.trim()) {
        Text(`摘要失败：${this.compactErrorMessage(this.summaryError)}`)
          .fontSize(12)
          .lineHeight(18)
          .fontColor('#D94848')
          .width('100%')
      }

      if (this.translationError.trim()) {
        Text(`翻译失败：${this.compactErrorMessage(this.translationError)}`)
          .fontSize(12)
          .lineHeight(18)
          .fontColor('#D94848')
          .width('100%')
      }
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 12, bottom: 12 })
    .backgroundColor(this.theme.elevated)
    .borderRadius(14)
  }
}
