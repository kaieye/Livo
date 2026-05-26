import { ThemePalette } from '../services/ThemeService'

@Component
export struct AIChatInputComposer {
  @Link inputContent: string
  @Prop theme: ThemePalette = {} as ThemePalette
  @Prop isLoading: boolean = false
  inputController: TextAreaController = new TextAreaController()
  onSend: () => void = () => {}
  onStop: () => void = () => {}

  build() {
    Column() {
      Column() {
        Row() {
          TextArea({
            text: this.inputContent,
            placeholder: '输入您想了解的内容...',
            controller: this.inputController,
          })
            .layoutWeight(1)
            .placeholderColor(this.theme.textMuted)
            .fontColor(this.theme.textPrimary)
            .backgroundColor('#00000000')
            .fontSize(15)
            .maxLines(5)
            .onChange((val: string) => {
              this.inputContent = val
            })
            .onSubmit(() => {
              this.onSend()
            })

          Row() {
            if (this.isLoading) {
              Rect()
                .width(12)
                .height(12)
                .fill('#FFFFFF')
            } else {
              SymbolGlyph($r('sys.symbol.paperplane_fill'))
                .fontSize(16)
                .fontColor([this.inputContent.trim() ? '#FFFFFF' : this.theme.textMuted])
            }
          }
          .width(36)
          .height(36)
          .borderRadius(18)
          .justifyContent(FlexAlign.Center)
          .alignItems(VerticalAlign.Center)
          .backgroundColor(this.isLoading ? '#DC2626' : (this.inputContent.trim() ? '#7A5AF8' : this.theme.divider))
          .onClick(() => {
            if (this.isLoading) {
              this.onStop()
            } else {
              this.onSend()
            }
          })
        }
        .width('100%')
        .alignItems(VerticalAlign.Bottom)

        Row() {
          Row() {
            SymbolGlyph($r('sys.symbol.at'))
              .fontSize(18)
              .fontColor([this.theme.textMuted])
              .margin({ right: 16 })

            SymbolGlyph($r('sys.symbol.paperclip'))
              .fontSize(18)
              .fontColor([this.theme.textMuted])
              .margin({ right: 16 })

            Row() {
              SymbolGlyph($r('sys.symbol.doc_plaintext'))
                .fontSize(12)
                .fontColor([this.theme.textPrimary])
                .margin({ right: 4 })
              Text('文章')
                .fontSize(12)
                .fontColor(this.theme.textPrimary)
            }
            .padding({ left: 8, right: 8, top: 4, bottom: 4 })
            .borderRadius(12)
            .backgroundColor(this.theme.elevated)
            .border({ width: 1, color: this.theme.divider })
            .onClick(() => {
              this.inputContent += ' [当前文章] '
            })
          }
          .alignItems(VerticalAlign.Center)

          Blank()

          Row() {
            SymbolGlyph($r('sys.symbol.bolt_fill'))
              .fontSize(12)
              .fontColor(['#7A5AF8'])
              .margin({ right: 4 })

            Text('智能')
              .fontSize(12)
              .fontColor(this.theme.textPrimary)

            SymbolGlyph($r('sys.symbol.chevron_down'))
              .fontSize(10)
              .fontColor([this.theme.textMuted])
              .margin({ left: 4 })
          }
          .padding({ left: 10, right: 10, top: 4, bottom: 4 })
          .borderRadius(14)
          .backgroundColor(this.theme.elevated)
          .border({ width: 1, color: this.theme.divider })
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
        .margin({ top: 12 })
      }
      .width('100%')
      .padding(12)
      .borderRadius(16)
      .backgroundColor(this.theme.surface)
      .border({ width: 1, color: this.theme.divider })
    }
    .width('100%')
    .padding({ left: 16, right: 16, bottom: 20, top: 12 })
    .backgroundColor(this.theme.background)
  }
}
