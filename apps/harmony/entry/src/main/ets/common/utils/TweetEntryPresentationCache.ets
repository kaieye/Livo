import { EntryCardModel } from '../models/LivoModels'
import { presentTweetEntryFromCard, TweetEntryPresentation } from './TweetEntryPresentation'

export interface TweetEntryPresentationCacheDiagnostics {
  onAccess(hit: boolean, elapsedMs: number): void
}

export class TweetEntryPresentationCache {
  private readonly entries: Map<string, TweetEntryPresentation> = new Map()
  private readonly diagnostics: TweetEntryPresentationCacheDiagnostics | undefined

  constructor(diagnostics?: TweetEntryPresentationCacheDiagnostics) {
    this.diagnostics = diagnostics
  }

  get(entry: EntryCardModel): TweetEntryPresentation {
    const startedAt = Date.now()
    const cacheKey = this.cacheKey(entry)
    const cached = this.entries.get(cacheKey)
    if (cached) {
      this.diagnostics?.onAccess(true, Date.now() - startedAt)
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
    this.diagnostics?.onAccess(false, Date.now() - startedAt)
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
      entry.feedTitle,
      entry.publishedAt,
      entry.publishedLabel,
      mediaUrls,
    ].join('|')
  }
}
