# Harmony X Timeline Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all Harmony X-related rendering into a tweet-timeline style presentation shared by the home social feed and the feed detail preview.

**Architecture:** Expand the X presentation model in `TweetEntryPresentation.ts`, then refactor `TweetEntryCard.ets` into a timeline-style renderer that consumes the richer model. Keep page-level logic thin by letting `Index.ets` and `FeedDetailView.ets` only detect X content and delegate all X UI to the shared card.

**Tech Stack:** ArkTS, ArkUI declarative UI, Harmony theme palette/tokens, Node built-in test runner.

---

## File Map

- Modify: `apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts`
  - Extend the presentation model for retweet banner, quote card, media layout, and action bar metadata.
- Modify: `apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets`
  - Replace the current summary-card layout with a flatter timeline renderer.
- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
  - Keep the X detection branch and route home social items into the unified renderer.
- Modify: `apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets`
  - Keep the X preview branch and route preview entries into the same unified renderer.
- Modify: `apps/harmony/tests/tweet-entry-presentation.test.ts`
  - Add regression cases for retweet, quote, media, and action-bar-facing fields.
- Modify: `apps/harmony/tests/feed-subscribe-flow.test.ts`
  - Assert the home and detail entry points still use the shared X renderer.

### Task 1: Lock the richer X presentation contract with tests

**Files:**
- Modify: `apps/harmony/tests/tweet-entry-presentation.test.ts`
- Modify: `apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts`

- [ ] **Step 1: Write the failing test**

Add tests that assert the presentation model exposes enough structure for the new timeline card:

```ts
test('presentTweetEntryFromEntry keeps retweet metadata for timeline header', () => {
  const presented = presentTweetEntryFromEntry({
    id: 'entry-retweet',
    title: '',
    summary: 'RT @ArthurMacWaters: Western civilization is awesome, actually',
    content: '',
    author: 'Elon Musk',
    articleUrl: 'https://x.com/elonmusk/status/1',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: Date.UTC(2024, 3, 4, 0, 0, 0),
  } as any, 'https://unavatar.io/x/elonmusk')

  assert.equal(presented.kind, 'retweet')
  assert.equal(presented.retweetByLabel, 'Elon Musk')
  assert.equal(presented.displayName, 'ArthurMacWaters')
  assert.equal(presented.username, '@ArthurMacWaters')
})

test('presentTweetEntryFromEntry keeps quote metadata for timeline quote card', () => {
  const presented = presentTweetEntryFromEntry({
    id: 'entry-quote',
    title: '',
    summary: '<p>Try out self-driving in a Tesla.</p><blockquote><p>Robert Scoble @Scobleizer</p><p>I was on @wholemars space this afternoon</p></blockquote>',
    content: '',
    author: 'Elon Musk',
    articleUrl: 'https://x.com/elonmusk/status/3',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: Date.UTC(2024, 3, 6, 0, 0, 0),
  } as any, 'https://unavatar.io/x/elonmusk')

  assert.equal(presented.kind, 'quote')
  assert.equal(presented.text, 'Try out self-driving in a Tesla.')
  assert.equal(presented.quotedTweet?.displayName, 'Robert Scoble')
  assert.equal(presented.quotedTweet?.username, '@Scobleizer')
  assert.equal(presented.quotedTweet?.text, 'I was on @wholemars space this afternoon')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/tweet-entry-presentation.test.ts`

Expected: FAIL if any asserted retweet/quote fields are missing or unstable for the richer contract.

- [ ] **Step 3: Write minimal implementation**

Update `TweetEntryPresentation.ts` so the existing parse path reliably returns:

```ts
export interface TweetQuotedPresentation {
  displayName: string
  username: string
  avatarUrl: string
  text: string
  mediaUrls: string[]
}

export interface TweetEntryPresentation {
  kind: 'tweet' | 'retweet' | 'quote'
  displayName: string
  username: string
  avatarUrl: string
  text: string
  mediaUrls: string[]
  publishedLabel: string
  articleUrl: string
  replyCount: string
  repostCount: string
  likeCount: string
  viewCount: string
  retweetByLabel: string
  quotedTweet?: TweetQuotedPresentation
}
```

Ensure the retweet and quote parsing helpers populate these fields consistently instead of leaving them empty or collapsing back to plain tweets.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/tweet-entry-presentation.test.ts`

Expected: PASS with the new semantic contract covered.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/tests/tweet-entry-presentation.test.ts apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts
git commit -m "test: lock harmony x timeline presentation contract"
```

### Task 2: Add renderer-level regression tests for shared X entry points

**Files:**
- Modify: `apps/harmony/tests/feed-subscribe-flow.test.ts`
- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets`

- [ ] **Step 1: Write the failing test**

Add source-level assertions that both entry points still route X content through the shared card:

```ts
test('Index routes x social entries through TweetEntryCard', () => {
  const source = fs.readFileSync('apps/harmony/entry/src/main/ets/pages/Index.ets', 'utf8')

  assert.match(source, /private isXSocialEntry\(entry: EntryCardModel\)/)
  assert.match(source, /TweetEntryCard\(\{/)
  assert.match(source, /presentTweetEntryFromCard\(entry\)/)
})

test('FeedDetailView routes x previews through TweetEntryCard', () => {
  const source = fs.readFileSync('apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets', 'utf8')

  assert.match(source, /private isXPreview\(\)/)
  assert.match(source, /TweetEntryCard\(\{/)
  assert.match(source, /presentTweetEntryFromEntry\(entry, this\.resolvedAvatarUrl\(\)\)/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/feed-subscribe-flow.test.ts`

Expected: FAIL if either page no longer uses the shared X renderer or missing helper calls.

- [ ] **Step 3: Write minimal implementation**

Keep both routes explicit:

```ts
// Index.ets
if (this.isXSocialEntry(entry)) {
  TweetEntryCard({
    presentation: presentTweetEntryFromCard(entry),
    theme: this.theme,
    onOpen: () => this.openEntry(entry.id),
  })
}

// FeedDetailView.ets
if (this.isXPreview()) {
  TweetEntryCard({
    presentation: this.tweetPresentation(entry),
    theme: this.theme,
    onOpen: () => {
      this.onOpenArticle(entry, this.articleDetailFeed(entry))
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/feed-subscribe-flow.test.ts`

Expected: PASS with the new entry-point assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/tests/feed-subscribe-flow.test.ts apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets
git commit -m "test: guard shared harmony x renderer entry points"
```

### Task 3: Refactor TweetEntryCard into a timeline renderer

**Files:**
- Modify: `apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets`

- [ ] **Step 1: Write the failing test**

Add source assertions that the card contains timeline-specific structure instead of the old metric-chip summary layout:

```ts
test('TweetEntryCard defines timeline-specific sections', () => {
  const source = fs.readFileSync(
    'apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets',
    'utf8',
  )

  assert.match(source, /private RetweetBanner\(\)/)
  assert.match(source, /private QuoteCard\(\)/)
  assert.match(source, /private MediaGrid\(\)/)
  assert.match(source, /private ActionRow\(\)/)
  assert.match(source, /presentation\.quotedTweet/)
  assert.doesNotMatch(source, /private MetricChip\(/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/feed-subscribe-flow.test.ts`

Expected: FAIL because the current card still uses pill-style metric chips and the old card layout.

- [ ] **Step 3: Write minimal implementation**

Refactor `TweetEntryCard.ets` around these builders:

```ts
@Builder
private RetweetBanner() {
  // small muted row above content
}

@Builder
private MediaGrid() {
  // 1/2/3/4 tile layout with tighter radius
}

@Builder
private QuoteCard() {
  // nested quoted tweet container
}

@Builder
private ActionRow() {
  // comment / repost / like / views / share icons with optional counts
}
```

The final card should:

- use a flatter container with lighter corner radius than the current summary card
- place display name, username, and time on a denser header row
- show tweet text as the primary body
- show retweet banner and quote card only when present
- render action items as an inline row, not rounded chips

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/feed-subscribe-flow.test.ts`

Expected: PASS for the renderer structure assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets apps/harmony/tests/feed-subscribe-flow.test.ts
git commit -m "feat: refactor harmony x card into timeline renderer"
```

### Task 4: Keep the richer X model aligned with the new renderer

**Files:**
- Modify: `apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts`
- Modify: `apps/harmony/tests/tweet-entry-presentation.test.ts`

- [ ] **Step 1: Write the failing test**

Add a regression for metrics and media order used by the action row and media grid:

```ts
test('presentTweetEntryFromCard keeps stable media order and optional action counts', () => {
  const presented = presentTweetEntryFromCard({
    id: 'card-2',
    title: '',
    summary: '<p>Hello world.</p><p>12 replies 34 reposts 56 likes 78 views</p>',
    content: '',
    imageUrl: 'https://pbs.twimg.com/media/four.jpg',
    feedImageUrl: 'https://unavatar.io/x/openai',
    author: 'OpenAI',
    articleUrl: 'https://x.com/openai/status/2',
    publishedAt: 1711920000000,
    mediaUrls: [
      'https://pbs.twimg.com/media/one.jpg',
      'https://pbs.twimg.com/media/two.jpg',
      'https://pbs.twimg.com/media/three.jpg',
    ],
    feedTitle: 'OpenAI',
  } as any)

  assert.deepEqual(presented.mediaUrls, [
    'https://pbs.twimg.com/media/one.jpg',
    'https://pbs.twimg.com/media/two.jpg',
    'https://pbs.twimg.com/media/three.jpg',
    'https://pbs.twimg.com/media/four.jpg',
  ])
  assert.equal(presented.replyCount, '12')
  assert.equal(presented.repostCount, '34')
  assert.equal(presented.likeCount, '56')
  assert.equal(presented.viewCount, '78')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/tweet-entry-presentation.test.ts`

Expected: FAIL if media order or action counts are not preserved for card-based sources.

- [ ] **Step 3: Write minimal implementation**

Adjust `basePresentation()` and related helpers so:

```ts
const mediaUrls = uniqueUrls([
  ...(source.mediaUrls ?? []),
  ...(trimValue(source.imageUrl) ? [source.imageUrl ?? ''] : []),
])

const metrics = extractMetrics(`${source.summary || ''}\n${source.content || ''}`)
```

Keep the current parsing order deterministic and let card-based sources expose metrics when available.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/tweet-entry-presentation.test.ts`

Expected: PASS with media and metrics behavior aligned to renderer needs.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts apps/harmony/tests/tweet-entry-presentation.test.ts
git commit -m "feat: align harmony x presentation data with timeline renderer"
```

### Task 5: Final verification

**Files:**
- Verify only: `apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts`
- Verify only: `apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets`
- Verify only: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Verify only: `apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets`
- Verify only: `apps/harmony/tests/tweet-entry-presentation.test.ts`
- Verify only: `apps/harmony/tests/feed-subscribe-flow.test.ts`

- [ ] **Step 1: Run X presentation tests**

Run: `node --test apps/harmony/tests/tweet-entry-presentation.test.ts`

Expected: PASS with all X semantic parsing tests green.

- [ ] **Step 2: Run shared entry-point tests**

Run: `node --test apps/harmony/tests/feed-subscribe-flow.test.ts`

Expected: PASS with both home/detail X routing assertions green.

- [ ] **Step 3: Run type-aware project verification**

Run: `pnpm --dir apps/harmony exec tsc --noEmit`

Expected: exit code `0`.

- [ ] **Step 4: Run Harmony package verification if available**

Run: `pnpm --dir apps/harmony build`

Expected: build succeeds without new X renderer errors.

- [ ] **Step 5: Commit final implementation**

```bash
git add apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets apps/harmony/tests/tweet-entry-presentation.test.ts apps/harmony/tests/feed-subscribe-flow.test.ts docs/superpowers/specs/2026-04-01-harmony-x-timeline-unification-design.md docs/superpowers/plans/2026-04-01-harmony-x-timeline-unification.md
git commit -m "feat: unify harmony x timeline presentation"
```

## Self-Review

- **Spec coverage:** Task 1 locks the richer presentation contract. Task 2 guards the shared page-level entry points. Task 3 implements the new timeline renderer. Task 4 aligns data helpers with renderer needs. Task 5 verifies the whole feature.
- **Placeholder scan:** Every task includes explicit file paths, concrete test or code snippets, exact commands, and expected results.
- **Type consistency:** The plan uses the same `TweetEntryPresentation`, `TweetQuotedPresentation`, `presentTweetEntryFromCard`, `presentTweetEntryFromEntry`, and `TweetEntryCard` names throughout.
