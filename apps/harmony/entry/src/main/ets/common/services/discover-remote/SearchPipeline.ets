import {
  DiscoverRemoteProfileSeed,
  DiscoverRemoteViewMapping,
  dedupeAndLimitDiscoverCandidates,
} from '../../coordinators/discover/DiscoverRemoteSearchParsing'
import { ResolvedDiscoverCandidate } from '../discover/DiscoverTypes'
import { buildSocialQueryVariants, dedupeCandidates, withConfiguredRssHubCandidate } from './SharedSearchHelpers'

export type SocialPrimarySearch = (query: string) => Promise<DiscoverRemoteProfileSeed[]>
export type SocialProfileFetch = (username: string) => Promise<DiscoverRemoteProfileSeed | undefined>
export type SocialCandidateBuilder = (seed: DiscoverRemoteProfileSeed, viewMapping: DiscoverRemoteViewMapping) => ResolvedDiscoverCandidate

export async function runSocialProfileSearch(
  query: string,
  rsshubBase: string,
  primarySearch: SocialPrimarySearch,
  fetchProfile: SocialProfileFetch,
  buildCandidate: SocialCandidateBuilder,
  viewMapping: DiscoverRemoteViewMapping,
  maxResults: number = 12,
): Promise<ResolvedDiscoverCandidate[]> {
  const clean = query.trim().replace(/^@+/, '')
  const searchSeeds = await primarySearch(clean)

  const variants = buildSocialQueryVariants(query, 30)
  const profileResults = await Promise.allSettled(
    variants.map((username: string) => fetchProfile(username)),
  )

  const fallbackSeeds: DiscoverRemoteProfileSeed[] = []
  profileResults.forEach((result: PromiseSettledResult<DiscoverRemoteProfileSeed | undefined>) => {
    if (result.status === 'fulfilled' && result.value) {
      fallbackSeeds.push(result.value)
    }
  })

  const dedupedSeeds = dedupeAndLimitDiscoverCandidates(
    [...searchSeeds, ...fallbackSeeds],
    maxResults,
  )

  const candidates = dedupedSeeds.map((seed: DiscoverRemoteProfileSeed) =>
    withConfiguredRssHubCandidate(
      buildCandidate(seed, viewMapping),
      rsshubBase,
    ),
  )

  return dedupeCandidates(candidates).slice(0, maxResults)
}
