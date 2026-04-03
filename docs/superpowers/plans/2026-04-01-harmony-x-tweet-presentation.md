# Harmony X Tweet Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Harmony X feeds render as tweet-style cards in both the subscribed feed detail page and the home "social" tab using one shared presentation pipeline.

**Architecture:** Add a focused X presentation helper that converts existing `Entry` and `EntryCardModel` data into a shared tweet-view model, then render that model through a new `TweetEntryCard` component. Wire both [`FeedDetailView.ets`](E:/Livo/apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets) and [`Index.ets`](E:/Livo/apps/harmony/entry/src/main/ets/pages/Index.ets) to branch to the new component only for X feeds, while keeping all other feed types unchanged.

**Tech Stack:** ArkTS, ArkUI declarative components, Harmony shared UI tokens/theme palette, Node built-in test runner, Harmony hvigor build.

---

## File Map

- Create: `apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts`
  - Parse `Entry` and `EntryCardModel` into a shared tweet display model.
- Create: `apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets`
  - Render the shared tweet display model into the new X-style card UI.
- Modify: `apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets`
  - Detect X feeds in subscribed feed detail preview and route them to `TweetEntryCard`.
- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
  - Detect X entries in the home "social" tab and route them to `TweetEntryCard`.
- Modify: `apps/harmony/tests/source-regressions.test.ts`
  - Assert the two page entry points both branch into the shared tweet card.
- Create: `apps/harmony/tests/tweet-entry-presentation.test.ts`
  - Cover parsing of username, text, media, and engagement metadata from existing feed data.

### Task 1: Add Tweet Presentation Parsing

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts`
- Create: `apps/harmony/tests/tweet-entry-presentation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  presentTweetEntryFromEntry,
  presentTweetEntryFromCard,
} from '../entry/src/main/ets/common/utils/TweetEntryPresentation.ts'

test('presentTweetEntryFromEntry extracts x username, text, media, and metrics', () => {
  const presented = presentTweetEntryFromEntry(
    {
      id: 'entry-1',
      title: 'OpenAI shipped Codex',
      summary:
        '<p>Codex is live now.</p><p>12 replies 34 reposts 56 likes 78 views</p>',
      content: '',
      author: 'OpenAI',
      articleUrl: 'https://x.com/OpenAI/status/1234567890',
      imageUrl: 'https://pbs.twimg.com/media/one.jpg',
      mediaUrls: [
        'https://pbs.twimg.com/media/one.jpg',
        'https://pbs.twimg.com/media/two.jpg',
      ],
      publishedAt: 1711920000000,
    } as any,
    'https://unavatar.io/x/OpenAI',
  )

  assert.equal(presented.displayName, 'OpenAI')
  assert.equal(presented.username, '@OpenAI')
  assert.equal(presented.text, 'Codex is live now.')
  assert.deepEqual(presented.mediaUrls, [
    'https://pbs.twimg.com/media/one.jpg',
    'https://pbs.twimg.com/media/two.jpg',
  ])
  assert.equal(presented.replyCount, '12')
  assert.equal(presented.repostCount, '34')
  assert.equal(presented.likeCount, '56')
  assert.equal(presented.viewCount, '78')
})

test('presentTweetEntryFromCard falls back cleanly when metrics are missing', () => {
  const presented = presentTweetEntryFromCard({
    id: 'card-1',
    title: 'Shipping notes',
    summary: 'Plain text summary only',
    imageUrl: 'https://pbs.twimg.com/media/card.jpg',
    feedImageUrl: 'https://unavatar.io/x/verge',
    author: 'The Verge',
    articleUrl: 'https://x.com/verge/status/999',
    publishedAt: 1711920000000,
    publishedLabel: '3 小时前',
    mediaUrls: [],
    feedTitle: 'The Verge',
  } as any)

  assert.equal(presented.displayName, 'The Verge')
  assert.equal(presented.username, '@verge')
  assert.equal(presented.text, 'Plain text summary only')
  assert.deepEqual(presented.mediaUrls, [
    'https://pbs.twimg.com/media/card.jpg',
  ])
  assert.equal(presented.replyCount, '')
  assert.equal(presented.repostCount, '')
  assert.equal(presented.likeCount, '')
  assert.equal(presented.viewCount, '')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/tweet-entry-presentation.test.ts`

Expected: FAIL with module-not-found or missing export errors for `TweetEntryPresentation.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface TweetEntryPresentation {
  displayName: string
  username: string
  text: string
  mediaUrls: string[]
  avatarUrl: string
  publishedLabel: string
  replyCount: string
  repostCount: string
  likeCount: string
  viewCount: string
  articleUrl: string
}

function extractUsername(articleUrl: string, author: string): string {
  const matched = (articleUrl || '').match(
    /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)/i,
  )
  const raw = matched?.[1] || author || ''
  const normalized = raw.replace(/^@+/, '').trim()
  return normalized ? `@${normalized}` : ''
}

function extractTweetText(summary: string, title: string): string {
  const plain = (summary || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain) {
    return plain
      .replace(
        /\b\d+\s+(?:replies|reply|reposts|repost|likes|like|views|view)\b/gi,
        '',
      )
      .replace(/\s+/g, ' ')
      .trim()
  }
  return (title || '').trim()
}

function extractMetric(summary: string, label: string): string {
  const matched = (summary || '').match(
    new RegExp(`(\\d[\\d.,KMB万]*)\\s+${label}`, 'i'),
  )
  return matched?.[1] || ''
}

function mediaList(
  mediaUrls: string[] | undefined,
  imageUrl: string,
): string[] {
  const urls = [...(mediaUrls || []), imageUrl].filter((url: string) => !!url)
  return urls.filter(
    (url: string, index: number) => urls.indexOf(url) === index,
  )
}

export function presentTweetEntryFromEntry(
  entry: any,
  avatarUrl: string,
): TweetEntryPresentation {
  return {
    displayName: (entry.author || '').trim() || '未知用户',
    username: extractUsername(entry.articleUrl || '', entry.author || ''),
    text: extractTweetText(entry.summary || '', entry.title || ''),
    mediaUrls: mediaList(entry.mediaUrls, entry.imageUrl || ''),
    avatarUrl: avatarUrl || '',
    publishedLabel: '',
    replyCount: extractMetric(entry.summary || '', 'repl(?:y|ies)'),
    repostCount: extractMetric(entry.summary || '', 'reposts?'),
    likeCount: extractMetric(entry.summary || '', 'likes?'),
    viewCount: extractMetric(entry.summary || '', 'views?'),
    articleUrl: entry.articleUrl || '',
  }
}

export function presentTweetEntryFromCard(entry: any): TweetEntryPresentation {
  return {
    displayName: (entry.author || entry.feedTitle || '').trim() || '未知用户',
    username: extractUsername(entry.articleUrl || '', ''),
    text: (entry.summary || '').trim() || (entry.title || '').trim(),
    mediaUrls: mediaList(entry.mediaUrls, entry.imageUrl || ''),
    avatarUrl: entry.feedImageUrl || '',
    publishedLabel: entry.publishedLabel || '',
    replyCount: '',
    repostCount: '',
    likeCount: '',
    viewCount: '',
    articleUrl: entry.articleUrl || '',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/tweet-entry-presentation.test.ts`

Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts apps/harmony/tests/tweet-entry-presentation.test.ts
git commit -m "feat: add x tweet presentation parser"
```

### Task 2: Build Shared Tweet Entry Card

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts`
- Test: `apps/harmony/tests/source-regressions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('TweetEntryCard renders tweet-specific sections', () => {
  const source = fs.readFileSync(
    'apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets',
    'utf8',
  )

  assert.match(source, /export struct TweetEntryCard/)
  assert.match(source, /presentation: TweetEntryPresentation/)
  assert.match(source, /presentation\.displayName/)
  assert.match(source, /presentation\.username/)
  assert.match(source, /presentation\.text/)
  assert.match(source, /presentation\.mediaUrls/)
  assert.match(
    source,
    /presentation\.replyCount|presentation\.repostCount|presentation\.likeCount|presentation\.viewCount/,
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: FAIL because `TweetEntryCard.ets` does not exist yet and the source assertion cannot pass.

- [ ] **Step 3: Write minimal implementation**

```ts
import { TweetEntryPresentation } from '../utils/TweetEntryPresentation'
import { ThemePalette } from '../services/ThemeService'

@Component
export struct TweetEntryCard {
  @Prop presentation: TweetEntryPresentation = {
    displayName: '',
    username: '',
    text: '',
    mediaUrls: [],
    avatarUrl: '',
    publishedLabel: '',
    replyCount: '',
    repostCount: '',
    likeCount: '',
    viewCount: '',
    articleUrl: '',
  }
  @Prop theme: ThemePalette = { } as ThemePalette
  onOpen: () => void = () => {}

  @Builder
  private MediaGrid() {
    if (this.presentation.mediaUrls.length > 0) {
      // Render one or more media tiles with rounded corners.
    }
  }

  @Builder
  private MetricsRow() {
    if (
      this.presentation.replyCount ||
      this.presentation.repostCount ||
      this.presentation.likeCount ||
      this.presentation.viewCount
    ) {
      // Render metrics labels only when present.
    }
  }

  build() {
    Column({ space: 10 }) {
      // header uses presentation.displayName / presentation.username / presentation.publishedLabel
      // body uses presentation.text
      this.MediaGrid()
      this.MetricsRow()
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: PASS for the new `TweetEntryCard` source-structure assertion and all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts apps/harmony/tests/source-regressions.test.ts
git commit -m "feat: add shared harmony tweet entry card"
```

### Task 3: Route Feed Detail X Entries to Tweet Cards

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets`
- Modify: `apps/harmony/tests/source-regressions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('FeedDetailView routes x previews through TweetEntryCard', () => {
  const source = fs.readFileSync(
    'apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets',
    'utf8',
  )

  assert.match(source, /import \{ TweetEntryCard \} from '\.\/TweetEntryCard'/)
  assert.match(source, /presentTweetEntryFromEntry/)
  assert.match(source, /this\.isXPreview\(\)/)
  assert.match(source, /TweetEntryCard\(\{/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: FAIL because `FeedDetailView.ets` still routes non-picture entries through the generic `EntryCard()`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { TweetEntryCard } from './TweetEntryCard'
import { presentTweetEntryFromEntry } from '../utils/TweetEntryPresentation'

private isXPreview(): boolean {
  const feedUrl = (this.existingFeed?.url || this.targetUrl || '').toLowerCase()
  const siteUrl = (this.targetSiteUrl || this.previewPayload?.siteUrl || '').toLowerCase()
  return feedUrl.includes('/x/user/') || feedUrl.includes('/twitter/user/') || siteUrl.includes('x.com/') || siteUrl.includes('twitter.com/')
}

private tweetPresentation(entry: Entry) {
  return presentTweetEntryFromEntry(entry, this.resolvedAvatarUrl())
}

// inside PreviewSection ForEach branch
if (this.isPicturesPreview()) {
  PictureEntryCard(this.picturePreviewCardProps(entry, index))
} else if (this.isXPreview()) {
  TweetEntryCard({
    presentation: this.tweetPresentation(entry),
    theme: this.theme,
    onOpen: () => {
      this.onOpenArticle(entry, this.articleDetailFeed(entry))
    },
  })
} else {
  this.EntryCard(entry, index)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: PASS for the new FeedDetailView assertion and prior feed-detail regression tests.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets apps/harmony/tests/source-regressions.test.ts
git commit -m "feat: render x previews as tweet cards in feed detail"
```

### Task 4: Route Home Social X Entries to Tweet Cards

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `apps/harmony/tests/source-regressions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('Index routes x social cards through TweetEntryCard', () => {
  const source = fs.readFileSync(
    'apps/harmony/entry/src/main/ets/pages/Index.ets',
    'utf8',
  )

  assert.match(
    source,
    /import \{ TweetEntryCard \} from '\.\.\/common\/components\/TweetEntryCard'/,
  )
  assert.match(source, /presentTweetEntryFromCard/)
  assert.match(source, /private isXSocialEntry\(entry: EntryCardModel\)/)
  assert.match(source, /mode === 'social'/)
  assert.match(source, /TweetEntryCard\(\{/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: FAIL because home social entries still render through the generic `EntryCard`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { TweetEntryCard } from '../common/components/TweetEntryCard'
import { presentTweetEntryFromCard } from '../common/utils/TweetEntryPresentation'

private isXSocialEntry(entry: EntryCardModel): boolean {
  const articleUrl = (entry.articleUrl || '').toLowerCase()
  const feedTitle = (entry.feedTitle || '').toLowerCase()
  return articleUrl.includes('x.com/') || articleUrl.includes('twitter.com/') || feedTitle.includes('x / twitter')
}

@Builder
private SocialEntryCard(entry: EntryCardModel) {
  if (this.isXSocialEntry(entry)) {
    TweetEntryCard({
      presentation: presentTweetEntryFromCard(entry),
      theme: this.theme,
      onOpen: () => this.openEntry(entry.id),
    })
  } else {
    this.EntryCard(entry)
  }
}

// inside EntryList(mode)
if (mode === 'social') {
  this.SocialEntryCard(entry)
} else {
  this.EntryCard(entry)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: PASS for the new Index assertion and prior discover/subscribe regressions.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/tests/source-regressions.test.ts
git commit -m "feat: render x cards in home social feed"
```

### Task 5: Verify Full Harmony Build

**Files:**

- Verify only: `apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts`
- Verify only: `apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets`
- Verify only: `apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets`
- Verify only: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Verify only: `apps/harmony/tests/tweet-entry-presentation.test.ts`
- Verify only: `apps/harmony/tests/source-regressions.test.ts`

- [ ] **Step 1: Run focused parsing tests**

Run: `node --test apps/harmony/tests/tweet-entry-presentation.test.ts`

Expected: PASS with the tweet parsing assertions all green.

- [ ] **Step 2: Run integration-style source tests**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: PASS with the new X tweet routing assertions plus the existing subscribe/discover regressions.

- [ ] **Step 3: Run Harmony build**

Run: `pnpm --dir apps/harmony build:debug`

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit final implementation**

```bash
git add apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/tests/tweet-entry-presentation.test.ts apps/harmony/tests/source-regressions.test.ts
git commit -m "feat: present harmony x feeds as tweet cards"
```

## Self-Review

- **Spec coverage:** Task 1 covers the shared parsing helper. Task 2 covers the shared component. Task 3 covers subscribed feed detail integration. Task 4 covers home social integration. Task 5 covers verification. No spec section is left without a task.
- **Placeholder scan:** Removed generic TODO-style instructions and included exact file paths, test snippets, commands, and expected outcomes for every task.
- **Type consistency:** The plan consistently uses `TweetEntryPresentation`, `TweetEntryCard`, `presentTweetEntryFromEntry`, and `presentTweetEntryFromCard` across helper, component, and page integration tasks.
