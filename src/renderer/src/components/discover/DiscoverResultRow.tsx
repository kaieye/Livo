import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ExternalLink,
  Loader2,
  Plus,
  Rss,
  ShieldAlert,
  X,
} from 'lucide-react'
import type { DiscoverSearchResult } from '../../lib/discover-search'
import { buildDiscoverInstagramPlaceholderAvatar } from '../../lib/discover-avatar'
import { inferDiscoverPlatform } from '../../lib/discover-platform-presentation'
import { openExternalUrlSafe } from '../../services/external-url'

/**
 * Visual representation of a single Discover search result.
 *
 * The row supports two interactions:
 * - Clicking the row body navigates to the preview page (`onOpenPreview`).
 * - Clicking the subscribe/unsubscribe button toggles subscription independently
 *   via `onToggleSubscribe`. Button click propagation is stopped so that pressing
 *   subscribe does NOT also trigger row navigation.
 */
export function DiscoverResultRow({
  result,
  subscribed,
  subscribing,
  /** Show a "Sign in required" hint next to the platform badge. */
  requiresSignIn,
  /** Label for the subscribe action when not yet subscribed. */
  subscribeLabel,
  onOpenPreview,
  onToggleSubscribe,
}: {
  result: DiscoverSearchResult
  subscribed: boolean
  subscribing: boolean
  requiresSignIn?: boolean
  subscribeLabel?: string
  onOpenPreview: () => void
  onToggleSubscribe: () => void
}) {
  const { t } = useTranslation()
  const platform = useMemo(
    () => inferDiscoverPlatform(result.url, result.metadata),
    [result.metadata, result.url],
  )
  const isInstagram = platform.id === 'instagram'

  const title = useMemo(() => normalizeTitle(result), [result])
  const normalized = useMemo(
    () =>
      isInstagram
        ? normalizeInstagramCardContent({
            title,
            url: result.url,
            description: result.description,
            followers: result.followers,
          })
        : null,
    [isInstagram, title, result.url, result.description, result.followers],
  )

  const displayTitle = normalized?.title || title
  const displayDescription = normalized?.description || result.description
  const displayFollowers =
    normalized?.followers || normalizeFollowersLabel(result.followers)

  const avatarCandidates = useMemo(
    () => buildDiscoverAvatarFallbacks(result.image, result.url),
    [result.image, result.url],
  )
  const placeholderAvatarLabel = useMemo(() => {
    const usernameFromUrl = extractInstagramUsernameFromFeedUrl(result.url)
    return usernameFromUrl || title || result.url
  }, [result.url, title])
  const instagramPlaceholderAvatar = useMemo(() => {
    if (!isInstagram) return ''
    return buildDiscoverInstagramPlaceholderAvatar(placeholderAvatarLabel)
  }, [isInstagram, placeholderAvatarLabel])
  const [avatarSrc, setAvatarSrc] = useState<string>(
    isInstagram ? instagramPlaceholderAvatar : avatarCandidates[0] || '',
  )

  useEffect(() => {
    if (!isInstagram) {
      setAvatarSrc(avatarCandidates[0] || '')
      return
    }

    let cancelled = false
    let activeLoader: HTMLImageElement | null = null
    setAvatarSrc(instagramPlaceholderAvatar)

    const tryLoad = (index: number) => {
      const candidate = avatarCandidates[index]
      if (!candidate) return
      const loader = new window.Image()
      activeLoader = loader
      loader.onload = () => {
        if (cancelled) return
        setAvatarSrc(candidate)
      }
      loader.onerror = () => {
        if (cancelled) return
        tryLoad(index + 1)
      }
      loader.src = candidate
    }

    tryLoad(0)

    return () => {
      cancelled = true
      if (activeLoader) {
        activeLoader.onload = null
        activeLoader.onerror = null
      }
    }
  }, [avatarCandidates, instagramPlaceholderAvatar, isInstagram])

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpenPreview()
    }
  }

  const stopAndRun =
    (handler: () => void) => (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation()
      handler()
    }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenPreview}
      onKeyDown={handleRowKeyDown}
      className="hover:border-accent/30 hover:bg-surface-secondary/50 focus:ring-accent/50 dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary/50 group flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3.5 transition-all duration-200 focus:outline-none focus:ring-2"
    >
      {/* Avatar */}
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt=""
          className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
          loading="lazy"
          onError={(e) => {
            if (isInstagram) {
              setAvatarSrc(instagramPlaceholderAvatar)
              return
            }
            const current = e.currentTarget.currentSrc || e.currentTarget.src
            const idx = avatarCandidates.findIndex(
              (candidate) => candidate === current,
            )
            const next =
              idx >= 0 ? avatarCandidates[idx + 1] : avatarCandidates[1]
            if (next) {
              setAvatarSrc(next)
              return
            }
            setAvatarSrc('')
          }}
        />
      ) : (
        <div className="bg-accent/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
          <Rss size={16} className="text-accent" />
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="block min-w-0 truncate text-sm font-medium">
            {displayTitle}
          </span>
          <span
            className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
            style={{
              backgroundColor: platform.color,
              color: '#FFFFFF',
            }}
          >
            {platform.label}
          </span>
          {requiresSignIn && (
            <span
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300"
              title={t('discover.signInRequired')}
            >
              <ShieldAlert size={10} />
              {t('discover.signInRequired')}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {displayFollowers && (
            <span className="text-text-secondary dark:text-text-dark-secondary flex-shrink-0 text-xs font-medium">
              {displayFollowers}
            </span>
          )}
          {displayFollowers && displayDescription && (
            <span
              aria-hidden="true"
              className="text-text-tertiary flex-shrink-0 text-xs"
            >
              ·
            </span>
          )}
          {displayDescription && (
            <p className="text-text-secondary dark:text-text-dark-secondary truncate text-xs">
              {displayDescription}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void openExternalUrlSafe(result.url)
          }}
          className="text-text-tertiary hover:bg-surface-secondary hover:text-text-secondary dark:hover:bg-surface-dark-tertiary rounded-lg p-1.5 opacity-0 transition-colors focus:opacity-100 group-hover:opacity-100"
          title={t('discover.viewSource')}
        >
          <ExternalLink size={14} />
        </a>
        <button
          type="button"
          onClick={stopAndRun(onToggleSubscribe)}
          disabled={subscribing}
          className={`group/btn flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ${
            subscribed
              ? 'bg-green-100 text-green-600 hover:bg-red-100 hover:text-red-600 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-red-900/30 dark:hover:text-red-400'
              : 'bg-accent hover:bg-accent-hover text-white active:scale-95'
          } disabled:cursor-default disabled:opacity-70`}
        >
          {subscribing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : subscribed ? (
            <>
              <Check size={12} className="group-hover/btn:hidden" />
              <X size={12} className="hidden group-hover/btn:block" />
              <span className="group-hover/btn:hidden">
                {t('common.subscribed')}
              </span>
              <span className="hidden group-hover/btn:block">
                {t('discover.unsubscribeAction')}
              </span>
            </>
          ) : (
            <>
              <Plus size={12} />
              <span>{subscribeLabel || t('common.subscribe')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Title / description normalization helpers
//
// These were previously colocated inside DiscoverPanel as `getDisplayTitle`,
// `normalizeInstagramCardContent`, etc. Moved here so the row can stand on its
// own as a presentational unit consumed by DiscoverPanel and (later) other
// discover surfaces.
// ---------------------------------------------------------------------------

function normalizeTitle(result: DiscoverSearchResult): string {
  const title = (result.title || '').trim()
  if (title && title !== result.url) return title
  return inferResultTitleFromUrl(result.url)
}

function inferResultTitleFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname

    const bili = path.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i)
    if (bili?.[1]) return `UID ${bili[1]} - Bilibili`

    const x = path.match(/\/twitter\/user\/([a-zA-Z0-9_]+)/i)
    if (x?.[1]) return `@${x[1]} - X`

    const ig = path.match(/\/instagram\/user\/([^/?#]+)/i)
    if (ig?.[1]) return `@${decodeURIComponent(ig[1])} - Instagram`

    const host = u.hostname.replace(/^www\./i, '')
    return `${host} - RSS`
  } catch {
    return url
  }
}

export function getDiscoverResultDisplayTitle(result: DiscoverSearchResult) {
  return normalizeTitle(result)
}

function extractInstagramUsernameFromFeedUrl(feedUrl: string): string | null {
  try {
    const u = new URL(feedUrl)
    const m = u.pathname.match(/\/instagram\/user\/([^/?#]+)/i)
    if (m?.[1]) return decodeURIComponent(m[1]).replace(/^@+/, '')
  } catch {
    // Ignore malformed URL.
  }
  return null
}

function normalizeFollowersLabel(raw?: string): string | undefined {
  const text = (raw || '').trim()
  if (!text) return undefined
  if (/followers?/i.test(text) || /粉丝/.test(text)) return text
  const count = text.match(/([\d]+(?:[.,]\d+)?\s*[kmb]?)/i)?.[1]?.trim()
  if (count) return `${count} followers`
  return undefined
}

function extractFollowersFromText(raw?: string): string | undefined {
  const text = (raw || '').trim()
  if (!text) return undefined
  const withWord = text.match(
    /([\d]+(?:[.,]\d+)?\s*[kmb]?\s*(?:followers?|粉丝))/i,
  )?.[1]
  if (withWord) return withWord.trim()
  const countOnly = text.match(/^\s*([\d]+(?:[.,]\d+)?\s*[kmb]?)\s*$/i)?.[1]
  if (countOnly) return `${countOnly.trim()} followers`
  return undefined
}

function normalizeInstagramCardContent(params: {
  title: string
  url: string
  description: string
  followers?: string
}): { title: string; description: string; followers?: string } {
  const { title, url, description, followers } = params
  const usernameFromUrl = extractInstagramUsernameFromFeedUrl(url)
  const userFromParen = title.match(/\(@([a-z0-9._]{1,30})\)/i)?.[1]
  const userFromSimple = title.match(
    /^@?([a-z0-9._]{1,30})\s*-\s*(?:instagram|ins)\b/i,
  )?.[1]
  const username = (
    userFromParen ||
    userFromSimple ||
    usernameFromUrl ||
    ''
  ).trim()
  const displayNameFromTitle =
    title
      .match(/^(.*?)\s*\(@[a-z0-9._]{1,30}\)\s*-\s*instagram\b/i)?.[1]
      ?.trim() ||
    title
      .replace(/\s*-\s*(?:instagram|ins)\s*$/i, '')
      .replace(/^@/, '')
      .trim()

  const normalizedTitle = username
    ? displayNameFromTitle &&
      displayNameFromTitle.toLowerCase() !== username.toLowerCase()
      ? `${displayNameFromTitle} (@${username}) - Instagram`
      : `@${username} - Instagram`
    : title

  const followersLabel =
    normalizeFollowersLabel(followers) ||
    normalizeFollowersLabel(extractFollowersFromText(description))
  const cleanedDescription = followersLabel
    ? description
        .replace(
          /[\s,，]*[\d]+(?:[.,]\d+)?\s*[kmb]?\s*(?:followers?|粉丝)[\s,，]*/gi,
          ' ',
        )
        .replace(/\s+/g, ' ')
        .trim()
    : description

  return {
    title: normalizedTitle,
    description: cleanedDescription || description,
    followers: followersLabel,
  }
}

function buildDiscoverAvatarFallbacks(
  imageUrl: string | undefined,
  feedUrl: string,
): string[] {
  const out: string[] = []
  if (imageUrl) out.push(imageUrl)

  const igUser = extractInstagramUsernameFromFeedUrl(feedUrl)
  if (igUser) {
    out.push(
      `https://unavatar.io/instagram/${encodeURIComponent(igUser)}?fallback=false`,
    )
    out.push(
      `https://unavatar.io/${encodeURIComponent(`instagram.com/${igUser}`)}?fallback=false`,
    )
  }

  const seen = new Set<string>()
  return out.filter((x) => {
    const key = x.trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
