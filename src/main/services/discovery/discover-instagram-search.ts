export const INSTAGRAM_DISCOVER_PROFILE_TIMEOUT_MS = 1600

export interface InstagramDiscoverCandidateShape {
  username: string
  title: string
  description: string
  image: string
  feedUrl: string
}

export function buildInstagramDiscoverAvatar(usernameRaw: string): string {
  const username = usernameRaw.trim().replace(/^@+/, '')
  if (!username) return ''
  return `https://unavatar.io/instagram/${encodeURIComponent(username)}?fallback=false`
}

export function createInstagramDiscoverCandidate(params: {
  username: string
  rsshubInstance: string
  displayName?: string
  description?: string
}): InstagramDiscoverCandidateShape {
  const username = params.username.trim().replace(/^@+/, '')
  const displayName = (params.displayName || '').trim()
  return {
    username,
    title: displayName
      ? `${displayName} (@${username}) - Instagram`
      : `${username} - Instagram`,
    description: params.description || 'Instagram user',
    image: buildInstagramDiscoverAvatar(username),
    feedUrl: `${params.rsshubInstance}/instagram/user/${encodeURIComponent(username)}`,
  }
}
