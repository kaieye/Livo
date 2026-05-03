import { PictureCarouselMediaItem } from './PictureGallery.ts'
import { TweetQuotedPresentation } from './TweetEntryPresentation.ts'
import { inlineMediaItemsFromUrls } from './InlineMediaLayout.ts'

const QUOTED_TWEET_COLLAPSED_LINES: number = 8
const QUOTED_TWEET_COLLAPSE_CHAR_THRESHOLD: number =
  QUOTED_TWEET_COLLAPSED_LINES * 24

export interface QuotedTweetMediaView {
  inlineNameLabel: string
  mediaItems: PictureCarouselMediaItem[]
  hasSingleVideoMedia: boolean
  primaryMediaItem: PictureCarouselMediaItem
}

export function emptyQuotedTweetPresentation(): TweetQuotedPresentation {
  return {
    displayName: '',
    username: '',
    avatarUrl: '',
    text: '',
    mediaUrls: [],
  }
}

function emptyMediaItem(): PictureCarouselMediaItem {
  return { kind: 'image', imageUrl: '', videoUrl: '' }
}

export function quotedInlineNameLabel(quoted: TweetQuotedPresentation): string {
  const name =
    (quoted.displayName || '').trim() ||
    (quoted.username || '').trim() ||
    '未知来源'
  return name.endsWith(':') ? name : `${name}:`
}

export function quotedTweetMediaView(
  quoted: TweetQuotedPresentation,
): QuotedTweetMediaView {
  const mediaItems = inlineMediaItemsFromUrls(quoted.mediaUrls || [])
  const hasSingleVideoMedia =
    mediaItems.length === 1 && !!(mediaItems[0].videoUrl || '').trim()
  const primaryMediaItem =
    mediaItems.length > 0 ? mediaItems[0] : emptyMediaItem()
  return {
    inlineNameLabel: quotedInlineNameLabel(quoted),
    mediaItems,
    hasSingleVideoMedia,
    primaryMediaItem,
  }
}

export function quotedShouldShowExpandAction(
  text: string,
  isExpanded: boolean,
): boolean {
  if (isExpanded) {
    return false
  }

  const trimmed = (text || '').trim()
  if (!trimmed) {
    return false
  }

  const lineBreakCount = (trimmed.match(/\n/g) || []).length + 1
  if (lineBreakCount > QUOTED_TWEET_COLLAPSED_LINES) {
    return true
  }

  return trimmed.length > QUOTED_TWEET_COLLAPSE_CHAR_THRESHOLD
}

export function quotedResolvedTextMaxLines(
  text: string,
  isExpanded: boolean,
): number {
  if (isExpanded) {
    return 99
  }
  return quotedShouldShowExpandAction(text, isExpanded)
    ? QUOTED_TWEET_COLLAPSED_LINES
    : 99
}
