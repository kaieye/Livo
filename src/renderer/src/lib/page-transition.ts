/**
 * Maps a router pathname to a "transition group" key for page enter animations.
 *
 * The desktop app is an SPA: Harmony's native page-stack transitions
 * (PageTransitionEnter/Exit) don't apply, so view changes are animated via a
 * keyed wrapper around the router `<Outlet />` (see `PageTransition`).
 *
 * All home-family routes ("/", "/starred", "/discover", "/settings",
 * "/:viewType", "/feed/:id", "/:viewType/feed/:id") share the "home" key so
 * switching content view types does NOT remount the heavy HomePage (preserving
 * scroll position and prefetch caches). Distinct pages get their own group key
 * so navigating to them plays an enter animation.
 */
export function getTransitionKey(pathname: string): string {
  const path = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
  if (path === '') return 'home'

  const [first, second] = path.split('/')
  switch (first) {
    case 'entry':
      return 'entry'
    case 'video':
      return 'video'
    case 'image':
      return 'image'
    case 'login':
      return 'login'
    case 'discover':
      if (second === 'preview') return 'discover-preview'
      if (second === 'subscribe') return 'discover-subscribe'
      return 'home'
    default:
      // Home family: starred, settings, feed/:id, :viewType, :viewType/feed/:id
      return 'home'
  }
}
