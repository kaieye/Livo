import { AgentTraceStore } from '../agent/AgentTraceStore'
import type {
  AgentTraceRecord,
  AgentTraceToolCall,
} from '../agent/AgentTraceStore'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import {
  AI_PANEL_HANDLE_BOTTOM_PADDING,
  AI_PANEL_HANDLE_TOP_PADDING,
  AI_PANEL_HINT_SIZE,
  AI_PANEL_SECTION_SPACING,
  AI_PANEL_SUBTITLE_SIZE,
  AI_PANEL_TITLE_SIZE,
} from '../ui/AIPanelTokens'

@Component
export struct AIChatTracePanel {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @State traces: AgentTraceRecord[] = []
  @State isLoading: boolean = true
  @State expandedTraceId: string = ''

  aboutToAppear(): void {
    void this.loadTraces()
  }

  private async loadTraces(): Promise<void> {
    this.isLoading = true
    try {
      this.traces = await AgentTraceStore.loadAll()
    } finally {
      this.isLoading = false
    }
  }

  private async clearTraces(): Promise<void> {
    await AgentTraceStore.clearAll()
    this.traces = []
    this.expandedTraceId = ''
  }

  private formatTime(timestamp: number): string {
    if (timestamp <= 0) {
      return '未知时间'
    }
    const date = new Date(timestamp)
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    const hour = `${date.getHours()}`.padStart(2, '0')
    const minute = `${date.getMinutes()}`.padStart(2, '0')
    return `${month}-${day} ${hour}:${minute}`
  }

  private statusLabel(status: string): string {
    if (status === 'completed' || status === 'success') {
      return '完成'
    }
    if (status === 'confirmation_required') {
      return '待确认'
    }
    if (status === 'cancelled') {
      return '已取消'
    }
    return '失败'
  }

  private statusColor(status: string): string {
    if (status === 'completed' || status === 'success') {
      return '#16A34A'
    }
    if (status === 'confirmation_required') {
      return '#F59E0B'
    }
    if (status === 'cancelled' || status === 'failed') {
      return '#DC2626'
    }
    return this.theme.textMuted
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
      Text('执行轨迹')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
        .layoutWeight(1)

      if (this.traces.length > 0) {
        Row({ space: 8 }) {
          Button('清空')
            .type(ButtonType.Capsule)
            .height(32)
            .fontSize(12)
            .fontColor(this.theme.textPrimary)
            .backgroundColor(this.theme.surface)
            .border({ width: 0.8, color: this.theme.divider })
            .onClick(() => { void this.clearTraces() })
          Button('刷新')
            .type(ButtonType.Capsule)
            .height(32)
            .fontSize(12)
            .fontColor(this.theme.textPrimary)
            .backgroundColor(this.theme.surface)
            .border({ width: 0.8, color: this.theme.divider })
            .onClick(() => { void this.loadTraces() })
        }
      }
    }
    .width('100%')
    .alignItems(VerticalAlign.Center)
  }

  @Builder
  private EmptyState() {
    Column({ space: 10 }) {
      SymbolGlyph($r('sys.symbol.list_bullet_square_fill'))
        .fontSize(32)
        .fontColor([this.theme.textMuted])
      Text('暂无执行轨迹')
        .fontSize(AI_PANEL_TITLE_SIZE)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
      Text('完成一次带工具调用的 AI 对话后会出现在这里')
        .fontSize(AI_PANEL_SUBTITLE_SIZE)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .padding({ top: 40, bottom: 40 })
    .alignItems(HorizontalAlign.Center)
  }

  @Builder
  private ToolCallRow(call: AgentTraceToolCall) {
    Column({ space: 4 }) {
      Row({ space: 8 }) {
        Text(this.statusLabel(call.status))
          .fontSize(11)
          .fontColor(this.statusColor(call.status))
        Text(call.toolName)
          .fontSize(AI_PANEL_SUBTITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .layoutWeight(1)
        if (call.elapsedMs > 0) {
          Text((call.elapsedMs / 1000).toFixed(1) + 's')
            .fontSize(11)
            .fontColor(this.theme.textMuted)
        }
      }
      .width('100%')

      if (call.resultSummary) {
        Text(call.resultSummary)
          .fontSize(AI_PANEL_HINT_SIZE)
          .lineHeight(16)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
      }
    }
    .width('100%')
    .padding({ left: 10, right: 10, top: 8, bottom: 8 })
    .backgroundColor(this.theme.elevated)
    .borderRadius(12)
  }

  @Builder
  private TraceCard(trace: AgentTraceRecord, index: number) {
    Column({ space: 8 }) {
      Row({ space: 8 }) {
        Text(this.statusLabel(trace.status))
          .fontSize(11)
          .fontColor(this.statusColor(trace.status))
        Text(this.formatTime(trace.startedAt))
          .fontSize(AI_PANEL_HINT_SIZE)
          .fontColor(this.theme.textMuted)
          .layoutWeight(1)
        Text(`${trace.toolCalls.length} 工具`)
          .fontSize(AI_PANEL_HINT_SIZE)
          .fontColor(this.theme.accent)
      }
      .width('100%')

      Text(trace.promptSummary)
        .fontSize(AI_PANEL_TITLE_SIZE)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')

      if (this.expandedTraceId === trace.traceId) {
        if (trace.toolCalls.length === 0) {
          Text('没有工具调用')
            .fontSize(AI_PANEL_HINT_SIZE)
            .fontColor(this.theme.textMuted)
            .width('100%')
        } else {
          ForEach(trace.toolCalls, (call: AgentTraceToolCall) => {
            this.ToolCallRow(call)
          }, (call: AgentTraceToolCall) => call.id)
        }
      }
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 12, bottom: 12 })
    .backgroundColor(this.theme.surface)
    .borderRadius(16)
    .border({ width: 0.8, color: this.theme.divider })
    .transition(livoMotion.enterSoft(index * 18 + 20))
    .onClick(() => {
      this.expandedTraceId = this.expandedTraceId === trace.traceId ? '' : trace.traceId
    })
  }

  build() {
    Scroll() {
      Column({ space: AI_PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()
        if (this.isLoading) {
          Column({ space: 10 }) {
            LoadingProgress().width(26).height(26).color(this.theme.accent)
            Text('正在加载执行轨迹').fontSize(12).fontColor(this.theme.textSecondary)
          }
          .width('100%')
          .padding({ top: 24, bottom: 24 })
          .alignItems(HorizontalAlign.Center)
        } else if (this.traces.length === 0) {
          this.EmptyState()
        } else {
          ForEach(this.traces, (trace: AgentTraceRecord, index: number) => {
            this.TraceCard(trace, index)
          }, (trace: AgentTraceRecord) => trace.traceId)
        }
        Row().height(28).width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
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
