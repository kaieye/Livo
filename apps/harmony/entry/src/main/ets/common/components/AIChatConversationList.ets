import { ChatMessage } from '../services/ChatHistoryStore'
import { ThemePalette } from '../services/ThemeService'
import { PendingAgentConfirmationView } from './AIChatPanelTypes'
import { AIChatConfirmationCard } from './AIChatConfirmationCard'
import { AIChatMarkdownText } from './AIChatMarkdownText'

@Component
export struct AIChatConversationList {
  @Prop messages: ChatMessage[] = []
  @Prop streamingContent: string = ''
  @Prop isLoading: boolean = false
  @Prop pendingConfirmation: PendingAgentConfirmationView | null = null
  @Prop isConfirming: boolean = false
  @Prop theme: ThemePalette = {} as ThemePalette
  scroller: Scroller = new Scroller()
  onEditMessage: (messageId: string) => void = () => {}
  onConfirmPendingTool: () => void = () => {}
  onCancelPendingTool: () => void = () => {}

  private safeDisplayText(value: string): string {
    if (typeof value !== 'string') {
      return ''
    }
    const lower = value.toLowerCase()
    if (lower.includes('[object object]')) {
      return '...'
    }
    return value
  }

  @Builder
  private AiAvatar(left: boolean) {
    Image($r('app.media.ri_ai'))
      .width(32)
      .height(32)
      .objectFit(ImageFit.Contain)
      .fillColor('#7A5AF8')
      .borderRadius(16)
      .backgroundColor(this.theme.surface)
      .padding(4)
      .margin(left ? { right: 10 } : { left: 10 })
  }

  @Builder
  private UserMessage(item: ChatMessage) {
    Row() {
      Blank()
      Column() {
        Row() {
          Text(this.safeDisplayText(item.content))
            .fontSize(15)
            .fontColor('#FFFFFF')
            .lineHeight(20)
            .copyOption(CopyOptions.LocalDevice)
            .layoutWeight(1)

          SymbolGlyph($r('sys.symbol.arrowshape_turn_up_left'))
            .fontSize(14)
            .fontColor(['rgba(255,255,255,0.7)'])
            .margin({ left: 8 })
            .onClick(() => {
              this.onEditMessage(item.id)
            })
        }
        .padding({ left: 16, right: 16, top: 12, bottom: 12 })
      }
      .backgroundColor('#7A5AF8')
      .borderRadius(16)
      .constraintSize({ maxWidth: '80%' })

      this.AiAvatar(false)
    }
    .width('100%')
    .margin({ bottom: 14 })
    .alignItems(VerticalAlign.Top)
  }

  @Builder
  private AssistantMessage(item: ChatMessage) {
    Row() {
      this.AiAvatar(true)

      Column() {
        Text(item.role === 'system' ? '系统提示' : 'Livo AI')
          .fontSize(11)
          .fontColor(this.theme.textMuted)
          .fontWeight(FontWeight.Medium)
          .margin({ bottom: 4 })

        Column() {
          if (item.role === 'system') {
            Text(this.safeDisplayText(item.content))
              .fontSize(15)
              .fontColor('#DC2626')
              .lineHeight(20)
              .copyOption(CopyOptions.LocalDevice)
          } else {
            AIChatMarkdownText({ content: item.content, theme: this.theme })
          }
        }
        .padding({ left: 16, right: 16, top: 12, bottom: 12 })
        .backgroundColor(this.theme.surface)
        .borderRadius(16)
        .border({ width: 1, color: this.theme.divider })
        .constraintSize({ maxWidth: '85%' })
      }
      .alignItems(HorizontalAlign.Start)

      Blank()
    }
    .width('100%')
    .margin({ bottom: 14 })
    .alignItems(VerticalAlign.Top)
  }

  @Builder
  private StreamingMessage() {
    Row() {
      this.AiAvatar(true)

      Column() {
        Text('Livo AI')
          .fontSize(11)
          .fontColor(this.theme.textMuted)
          .fontWeight(FontWeight.Medium)
          .margin({ bottom: 4 })

        Column() {
          Text(this.streamingContent)
            .fontSize(15)
            .fontColor(this.theme.textPrimary)
            .lineHeight(22)
            .copyOption(CopyOptions.LocalDevice)
        }
        .padding({ left: 16, right: 16, top: 12, bottom: 12 })
        .backgroundColor(this.theme.surface)
        .borderRadius(16)
        .border({ width: 1, color: this.theme.divider })
        .constraintSize({ maxWidth: '85%' })
      }
      .alignItems(HorizontalAlign.Start)

      Blank()
    }
    .width('100%')
    .margin({ bottom: 14 })
    .alignItems(VerticalAlign.Top)
  }

  @Builder
  private LoadingMessage() {
    Row() {
      this.AiAvatar(true)

      Column() {
        Text('Livo AI')
          .fontSize(11)
          .fontColor(this.theme.textMuted)
          .fontWeight(FontWeight.Medium)
          .margin({ bottom: 4 })

        Row() {
          LoadingProgress()
            .width(14)
            .height(14)
            .color('#7A5AF8')
            .margin({ right: 6 })
          Text('正在处理...')
            .fontSize(14)
            .fontColor(this.theme.textMuted)
        }
        .padding({ left: 16, right: 16, top: 10, bottom: 10 })
        .backgroundColor(this.theme.surface)
        .borderRadius(16)
        .border({ width: 1, color: this.theme.divider })
      }
      .alignItems(HorizontalAlign.Start)

      Blank()
    }
    .width('100%')
    .margin({ bottom: 14 })
    .alignItems(VerticalAlign.Top)
  }

  build() {
    Scroll(this.scroller) {
      Column() {
        Blank()
          .layoutWeight(1)

        ForEach(this.messages, (item: ChatMessage) => {
          Column() {
            if (item.role === 'user') {
              this.UserMessage(item)
            } else {
              this.AssistantMessage(item)
            }
          }
        }, (item: ChatMessage) => item.id)

        if (!this.isLoading && this.streamingContent) {
          this.StreamingMessage()
        }

        if (this.pendingConfirmation) {
          AIChatConfirmationCard({
            theme: this.theme,
            confirmation: this.pendingConfirmation,
            isConfirming: this.isConfirming,
            onConfirm: () => {
              this.onConfirmPendingTool()
            },
            onCancel: () => {
              this.onCancelPendingTool()
            },
          })
        }

        if (this.isLoading && !this.pendingConfirmation) {
          this.LoadingMessage()
        }
      }
      .width('100%')
      .padding({ left: 16, right: 16 })
      .constraintSize({ minHeight: '100%' })
    }
    .width('100%')
    .layoutWeight(1)
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.Spring)
  }
}
