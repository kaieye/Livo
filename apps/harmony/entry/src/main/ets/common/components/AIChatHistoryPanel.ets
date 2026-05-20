import { ChatHistoryStore, ChatSession } from '../services/ChatHistoryStore'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import {
  AI_PANEL_HANDLE_BOTTOM_PADDING,
  AI_PANEL_HANDLE_TOP_PADDING,
  AI_PANEL_SECTION_SPACING,
} from '../ui/AIPanelTokens'
@Component
export struct AIChatHistoryPanel {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @State sessions: ChatSession[] = []
  @State isLoading: boolean = true
  @State confirmDeleteId: string = ''
  onLoadSession: (session: ChatSession) => void = () => {}
  onClose: () => void = () => {}

  aboutToAppear(): void {
    void this.loadSessions()
  }

  private async loadSessions(): Promise<void> {
    this.isLoading = true
    try {
      this.sessions = await ChatHistoryStore.loadAll()
    } finally {
      this.isLoading = false
    }
  }

  private async handleDelete(id: string): Promise<void> {
    await ChatHistoryStore.deleteById(id)
    this.sessions = this.sessions.filter((s: ChatSession) => s.id !== id)
    this.confirmDeleteId = ''
  }

  private async handleClearAll(): Promise<void> {
    await ChatHistoryStore.clearAll()
    this.sessions = []
  }

  private formatTime(timestamp: number): string {
    if (timestamp <= 0) {
      return ''
    }
    const date = new Date(timestamp)
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const sameYear = date.getFullYear() === now.getFullYear()

    if (
      sameYear &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    ) {
      return `今天 ${hours}:${minutes}`
    }

    if (
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate()
    ) {
      return `昨天 ${hours}:${minutes}`
    }

    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${sameYear ? '' : `${date.getFullYear()}年`}${month}月${day}日 ${hours}:${minutes}`
  }

  private messageCountLabel(count: number): string {
    if (count === 0) {
      return '无消息'
    }
    return `${count} 条消息`
  }

  @Builder
  private SheetHandle() {
    Column() {
      Row()
        .width(40)
        .height(5)
        .borderRadius(999)
        .backgroundColor(this.theme.dragHandle)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
    .padding({ top: AI_PANEL_HANDLE_TOP_PADDING, bottom: AI_PANEL_HANDLE_BOTTOM_PADDING })
  }

  @Builder
  private PanelHeader() {
    Row() {
      Text('历史对话')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
        .layoutWeight(1)

      if (this.sessions.length > 0) {
        Row({ space: 8 }) {
          Button('清空全部')
            .type(ButtonType.Capsule)
            .height(32)
            .fontSize(12)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)
            .backgroundColor(this.theme.surface)
            .border({ width: 0.8, color: this.theme.divider })
            .onClick(() => {
              void this.handleClearAll()
            })

          Button('刷新')
            .type(ButtonType.Capsule)
            .height(32)
            .fontSize(12)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)
            .backgroundColor(this.theme.surface)
            .border({ width: 0.8, color: this.theme.divider })
            .onClick(() => {
              void this.loadSessions()
            })
        }
      }
    }
    .width('100%')
    .alignItems(VerticalAlign.Center)
  }

  @Builder
  private EmptyState() {
    Column({ space: 10 }) {
      SymbolGlyph($r('sys.symbol.arrow_counterclockwise_clock'))
        .fontSize(32)
        .fontColor([this.theme.textMuted])

      Text('暂无历史对话')
        .fontSize(15)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)

      Text('开始与 AI 对话后，对话记录会自动保存在这里')
        .fontSize(12)
        .lineHeight(18)
        .fontColor(this.theme.textSecondary)
        .textAlign(TextAlign.Center)
    }
    .width('100%')
    .padding({ top: 40, bottom: 40 })
    .alignItems(HorizontalAlign.Center)
  }

  @Builder
  private SessionCard(session: ChatSession, index: number) {
    Column() {
      Row() {
        Column({ space: 6 }) {
          Text(session.title || '新对话')
            .fontSize(15)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          Row({ space: 10 }) {
            Text(this.formatTime(session.updatedAt))
              .fontSize(12)
              .fontColor(this.theme.textMuted)

            Text(this.messageCountLabel(session.messages.length))
              .fontSize(12)
              .fontColor(this.theme.accent)
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        if (this.confirmDeleteId === session.id) {
          Row({ space: 6 }) {
            Button('删除')
              .type(ButtonType.Capsule)
              .height(32)
              .fontSize(12)
              .fontColor('#FFFFFF')
              .backgroundColor('#DC2626')
              .onClick(() => {
                void this.handleDelete(session.id)
              })

            Button('取消')
              .type(ButtonType.Capsule)
              .height(32)
              .fontSize(12)
              .fontColor(this.theme.textPrimary)
              .backgroundColor(this.theme.elevated)
              .border({ width: 0.8, color: this.theme.divider })
              .onClick(() => {
                this.confirmDeleteId = ''
              })
          }
        } else {
          Row() {
            SymbolGlyph($r('sys.symbol.trash'))
              .fontSize(16)
              .fontColor([this.theme.textMuted])
          }
          .width(32)
          .height(32)
          .borderRadius(16)
          .justifyContent(FlexAlign.Center)
          .alignItems(VerticalAlign.Center)
          .backgroundColor(this.theme.elevated)
          .onClick(() => {
            this.confirmDeleteId = session.id
          })
        }
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 14, bottom: 14 })
    .backgroundColor(this.theme.surface)
    .borderRadius(16)
    .border({ width: 0.8, color: this.theme.divider })
    .transition(livoMotion.enterSoft(index * 20 + 30))
    .onClick(() => {
      if (this.confirmDeleteId) {
        this.confirmDeleteId = ''
        return
      }
      this.onLoadSession(session)
    })
  }

  build() {
    Scroll() {
      Column({ space: AI_PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        if (this.isLoading) {
          Column({ space: 10 }) {
            LoadingProgress()
              .width(26)
              .height(26)
              .color(this.theme.accent)

            Text('正在加载历史记录')
              .fontSize(12)
              .fontColor(this.theme.textSecondary)
          }
          .width('100%')
          .padding({ top: 24, bottom: 24 })
          .alignItems(HorizontalAlign.Center)
        } else {
          if (this.sessions.length === 0) {
            this.EmptyState()
          } else {
            Column({ space: 10 }) {
              ForEach(this.sessions, (session: ChatSession, index: number) => {
                this.SessionCard(session, index)
              }, (session: ChatSession) => session.id)
            }
            .width('100%')
          }
        }

        Row()
          .height(28)
          .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
    .edgeEffect(EdgeEffect.Spring)
  }
}
