import { ROUTES } from '../router/route-paths'

export type DigestSourceNavigationInput = {
  id: string
  status: 'available' | 'missing'
}

export function getDigestSourceEntryRoute(
  source: DigestSourceNavigationInput,
): string | null {
  return source.status === 'available' ? ROUTES.entry(source.id) : null
}
