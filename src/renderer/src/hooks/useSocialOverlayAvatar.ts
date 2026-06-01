import { useEffect, useMemo, useState } from 'react'

export function useSocialOverlayAvatar({
  entryId,
  author,
  feedTitle,
  authorAvatar,
  feedImageUrl,
  feedSiteUrl,
  feedUrl,
  normalizeInstagramUnavatar,
  isGenericInstagramIconUrl,
  extractPixnoyOriginUrl,
  normalizeImageCacheKey,
}: {
  entryId: string
  author?: string
  feedTitle?: string
  authorAvatar?: string
  feedImageUrl?: string
  feedSiteUrl?: string
  feedUrl?: string
  normalizeInstagramUnavatar: (value: string) => string
  isGenericInstagramIconUrl: (value: string) => boolean
  extractPixnoyOriginUrl: (value: string) => string
  normalizeImageCacheKey: (value: string) => string
}) {
  const twitterAvatar = useMemo(() => {
    const urls = [feedSiteUrl, feedUrl].filter(Boolean) as string[]
    for (const u of urls) {
      try {
        const { hostname, pathname } = new URL(u)
        if (
          hostname === 'x.com' ||
          hostname === 'twitter.com' ||
          hostname === 'www.x.com' ||
          hostname === 'www.twitter.com'
        ) {
          const username = pathname.split('/').filter(Boolean)[0]
          if (username && /^[a-zA-Z0-9_]+$/.test(username)) {
            return `https://unavatar.io/x/${username}`
          }
        }
      } catch {}
      const m = u.match(/\/twitter\/user\/([a-zA-Z0-9_]+)/i)
      if (m) return `https://unavatar.io/x/${m[1]}`
    }
    return null
  }, [feedSiteUrl, feedUrl])

  const cleanAuthorAvatar = useMemo(() => {
    const candidate = normalizeInstagramUnavatar(authorAvatar || '')
    return candidate && !isGenericInstagramIconUrl(candidate) ? candidate : ''
  }, [authorAvatar, isGenericInstagramIconUrl, normalizeInstagramUnavatar])

  const cleanFeedImage = useMemo(() => {
    const candidate = normalizeInstagramUnavatar(feedImageUrl || '')
    return candidate && !isGenericInstagramIconUrl(candidate) ? candidate : ''
  }, [feedImageUrl, isGenericInstagramIconUrl, normalizeInstagramUnavatar])

  const avatarCandidates = useMemo(() => {
    const candidates = [
      twitterAvatar || '',
      cleanAuthorAvatar,
      extractPixnoyOriginUrl(cleanAuthorAvatar),
      cleanFeedImage,
      extractPixnoyOriginUrl(cleanFeedImage),
    ]
    const unique: string[] = []
    for (const c of candidates) {
      const candidate = (c || '').trim()
      if (!candidate) continue
      if (!/^https?:\/\//i.test(candidate)) continue
      const key = normalizeImageCacheKey(candidate)
      if (unique.some((u) => normalizeImageCacheKey(u) === key)) continue
      unique.push(candidate)
    }
    return unique
  }, [
    cleanAuthorAvatar,
    cleanFeedImage,
    extractPixnoyOriginUrl,
    normalizeImageCacheKey,
    twitterAvatar,
  ])

  const [avatarImageFailed, setAvatarImageFailed] = useState(false)
  const [avatarCandidateIndex, setAvatarCandidateIndex] = useState(0)

  useEffect(() => {
    setAvatarImageFailed(false)
    setAvatarCandidateIndex(0)
  }, [entryId, avatarCandidates])

  const avatarUrl = avatarCandidates[avatarCandidateIndex] || ''
  const avatarLetter = (author || feedTitle || '?')[0]

  const handleAvatarError = () => {
    const nextIndex = avatarCandidateIndex + 1
    if (nextIndex < avatarCandidates.length) {
      setAvatarCandidateIndex(nextIndex)
      return
    }
    setAvatarImageFailed(true)
  }

  return {
    avatarUrl,
    avatarLetter,
    avatarImageFailed,
    handleAvatarError,
  }
}
