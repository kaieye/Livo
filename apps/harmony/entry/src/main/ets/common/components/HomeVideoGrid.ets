import { EntryCardModel } from '../models/LivoModels'
import { HighlightedInlineText } from './HighlightedInlineText'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { CARD_RADIUS_MD } from '../ui/UiTokens'
import {
  chunkHomeVideoEntries,
  resolveHomeVideoCardTokens,
  resolveHomeVideoGridColumns,
} from '../utils/HomeVideoGrid'

@Component
export struct HomeVideoGrid {
  @Prop entries: EntryCardModel[] = []
  @Prop highlightQuery: string = ''
  @StorageProp('showUnreadDot') showUnreadDot: boolean = true
  onOpenEntry: (entry: EntryCardModel) => void = () => {}
  @State theme: ThemePalette = ThemeService.currentPalette()
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()

  aboutToAppear(): void {
    this.theme = this.inheritedTheme
  }

  private syncInheritedTheme(): void {
    this.theme = this.inheritedTheme
  }

  private cardMeta(entry: EntryCardModel): string {
    const feedTitle = (entry.feedTitle || '').trim()
    if (feedTitle) {
      return feedTitle
    }
    return (entry.author || '').trim()
  }

  private relativePublishedMeta(entry: EntryCardModel): string {
    if (!entry.publishedAt || entry.publishedAt <= 0) {
      return ''
    }

    const elapsedMs = Math.max(0, Date.now() - entry.publishedAt)
    const minuteMs = 60 * 1000
    const hourMs = 60 * minuteMs
    const dayMs = 24 * hourMs

    if (elapsedMs < minuteMs) {
      return '刚刚'
    }
    if (elapsedMs < hourMs) {
      return `${Math.floor(elapsedMs / minuteMs)}分钟前`
    }
    if (elapsedMs < dayMs) {
      return `${Math.floor(elapsedMs / hourMs)}小时前`
    }
    if (elapsedMs < 30 * dayMs) {
      return `${Math.floor(elapsedMs / dayMs)}天前`
    }
    if (elapsedMs < 365 * dayMs) {
      return `${Math.floor(elapsedMs / (30 * dayMs))}个月前`
    }
    return `${Math.floor(elapsedMs / (365 * dayMs))}年前`
  }

  private cardMetaLine(entry: EntryCardModel): string {
    const source = this.cardMeta(entry)
    const relative = this.relativePublishedMeta(entry)
    if (source && relative) {
      return `${source} · ${relative}`
    }
    return source || relative
  }

  private parseIsoDurationToSeconds(value: string): number {
    const matched = value.match(/\bPT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?\b/i)
    if (!matched) {
      return 0
    }

    const hours = Number(matched[1] || '0')
    const minutes = Number(matched[2] || '0')
    const seconds = Number(matched[3] || '0')
    return Math.max(0, hours * 3600 + minutes * 60 + seconds)
  }

  private parseChineseDurationToSeconds(value: string): number {
    const normalized = (value || '').replace(/\s+/g, '')
    if (!normalized) {
      return 0
    }

    const fullMatch = normalized.match(/(?:(\d+)小时)?(?:(\d+)分(?:钟)?)?(?:(\d+)秒)?/)
    if (fullMatch) {
      const hours = Number(fullMatch[1] || '0')
      const minutes = Number(fullMatch[2] || '0')
      const seconds = Number(fullMatch[3] || '0')
      const total = hours * 3600 + minutes * 60 + seconds
      if (total > 0) {
        return total
      }
    }

    return 0
  }

  private parseNumericDurationToSeconds(value: string): number {
    const normalized = value || ''

    // duration=123 / duration:123 / 时长 123秒
    const explicitSeconds = normalized.match(/(?:duration|length|时长)[\s:=："]*(\d{1,6})(?:\s*(?:s|秒))?/i)
    if (explicitSeconds?.[1]) {
      return Math.max(0, Number(explicitSeconds[1]))
    }

    return 0
  }

  private parseClockDurationToSeconds(value: string): number {
    const matched = value.match(/(?:^|[^\d])((?:\d{1,2}:)?\d{1,2}:\d{2})(?:[^\d]|$)/)
    if (!matched?.[1]) {
      return 0
    }

    const parts = matched[1].split(':').map((part: string) => Number(part))
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    return 0
  }

  private formatDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds))
    const hours = Math.floor(safe / 3600)
    const minutes = Math.floor((safe % 3600) / 60)
    const remainSeconds = safe % 60
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`
    }
    return `${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`
  }

  private videoDurationLabel(entry: EntryCardModel): string {
    const source = [
      entry.title || '',
      entry.summary || '',
      ...(entry.mediaUrls ?? []),
      entry.articleUrl || '',
    ].join(' ')

    const isoSeconds = this.parseIsoDurationToSeconds(source)
    if (isoSeconds > 0) {
      return this.formatDuration(isoSeconds)
    }

    const chineseExplicit = (source.match(/(?:时长|duration|length)[^，。；;|]*?(?:(?:\d+小时)?(?:\d+分(?:钟)?)?(?:\d+秒)?)/i)?.[0]) || ''
    const chineseSeconds = this.parseChineseDurationToSeconds(chineseExplicit || source)
    if (chineseSeconds > 0) {
      return this.formatDuration(chineseSeconds)
    }

    const clockSeconds = this.parseClockDurationToSeconds(source)
    if (clockSeconds > 0) {
      return this.formatDuration(clockSeconds)
    }

    const numericSeconds = this.parseNumericDurationToSeconds(source)
    if (numericSeconds > 0) {
      return this.formatDuration(numericSeconds)
    }

    return ''
  }

  private rows(): EntryCardModel[][] {
    return chunkHomeVideoEntries(this.entries, resolveHomeVideoGridColumns())
  }

  private cardTokens() {
    return resolveHomeVideoCardTokens({
      isDark: this.theme.isDark,
      elevated: this.theme.elevated,
      textPrimary: this.theme.textPrimary,
      textSecondary: this.theme.textSecondary,
    })
  }

  @Builder
  private VideoCard(entry: EntryCardModel) {
    Column({ space: 8 }) {
      Stack({ alignContent: Alignment.TopEnd }) {
        Stack({ alignContent: Alignment.BottomEnd }) {
          if (entry.imageUrl) {
            Image(entry.imageUrl)
              .width('100%')
              .aspectRatio(16 / 9)
              .objectFit(ImageFit.Cover)
              .borderRadius(14)
          } else {
            Column()
              .width('100%')
              .aspectRatio(16 / 9)
              .backgroundColor(this.cardTokens().placeholderBackground)
              .borderRadius(14)
          }

          if (this.videoDurationLabel(entry)) {
            Text(this.videoDurationLabel(entry))
              .fontSize(10)
              .fontWeight(FontWeight.Medium)
              .fontColor('#FFFFFF')
              .padding({ left: 6, right: 6, top: 3, bottom: 3 })
              .backgroundColor('rgba(0,0,0,0.62)')
              .borderRadius(8)
              .margin({ right: 8, bottom: 8 })
          }
        }

        if (!entry.isRead && this.showUnreadDot) {
          Row()
            .width(8)
            .height(8)
            .borderRadius(999)
            .backgroundColor(this.theme.accent)
            .margin({ right: 8, top: 8 })
        }
      }

      Column({ space: 4 }) {
        HighlightedInlineText({
          text: entry.title,
          query: this.highlightQuery,
          theme: this.theme,
          fontSize: 14,
          lineHeight: 18,
          fontWeight: FontWeight.Medium,
          defaultColor: this.cardTokens().titleColor,
          maxLines: 2,
        })
          .width('100%')

        if (this.cardMetaLine(entry)) {
          Text(this.cardMetaLine(entry))
            .width('100%')
            .fontSize(11)
            .fontColor(this.cardTokens().metaColor)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .onClick(() => {
      this.onOpenEntry(entry)
    })
  }

  build() {
    Column({ space: 12 }) {
      if (this.entries.length === 0) {
        Column({ space: 8 }) {
          Text('还没有可展示的条目')
            .fontSize(18)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)

          Text('请先到订阅页添加或刷新订阅源，然后回到首页查看整理后的内容流。')
            .fontSize(14)
            .lineHeight(22)
            .fontColor(this.theme.textSecondary)
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .padding(20)
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_MD)
        .border({ width: 0.8, color: this.theme.divider })
      } else {
        ForEach(this.rows(), (rowEntries: EntryCardModel[], rowIndex: number) => {
          Row({ space: 12 }) {
            ForEach(rowEntries, (entry: EntryCardModel) => {
              Column() {
                this.VideoCard(entry)
              }
              .layoutWeight(1)
            }, (entry: EntryCardModel) => `${entry.id}-${entry.isRead}`)

            if (rowEntries.length < resolveHomeVideoGridColumns()) {
              Blank()
                .layoutWeight(1)
            }
          }
          .width('100%')
        }, (rowEntries: EntryCardModel[], rowIndex: number) => {
          const rowSignature = rowEntries
            .map((entry: EntryCardModel) => `${entry.id}-${entry.isRead ? '1' : '0'}`)
            .join('|')
          return `video-row-${rowIndex}-${rowSignature}`
        })
      }
    }
    .width('100%')
  }
}
