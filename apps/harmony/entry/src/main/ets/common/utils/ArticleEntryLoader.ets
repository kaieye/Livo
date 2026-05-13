import { getStringParams } from '../navigation/AppRouter'
import {
  ArticleContentBlock,
  ArticleDetailModel,
  HarmonySettings,
  isLegacyPlainArticleContent,
  toArticleDetailModel,
} from '../models/LivoModels'
import {
  buildArticleContentBlocks,
  buildMediaContentBlocks,
} from '../models/ArticleContentBuilder'
import { resolvePictureCarouselMediaItems } from '../utils/PictureGallery'
import { EntryRepository } from '../repositories/EntryRepository'
import { FeedRepository } from '../repositories/FeedRepository'
import { SettingsStore } from '../services/SettingsStore'
import { FeedRefreshCoordinator } from '../data/FeedRefreshCoordinator'
import { ThemeService, ThemePalette } from '../services/ThemeService'
import { ArticleAIAssistViewModel } from './ArticleAIAssistViewModel'

export interface ArticleEntryLoaderOwner {
  entry?: ArticleDetailModel
  actionHint: string
  theme: ThemePalette
  isUpgradingLegacyContent: boolean
  isLoading: boolean
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
      this.owner.isLoading = false
      return
    }

    // Snapshot rehydration runs synchronously so entry is available before build()
    const snapshotRehydrated = allowRouteSnapshot && this.tryRehydrateFromRouteSnapshot()

    if (markRead) {
      await EntryRepository.markRead(entryId, true)
      console.info(`已标记条目为已读: ${entryId}`)
    }

    if (snapshotRehydrated) {
      // Build content blocks asynchronously from the snapshot card data
      await this.buildContentBlocksFromEntry()
      this.owner.isLoading = false

      // Settings/theme/AI assist
      const settings = await SettingsStore.load()
      this.owner.theme = await ThemeService.resolvePalette(settings)
      this.owner.applyAISettings(settings)
      this.owner.resetAIResultsIfEntryChanged()
      if (this.owner.entry && ArticleAIAssistViewModel.shouldAutoTrigger(settings)) {
        this.owner.triggerAutoAIAssist()
      }
      return
    }

    // No snapshot — full DB load
    this.owner.entry = await this.loadEntryById(entryId)
    const upgraded = await this.upgradeLegacyEntryIfNeeded()
    const settings = await SettingsStore.load()
    this.owner.theme = await ThemeService.resolvePalette(settings)
    this.owner.applyAISettings(settings)
    this.owner.resetAIResultsIfEntryChanged()

    if (this.owner.entry && ArticleAIAssistViewModel.shouldAutoTrigger(settings)) {
      this.owner.triggerAutoAIAssist()
    }
    if (!upgraded) {
      this.owner.actionHint = markRead ? '已标记为已读' : '内容已刷新'
    }
    this.owner.isLoading = false
  }

  private async buildContentBlocksFromEntry(): Promise<void> {
    const current = this.owner.entry
    if (!current) {
      return
    }

    const isPicture = (current.viewLabel || '').trim() === '图片'
    const rawUrls = current.rawMediaUrls ?? []

    const blocks: ArticleContentBlock[] = isPicture
      ? buildMediaContentBlocks(resolvePictureCarouselMediaItems(rawUrls, current.imageUrl), current.imageUrl)
      : buildArticleContentBlocks(current.content, current.articleUrl, current.articleUrl, current.mediaUrls ?? [], current.title)

    const paragraphs = blocks
      .filter((block: ArticleContentBlock) => block.type === 'paragraph')
      .map((block: ArticleContentBlock) => block.text)

    this.owner.entry = {
      id: current.id,
      feedId: current.feedId,
      title: current.title,
      summary: current.summary,
      content: current.content,
      imageUrl: current.imageUrl,
      feedImageUrl: current.feedImageUrl,
      author: current.author,
      articleUrl: current.articleUrl,
      publishedAt: current.publishedAt,
      publishedLabel: current.publishedLabel,
      readingLabel: current.readingLabel,
      tags: current.tags,
      mediaUrls: current.mediaUrls,
      rawMediaUrls: current.rawMediaUrls,
      feedTitle: current.feedTitle,
      feedCategory: current.feedCategory,
      viewLabel: current.viewLabel,
      viewBadgeColor: current.viewBadgeColor,
      hasVideoMedia: current.hasVideoMedia,
      isRead: current.isRead,
      isStarred: current.isStarred,
      contentParagraphs: paragraphs,
      contentBlocks: blocks,
      siteUrl: current.siteUrl,
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
      await FeedRefreshCoordinator.refreshFeed(current.feedId)
      const refreshed = await this.loadEntryById(current.id)
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

  private async loadEntryById(entryId: string): Promise<ArticleDetailModel | undefined> {
    const entry = await EntryRepository.getById(entryId)
    if (!entry) {
      return undefined
    }
    const feed = await FeedRepository.getById(entry.feedId)
    if (!feed) {
      return undefined
    }
    return toArticleDetailModel(entry, feed)
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
