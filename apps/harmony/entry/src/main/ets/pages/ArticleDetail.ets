import { AppRepository } from '../common/data/AppRepository'
import { getStringParams, goBack } from '../common/navigation/AppRouter'
import { ArticleAssistService } from '../common/services/ArticleAssistService'
import { PageHeader } from '../common/components/PageHeader'
import {
  ArticleContentBlock,
  ArticleDetailModel,
  isLegacyPlainArticleContent,
} from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { HEADER_BACK_SLOT_SIZE, PAGE_HORIZONTAL_PADDING, PAGE_TOP_PADDING } from '../common/ui/UiTokens'

@Entry
@Component
struct ArticleDetail {
  @StorageProp('topAvoidArea') topAvoidArea: number = 0
  @StorageProp('bottomAvoidArea') bottomAvoidArea: number = 0
  @State entry?: ArticleDetailModel = undefined
  @State actionHint: string = ''
  @State aiSummary: string = ''
  @State aiEnabled: boolean = false
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State isUpgradingLegacyContent: boolean = false
  @State starScale: number = 1
  private upgradedEntryIds: Set<string> = new Set<string>()

  private animateWithUiContext(options: AnimateParam, event: () => void): void {
    this.getUIContext().animateTo(options, event)
  }

  aboutToAppear(): void {
    this.theme = ThemeService.currentPalette()
    void this.loadEntry(true)
  }

  private entryId(): string {
    const params = getStringParams()
    return params?.entryId ?? ''
  }

  private async loadEntry(markRead: boolean): Promise<void> {
    const entryId = this.entryId()
    if (!entryId) {
      this.entry = undefined
      return
    }

    if (markRead) {
      await AppRepository.markRead(entryId, true)
    }

    const params = getStringParams()
    const entryJson = params?.entryJson as string

    if (entryJson) {
      try {
        const parsed = JSON.parse(entryJson) as ArticleDetailModel
        if (parsed) {
          this.entry = parsed
          this.actionHint = ''
          return
        }
      } catch (e) {
        console.error('Failed to parse entryJson', e)
      }
    }

    this.entry = await AppRepository.entryById(entryId)
    const upgraded = await this.upgradeLegacyEntryIfNeeded()
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
    this.aiEnabled = settings.aiSummaryEnabled
    this.aiSummary = this.entry
      ? ArticleAssistService.summarize(this.entry.title, this.entry.summary, this.entry.contentParagraphs)
      : ''
    if (!upgraded) {
      this.actionHint = markRead ? '已标记为已读' : '内容已刷新'
    }
  }

  private async toggleStar(): Promise<void> {
    const entryId = this.entryId()
    if (!entryId) {
      return
    }

    this.animateWithUiContext({ duration: 150, curve: Curve.EaseOut }, () => {
      this.starScale = 1.4
    })

    await AppRepository.toggleStar(entryId)
    await this.loadEntry(false)
    this.actionHint = this.entry?.isStarred ? '已收藏' : '已取消收藏'

    setTimeout(() => {
      this.animateWithUiContext({ duration: 300, curve: Curve.FastOutSlowIn }, () => {
        this.starScale = 1.0
      })
    }, 150)
  }

  private async upgradeLegacyEntryIfNeeded(): Promise<boolean> {
    const current = this.entry
    if (!current) {
      return false
    }

    if (this.upgradedEntryIds.has(current.id)) {
      return false
    }

    const rawContent = current.contentParagraphs.join('\n\n').trim()
    if (!isLegacyPlainArticleContent(rawContent)) {
      return false
    }

    this.upgradedEntryIds.add(current.id)
    this.isUpgradingLegacyContent = true
    this.actionHint = '正在刷新旧版正文格式...'

    try {
      await AppRepository.refreshFeed(current.feedId)
      const refreshed = await AppRepository.entryById(current.id)
      if (refreshed) {
        this.entry = refreshed
      }
      this.actionHint = '已刷新正文排版'
      return true
    } catch (_) {
      this.actionHint = '旧版正文刷新失败，已保留本地内容'
      return true
    } finally {
      this.isUpgradingLegacyContent = false
    }
  }

  @Builder
  private MetaBadge(text: string, active?: boolean) {
    Text(text)
      .fontSize(11)
      .fontWeight(FontWeight.Medium)
      .fontColor(active ? '#FFFFFF' : this.theme.textSecondary)
      .padding({ left: 10, right: 10, top: 6, bottom: 6 })
      .backgroundColor(active ? this.theme.accent : this.theme.elevated)
      .borderRadius(999)
  }

  @Builder
  private HeaderIconAction(
    symbol: Resource,
    size: number,
    onTap?: () => void,
    symbolColors?: ResourceColor[],
    backgroundColor?: string,
  ) {
    Row() {
      SymbolGlyph(symbol)
        .fontSize(size)
        .fontColor(symbolColors ?? [this.theme.textSecondary])
        .renderingStrategy(symbol === $r('sys.symbol.lightbulb')
          ? SymbolRenderingStrategy.MULTIPLE_COLOR
          : SymbolRenderingStrategy.SINGLE)
    }
      .width(HEADER_BACK_SLOT_SIZE)
      .height(HEADER_BACK_SLOT_SIZE)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(backgroundColor ?? Color.Transparent)
      .borderRadius(HEADER_BACK_SLOT_SIZE)
      .clickEffect({ level: ClickEffectLevel.LIGHT })
      .onClick(() => {
        if (onTap) {
          onTap()
        }
      })
  }

  @Builder
  private HeaderActions() {
    Row({ space: 4 }) {
      this.HeaderIconAction(
        $r('sys.symbol.lightbulb'),
        24,
        () => { this.actionHint = 'AI 助手功能开发中...' },
        [this.theme.accent, this.theme.textSecondary],
      )

      this.HeaderIconAction(
        $r('sys.symbol.share'),
        22,
        () => { this.actionHint = '分享功能开发中...' },
      )

      this.HeaderIconAction(
        $r(this.entry?.isStarred ? 'sys.symbol.star_fill' : 'sys.symbol.star'),
        22,
        () => { void this.toggleStar() },
        [this.entry?.isStarred ? this.theme.accent : this.theme.textSecondary],
        undefined,
      )
    }
    .height(HEADER_BACK_SLOT_SIZE)
  }

  @Builder
  private ContentBlockItem(block: ArticleContentBlock) {
    if (block.type === 'image' && block.imageUrl) {
      Column({ space: 0 }) {
        Image(block.imageUrl)
          .width('100%')
          .constraintSize({ minHeight: 180, maxHeight: 520 })
          .objectFit(ImageFit.Contain)
          .borderRadius(16)
      }
      .width('100%')
      .clip(true)
    } else if (block.text) {
      Column({ space: 0 }) {
        Text(block.text)
          .fontSize(16)
          .lineHeight(29)
          .fontColor(this.theme.textPrimary)
          .width('100%')
          .textAlign(TextAlign.Start)
      }
      .width('100%')
      .padding({ left: 2, right: 2 })
    }
  }

  build() {
    Column() {
      Column({ space: 8 }) {
        PageHeader({
          title: '文章详情',
          theme: this.theme,
          showBackButton: true,
          showTrailingBuilder: true,
          titleSize: 20,
          topPadding: 0,
          bottomPadding: 0,
          onBack: () => { void goBack() },
        }) {
          this.HeaderActions()
        }
      }
      .width('100%')
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 8 })

      if (this.entry) {
        Scroll() {
          Column({ space: 18 }) {
            Column({ space: 12 }) {
              Text(this.entry!.title)
                .fontSize(28)
                .lineHeight(38)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.theme.textPrimary)
                .width('100%')

              Text(`${this.entry!.author} · ${this.entry!.publishedLabel}`)
                .fontSize(13)
                .lineHeight(20)
                .fontColor(this.theme.textSecondary)
                .width('100%')
            }
            .width('100%')
            .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 6, bottom: 2 })
            .alignItems(HorizontalAlign.Start)

            if (this.aiEnabled && this.aiSummary) {
              Column({ space: 8 }) {
                Text('摘要增强')
                  .fontSize(14)
                  .fontWeight(FontWeight.Medium)
                  .fontColor(this.theme.textPrimary)

                Text(this.aiSummary)
                  .fontSize(14)
                  .lineHeight(23)
                  .fontColor(this.theme.textSecondary)
                  .maxLines(5)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                  .width('100%')
              }
              .width('100%')
              .alignItems(HorizontalAlign.Start)
              .padding(16)
              .margin({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
              .borderRadius(20)
              .border({ width: 1, color: this.theme.divider })
            }

            if (this.entry!.tags.length > 0) {
              Row({ space: 8 }) {
                ForEach(this.entry!.tags, (tag: string) => {
                  Text(tag)
                    .fontSize(12)
                    .fontColor(this.theme.textSecondary)
                    .padding({ left: 10, right: 10, top: 6, bottom: 6 })
                    .backgroundColor(this.theme.elevated)
                    .borderRadius(999)
                }, (tag: string) => tag)
              }
              .width('100%')
              .margin({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
            }

            Column({ space: 20 }) {
              if (this.entry!.summary) {
                Text(this.entry!.summary)
                  .fontSize(16)
                  .lineHeight(27)
                  .fontColor(this.theme.textSecondary)
                  .fontWeight(FontWeight.Medium)
                  .width('100%')
              }

              if (this.entry!.contentBlocks.length > 0) {
                ForEach(this.entry!.contentBlocks, (block: ArticleContentBlock) => {
                  this.ContentBlockItem(block)
                }, (block: ArticleContentBlock) => block.id)
              } else {
                ForEach(this.entry!.contentParagraphs, (paragraph: string) => {
                  Text(paragraph)
                    .fontSize(16)
                    .lineHeight(29)
                    .fontColor(this.theme.textPrimary)
                    .width('100%')
                    .textAlign(TextAlign.Start)
                }, (paragraph: string, index: number) => `${index}-${paragraph}`)
              }

              if (this.entry!.siteUrl) {
                Text(`原始来源：${this.entry!.siteUrl}`)
                  .fontSize(13)
                  .fontColor(this.theme.textMuted)
                  .width('100%')
              }
            }
            .width('100%')
            .alignItems(HorizontalAlign.Start)
            .padding({ left: 18, right: 18, top: 12, bottom: 22 })
            .margin({ top: 4, bottom: 16 })
          }
          .width('100%')
          .padding({ bottom: this.bottomAvoidArea + 28 })
          .alignItems(HorizontalAlign.Start)
        }
        .width('100%')
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.Spring)
      } else {
        Column({ space: 12 }) {
          Text('未找到内容')
            .fontSize(24)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)

          Text('请从订阅页重新进入一个条目。')
            .fontSize(15)
            .fontColor(this.theme.textSecondary)
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      }
    }
    .width('100%')
    .height('100%')
    .padding({ top: this.topAvoidArea })
    .backgroundColor(this.theme.background)
  }
}
