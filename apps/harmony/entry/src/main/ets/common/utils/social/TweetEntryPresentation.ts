import { extractPictureCarouselMediaUrls } from '../PictureGallery.ts'
import { normalizeSocialFeedTitle } from './SocialFeedTitles.ts'
import {
  formatPublishedLabel,
  normalizedPlainText,
  normalizeParagraphWhitespace,
  trimValue,
  uniqueUrls,
} from './TweetTextNormalization.ts'
import {
  extractDisplayName,
  extractMetrics,
  extractText,
  extractUsername,
  normalizeUsernameLabel,
  preferredSourceAvatarUrl,
  xAvatarUrl,
} from './TweetSourceExtraction.ts'
import type { TweetPresentationSource } from './TweetSourceExtraction.ts'
import {
  parseNitterRetweetFromTitle,
  parseRetweet,
  parseRetweetAuthorFromTitle,
  stripDuplicatedRetweetLeadingBadge,
} from './TweetRetweetParsing.ts'
import {
  findFirstParsedQuote,
  parseRetweetWithNestedQuote,
} from './TweetQuoteParsing.ts'
import type { TweetQuotedPresentation } from './TweetQuoteParsing.ts'

export type { TweetQuotedPresentation } from './TweetQuoteParsing.ts'

export interface TweetEntryPresentation {
  kind: 'tweet' | 'retweet' | 'quote'
  retweetStyle: 'pure' | 'commented' | ''
  displayName: string
  username: string
  avatarUrl: string
  text: string
  mediaUrls: string[]
  publishedLabel: string
  articleUrl: string
  replyCount: string
  repostCount: string
  likeCount: string
  viewCount: string
  retweetByLabel: string
  quotedTweet?: TweetQuotedPresentation
}

function basePresentation(
  source: TweetPresentationSource,
): TweetEntryPresentation {
  const mediaUrls = uniqueUrls([
    ...extractPictureCarouselMediaUrls({
      summary: source.summary || '',
      content: source.content || '',
      articleUrl: source.articleUrl || '',
      siteUrl: source.articleUrl || '',
      mediaUrls: source.mediaUrls ?? [],
    }),
    ...(trimValue(source.imageUrl) ? [source.imageUrl ?? ''] : []),
  ])
  const textSource = `${source.summary || ''}\n${source.content || ''}`
  const metrics = extractMetrics(textSource)
  return {
    kind: 'tweet',
    retweetStyle: '',
    displayName: extractDisplayName(source),
    username: extractUsername(source),
    avatarUrl: preferredSourceAvatarUrl(source),
    text: extractText(source.summary || '', source.content || ''),
    mediaUrls,
    publishedLabel:
      trimValue(source.publishedLabel) ||
      formatPublishedLabel(source.publishedAt),
    articleUrl: trimValue(source.articleUrl),
    replyCount: metrics.replyCount,
    repostCount: metrics.repostCount,
    likeCount: metrics.likeCount,
    viewCount: metrics.viewCount,
    retweetByLabel: '',
    quotedTweet: undefined,
  }
}

function applyRetweetSemantics(
  base: TweetEntryPresentation,
  source: TweetPresentationSource,
): TweetEntryPresentation | undefined {
  const rawText = normalizedPlainText(
    `${source.summary || ''}\n${source.content || ''}`,
  )
  let parsedRetweet = parseRetweet(rawText)

  // Nitter RSS format: "RT by @<retweeter>: <text>" lives in the <title>
  // field, not in <description>. Fall back to title-based detection.
  if (!parsedRetweet) {
    parsedRetweet = parseNitterRetweetFromTitle(source.title || '')
  }

  if (!parsedRetweet) {
    return undefined
  }

  const isNitterRetweet =
    !trimValue(parsedRetweet.originalDisplayName) &&
    !trimValue(parsedRetweet.originalUsername)

  let nestedQuoteRetweet = parseRetweetWithNestedQuote(source)

  // Fallback: for Nitter retweets where the main text isn't itself a retweet
  // but the HTML content contains a quoted blockquote (e.g., a retweet of a
  // tweet that quotes another user's tweet). Extract the quoted tweet from
  // the HTML so QuotedTweetRenderer can render a nested retweet card.
  if (!nestedQuoteRetweet && isNitterRetweet) {
    const htmlQuote = findFirstParsedQuote(source)
    if (htmlQuote) {
      nestedQuoteRetweet = {
        retweet: parsedRetweet,
        quotedTweet: htmlQuote.quotedTweet,
      }
    }
  }

  const parsed = nestedQuoteRetweet?.retweet || parsedRetweet

  // For Nitter retweets, the original author comes from <dc:creator>
  // (source.author), not from the title.
  const nitterAuthor = isNitterRetweet
    ? trimValue(source.author || '').replace(/^@/, '')
    : ''
  const nitterUsername = isNitterRetweet ? trimValue(source.author || '') : ''

  const originalAuthorLabel =
    trimValue(parsed.originalDisplayName) ||
    trimValue(parsed.originalUsername).replace(/^@/, '') ||
    nitterAuthor ||
    ''
  const normalizedOriginalText = normalizeParagraphWhitespace(
    parsed.originalText,
  )
  const originalAvatarUrl =
    parsed.originalAvatarUrl ||
    xAvatarUrl(parsed.originalUsername) ||
    xAvatarUrl(nitterUsername)
  const titleAuthor = parseRetweetAuthorFromTitle(source.title || '')
  // For Nitter retweets, the titleAuthor identifies the RETWEETER (e.g., "elonmusk"
  // from "RT by @elonmusk:"), not the original author. Skip it for displayName.
  const resolvedOriginalDisplayName = isNitterRetweet
    ? originalAuthorLabel
    : trimValue(titleAuthor?.displayName) || originalAuthorLabel
  const resolvedOriginalUsername = isNitterRetweet
    ? nitterUsername || trimValue(parsed.originalUsername)
    : trimValue(titleAuthor?.username) || trimValue(parsed.originalUsername)
  const resolvedOriginalAvatarUrl =
    xAvatarUrl(resolvedOriginalUsername) || originalAvatarUrl
  const resolvedOriginalText = stripDuplicatedRetweetLeadingBadge(
    resolvedOriginalDisplayName,
    normalizedOriginalText,
  )

  if (nestedQuoteRetweet) {
    const normalizedCommentText = normalizeParagraphWhitespace(
      parsed.commentText,
    )
    const nestedQuotedMediaUrls = uniqueUrls(
      nestedQuoteRetweet.quotedTweet.mediaUrls || [],
    )
    const outerQuotedMediaUrls = uniqueUrls(
      (base.mediaUrls || []).filter(
        (url: string) => !nestedQuotedMediaUrls.includes(url),
      ),
    )
    const outerDisplayName =
      resolvedOriginalDisplayName ||
      resolvedOriginalUsername.replace(/^@/, '') ||
      '转发推文'
    const outerAvatarUrl =
      resolvedOriginalAvatarUrl || xAvatarUrl(resolvedOriginalUsername)

    return {
      ...base,
      kind: 'retweet',
      retweetStyle: normalizedCommentText ? 'commented' : 'pure',
      retweetByLabel: base.displayName,
      text: normalizedCommentText,
      mediaUrls: [],
      quotedTweet: {
        displayName: outerDisplayName,
        username: resolvedOriginalUsername,
        avatarUrl: outerAvatarUrl,
        text: resolvedOriginalText,
        mediaUrls: outerQuotedMediaUrls,
        nestedQuotedTweet: {
          displayName:
            nestedQuoteRetweet.quotedTweet.displayName ||
            nestedQuoteRetweet.quotedTweet.username.replace(/^@/, '') ||
            '引用推文',
          username: nestedQuoteRetweet.quotedTweet.username,
          avatarUrl:
            nestedQuoteRetweet.quotedTweet.avatarUrl ||
            xAvatarUrl(nestedQuoteRetweet.quotedTweet.username),
          text: nestedQuoteRetweet.quotedTweet.text,
          mediaUrls: nestedQuotedMediaUrls,
        },
      },
    }
  }

  const quotedTweet: TweetQuotedPresentation = {
    displayName: resolvedOriginalDisplayName,
    username: resolvedOriginalUsername,
    avatarUrl: resolvedOriginalAvatarUrl,
    text: resolvedOriginalText,
    mediaUrls: [...(base.mediaUrls || [])],
  }

  if (parsed.style === 'commented') {
    const commentText = normalizeParagraphWhitespace(parsed.commentText)
    return {
      ...base,
      kind: 'retweet',
      retweetStyle: 'commented',
      retweetByLabel: base.displayName,
      text: commentText,
      mediaUrls: [],
      quotedTweet,
    }
  }

  return {
    ...base,
    kind: 'retweet',
    retweetStyle: 'pure',
    retweetByLabel: base.displayName,
    text: '',
    mediaUrls: [],
    quotedTweet,
  }
}

function applyQuoteSemantics(
  base: TweetEntryPresentation,
  source: TweetPresentationSource,
): TweetEntryPresentation | undefined {
  const parsed = findFirstParsedQuote(source)
  if (!parsed) {
    return undefined
  }

  const quotedMediaUrls = parsed.quotedTweet.mediaUrls || []
  const mediaUrls =
    quotedMediaUrls.length > 0
      ? (base.mediaUrls || []).filter(
          (url: string) => !quotedMediaUrls.includes(url),
        )
      : base.mediaUrls

  return {
    ...base,
    kind: 'quote',
    text: parsed.mainText,
    mediaUrls,
    quotedTweet: parsed.quotedTweet,
  }
}

function presentTweetEntryFromSource(
  source: TweetPresentationSource,
): TweetEntryPresentation {
  const base = basePresentation(source)
  return (
    applyRetweetSemantics(base, source) ||
    applyQuoteSemantics(base, source) ||
    base
  )
}

export function presentTweetEntryFromEntry(
  entry: {
    title?: string
    summary?: string
    content?: string
    author?: string
    articleUrl?: string
    imageUrl?: string
    publishedAt?: number
    publishedLabel?: string
    mediaUrls?: string[]
  },
  avatarUrl: string,
  feedDisplayName: string = '',
): TweetEntryPresentation {
  const presentation = presentTweetEntryFromSource({
    ...entry,
    avatarUrl,
  })
  return applyResolvedDisplayName(presentation, feedDisplayName)
}

export function presentTweetEntryFromCard(card: {
  title?: string
  summary?: string
  content?: string
  author?: string
  articleUrl?: string
  imageUrl?: string
  feedImageUrl?: string
  feedTitle?: string
  publishedAt?: number
  publishedLabel?: string
  mediaUrls?: string[]
}): TweetEntryPresentation {
  const source = {
    ...card,
    avatarUrl: card.feedImageUrl,
  }
  const presentation = presentTweetEntryFromSource(source)
  const sourceAvatarUrl = preferredSourceAvatarUrl(source)

  const feedDisplayName = resolveFeedDisplayName(
    card.feedTitle || '',
    card.articleUrl || '',
  )

  return {
    ...applyResolvedDisplayName(
      presentation,
      feedDisplayName || presentation.displayName,
    ),
    username:
      presentation.username || normalizeUsernameLabel(extractUsername(source)),
    avatarUrl: sourceAvatarUrl || presentation.avatarUrl,
  }
}

function applyResolvedDisplayName(
  presentation: TweetEntryPresentation,
  displayName: string,
): TweetEntryPresentation {
  const normalizedDisplayName = normalizeFinalDisplayName(displayName)
  if (!normalizedDisplayName) {
    return presentation
  }

  return {
    ...presentation,
    displayName: normalizedDisplayName,
    retweetByLabel: presentation.retweetByLabel
      ? normalizedDisplayName
      : presentation.retweetByLabel,
  }
}

function normalizeFinalDisplayName(value: string): string {
  const trimmed = trimValue(value)
  if (!trimmed) {
    return ''
  }

  return trimmed
    .replace(/\s*[/-]\s*@\s*[a-z0-9_]{1,15}\s*$/i, '')
    .replace(/\s+@\s*[a-z0-9_]{1,15}\s*$/i, '')
    .replace(/\s*-\s*ins\s*$/i, '')
    .trim()
}

function resolveFeedDisplayName(feedTitle: string, articleUrl: string): string {
  const trimmed = (feedTitle || '').trim()
  if (!trimmed) {
    return ''
  }
  const normalized = normalizeSocialFeedTitle(trimmed, articleUrl, '')
  return normalized
    .replace(/\s*-\s*ins\s*$/i, '')
    .replace(/\s+@[a-z0-9_]{1,15}\s*$/i, '')
    .trim()
}
