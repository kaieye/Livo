/**
 * Subscribe / save / unsubscribe orchestration for the feed-subscribe flow.
 *
 * The component is responsible for UI side-effects (toasts, dialogs, isSubmitting
 * spinners, callback fan-out); this module owns the data-layer work:
 *   - building a `FeedDraft` from the user's edited fields
 *   - locating an existing feed by URL, mapped-URL, or site URL
 *   - branching on update vs create
 *   - seeding cached preview entries into the new/updated feed
 *   - signalling "feeds changed" once the data side has settled
 *
 * The shape returned (`FeedSubscribeOutcome`) lets the caller decide what
 * toast message to show and whether to trigger a follow-up refresh.
 */

import { Feed, FeedViewType } from '../models/LivoModels'
import { AppRepository } from '../data/AppRepository'
import { FeedDraft } from '../repositories/FeedRepository'
import { FeedRefreshPayload } from '../services/RssFeedService'
import { bumpFeedsChangedSignal } from './FeedChangeSignal'
import { effectiveSubscribedUrl } from './FeedSubscribeTargetUrl'

export interface FeedSubscribeRequest {
  targetUrl: string
  targetTitle: string
  targetSiteUrl: string
  targetDescription: string
  customTitle: string
  customCategory: string
  selectedView: FeedViewType
  hideInTimeline: boolean
  mappedTargetUrl: string
  resolvedImageUrl: string
  cachedPreview?: FeedRefreshPayload
}

export interface FeedSubscribeOutcome {
  feedId: string
  message: string
  hasSeededPreview: boolean
  wasUpdate: boolean
}

export class FeedSubscribeAction {
  static async subscribe(
    request: FeedSubscribeRequest,
    knownExistingFeed?: Feed,
  ): Promise<FeedSubscribeOutcome> {
    const cachedPreview = request.cachedPreview
    const resolvedTargetUrl = effectiveSubscribedUrl(
      cachedPreview?.resolvedFeedUrl?.trim() || request.mappedTargetUrl,
      cachedPreview?.siteUrl?.trim() || request.targetSiteUrl.trim(),
    )
    const resolvedSiteUrl = cachedPreview?.siteUrl?.trim() || request.targetSiteUrl.trim()
    const existingFeed = knownExistingFeed
      ?? await AppRepository.feedEntityByUrl(request.mappedTargetUrl)
      ?? await AppRepository.feedEntityByUrl(resolvedTargetUrl)
      ?? await AppRepository.feedEntityBySiteUrl(resolvedSiteUrl)

    const draft: FeedDraft = {
      url: resolvedTargetUrl,
      title: request.customTitle || cachedPreview?.feedTitle || request.targetTitle,
      siteUrl: resolvedSiteUrl,
      imageUrl: request.resolvedImageUrl || existingFeed?.imageUrl || '',
      description: cachedPreview?.description || request.targetDescription,
      category: request.customCategory,
      view: request.selectedView,
      showInAll: !request.hideInTimeline,
    }

    let feedId: string = ''
    let message: string = ''
    let wasUpdate = false

    if (existingFeed) {
      const updatedFeed = await AppRepository.updateFeed(existingFeed.id, draft)
      feedId = updatedFeed.id
      message = '订阅已更新'
      wasUpdate = true
    } else {
      const createdFeed = await AppRepository.createFeed(draft)
      feedId = createdFeed.id
      message = '订阅成功'
    }

    if (cachedPreview) {
      await AppRepository.seedFeedFromPreview(feedId, cachedPreview)
    }
    bumpFeedsChangedSignal()

    const hasSeededPreview = !!cachedPreview && (cachedPreview.entries?.length ?? 0) > 0
    return { feedId, message, hasSeededPreview, wasUpdate }
  }

  static async save(
    request: FeedSubscribeRequest,
    existingFeed: Feed,
  ): Promise<FeedSubscribeOutcome> {
    const draft: FeedDraft = {
      url: request.mappedTargetUrl,
      title: request.customTitle || request.targetTitle,
      siteUrl: request.targetSiteUrl,
      imageUrl: request.resolvedImageUrl || existingFeed.imageUrl || '',
      description: request.targetDescription,
      category: request.customCategory,
      view: request.selectedView,
      showInAll: !request.hideInTimeline,
    }
    const updatedFeed = await AppRepository.updateFeed(existingFeed.id, draft)

    const cachedPreview = request.cachedPreview
    if (cachedPreview) {
      const seedPayload: FeedRefreshPayload = {
        etag: cachedPreview.etag,
        lastModified: cachedPreview.lastModified,
        feedTitle: draft.title || cachedPreview.feedTitle,
        siteUrl: cachedPreview.siteUrl,
        imageUrl: cachedPreview.imageUrl,
        description: cachedPreview.description,
        resolvedFeedUrl: cachedPreview.resolvedFeedUrl,
        entries: cachedPreview.entries,
      }
      void seedPreviewSafely(updatedFeed.id, seedPayload)
    }
    bumpFeedsChangedSignal()

    return {
      feedId: updatedFeed.id,
      message: '保存成功',
      hasSeededPreview: !!cachedPreview && (cachedPreview.entries?.length ?? 0) > 0,
      wasUpdate: true,
    }
  }

  static async unsubscribe(feedId: string): Promise<void> {
    await AppRepository.removeFeed(feedId)
  }

  static async refreshAfterSubscribe(feedId: string): Promise<void> {
    try {
      await AppRepository.refreshFeed(feedId)
    } catch (error) {
      console.error(`subscribe refresh failed: ${error instanceof Error ? error.message : error}`)
    }
  }
}

async function seedPreviewSafely(feedId: string, payload: FeedRefreshPayload): Promise<void> {
  try {
    await AppRepository.seedFeedFromPreview(feedId, payload)
  } catch (error) {
    console.error(`seed preview after save failed: ${error instanceof Error ? error.message : error}`)
  }
}
