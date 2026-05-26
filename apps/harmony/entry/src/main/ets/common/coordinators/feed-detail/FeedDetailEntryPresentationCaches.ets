import { Entry } from '../../models/LivoModels'
import { presentTweetEntryFromEntry, TweetEntryPresentation } from '../../utils/social/TweetEntryPresentation'
import {
  collectFeedDetailEntryVersionKeys,
  FeedDetailEntryScopedCache,
  feedDetailEntryVersionCacheKey,
} from './FeedDetailEntryCaches'

function withTweetAvatarUrl(
  presentation: TweetEntryPresentation,
  avatarUrl: string,
): TweetEntryPresentation {
  return {
    kind: presentation.kind,
    retweetStyle: presentation.retweetStyle,
    displayName: presentation.displayName,
    username: presentation.username,
    avatarUrl,
    text: presentation.text,
    mediaUrls: presentation.mediaUrls,
    publishedLabel: presentation.publishedLabel,
    articleUrl: presentation.articleUrl,
    replyCount: presentation.replyCount,
    repostCount: presentation.repostCount,
    likeCount: presentation.likeCount,
    viewCount: presentation.viewCount,
    retweetByLabel: presentation.retweetByLabel,
    quotedTweet: presentation.quotedTweet,
  }
}

export class FeedDetailTweetPresentationCache {
  private readonly storage: FeedDetailEntryScopedCache<TweetEntryPresentation> =
    new FeedDetailEntryScopedCache<TweetEntryPresentation>()

  get(entry: Entry, currentAvatarUrl: string, displayNameOverride: string = ''): TweetEntryPresentation {
    const cacheKey = `${feedDetailEntryVersionCacheKey(entry)}|${displayNameOverride.trim()}`
    const cached = this.storage.get(cacheKey)
    if (cached) {
      if (cached.avatarUrl === currentAvatarUrl) {
        return cached
      }
      const withAvatar = withTweetAvatarUrl(cached, currentAvatarUrl)
      this.storage.set(cacheKey, withAvatar)
      return withAvatar
    }

    const generated = presentTweetEntryFromEntry(entry, currentAvatarUrl, displayNameOverride)
    this.storage.set(cacheKey, generated)
    return generated
  }

  reconcile(entries: Entry[]): void {
    this.storage.reconcile(collectFeedDetailEntryVersionKeys(entries))
  }

  clear(): void {
    this.storage.clear()
  }
}

export class FeedDetailPicturePreviewLeadUrlCache {
  private readonly storage: FeedDetailEntryScopedCache<string> =
    new FeedDetailEntryScopedCache<string>()

  get(entry: Entry, resolve: (entry: Entry) => string): string {
    const cacheKey = feedDetailEntryVersionCacheKey(entry)
    const cached = this.storage.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }
    const resolved = resolve(entry)
    this.storage.set(cacheKey, resolved)
    return resolved
  }

  reconcile(entries: Entry[]): void {
    this.storage.reconcile(collectFeedDetailEntryVersionKeys(entries))
  }

  clear(): void {
    this.storage.clear()
  }
}
