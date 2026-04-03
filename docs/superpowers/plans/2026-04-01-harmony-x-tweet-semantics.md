# Harmony X Tweet Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach Harmony's X feed cards to distinguish normal tweets, retweets, and quote tweets so subscribed detail and home social views show the correct content semantics.

**Architecture:** Extend the shared tweet presentation model in [`TweetEntryPresentation.ts`](E:/Livo/apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts) with semantic fields for `tweet`, `retweet`, and `quote`, then update [`TweetEntryCard.ets`](E:/Livo/apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets) to render the new semantics. Because [`FeedDetailView.ets`](E:/Livo/apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets) and [`Index.ets`](E:/Livo/apps/harmony/entry/src/main/ets/pages/Index.ets) already route X entries through `TweetEntryCard`, no new page-specific wiring is needed for this feature.

**Tech Stack:** ArkTS, ArkUI declarative components, Harmony theme palette utilities, Node built-in test runner, Harmony hvigor build.

---

## File Map

- Modify: `apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts`
  - Add semantic tweet kind parsing and quoted/retweet payloads.
- Modify: `apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets`
  - Render retweet header and quote sub-card using the shared semantic model.
- Modify: `apps/harmony/tests/tweet-entry-presentation.test.ts`
  - Add parser regression coverage for retweets, quote tweets, and safe fallbacks.
- Modify: `apps/harmony/tests/source-regressions.test.ts`
  - Add source-level assertions for retweet banner and quoted tweet rendering.

### Task 1: Extend Tweet Presentation Semantics

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts`
- Modify: `apps/harmony/tests/tweet-entry-presentation.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test('presentTweetEntryFromEntry classifies RT prefix content as retweet', () => {
  const entry: TweetEntryLike = {
    title: '',
    summary: 'RT @ArthurMacWaters: Western civilization is awesome, actually',
    content: '',
    author: 'Elon Musk',
    articleUrl: 'https://x.com/elonmusk/status/1',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: 1711920000000,
  }

  const presented = presentTweetEntryFromEntry(
    entry,
    'https://unavatar.io/x/elonmusk',
  )

  assert.equal(presented.kind, 'retweet')
  assert.equal(presented.retweetByLabel, 'Elon Musk')
  assert.equal(presented.displayName, 'ArthurMacWaters')
  assert.equal(presented.username, '@ArthurMacWaters')
  assert.equal(presented.text, 'Western civilization is awesome, actually')
})

test('presentTweetEntryFromEntry keeps ambiguous RT content as plain tweet', () => {
  const entry: TweetEntryLike = {
    title: '',
    summary: 'RT this is still just plain text without a real author split',
    content: '',
    author: 'OpenAI',
    articleUrl: 'https://x.com/OpenAI/status/2',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: 1711920000000,
  }

  const presented = presentTweetEntryFromEntry(
    entry,
    'https://unavatar.io/x/OpenAI',
  )

  assert.equal(presented.kind, 'tweet')
  assert.equal(presented.retweetByLabel, '')
  assert.equal(presented.quotedTweet, undefined)
})

test('presentTweetEntryFromEntry classifies quote tweet content', () => {
  const entry: TweetEntryLike = {
    title: '',
    summary:
      'Try out self-driving in a Tesla. ||QUOTE|| Robert Scoble|@Scobleizer|I was on @wholemars space this afternoon while my Model 3 drove me for a couple of hours',
    content: '',
    author: 'Elon Musk',
    articleUrl: 'https://x.com/elonmusk/status/3',
    imageUrl: '',
    mediaUrls: [],
    publishedAt: 1711920000000,
  }

  const presented = presentTweetEntryFromEntry(
    entry,
    'https://unavatar.io/x/elonmusk',
  )

  assert.equal(presented.kind, 'quote')
  assert.equal(presented.text, 'Try out self-driving in a Tesla.')
  assert.equal(presented.quotedTweet?.displayName, 'Robert Scoble')
  assert.equal(presented.quotedTweet?.username, '@Scobleizer')
  assert.equal(
    presented.quotedTweet?.text,
    'I was on @wholemars space this afternoon while my Model 3 drove me for a couple of hours',
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/harmony/tests/tweet-entry-presentation.test.ts`

Expected: FAIL because `kind`, `retweetByLabel`, and `quotedTweet` do not exist yet.

- [ ] **Step 3: Write minimal implementation**

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
  retweetByLabel: string
  quotedTweet?: TweetQuotedPresentation
  // existing fields stay here
}

function parseRetweetPresentation(
  source: PresentTweetSource,
): TweetEntryPresentation | undefined {
  const normalized = trimValue(
    stripHtml(source.summary || source.content || ''),
  )
  const matched = normalized.match(/^RT\s+@?([^:]+):\s+([\s\S]+)$/)
  if (!matched?.[1] || !matched?.[2]) {
    return undefined
  }

  const originalName = trimValue(matched[1])
  const originalText = trimValue(matched[2])
  if (!originalName || !originalText) {
    return undefined
  }

  return {
    ...basePresentation(source),
    kind: 'retweet',
    retweetByLabel: extractDisplayName(source),
    displayName: originalName.replace(/^@/, ''),
    username: originalName.startsWith('@') ? originalName : `@${originalName}`,
    text: originalText,
  }
}

function parseQuotePresentation(
  source: PresentTweetSource,
): TweetEntryPresentation | undefined {
  const normalized = trimValue(
    stripHtml(source.summary || source.content || ''),
  )
  const parts = normalized.split('||QUOTE||')
  if (parts.length !== 2) {
    return undefined
  }

  const mainText = trimValue(parts[0])
  const quoteParts = parts[1].split('|').map((part: string) => trimValue(part))
  if (!mainText || quoteParts.length < 3) {
    return undefined
  }

  return {
    ...basePresentation(source),
    kind: 'quote',
    text: mainText,
    quotedTweet: {
      displayName: quoteParts[0],
      username: quoteParts[1],
      text: quoteParts[2],
      avatarUrl: '',
      mediaUrls: [],
    },
  }
}

function presentTweetEntryFromSource(
  source: PresentTweetSource,
): TweetEntryPresentation {
  return (
    parseRetweetPresentation(source) ||
    parseQuotePresentation(source) || {
      ...basePresentation(source),
      kind: 'tweet',
      retweetByLabel: '',
      quotedTweet: undefined,
    }
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps/harmony/tests/tweet-entry-presentation.test.ts`

Expected: PASS with all previous tweet presentation tests plus the new retweet/quote tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts apps/harmony/tests/tweet-entry-presentation.test.ts
git commit -m "feat: classify harmony x tweet semantics"
```

### Task 2: Render Retweet and Quote Semantics in TweetEntryCard

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets`
- Modify: `apps/harmony/tests/source-regressions.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test('TweetEntryCard renders retweet and quote semantic sections', () => {
  const source = fs.readFileSync(
    'apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets',
    'utf8',
  )

  assert.match(source, /presentation\.kind === 'retweet'/)
  assert.match(source, /presentation\.retweetByLabel/)
  assert.match(source, /presentation\.kind === 'quote'/)
  assert.match(source, /presentation\.quotedTweet/)
  assert.match(source, /private QuoteCard\(/)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: FAIL because `TweetEntryCard.ets` does not yet render retweet banner or quote sub-card sections.

- [ ] **Step 3: Write minimal implementation**

```ts
@Builder
private RetweetBanner() {
  if (this.presentation.kind === 'retweet' && this.presentation.retweetByLabel) {
    Row({ space: 6 }) {
      Text(`${this.presentation.retweetByLabel} 已转帖`)
        .fontSize(11)
        .fontColor(this.theme.textMuted)
    }
    .width('100%')
  }
}

@Builder
private QuoteCard() {
  if (this.presentation.kind === 'quote' && this.presentation.quotedTweet) {
    Column({ space: 8 }) {
      Text(this.presentation.quotedTweet.displayName)
      if (this.presentation.quotedTweet.username) {
        Text(this.presentation.quotedTweet.username)
      }
      Text(this.presentation.quotedTweet.text)
    }
    .width('100%')
    .padding(12)
    .border({ width: 0.8, color: this.theme.divider })
    .borderRadius(18)
    .backgroundColor(this.theme.elevated)
  }
}

build() {
  Column({ space: 12 }) {
    this.RetweetBanner()
    // existing header/body/media
    this.QuoteCard()
    // existing metrics
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: PASS with the new semantic-card assertions and existing X routing assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets apps/harmony/tests/source-regressions.test.ts
git commit -m "feat: render harmony x retweets and quotes"
```

### Task 3: Full Verification

**Files:**

- Verify only: `apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts`
- Verify only: `apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets`
- Verify only: `apps/harmony/tests/tweet-entry-presentation.test.ts`
- Verify only: `apps/harmony/tests/source-regressions.test.ts`

- [ ] **Step 1: Run tweet parser tests**

Run: `node --test apps/harmony/tests/tweet-entry-presentation.test.ts`

Expected: PASS with retweet/quote semantic parsing coverage.

- [ ] **Step 2: Run integration-style source tests**

Run: `node --test apps/harmony/tests/source-regressions.test.ts`

Expected: PASS with `TweetEntryCard` semantic rendering assertions and existing X routing assertions.

- [ ] **Step 3: Run Harmony build**

Run: `pnpm --dir apps/harmony build:debug`

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit final verification state**

```bash
git add apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets apps/harmony/tests/tweet-entry-presentation.test.ts apps/harmony/tests/source-regressions.test.ts
git commit -m "feat: improve harmony x tweet semantics"
```

## Self-Review

- **Spec coverage:** Task 1 covers semantic parsing for `tweet`, `retweet`, and `quote`, including safe fallback behavior. Task 2 covers semantic rendering in the shared card. Task 3 covers verification. No spec requirement is left without a task.
- **Placeholder scan:** Every task includes exact file paths, concrete test snippets, concrete commands, expected outcomes, and commit messages. No placeholder language remains.
- **Type consistency:** The plan consistently uses `kind`, `retweetByLabel`, `quotedTweet`, and `TweetQuotedPresentation` across parser, renderer, and tests.
