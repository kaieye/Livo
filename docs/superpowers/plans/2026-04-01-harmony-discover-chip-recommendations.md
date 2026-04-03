# Harmony Discover Chip Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every Discover chip on Harmony (`all`, `YouTube`, `Bilibili`, `X`, `Instagram`) has built-in recommended feeds when the search box is empty.

**Architecture:** Reuse the existing Discover recommendation pipeline instead of adding a new UI path. Expand the static `RECOMMENDED_FEEDS` dataset in `DiscoverService.ets` so each platform can be matched by the current `discoverFeedPlatform()` filter, then lock the coverage with a focused regression test.

**Tech Stack:** ArkTS, ArkUI declarative UI, HarmonyOS NEXT, Node test runner

---

### Task 1: Lock Platform Recommendation Coverage with a Failing Test

**Files:**

- Modify: `apps/harmony/tests/source-regressions.test.ts`
- Verify: `apps/harmony/entry/src/main/ets/common/services/DiscoverService.ets`

- [ ] **Step 1: Write the failing test**

Add this source-level regression test near the other Discover-related assertions in `apps/harmony/tests/source-regressions.test.ts`:

```ts
test('DiscoverService provides built-in recommended feeds for every discover chip platform', async () => {
  const source = await fs.readFile(
    path.join(
      repoRoot,
      'apps/harmony/entry/src/main/ets/common/services/DiscoverService.ets',
    ),
    'utf8',
  )

  const requiredMarkers = [
    "siteUrl: 'https://www.youtube.com/",
    "siteUrl: 'https://space.bilibili.com/",
    "siteUrl: 'https://x.com/",
    "siteUrl: 'https://www.instagram.com/",
  ]

  requiredMarkers.forEach((marker) => {
    assert.match(source, new RegExp(escapeRegExp(marker)))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: FAIL because the current recommendation table does not yet contain built-in examples for every platform chip.

- [ ] **Step 3: Write minimal implementation**

Update `apps/harmony/entry/src/main/ets/common/services/DiscoverService.ets` by appending platform-specific examples to `RECOMMENDED_FEEDS`. Keep the existing object shape and only add static feed entries that the current `discoverFeedPlatform()` logic can classify.

Add at least these kinds of entries:

```ts
  {
    title: 'OpenAI',
    url: `${DEFAULT_RSSHUB_INSTANCE}/youtube/channel/UCXZCJLdBC09xxGZ6gcdrc6A`,
    siteUrl: 'https://www.youtube.com/@OpenAI',
    description: 'OpenAI 官方频道更新',
    view: FeedViewType.Videos,
    category: 'YouTube',
  },
```

```ts
  {
    title: '罗翔说刑法',
    url: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/video/517327498`,
    siteUrl: 'https://space.bilibili.com/517327498',
    description: 'Bilibili 视频更新示例源',
    view: FeedViewType.Videos,
    category: 'Bilibili',
  },
```

```ts
  {
    title: 'OpenAI on X',
    url: `${DEFAULT_RSSHUB_INSTANCE}/x/user/openai`,
    siteUrl: 'https://x.com/OpenAI',
    description: 'OpenAI 在 X 上的公开动态',
    view: FeedViewType.SocialMedia,
    category: 'X',
  },
```

```ts
  {
    title: 'NASA',
    url: `${DEFAULT_RSSHUB_INSTANCE}/instagram/user/nasa`,
    siteUrl: 'https://www.instagram.com/nasa/',
    description: 'Instagram 图片流示例源',
    view: FeedViewType.Pictures,
    category: 'Instagram',
  },
```

Keep the additions balanced: add at least 4 entries for `youtube`, 4 for `bilibili`, 4 for `x`, and 4 for `instagram`, using recognizable public accounts and URLs that match existing route conventions.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: PASS, including the new coverage assertion.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/services/DiscoverService.ets apps/harmony/tests/source-regressions.test.ts
git commit -m "feat: add discover recommendations for every chip"
```

### Task 2: Verify Platform Filtering Still Works with the Expanded Dataset

**Files:**

- Modify: `apps/harmony/tests/source-regressions.test.ts`
- Verify: `apps/harmony/entry/src/main/ets/common/components/DiscoverContent.ets`
- Verify: `apps/harmony/entry/src/main/ets/common/services/DiscoverService.ets`

- [ ] **Step 1: Write the failing test**

Add a second regression to `apps/harmony/tests/source-regressions.test.ts` that checks the actual platform-filter helpers still exist and are wired through Discover content:

```ts
test('DiscoverContent still uses platform-scoped recommended fallback helpers', async () => {
  const discoverContent = await fs.readFile(
    path.join(
      repoRoot,
      'apps/harmony/entry/src/main/ets/common/components/DiscoverContent.ets',
    ),
    'utf8',
  )
  const discoverService = await fs.readFile(
    path.join(
      repoRoot,
      'apps/harmony/entry/src/main/ets/common/services/DiscoverService.ets',
    ),
    'utf8',
  )

  assert.match(
    discoverContent,
    /filteredRecommendedFeedsByPlatform\(this\.searchPlatform\)/,
  )
  assert.match(
    discoverContent,
    /searchedRecommendedFeedsByPlatform\(this\.query, this\.searchPlatform\)/,
  )
  assert.match(
    discoverService,
    /export function filteredRecommendedFeedsByPlatform\(platform: DiscoverSearchPlatform\)/,
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: PASS or FAIL depending on the exact source shape. If it already passes, keep the test and move on; this step exists to confirm the assertion is meaningful before broader verification.

- [ ] **Step 3: Adjust implementation only if needed**

If the test fails because the helper call shape drifted while editing `DiscoverService.ets`, restore the existing integration pattern in `apps/harmony/entry/src/main/ets/common/components/DiscoverContent.ets`:

```ts
  private localRecommendedResults(): RecommendedFeed[] {
    if (!this.query.trim()) {
      return []
    }

    return searchedRecommendedFeedsByPlatform(this.query, this.searchPlatform)
      .filter((feed: RecommendedFeed) => !this.isSubscribedRecommendedFeed(feed))
      .slice(0, 10)
  }
```

```ts
  private recommendedFallback(): RecommendedFeed[] {
    return filteredRecommendedFeedsByPlatform(this.searchPlatform)
      .filter((feed: RecommendedFeed) => !this.isSubscribedRecommendedFeed(feed))
      .slice(0, 8)
  }
```

Do not add a second recommendation source or special-case platform branch; keep the current data-driven path.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/components/DiscoverContent.ets apps/harmony/entry/src/main/ets/common/services/DiscoverService.ets apps/harmony/tests/source-regressions.test.ts
git commit -m "test: lock discover chip recommendation wiring"
```

### Task 3: Run Final Verification for Discover Chip Recommendations

**Files:**

- Verify only: `apps/harmony/entry/src/main/ets/common/services/DiscoverService.ets`
- Verify only: `apps/harmony/entry/src/main/ets/common/components/DiscoverContent.ets`
- Verify only: `apps/harmony/tests/source-regressions.test.ts`

- [ ] **Step 1: Run focused regression tests**

Run:

```bash
node --test apps/harmony/tests/source-regressions.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run Harmony build**

Run:

```bash
pnpm --dir apps/harmony build:debug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Manual verification checklist**

Verify on device or emulator:

```text
1. 打开“发现”页，保持搜索框为空
2. 依次点击“全部 / YouTube / Bilibili / X / Instagram”五个 chip
3. 确认每个 chip 下都能看到至少一条推荐源
4. 确认推荐源右侧按钮仍按当前订阅状态显示“订阅”或“已订阅”
5. 确认点击推荐源仍进入现有的订阅配置/编辑页面
```

- [ ] **Step 4: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/services/DiscoverService.ets apps/harmony/tests/source-regressions.test.ts
git commit -m "chore: verify discover chip recommendations"
```

## Self-Review

- Spec coverage: covers static recommendation expansion, per-platform chip coverage, and preserving the existing Discover fallback/search wiring.
- Placeholder scan: no `TODO` / `TBD` markers remain; every task lists exact files, commands, and concrete code or assertions.
- Type consistency: the plan keeps the existing `RecommendedFeed` shape, `discoverFeedPlatform()` mapping, and `DiscoverContent` helper calls instead of inventing a parallel configuration layer.
