
import router from '@ohos.router'
import { AppRepository } from '../common/data/AppRepository'
import { ArticleAssistService } from '../common/services/ArticleAssistService'
import { ArticleDetailModel } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'

@Entry
@Component
struct ArticleDetail {
  @State entry?: ArticleDetailModel = undefined
  @State actionHint: string = ''
  @State aiSummary: string = ''
  @State aiEnabled: boolean = false
  @State theme: ThemePalette = ThemeService.darkPalette()

  aboutToAppear(): void {
    void this.loadEntry(true)
  }

  private entryId(): string {
    const params = router.getParams() as Record<string, string>
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
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
    this.aiEnabled = settings.aiSummaryEnabled
    this.aiSummary = this.entry
      ? ArticleAssistService.summarize(this.entry.title, this.entry.summary, this.entry.contentParagraphs)
      : ''
    this.actionHint = markRead ? '已标记为已读' : '内容已刷新'
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

  build() {
    Column() {
      Row() {
        Button('返回')
          .type(ButtonType.Capsule)
          .backgroundColor(this.theme.elevated)
          .fontColor(this.theme.textPrimary)
          .clickEffect({ level: ClickEffectLevel.LIGHT })
          .onClick(() => router.back())

        Blank()

        Button('收藏')
          .type(ButtonType.Capsule)
          .backgroundColor(this.theme.elevated)
          .fontColor(this.entry?.isStarred ? this.theme.accent : this.theme.textPrimary)
          .clickEffect({ level: ClickEffectLevel.LIGHT })
          .onClick(() => { void this.toggleStar() })

        Button(this.entry?.isRead ? '未读' : '已读')
          .type(ButtonType.Capsule)
          .backgroundColor(this.theme.elevated)
          .fontColor(this.theme.textPrimary)
          .clickEffect({ level: ClickEffectLevel.LIGHT })
          .onClick(() => { void this.toggleRead() })
      }
      .width('100%')
      .padding({ left: 18, right: 18, top: 20, bottom: 12 })

      Scroll() {
        Column({ space: 18 }) {
          if (this.entry) {
            Text(this.entry!.title)
              .fontSize(30)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme.textPrimary)

            Text(`${this.entry!.author} · ${this.entry!.publishedLabel} · ${this.entry!.readingLabel}`)
              .fontSize(14)
              .fontColor(this.theme.textSecondary)

            Text(this.actionHint)
              .fontSize(12)
              .fontColor(this.theme.accent)

            if (this.aiEnabled && this.aiSummary) {
              Column({ space: 8 }) {
                Text('摘要增强')
                  .fontSize(14)
                  .fontWeight(FontWeight.Medium)
                  .fontColor(this.theme.textPrimary)

                Text(this.aiSummary)
                  .fontSize(14)
                  .lineHeight(22)
                  .fontColor(this.theme.textSecondary)
              }
              .width('100%')
              .alignItems(HorizontalAlign.Start)
              .padding(16)
              .backgroundColor(this.theme.surface)
              .borderRadius(18)
            }

            Row({ space: 8 }) {
              Text(this.entry!.viewLabel)
                .fontSize(11)
                .fontColor(this.theme.isDark ? '#000000' : '#FFFFFF')
                .padding({ left: 10, right: 10, top: 6, bottom: 6 })
                .backgroundColor(this.entry!.viewBadgeColor)
                .borderRadius(999)

              Text(this.entry!.feedTitle)
                .fontSize(12)
                .fontColor(this.theme.accent)

              Text(this.entry!.isStarred ? '已收藏' : '未收藏')
                .fontSize(12)
                .fontColor(this.theme.textMuted)
            }

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

            Column({ space: 18 }) {
              if (this.entry!.summary) {
                Text(this.entry!.summary)
                  .fontSize(17)
                  .lineHeight(28)
                  .fontColor(this.theme.textPrimary)
                  .fontWeight(FontWeight.Medium)
              }

              ForEach(this.entry!.contentParagraphs, (paragraph: string) => {
                Text(paragraph)
                  .fontSize(17)
                  .lineHeight(30)
                  .fontColor(this.theme.textSecondary)
              }, (paragraph: string, index: number) => `${index}-${paragraph}`)

              Text(`原始来源：${this.entry!.siteUrl}`)
                .fontSize(13)
                .fontColor(this.theme.textMuted)
                .margin({ top: 18 })
            }
            .width('100%')
            .alignItems(HorizontalAlign.Start)
            .padding({ top: 12, bottom: 12 })
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
        .padding({ left: 18, right: 18, bottom: 48 })
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
