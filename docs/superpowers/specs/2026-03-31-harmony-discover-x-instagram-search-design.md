# Harmony Discover X / Instagram Search Design

## Goal

Enhance the HarmonyOS Discover page so searching for X and Instagram users behaves closer to the desktop app:

- support remote lookup for X users
- support remote lookup for Instagram users
- return richer candidate metadata
- keep the existing Discover page flow unchanged

## Scope

In scope:

- extend Harmony discover remote search service to search X and Instagram
- enrich X results with follower text when available
- enrich X and Instagram results with avatar URLs when available
- preserve existing candidate rendering and subscribe flow
- dedupe and rank remote results in the service layer

Out of scope:

- redesign Discover page UI
- add new navigation destinations
- change subscription persistence logic
- add account-login coupling for discover search

## Existing Structure

The Harmony Discover feature already has:

- query and platform state in `DiscoverContent`
- a common candidate model in `ResolvedDiscoverCandidate`
- preview and subscribe-config navigation already wired
- remote search implemented only for YouTube and Bilibili in `DiscoverRemoteSearchService`

This means the missing work is primarily service-side.

## Proposed Approach

Use the current architecture and only extend `DiscoverRemoteSearchService`.

### X search

- search public X profile candidates from lightweight remote sources
- build candidates as RSSHub X user feeds
- fill `siteUrl` with canonical `https://x.com/{username}`
- fill `imageUrl` when an avatar can be resolved
- fill `description` with follower text when available, otherwise use a platform label

### Instagram search

- search public Instagram profile candidates from lightweight remote sources
- build candidates as RSSHub Instagram user feeds
- fill `siteUrl` with canonical `https://www.instagram.com/{username}/`
- fill `imageUrl` when an avatar can be resolved
- fill `description` with follower text or a readable fallback label

### Result handling

- keep `ResolvedDiscoverCandidate` as the only output model
- dedupe by `targetUrl`
- score exact/startsWith/includes matches higher
- cap total results to a small list to keep the page responsive

## Data Flow

1. User enters a query in `DiscoverContent`.
2. `DiscoverContent.refreshRemoteResults()` calls `DiscoverRemoteSearchService.search(query, platform)`.
3. The service conditionally runs X and Instagram remote search tasks in parallel with existing YouTube and Bilibili tasks.
4. The service normalizes, scores, dedupes, and returns candidates.
5. `DiscoverContent` renders the returned candidates without platform-specific UI changes.

## Error Handling

- treat each platform probe as best-effort
- return partial results when one source fails
- swallow remote parsing errors inside the service and keep the page usable
- always destroy Harmony `http` request instances in `finally`

## Verification Plan

- type-check the Harmony app if the local toolchain supports it
- inspect that X platform search returns RSSHub X candidates with canonical `x.com` links
- inspect that Instagram platform search returns RSSHub Instagram candidates with canonical Instagram links
- confirm candidate rows still open preview and subscribe-config flows without UI changes

## Risks

- public X and Instagram pages may change markup, so parsing should stay defensive
- some avatar endpoints may fail or rate-limit, so image enrichment must be optional
- follower text may not always be available, especially for X

## Acceptance Criteria

- searching under `X` returns real remote user candidates, not only keyword-generated placeholders
- searching under `Instagram` returns real remote user candidates, not only keyword-generated placeholders
- X results prefer follower text in the description when it can be resolved
- X and Instagram results show avatars when resolvable
- existing Discover preview and subscription flows keep working
