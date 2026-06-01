export function buildDiscoverInstagramPlaceholderAvatar(
  usernameRaw: string,
): string {
  const username = usernameRaw.trim().replace(/^@+/, '')
  const initial = (username.charAt(0) || '?').toUpperCase()
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#833AB4"/><stop offset="50%" stop-color="#E1306C"/><stop offset="100%" stop-color="#F77737"/></linearGradient></defs><rect width="128" height="128" rx="32" fill="url(#ig)"/><text x="64" y="82" text-anchor="middle" fill="white" font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif" font-size="56" font-weight="700">${initial}</text></svg>`)}`
}
