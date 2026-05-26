import { ThemePalette } from '../services/ThemeService'

@Component
export struct AIChatEmptyState {
  @Prop theme: ThemePalette = {} as ThemePalette
  onSuggestionClick: (text: string) => void = () => {}

  @Builder
  private SuggestionRow(icon: Resource, label: string, prompt: string) {
    Row() {
      SymbolGlyph(icon)
        .fontSize(14)
        .fontColor(['#7A5AF8'])
        .margin({ right: 8 })
      Text(label)
        .fontSize(14)
        .fontColor(this.theme.textPrimary)
    }
    .width('100%')
    .padding(14)
    .backgroundColor(this.theme.surface)
    .borderRadius(10)
    .border({ width: 1, color: this.theme.divider })
    .onClick(() => {
      this.onSuggestionClick(prompt)
    })
  }

  build() {
    Scroll() {
      Column() {
        Blank()
          .height(90)

        Image($r('app.media.ri_ai'))
          .width(64)
          .height(64)
          .objectFit(ImageFit.Contain)
          .fillColor('#7A5AF8')
          .margin({ bottom: 18 })

        Text('Livo AI')
          .fontSize(26)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
          .margin({ bottom: 8 })

        Text('您好，有什么可以帮您的？')
          .fontSize(15)
          .fontColor(this.theme.textSecondary)
          .textAlign(TextAlign.Center)
          .lineHeight(20)
          .margin({ bottom: 32 })

        Column({ space: 10 }) {
          this.SuggestionRow(
            $r('sys.symbol.bolt_fill'),
            '我订阅了哪些源？',
            '我订阅了哪些源？',
          )
          this.SuggestionRow(
            $r('sys.symbol.doc_plaintext'),
            '今天有什么更新？',
            '今天有哪些订阅源更新了？',
          )
          this.SuggestionRow(
            $r('sys.symbol.list_number'),
            '有多少未读文章？',
            '我有多少未读文章？',
          )
        }
        .width('100%')
        .margin({ bottom: 40 })

        Blank()
          .height(40)
      }
      .width('100%')
      .padding({ left: 24, right: 24 })
    }
    .width('100%')
    .scrollBar(BarState.Off)
  }
}
