import { EntryCardModel } from '../models/LivoModels'
import { presentTweetEntryFromCard, TweetEntryPresentation } from './TweetEntryPresentation'

export class TweetEntryPresentationCache {
  private readonly entries: Map<string, TweetEntryPresentation> = new Map()

  get(entry: EntryCardModel): TweetEntryPresentation {
    const cacheKey = this.cacheKey(entry)
    const cached = this.entries.get(cacheKey)
    if (cached) {
      return cached
    }

    const base = presentTweetEntryFromCard(entry)
    const presentation: TweetEntryPresentation = {
      kind: base.kind,
      retweetStyle: base.retweetStyle,
      displayName: base.displayName,
      username: '',
      avatarUrl: base.avatarUrl,
      text: base.text,
      mediaUrls: base.mediaUrls,
      publishedLabel: base.publishedLabel,
      articleUrl: base.articleUrl,
      replyCount: base.replyCount,
      repostCount: base.repostCount,
      likeCount: base.likeCount,
      viewCount: base.viewCount,
      retweetByLabel: base.retweetByLabel,
      quotedTweet: base.quotedTweet,
    }
    this.entries.set(cacheKey, presentation)
    return presentation
  }

  clear(): void {
    if (this.entries.size === 0) {
      return
    }
    this.entries.clear()
  }

  private cacheKey(entry: EntryCardModel): string {
    const mediaUrls = (entry.mediaUrls ?? []).join('|')
    return [
      entry.id,
      entry.title,
      entry.summary,
      entry.content,
      entry.author,
      entry.articleUrl,
      entry.imageUrl,
      entry.feedImageUrl,
      entry.publishedAt,
      entry.publishedLabel,
      mediaUrls,
    ].join('|')
  }
}
