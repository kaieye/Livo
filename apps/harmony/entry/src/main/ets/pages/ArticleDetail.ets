import { AppRepository } from '../common/data/AppRepository'
import { getStringParams, goBack } from '../common/navigation/AppRouter'
import { ArticleAssistService } from '../common/services/ArticleAssistService'
import {
  ArticleContentBlock,
  ArticleDetailModel,
  isLegacyPlainArticleContent,
} from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'

@Entry
@Component
struct ArticleDetail {
  @State entry?: ArticleDetailModel = undefined
  @State actionHint: string = ''
  @State aiSummary: string = ''
  @State aiEnabled: boolean = false
  @State theme: ThemePalette = ThemeService.darkPalette()
  @State isUpgradingLegacyContent: boolean = false
  private upgradedEntryIds: Set<string> = new Set<string>()

  aboutToAppear(): void {
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

    await AppRepository.toggleStar(entryId)
    await this.loadEntry(false)
    this.actionHint = '收藏状态已更新'
  }

  private async toggleRead(): Promise<void> {
    const entryId = this.entryId()
    if (!entryId || !this.entry) {
      return
    }

    await AppRepository.markRead(entryId, !this.entry.isRead)
    await this.loadEntry(false)
    this.actionHint = this.entry?.isRead ? '已标记为已读' : '已标记为未读'
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
  private HeaderAction(label: string, accent?: boolean, onTap?: () => void) {
    Button(label)
      .type(ButtonType.Capsule)
      .fontSize(14)
      .fontWeight(FontWeight.Medium)
      .backgroundColor(this.theme.elevated)
      .fontColor(accent ? this.theme.accent : this.theme.textPrimary)
      .clickEffect({ level: ClickEffectLevel.LIGHT })
      .onClick(() => {
        if (onTap) {
          onTap()
        }
      })
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
      Row() {
        this.HeaderAction('返回', false, () => { void goBack() })

        Blank()

        this.HeaderAction('收藏', !!this.entry?.isStarred, () => { void this.toggleStar() })
        this.HeaderAction(this.entry?.isRead ? '未读' : '已读', false, () => { void this.toggleRead() })
      }
      .width('100%')
      .padding({ left: 18, right: 18, top: 18, bottom: 10 })

      Scroll() {
        Column({ space: 18 }) {
          if (this.entry) {
            Column({ space: 12 }) {
              Row({ space: 8 }) {
                this.MetaBadge(this.entry!.viewLabel, true)
                this.MetaBadge(this.entry!.feedTitle)
                if (this.entry!.isStarred) {
                  this.MetaBadge('已收藏')
                }
              }
              .width('100%')

              Text(this.entry!.title)
                .fontSize(28)
                .lineHeight(38)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.theme.textPrimary)
                .width('100%')

              Text(`${this.entry!.author} · ${this.entry!.publishedLabel} · ${this.entry!.readingLabel}`)
                .fontSize(13)
                .lineHeight(20)
                .fontColor(this.theme.textSecondary)
                .width('100%')

              if (this.actionHint) {
                Text(this.actionHint)
                  .fontSize(11)
                  .fontColor(this.theme.accent)
                  .width('100%')
              }

              if (this.isUpgradingLegacyContent) {
                Row({ space: 8 }) {
                  LoadingProgress()
                    .width(16)
                    .height(16)
                    .color(this.theme.accent)

                  Text('正在尝试重建段落与图片...')
                    .fontSize(12)
                    .fontColor(this.theme.textSecondary)
                }
                .width('100%')
              }
            }
            .width('100%')
            .padding({ left: 18, right: 18, top: 6, bottom: 2 })
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
              .margin({ left: 18, right: 18 })
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
              .margin({ left: 18, right: 18 })
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
                    .fontColor(this.theme.textSecondary)
                    .width('100%')
                    .textAlign(TextAlign.Start)
                }, (paragraph: string, index: number) => `${index}-${paragraph}`)
              }

              Text(`原始来源：${this.entry!.siteUrl}`)
                .fontSize(13)
                .fontColor(this.theme.textMuted)
                .width('100%')
            }
            .width('100%')
            .alignItems(HorizontalAlign.Start)
            .padding({ left: 18, right: 18, top: 12, bottom: 22 })
            .margin({ top: 4, bottom: 16 })
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
            .padding(20)
            .backgroundColor(this.theme.surface)
            .borderRadius(24)
          }
        }
        .width('100%')
        .padding({ bottom: 12 })
        .alignItems(HorizontalAlign.Start)
      }
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.Spring)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
