import { ThemePalette } from '../services/ThemeService'
import { PendingAgentConfirmationView } from './AIChatPanelTypes'

@Component
export struct AIChatConfirmationCard {
  @Prop theme: ThemePalette = {} as ThemePalette
  @Prop confirmation: PendingAgentConfirmationView | null = null
  @Prop isConfirming: boolean = false
  onConfirm: () => void = () => {}
  onCancel: () => void = () => {}

  private riskColor(): string {
    if (this.confirmation?.risk === 'high') {
      return '#DC2626'
    }
    if (this.confirmation?.risk === 'medium') {
      return '#F59E0B'
    }
    return '#16A34A'
  }

  private titleText(): string {
    return this.confirmation ? this.confirmation.title : ''
  }

  private messageText(): string {
    return this.confirmation ? this.confirmation.message : ''
  }

  private argsText(): string {
    return this.confirmation ? this.confirmation.argsPreview : ''
  }

  build() {
    if (this.confirmation) {
      Row() {
        Image($r('app.media.ri_ai'))
          .width(32)
          .height(32)
          .objectFit(ImageFit.Contain)
          .fillColor('#7A5AF8')
          .borderRadius(16)
          .backgroundColor(this.theme.surface)
          .padding(4)
          .margin({ right: 10 })

        Column() {
          Row() {
            SymbolGlyph($r('sys.symbol.bolt_circle_fill'))
              .fontSize(14)
              .fontColor([this.riskColor()])
              .margin({ right: 6 })
            Text(this.titleText())
              .fontSize(14)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.theme.textPrimary)
              .layoutWeight(1)
          }
          .width('100%')

          Text(this.messageText())
            .fontSize(13)
            .fontColor(this.theme.textSecondary)
            .lineHeight(18)
            .margin({ top: 6 })

          Text(this.argsText())
            .fontSize(11)
            .fontColor(this.theme.textMuted)
            .lineHeight(15)
            .maxLines(3)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: 8 })

          Row({ space: 8 }) {
            Row() {
              SymbolGlyph($r('sys.symbol.checkmark'))
                .fontSize(12)
                .fontColor(['#FFFFFF'])
                .margin({ right: 4 })
              Text(this.isConfirming ? '执行中' : '执行')
                .fontSize(13)
                .fontColor('#FFFFFF')
            }
            .height(32)
            .padding({ left: 12, right: 12 })
            .borderRadius(16)
            .backgroundColor(this.riskColor())
            .justifyContent(FlexAlign.Center)
            .onClick(() => {
              if (!this.isConfirming) {
                this.onConfirm()
              }
            })

            Row() {
              SymbolGlyph($r('sys.symbol.xmark'))
                .fontSize(12)
                .fontColor([this.theme.textSecondary])
                .margin({ right: 4 })
              Text('取消')
                .fontSize(13)
                .fontColor(this.theme.textSecondary)
            }
            .height(32)
            .padding({ left: 12, right: 12 })
            .borderRadius(16)
            .backgroundColor(this.theme.elevated)
            .border({ width: 1, color: this.theme.divider })
            .justifyContent(FlexAlign.Center)
            .onClick(() => {
              if (!this.isConfirming) {
                this.onCancel()
              }
            })
          }
          .margin({ top: 12 })
        }
        .alignItems(HorizontalAlign.Start)
        .padding({ left: 14, right: 14, top: 12, bottom: 12 })
        .backgroundColor(this.theme.surface)
        .borderRadius(16)
        .border({ width: 1, color: this.riskColor() })
        .constraintSize({ maxWidth: '85%' })

        Blank()
      }
      .width('100%')
      .margin({ bottom: 14 })
      .alignItems(VerticalAlign.Top)
    }
  }
}
