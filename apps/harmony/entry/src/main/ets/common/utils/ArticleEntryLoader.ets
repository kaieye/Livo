import { AppRepository } from '../data/AppRepository'
import { getStringParams } from '../navigation/AppRouter'
import {
  ArticleDetailModel,
  HarmonySettings,
  isLegacyPlainArticleContent,
} from '../models/LivoModels'
import { ThemeService, ThemePalette } from '../services/ThemeService'
import { ArticleAIAssistViewModel } from './ArticleAIAssistViewModel'

export interface ArticleEntryLoaderOwner {
  entry?: ArticleDetailModel
  actionHint: string
  theme: ThemePalette
  isUpgradingLegacyContent: boolean
  applyAISettings(settings: HarmonySettings): void
  resetAIResultsIfEntryChanged(): void
  triggerAutoAIAssist(): void
}

/**
 * Coordinates loading an article detail: optional snapshot rehydration,
 * mark-as-read, repository fetch, legacy-content upgrade, theme + AI
 * settings application, and auto-AI triggering.
 *
 * Owns the per-page upgraded-entry id set so we don't refresh the same
 * entry's legacy content twice within a session.
 */
export class ArticleEntryLoader {
  private readonly upgradedEntryIds: Set<string> = new Set<string>()
  private readonly owner: ArticleEntryLoaderOwner

  constructor(owner: ArticleEntryLoaderOwner) {
    this.owner = owner
  }

  async load(entryId: string, markRead: boolean, allowRouteSnapshot: boolean): Promise<void> {
    if (!entryId) {
      this.owner.entry = undefined
      return
    }

    if (markRead) {
      await AppRepository.markRead(entryId, true)
      console.info(`已标记条目为已读: ${entryId}`)
    }

    if (allowRouteSnapshot && this.tryRehydrateFromRouteSnapshot()) {
      return
    }

    this.owner.entry = await AppRepository.entryById(entryId)
    const upgraded = await this.upgradeLegacyEntryIfNeeded()
    const settings = await AppRepository.settings()
    this.owner.theme = await ThemeService.resolvePalette(settings)
    this.owner.applyAISettings(settings)
    this.owner.resetAIResultsIfEntryChanged()

    if (this.owner.entry && ArticleAIAssistViewModel.shouldAutoTrigger(settings)) {
      this.owner.triggerAutoAIAssist()
    }
    if (!upgraded) {
      this.owner.actionHint = markRead ? '已标记为已读' : '内容已刷新'
    }
  }

  private tryRehydrateFromRouteSnapshot(): boolean {
    const params = getStringParams()
    const entryJson = params?.entryJson as string
    if (!entryJson) {
      return false
    }
    try {
      const parsed = JSON.parse(entryJson) as ArticleDetailModel
      if (parsed) {
        this.owner.entry = parsed
        this.owner.actionHint = ''
        return true
      }
    } catch (e) {
      console.error('Failed to parse entryJson', e)
    }
    return false
  }

  private async upgradeLegacyEntryIfNeeded(): Promise<boolean> {
    const current = this.owner.entry
    if (!current || this.upgradedEntryIds.has(current.id)) {
      return false
    }

    const rawContent = current.contentParagraphs.join('\n\n').trim()
    if (!isLegacyPlainArticleContent(rawContent)) {
      return false
    }

    this.upgradedEntryIds.add(current.id)
    this.owner.isUpgradingLegacyContent = true
    this.owner.actionHint = '正在刷新旧版正文格式...'

    try {
      await AppRepository.refreshFeed(current.feedId)
      const refreshed = await AppRepository.entryById(current.id)
      if (refreshed) {
        this.owner.entry = refreshed
      }
      this.owner.actionHint = '已刷新正文排版'
      return true
    } catch (_) {
      this.owner.actionHint = '旧版正文刷新失败，已保留本地内容'
      return true
    } finally {
      this.owner.isUpgradingLegacyContent = false
    }
  }
}

export function copyArticleEntryWithStarState(
  entry: ArticleDetailModel,
  isStarred: boolean,
): ArticleDetailModel {
  return {
    id: entry.id,
    feedId: entry.feedId,
    title: entry.title,
    summary: entry.summary,
    content: entry.content,
    imageUrl: entry.imageUrl,
    feedImageUrl: entry.feedImageUrl,
    author: entry.author,
    articleUrl: entry.articleUrl,
    publishedAt: entry.publishedAt,
    publishedLabel: entry.publishedLabel,
    readingLabel: entry.readingLabel,
    tags: entry.tags,
    mediaUrls: entry.mediaUrls,
    rawMediaUrls: entry.rawMediaUrls,
    feedTitle: entry.feedTitle,
    feedCategory: entry.feedCategory,
    viewLabel: entry.viewLabel,
    viewBadgeColor: entry.viewBadgeColor,
    hasVideoMedia: entry.hasVideoMedia,
    isRead: entry.isRead,
    isStarred,
    contentParagraphs: entry.contentParagraphs,
    contentBlocks: entry.contentBlocks,
    siteUrl: entry.siteUrl,
  }
}
