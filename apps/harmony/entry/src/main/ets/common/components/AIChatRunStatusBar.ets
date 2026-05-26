import { ThemePalette } from '../services/ThemeService'
import { ToolStatusItem } from './AIChatPanelTypes'

@Component
export struct AIChatRunStatusBar {
  @Prop theme: ThemePalette = {} as ThemePalette
  @Prop showToolBanner: boolean = false
  @Prop toolBannerOpacity: number = 0
  @Prop toolStatusItems: ToolStatusItem[] = []
  @Prop timerVisible: boolean = false
  @Prop timerOpacity: number = 0
  @Prop elapsedTime: string = ''

  private statusLabel(item: ToolStatusItem): string {
    if (item.status === 'running') {
      return `${item.label}${item.dots}`
    }
    if (item.status === 'confirmation_required') {
      return `${item.label} · 待确认`
    }
    if (item.status === 'failed') {
      return `${item.label} · 失败`
    }
    if (item.status === 'cancelled') {
      return `${item.label} · 已取消`
    }
    return `${item.label} · 完成`
  }

  private statusColor(item: ToolStatusItem): string {
    if (item.status === 'success') {
      return '#16A34A'
    }
    if (item.status === 'failed' || item.status === 'cancelled') {
      return '#DC2626'
    }
    if (item.status === 'confirmation_required') {
      return '#F59E0B'
    }
    return '#7A5AF8'
  }

  @Builder
  private ToolStatusBanner() {
    Column() {
      ForEach(this.toolStatusItems, (item: ToolStatusItem) => {
        Column() {
          Row() {
            if (item.status === 'success') {
              SymbolGlyph($r('sys.symbol.checkmark_circle_fill'))
                .fontSize(12)
                .fontColor([this.statusColor(item)])
                .margin({ right: 6 })
            } else if (item.status === 'failed' || item.status === 'cancelled') {
              SymbolGlyph($r('sys.symbol.xmark'))
                .fontSize(12)
                .fontColor([this.statusColor(item)])
                .margin({ right: 6 })
            } else if (item.status === 'confirmation_required') {
              SymbolGlyph($r('sys.symbol.bolt_circle_fill'))
                .fontSize(12)
                .fontColor([this.statusColor(item)])
                .margin({ right: 6 })
            } else {
              SymbolGlyph($r('sys.symbol.arrow_2_circlepath'))
                .fontSize(12)
                .fontColor([this.statusColor(item)])
                .margin({ right: 6 })
            }
            Text(this.statusLabel(item))
              .fontSize(11)
              .fontColor(this.theme.textSecondary)
              .layoutWeight(1)
            if (item.elapsedMs !== undefined) {
              Text((item.elapsedMs / 1000).toFixed(1) + 's')
                .fontSize(10)
                .fontColor(this.theme.textMuted)
                .margin({ left: 8 })
            }
          }
          .width('100%')
          if (item.message && item.status !== 'running') {
            Text(item.message)
              .fontSize(10)
              .fontColor(this.theme.textMuted)
              .lineHeight(14)
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .margin({ left: 18, top: 2 })
          }
        }
        .width('100%')
        .opacity(item.opacity)
        .padding({ top: 3, bottom: 3 })
        .animation({ duration: 200, curve: Curve.EaseOut })
      }, (item: ToolStatusItem) => item.key)
    }
    .padding({ left: 12, right: 12, top: 6, bottom: 6 })
    .borderRadius(12)
    .backgroundColor(this.theme.surface)
    .border({ width: 1, color: this.theme.divider })
    .alignItems(HorizontalAlign.Start)
    .opacity(this.toolBannerOpacity)
    .animation({ duration: 300, curve: Curve.EaseInOut })
  }

  @Builder
  private TimerDisplay() {
    Row() {
      SymbolGlyph($r('sys.symbol.timer'))
        .fontSize(11)
        .fontColor(['#7A5AF8'])
        .margin({ right: 5 })
      Text(this.elapsedTime)
        .fontSize(11)
        .fontColor(this.theme.textSecondary)
        .fontFamily('monospace')
    }
    .padding({ left: 10, right: 10, top: 4, bottom: 4 })
    .borderRadius(10)
    .backgroundColor(this.theme.surface)
    .border({ width: 1, color: this.theme.divider })
    .opacity(this.timerOpacity)
    .animation({ duration: 300, curve: Curve.EaseInOut })
  }

  build() {
    Row() {
      if (this.showToolBanner) {
        this.ToolStatusBanner()
      }
      if (this.timerVisible) {
        Blank()
          .width(8)
        this.TimerDisplay()
      }
    }
    .width('100%')
    .padding({ left: 20, right: 20, bottom: 4 })
    .justifyContent(FlexAlign.Start)
  }
}
