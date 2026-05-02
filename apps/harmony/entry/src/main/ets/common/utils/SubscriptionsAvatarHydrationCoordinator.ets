import { AppRepository } from '../data/AppRepository'
import { FeedCardModel } from '../models/LivoModels'
import { bumpFeedsChangedSignal } from './FeedChangeSignal'
import {
  isSubscriptionFeedAvatarHydratable,
} from './SubscriptionsAvatarPolicy'
import {
  SUBSCRIPTIONS_AVATAR_HYDRATION_LIMIT,
  SubscriptionMode,
} from '../components/SubscriptionsConstants'
import { resolveSubscriptionModeLabel } from './SubscriptionsModePresentation'

export interface SubscriptionAvatarHydrationOwner {
  feeds: FeedCardModel[]
  mode: SubscriptionMode
  isFeedHydrated(feedId: string): boolean
  markFeedHydrated(feedId: string): void
  logHydrationDiag(message: string): void
}

export class SubscriptionsAvatarHydrationCoordinator {
  private readonly owner: SubscriptionAvatarHydrationOwner
  private token: number = 0
  private running: boolean = false
  private pending: boolean = false

  constructor(owner: SubscriptionAvatarHydrationOwner) {
    this.owner = owner
  }

  bumpToken(): void {
    this.token += 1
  }

  markPending(): void {
    this.pending = true
  }

  private shouldHydrateFeed(feed: FeedCardModel): boolean {
    if (this.owner.isFeedHydrated(feed.id)) {
      return false
    }
    return isSubscriptionFeedAvatarHydratable(feed.url, feed.siteUrl)
  }

  async run(): Promise<void> {
    if (this.running || this.owner.feeds.length === 0) {
      this.pending = true
      this.owner.logHydrationDiag(
        `avatar hydrate pending running=${this.running} count=${this.owner.feeds.length}`,
      )
      return
    }

    const activeLabel = resolveSubscriptionModeLabel(this.owner.mode)
    const candidates = this.owner.feeds
      .filter((feed: FeedCardModel) => this.shouldHydrateFeed(feed))
      .filter((feed: FeedCardModel) => feed.viewLabel === activeLabel)
      .slice(0, SUBSCRIPTIONS_AVATAR_HYDRATION_LIMIT)
    if (candidates.length === 0) {
      this.pending = false
      this.owner.logHydrationDiag(`avatar hydrate skipped no candidates mode=${this.owner.mode}`)
      return
    }

    this.pending = false
    const currentToken = this.token + 1
    this.token = currentToken
    this.running = true
    const startedAt = Date.now()
    this.owner.logHydrationDiag(
      `avatar hydrate start mode=${this.owner.mode} count=${candidates.length}`,
    )

    let changedCount = 0
    try {
      for (const feed of candidates) {
        if (this.token !== currentToken) {
          break
        }

        let didHydrate = false
        try {
          const changed = await AppRepository.resolveFeedAvatarOnly(feed.id)
          if (changed) {
            changedCount += 1
          }
          didHydrate = true
        } catch (error) {
          this.owner.logHydrationDiag(
            `avatar hydrate failed feedId=${feed.id} error=${error instanceof Error ? error.message : error}`,
          )
        }
        if (didHydrate) {
          this.owner.markFeedHydrated(feed.id)
        }
      }
    } finally {
      this.running = false
    }

    if (changedCount > 0 && this.token === currentToken) {
      bumpFeedsChangedSignal()
    }

    this.owner.logHydrationDiag(
      `avatar hydrate finished elapsedMs=${Date.now() - startedAt} changed=${changedCount} mode=${this.owner.mode}`,
    )

    if (this.pending && !this.running) {
      void this.run()
    }
  }
}
