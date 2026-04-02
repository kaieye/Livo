# Harmony Discover X / Instagram Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add desktop-like X and Instagram remote search support to the Harmony Discover page, including avatars, X follower text, and service-layer ranking/deduplication.

**Architecture:** Keep `DiscoverContent` unchanged and extend the existing Harmony discover service. Move platform parsing and ranking into a small testable helper module so we can follow TDD with `node:test`, then wire the `.ets` service to call the new helpers and remote probes.

**Tech Stack:** ArkTS, Harmony `@ohos.net.http`, existing Harmony Discover service, Node `node:test`, TypeScript helper modules under `entry/src/main/ets/common/utils`

---

## File Map

- Modify: `apps/harmony/entry/src/main/ets/common/services/DiscoverRemoteSearchService.ets`
  - Extend remote search from `youtube/bilibili` to `x/instagram`
  - Reuse helper functions for parsing, normalization, ranking, and candidate building
- Create: `apps/harmony/entry/src/main/ets/common/utils/DiscoverRemoteSearchParsing.ts`
  - Pure parsing and ranking helpers for X and Instagram payloads
  - Candidate normalization helpers used by the Harmony remote search service
- Create: `apps/harmony/tests/discover-remote-search-parsing.test.ts`
  - Regression tests for X/Instagram parsing, follower extraction, ranking, and dedupe behavior

### Task 1: Add Failing Tests For X / Instagram Parsing

**Files:**
- Create: `apps/harmony/tests/discover-remote-search-parsing.test.ts`
- Test target: `apps/harmony/entry/src/main/ets/common/utils/DiscoverRemoteSearchParsing.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildXCandidateFromProfile,
  buildInstagramCandidateFromProfile,
  dedupeAndLimitDiscoverCandidates,
  extractXFollowersFromText,
  parseInstagramProfilesFromSearchHtml,
  parseXProfilesFromSearchHtml,
} from '../entry/src/main/ets/common/utils/DiscoverRemoteSearchParsing.ts'
import { FeedViewType } from '../entry/src/main/ets/common/models/LivoModels.ets'

test('extractXFollowersFromText parses compact follower labels', () => {
  assert.equal(
    extractXFollowersFromText('OpenAI · 1.2M Followers · Following 12'),
    '1.2M followers',
  )
  assert.equal(
    extractXFollowersFromText('followers: 987K'),
    '987K followers',
  )
})

test('parseXProfilesFromSearchHtml extracts usernames, display names, avatars and follower text', () => {
  const html = `
    <section>
      <a href="/openai">
        <img src="https://pbs.twimg.com/profile_images/openai.jpg" />
        <span>OpenAI</span>
        <span>@OpenAI</span>
        <span>1.8M Followers</span>
      </a>
    </section>
  `

  const profiles = parseXProfilesFromSearchHtml(html, 'openai')

  assert.equal(profiles.length, 1)
  assert.equal(profiles[0]?.username, 'openai')
  assert.equal(profiles[0]?.title, 'OpenAI')
  assert.equal(profiles[0]?.imageUrl, 'https://pbs.twimg.com/profile_images/openai.jpg')
  assert.equal(profiles[0]?.followers, '1.8M followers')
})

test('parseInstagramProfilesFromSearchHtml extracts profile candidates from embedded links', () => {
  const html = `
    <div>
      <a href="/studiolivo/">
        <img src="https://cdninstagram.com/studiolivo.jpg" />
        <span>Studio Livo</span>
        <span>@studiolivo</span>
      </a>
    </div>
  `

  const profiles = parseInstagramProfilesFromSearchHtml(html, 'studiolivo')

  assert.equal(profiles.length, 1)
  assert.equal(profiles[0]?.username, 'studiolivo')
  assert.equal(profiles[0]?.title, 'Studio Livo')
  assert.equal(profiles[0]?.imageUrl, 'https://cdninstagram.com/studiolivo.jpg')
})

test('buildXCandidateFromProfile emits RSSHub X candidate with follower-first description', () => {
  const candidate = buildXCandidateFromProfile({
    username: 'openai',
    title: 'OpenAI',
    imageUrl: 'https://pbs.twimg.com/profile_images/openai.jpg',
    followers: '1.8M followers',
  })

  assert.equal(candidate.targetUrl, 'https://rsshub.pseudoyu.com/x/user/openai')
  assert.equal(candidate.targetTitle, 'OpenAI')
  assert.equal(candidate.targetView, FeedViewType.SocialMedia)
  assert.equal(candidate.siteUrl, 'https://x.com/openai')
  assert.equal(candidate.description, '1.8M followers')
})

test('buildInstagramCandidateFromProfile emits RSSHub Instagram candidate with canonical profile URL', () => {
  const candidate = buildInstagramCandidateFromProfile({
    username: 'studiolivo',
    title: 'Studio Livo',
    imageUrl: 'https://cdninstagram.com/studiolivo.jpg',
    followers: '',
  })

  assert.equal(candidate.targetUrl, 'https://rsshub.pseudoyu.com/instagram/user/studiolivo')
  assert.equal(candidate.targetTitle, 'Studio Livo')
  assert.equal(candidate.targetView, FeedViewType.Pictures)
  assert.equal(candidate.siteUrl, 'https://www.instagram.com/studiolivo/')
  assert.equal(candidate.description, 'Instagram 用户')
})

test('dedupeAndLimitDiscoverCandidates keeps highest ranked unique candidates first', () => {
  const deduped = dedupeAndLimitDiscoverCandidates([
    buildXCandidateFromProfile({
      username: 'openai',
      title: 'OpenAI',
      imageUrl: '',
      followers: '1.8M followers',
    }),
    buildXCandidateFromProfile({
      username: 'openai',
      title: 'OpenAI Labs',
      imageUrl: '',
      followers: '',
    }),
    buildInstagramCandidateFromProfile({
      username: 'studiolivo',
      title: 'Studio Livo',
      imageUrl: '',
      followers: '',
    }),
  ], 2)

  assert.equal(deduped.length, 2)
  assert.equal(deduped[0]?.targetUrl, 'https://rsshub.pseudoyu.com/x/user/openai')
  assert.equal(deduped[1]?.targetUrl, 'https://rsshub.pseudoyu.com/instagram/user/studiolivo')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/discover-remote-search-parsing.test.ts`
Expected: FAIL with module-not-found for `DiscoverRemoteSearchParsing.ts`

- [ ] **Step 3: Write minimal implementation**

```ts
import { FeedViewType } from '../models/LivoModels.ets'
import type { ResolvedDiscoverCandidate } from '../services/DiscoverService'

export interface SocialRemoteProfile {
  username: string
  title: string
  imageUrl: string
  followers: string
}

export function extractXFollowersFromText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const first = normalized.match(/([\d][\d.,]*\s*[KMB]?)\s*followers?/i)
  if (first?.[1]) return `${first[1].trim()} followers`
  const second = normalized.match(/followers?\s*[:：]?\s*([\d][\d.,]*\s*[KMB]?)/i)
  if (second?.[1]) return `${second[1].trim()} followers`
  return ''
}

export function parseXProfilesFromSearchHtml(html: string, query: string): SocialRemoteProfile[] {
  void query
  const match = html.match(/href="\/([a-zA-Z0-9_]{1,15})"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?(?:followers?|Followers)/i)
  if (!match) return []
  return [{
    username: match[1].toLowerCase(),
    imageUrl: match[2],
    title: match[3].trim(),
    followers: extractXFollowersFromText(match[0]),
  }]
}

export function parseInstagramProfilesFromSearchHtml(html: string, query: string): SocialRemoteProfile[] {
  void query
  const match = html.match(/href="\/([a-zA-Z0-9._]+)\/"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<span>([^<]+)<\/span>/i)
  if (!match) return []
  return [{
    username: match[1].toLowerCase(),
    imageUrl: match[2],
    title: match[3].trim(),
    followers: '',
  }]
}

export function buildXCandidateFromProfile(profile: SocialRemoteProfile): ResolvedDiscoverCandidate {
  return {
    targetUrl: `https://rsshub.pseudoyu.com/x/user/${encodeURIComponent(profile.username)}`,
    targetTitle: profile.title,
    targetView: FeedViewType.SocialMedia,
    description: profile.followers || 'X 用户',
    siteUrl: `https://x.com/${encodeURIComponent(profile.username)}`,
    sourceKind: 'X',
    imageUrl: profile.imageUrl,
  }
}

export function buildInstagramCandidateFromProfile(profile: SocialRemoteProfile): ResolvedDiscoverCandidate {
  return {
    targetUrl: `https://rsshub.pseudoyu.com/instagram/user/${encodeURIComponent(profile.username)}`,
    targetTitle: profile.title,
    targetView: FeedViewType.Pictures,
    description: profile.followers || 'Instagram 用户',
    siteUrl: `https://www.instagram.com/${encodeURIComponent(profile.username)}/`,
    sourceKind: 'Instagram',
    imageUrl: profile.imageUrl,
  }
}

export function dedupeAndLimitDiscoverCandidates(
  items: ResolvedDiscoverCandidate[],
  limit: number,
): ResolvedDiscoverCandidate[] {
  const result: ResolvedDiscoverCandidate[] = []
  items.forEach((item) => {
    if (!result.some((candidate) => candidate.targetUrl === item.targetUrl)) {
      result.push(item)
    }
  })
  return result.slice(0, limit)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/discover-remote-search-parsing.test.ts`
Expected: PASS with all tests green

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/tests/discover-remote-search-parsing.test.ts apps/harmony/entry/src/main/ets/common/utils/DiscoverRemoteSearchParsing.ts
git commit -m "test: cover harmony discover social search parsing"
```

### Task 2: Wire X / Instagram Remote Search Into Harmony Discover Service

**Files:**
- Modify: `apps/harmony/entry/src/main/ets/common/services/DiscoverRemoteSearchService.ets`
- Reuse: `apps/harmony/entry/src/main/ets/common/utils/DiscoverRemoteSearchParsing.ts`
- Test: `apps/harmony/tests/discover-remote-search-parsing.test.ts`

- [ ] **Step 1: Write the failing integration assertions in the existing test file**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildXCandidateFromProfile,
  buildInstagramCandidateFromProfile,
  dedupeAndLimitDiscoverCandidates,
} from '../entry/src/main/ets/common/utils/DiscoverRemoteSearchParsing.ts'

test('X candidate ranking prefers follower-rich exact profile match', () => {
  const candidates = dedupeAndLimitDiscoverCandidates([
    buildXCandidateFromProfile({
      username: 'openai',
      title: 'OpenAI Labs',
      imageUrl: '',
      followers: '',
    }),
    buildXCandidateFromProfile({
      username: 'openai',
      title: 'OpenAI',
      imageUrl: '',
      followers: '1.8M followers',
    }),
  ], 5)

  assert.equal(candidates[0]?.description, '1.8M followers')
})

test('Instagram candidate builder preserves avatar and picture view', () => {
  const candidate = buildInstagramCandidateFromProfile({
    username: 'studiolivo',
    title: 'Studio Livo',
    imageUrl: 'https://cdninstagram.com/avatar.jpg',
    followers: '25K followers',
  })

  assert.equal(candidate.imageUrl, 'https://cdninstagram.com/avatar.jpg')
  assert.equal(candidate.targetView, 3)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/discover-remote-search-parsing.test.ts`
Expected: FAIL because dedupe/ranking still keeps first-seen duplicate rather than the richer X candidate

- [ ] **Step 3: Write minimal implementation in the helper and service**

```ts
// apps/harmony/entry/src/main/ets/common/utils/DiscoverRemoteSearchParsing.ts
function scoreCandidate(candidate: ResolvedDiscoverCandidate): number {
  let score = 0
  if (candidate.sourceKind === 'X' || candidate.sourceKind === 'Instagram') score += 10
  if (candidate.imageUrl) score += 4
  if (/followers/i.test(candidate.description)) score += 6
  return score
}

export function dedupeAndLimitDiscoverCandidates(
  items: ResolvedDiscoverCandidate[],
  limit: number,
): ResolvedDiscoverCandidate[] {
  const best = new Map<string, ResolvedDiscoverCandidate>()
  items.forEach((item) => {
    const current = best.get(item.targetUrl)
    if (!current || scoreCandidate(item) > scoreCandidate(current)) {
      best.set(item.targetUrl, item)
    }
  })
  return Array.from(best.values())
    .sort((left, right) => scoreCandidate(right) - scoreCandidate(left))
    .slice(0, limit)
}
```

```ts
// apps/harmony/entry/src/main/ets/common/services/DiscoverRemoteSearchService.ets
import {
  buildInstagramCandidateFromProfile,
  buildXCandidateFromProfile,
  dedupeAndLimitDiscoverCandidates,
  parseInstagramProfilesFromSearchHtml,
  parseXProfilesFromSearchHtml,
} from '../utils/DiscoverRemoteSearchParsing'

// inside search()
if (platform === 'all' || platform === 'x') {
  tasks.push(DiscoverRemoteSearchService.searchXUsers(trimmed))
}
if (platform === 'all' || platform === 'instagram') {
  tasks.push(DiscoverRemoteSearchService.searchInstagramUsers(trimmed))
}

// final merge
return dedupeAndLimitDiscoverCandidates(merged, 12)

private static async searchXUsers(query: string): Promise<ResolvedDiscoverCandidate[]> {
  const html = await DiscoverRemoteSearchService.fetchHtml(
    `https://r.jina.ai/http://x.com/search?q=${encodeURIComponent(query)}&src=typed_query`,
  )
  return parseXProfilesFromSearchHtml(html, query)
    .map((profile) => buildXCandidateFromProfile(profile))
}

private static async searchInstagramUsers(query: string): Promise<ResolvedDiscoverCandidate[]> {
  const html = await DiscoverRemoteSearchService.fetchHtml(
    `https://www.instagram.com/web/search/topsearch/?context=blended&query=${encodeURIComponent(query)}`,
    'application/json, text/plain, */*',
  )
  return parseInstagramProfilesFromSearchHtml(html, query)
    .map((profile) => buildInstagramCandidateFromProfile(profile))
}

private static async fetchHtml(url: string, accept: string = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'): Promise<string> {
  const request = http.createHttp()
  try {
    const response = await request.request(url, {
      method: http.RequestMethod.GET,
      connectTimeout: 8000,
      readTimeout: 8000,
      header: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': accept,
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    })
    if (response.responseCode !== 200) {
      return ''
    }
    return String(response.result)
  } finally {
    request.destroy()
  }
}
```

- [ ] **Step 4: Run tests and a Harmony-focused verification command**

Run: `node --test apps/harmony/tests/discover-remote-search-parsing.test.ts`
Expected: PASS

Run: `pnpm --dir apps/harmony build:debug`
Expected: build completes or fails only with known local SDK/tooling prerequisites unrelated to TypeScript logic

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/services/DiscoverRemoteSearchService.ets apps/harmony/entry/src/main/ets/common/utils/DiscoverRemoteSearchParsing.ts apps/harmony/tests/discover-remote-search-parsing.test.ts
git commit -m "feat: add harmony discover social remote search"
```
