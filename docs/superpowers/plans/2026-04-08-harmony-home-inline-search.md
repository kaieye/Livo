# Harmony Home Inline Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline search entry to the Harmony home page that expands with animation, auto-focuses the input and keyboard, and highlights matches in the current home segment using the appearance accent color.

**Architecture:** Keep search state orchestration in `Index.ets`, because that file already owns the home root header, active segment, and root-tab lifecycle. Extract text-match and highlight rendering into focused shared utilities/components so article cards, tweet cards, picture cards, and video tiles can all consume the same match model without duplicating search logic.

**Tech Stack:** ArkTS, ArkUI, HarmonyOS `TextInputController`, existing `ThemeService`, Node `node:test` source-regression tests

---

## File Map

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
  Home-page search state, top-right search affordance, inline search box animation, current-segment lifecycle reset.
- Create: `apps/harmony/entry/src/main/ets/common/utils/HomeInlineSearch.ts`
  Shared query normalization, case-insensitive match slicing, and per-text highlight segment generation.
- Create: `apps/harmony/entry/src/main/ets/common/components/HighlightedInlineText.ets`
  Shared highlighted text renderer driven by `theme.accent`.
- Modify: `apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets`
  Optional highlighted rendering for display name, username, tweet text, and quoted text.
- Modify: `apps/harmony/entry/src/main/ets/common/components/PictureEntryCard.ets`
  Optional highlighted rendering for author/source/caption text.
- Modify: `apps/harmony/entry/src/main/ets/common/components/HomeVideoGrid.ets`
  Optional highlighted rendering for video title text shown inside the grid.
- Create: `apps/harmony/tests/home-inline-search-source.test.ts`
  New source-level regression coverage for search state, header placement, highlight color, and keyboard focus behavior.
- Modify: `apps/harmony/tests/home-search-button-material-source.test.ts`
  Replace old “search must not exist” assertions with the new inline-search structural contract.

## Task 1: Lock In Source-Level Search Contract

**Files:**

- Create: `apps/harmony/tests/home-inline-search-source.test.ts`
- Modify: `apps/harmony/tests/home-search-button-material-source.test.ts`
- Test: `apps/harmony/tests/home-inline-search-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home page defines inline search state and keyboard controller', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /@State searchQuery: string = ''/)
  assert.match(source, /@State showSearch: boolean = false/)
  assert.match(
    source,
    /private searchInputController: TextInputController = new TextInputController\(\)/,
  )
  assert.match(source, /private openHomeInlineSearch\(\): void/)
  assert.match(source, /private closeHomeInlineSearch\(\): void/)
  assert.match(source, /private focusHomeInlineSearch\(\): void/)
})

test('home inline search highlight uses theme accent and current mode entries', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /theme\.accent/)
  assert.match(source, /private currentSearchEntries\(\): EntryCardModel\[\]/)
  assert.match(source, /private hasSearchMatches\(\): boolean/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-inline-search-source.test.ts`

Expected: FAIL because the new search state, methods, and assertions do not exist yet.

- [ ] **Step 3: Update legacy search-removal test to the new expectation**

```ts
test('home page renders inline search in the home lower title area instead of a floating overlay button', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /private HomeRootLowerTitleBuilder\(\)/)
  assert.match(source, /private HomeInlineSearchActionRow\(\)/)
  assert.match(source, /private HomeInlineSearchField\(\)/)
  assert.doesNotMatch(source, /private HomeFloatingSearchButton\(\)/)
  assert.doesNotMatch(source, /\.bindSheet\(/)
})
```

- [ ] **Step 4: Run both source tests and confirm they fail for the right reason**

Run: `node --test tests/home-inline-search-source.test.ts tests/home-search-button-material-source.test.ts`

Expected: FAIL with missing-search-contract assertions, not syntax errors.

- [ ] **Step 5: Commit**

```bash
git add tests/home-inline-search-source.test.ts tests/home-search-button-material-source.test.ts
git commit -m "test: add home inline search source coverage"
```

## Task 2: Add Shared Search Matching Utility

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/utils/HomeInlineSearch.ts`
- Test: `apps/harmony/tests/home-inline-search-source.test.ts`

- [ ] **Step 1: Write the failing test**

Add a utility contract assertion:

```ts
test('home inline search utility exposes normalized matching helpers', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/utils/HomeInlineSearch.ts',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(source, /export interface InlineHighlightSegment/)
  assert.match(
    source,
    /export function normalizeInlineSearchQuery\(query: string\): string/,
  )
  assert.match(
    source,
    /export function buildInlineHighlightSegments\(text: string, query: string\): InlineHighlightSegment\[\]/,
  )
  assert.match(source, /toLocaleLowerCase\(\)/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-inline-search-source.test.ts`

Expected: FAIL because `HomeInlineSearch.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface InlineHighlightSegment {
  text: string
  matched: boolean
}

export function normalizeInlineSearchQuery(query: string): string {
  return (query || '').trim().toLocaleLowerCase()
}

export function buildInlineHighlightSegments(
  text: string,
  query: string,
): InlineHighlightSegment[] {
  const rawText = text || ''
  const normalizedQuery = normalizeInlineSearchQuery(query)
  if (!rawText || !normalizedQuery) {
    return [{ text: rawText, matched: false }]
  }

  const lowerText = rawText.toLocaleLowerCase()
  const segments: InlineHighlightSegment[] = []
  let cursor = 0

  while (cursor < rawText.length) {
    const matchIndex = lowerText.indexOf(normalizedQuery, cursor)
    if (matchIndex < 0) {
      segments.push({ text: rawText.slice(cursor), matched: false })
      break
    }

    if (matchIndex > cursor) {
      segments.push({ text: rawText.slice(cursor, matchIndex), matched: false })
    }

    const matchEnd = matchIndex + normalizedQuery.length
    segments.push({ text: rawText.slice(matchIndex, matchEnd), matched: true })
    cursor = matchEnd
  }

  return segments.length > 0 ? segments : [{ text: rawText, matched: false }]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/home-inline-search-source.test.ts`

Expected: PASS for the utility contract assertion; other assertions may still fail until later tasks land.

- [ ] **Step 5: Commit**

```bash
git add entry/src/main/ets/common/utils/HomeInlineSearch.ts tests/home-inline-search-source.test.ts
git commit -m "feat: add home inline search matching utility"
```

## Task 3: Add Shared Highlighted Text Renderer

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/components/HighlightedInlineText.ets`
- Modify: `apps/harmony/tests/home-inline-search-source.test.ts`
- Test: `apps/harmony/tests/home-inline-search-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('highlighted inline text component renders matched segments with theme accent styling', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/HighlightedInlineText.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(source, /@Component\s+export struct HighlightedInlineText/)
  assert.match(source, /@Prop query: string = ''/)
  assert.match(source, /buildInlineHighlightSegments/)
  assert.match(source, /this\.theme\.accent/)
  assert.match(source, /ForEach\(segments/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-inline-search-source.test.ts`

Expected: FAIL because the component file does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { buildInlineHighlightSegments, InlineHighlightSegment } from '../utils/HomeInlineSearch'

@Component
export struct HighlightedInlineText {
  @Prop text: string = ''
  @Prop query: string = ''
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop fontSize: number = 14
  @Prop lineHeight: number = 20
  @Prop fontWeight: FontWeight | number | string = FontWeight.Regular
  @Prop defaultColor: string = ''
  @Prop maxLines: number = 1

  private highlightBackgroundColor(): string {
    return this.theme.isDark ? `${this.theme.accent}33` : `${this.theme.accent}22`
  }

  build() {
    const segments: InlineHighlightSegment[] = buildInlineHighlightSegments(this.text, this.query)
    Text() {
      ForEach(segments, (segment: InlineHighlightSegment, index: number) => {
        Span(segment.text)
          .fontColor(segment.matched ? this.theme.accent : (this.defaultColor || this.theme.textPrimary))
          .backgroundColor(segment.matched ? this.highlightBackgroundColor() : '#00000000')
      }, (_segment: InlineHighlightSegment, index: number) => `${index}`)
    }
    .fontSize(this.fontSize)
    .lineHeight(this.lineHeight)
    .fontWeight(this.fontWeight)
    .maxLines(this.maxLines)
    .textOverflow({ overflow: TextOverflow.Ellipsis })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/home-inline-search-source.test.ts`

Expected: PASS for the new renderer assertions.

- [ ] **Step 5: Commit**

```bash
git add entry/src/main/ets/common/components/HighlightedInlineText.ets tests/home-inline-search-source.test.ts
git commit -m "feat: add shared inline highlighted text component"
```

## Task 4: Implement Home Inline Search State In Index

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Test: `apps/harmony/tests/home-inline-search-source.test.ts`
- Test: `apps/harmony/tests/home-search-button-material-source.test.ts`

- [ ] **Step 1: Write the failing test**

Extend source assertions with the concrete header/search contract:

```ts
assert.match(source, /@State searchQuery: string = ''/)
assert.match(source, /@State showSearch: boolean = false/)
assert.match(
  source,
  /private searchInputController: TextInputController = new TextInputController\(\)/,
)
assert.match(source, /private HomeInlineSearchActionRow\(\)/)
assert.match(source, /private HomeInlineSearchField\(\)/)
assert.match(
  source,
  /TextInput\(\{ text: this\.searchQuery, placeholder: '搜索当前分段'/,
)
assert.match(source, /this\.searchInputController\.caretPosition/)
assert.match(source, /this\.searchInputController\.stopEditing\(\)/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-inline-search-source.test.ts tests/home-search-button-material-source.test.ts`

Expected: FAIL because `Index.ets` still has the old lower-title builder only.

- [ ] **Step 3: Write minimal implementation**

Add the search state and lifecycle in `Index.ets`:

```ts
  @State searchQuery: string = ''
  @State showSearch: boolean = false
  private searchInputController: TextInputController = new TextInputController()

  private openHomeInlineSearch(): void {
    if (!this.showSearch) {
      this.showSearch = true
    }
    this.focusHomeInlineSearch()
  }

  private focusHomeInlineSearch(): void {
    this.searchInputController.caretPosition(this.searchQuery.length)
  }

  private closeHomeInlineSearch(clearQuery: boolean = true): void {
    this.showSearch = false
    this.searchInputController.stopEditing()
    if (clearQuery) {
      this.searchQuery = ''
    }
  }
```

Replace the home lower title builder with a title + right action row:

```ts
  @Builder
  private HomeInlineSearchActionRow() {
    Row({ space: 8 }) {
      if (this.showSearch) {
        this.HomeInlineSearchField()
      }

      Row() {
        SymbolGlyph($r('sys.symbol.magnifyingglass'))
          .fontSize(18)
          .fontColor([this.theme.textPrimary])
      }
      .width(40)
      .height(40)
      .borderRadius(20)
      .backgroundColor(this.homeCollapsedModeRailBackgroundColor())
      .onClick(() => {
        this.openHomeInlineSearch()
      })
    }
  }
```

Integrate it into `HomeRootLowerTitleBuilder()`:

```ts
    Row({ space: 12 }) {
      Text('今日推荐')
        .layoutWeight(1)

      this.HomeInlineSearchActionRow()
    }
```

Reset on non-home root tabs:

```ts
  private handleRootTabChange(index: number): void {
    // existing tab sync...
    if (tabId !== 'home') {
      this.closeHomeInlineSearch(true)
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/home-inline-search-source.test.ts tests/home-search-button-material-source.test.ts`

Expected: PASS for search-state and header-structure assertions.

- [ ] **Step 5: Commit**

```bash
git add entry/src/main/ets/pages/Index.ets tests/home-inline-search-source.test.ts tests/home-search-button-material-source.test.ts
git commit -m "feat: add inline home search header state"
```

## Task 5: Wire Current-Segment Match Computation

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `apps/harmony/tests/home-inline-search-source.test.ts`
- Test: `apps/harmony/tests/home-inline-search-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
assert.match(source, /private currentSearchEntries\(\): EntryCardModel\[\]/)
assert.match(source, /return this\.filteredEntriesFor\(this\.mode\)/)
assert.match(source, /private hasSearchMatches\(\): boolean/)
assert.match(source, /buildInlineHighlightSegments/)
assert.match(source, /切换到底部其他 Tab 后，搜索框关闭/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-inline-search-source.test.ts`

Expected: FAIL because current-mode search helpers are still absent.

- [ ] **Step 3: Write minimal implementation**

```ts
  private normalizedSearchQuery(): string {
    return normalizeInlineSearchQuery(this.searchQuery)
  }

  private currentSearchEntries(): EntryCardModel[] {
    return this.filteredEntriesFor(this.mode)
  }

  private matchesAnyEntryText(texts: string[]): boolean {
    const query = this.normalizedSearchQuery()
    if (!query) {
      return false
    }
    return texts.some((text: string) => normalizeInlineSearchQuery(text).includes(query))
  }

  private hasSearchMatches(): boolean {
    return this.currentSearchEntries().some((entry: EntryCardModel) => {
      return this.matchesAnyEntryText([
        entry.feedTitle,
        entry.title,
        entry.summary,
        entry.author,
      ])
    })
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/home-inline-search-source.test.ts`

Expected: PASS for current-segment helper assertions.

- [ ] **Step 5: Commit**

```bash
git add entry/src/main/ets/pages/Index.ets tests/home-inline-search-source.test.ts
git commit -m "feat: compute current-segment home search matches"
```

## Task 6: Highlight Standard Home Cards

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `apps/harmony/tests/home-inline-search-source.test.ts`
- Test: `apps/harmony/tests/home-inline-search-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
assert.match(
  source,
  /HighlightedInlineText\(\{\s*text: entry\.feedTitle,\s*query: this\.searchQuery/s,
)
assert.match(
  source,
  /HighlightedInlineText\(\{\s*text: entry\.title,\s*query: this\.searchQuery/s,
)
assert.doesNotMatch(source, /Text\(entry\.title\)\s*\.fontSize\(15\)/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-inline-search-source.test.ts`

Expected: FAIL because `EntryCard()` still renders plain `Text(...)`.

- [ ] **Step 3: Write minimal implementation**

```ts
HighlightedInlineText({
  text: entry.feedTitle,
  query: this.searchQuery,
  theme: this.theme,
  fontSize: 12,
  lineHeight: 16,
  fontWeight: FontWeight.Medium,
  defaultColor: this.theme.accent,
  maxLines: 1,
})

HighlightedInlineText({
  text: entry.title,
  query: this.searchQuery,
  theme: this.theme,
  fontSize: 15,
  lineHeight: 22,
  fontWeight: FontWeight.Bold,
  defaultColor: this.theme.textPrimary,
  maxLines: 2,
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/home-inline-search-source.test.ts`

Expected: PASS for standard-card highlight assertions.

- [ ] **Step 5: Commit**

```bash
git add entry/src/main/ets/pages/Index.ets tests/home-inline-search-source.test.ts
git commit -m "feat: highlight standard home cards for inline search"
```

## Task 7: Highlight Tweet, Picture, And Video Content

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/PictureEntryCard.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/HomeVideoGrid.ets`
- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `apps/harmony/tests/home-inline-search-source.test.ts`
- Test: `apps/harmony/tests/home-inline-search-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
const tweetSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/TweetEntryCard.ets',
    import.meta.url,
  ),
  'utf8',
)
assert.match(tweetSource, /@Prop highlightQuery: string = ''/)
assert.match(tweetSource, /HighlightedInlineText/)

const pictureSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/PictureEntryCard.ets',
    import.meta.url,
  ),
  'utf8',
)
assert.match(pictureSource, /@Prop highlightQuery: string = ''/)
assert.match(pictureSource, /HighlightedInlineText/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-inline-search-source.test.ts`

Expected: FAIL because the auxiliary cards do not yet accept a highlight query.

- [ ] **Step 3: Write minimal implementation**

In `TweetEntryCard.ets`:

```ts
  @Prop highlightQuery: string = ''

  HighlightedInlineText({
    text: this.presentation.displayName || '未知来源',
    query: this.highlightQuery,
    theme: this.theme,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: FontWeight.Bold,
    defaultColor: this.theme.textPrimary,
    maxLines: 1,
  })
```

In `PictureEntryCard.ets`:

```ts
  @Prop highlightQuery: string = ''

  HighlightedInlineText({
    text: this.displayAuthor(),
    query: this.highlightQuery,
    theme: this.theme,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: FontWeight.Medium,
    defaultColor: this.theme.textPrimary,
    maxLines: 1,
  })
```

In `HomeVideoGrid.ets`, add an optional `highlightQuery` prop and use `HighlightedInlineText` anywhere the video title is rendered.

In `Index.ets`, pass the search query through:

```ts
TweetEntryCard({
  presentation: presentTweetEntryFromCard(entry),
  theme: this.theme,
  highlightQuery: this.searchQuery,
  enableEnterTransition: false,
  onOpen: () => this.openEntry(entry),
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/home-inline-search-source.test.ts`

Expected: PASS for tweet/picture/video highlight plumbing assertions.

- [ ] **Step 5: Commit**

```bash
git add entry/src/main/ets/common/components/TweetEntryCard.ets entry/src/main/ets/common/components/PictureEntryCard.ets entry/src/main/ets/common/components/HomeVideoGrid.ets entry/src/main/ets/pages/Index.ets tests/home-inline-search-source.test.ts
git commit -m "feat: wire inline search highlights through home content cards"
```

## Task 8: Final Verification

**Files:**

- Modify: none unless fixes are required
- Test: `apps/harmony/tests/home-inline-search-source.test.ts`
- Test: `apps/harmony/tests/home-search-button-material-source.test.ts`

- [ ] **Step 1: Run targeted source-regression tests**

Run: `node --test tests/home-inline-search-source.test.ts tests/home-search-button-material-source.test.ts`

Expected: PASS with no failing assertions.

- [ ] **Step 2: Run adjacent existing home regressions**

Run: `node --test tests/home-collapsing-mode-rail-source.test.ts tests/home-collapsing-mode-rail-interaction-source.test.ts tests/home-mode-switch-source.test.ts tests/home-video-grid.test.ts`

Expected: PASS so the new search UI does not break home rail, mode switch, or video grid contracts.

- [ ] **Step 3: Run Harmony build verification**

Run: `pnpm build:harmony:debug`

Expected: Successful ArkTS build with no new compile errors.

- [ ] **Step 4: Review diff before handoff**

Run: `git diff --stat HEAD~1..HEAD`

Expected: Changes limited to home search state, shared highlight renderer/utility, affected cards, and tests.

- [ ] **Step 5: Commit any final verification fixes**

```bash
git add entry/src/main/ets/pages/Index.ets entry/src/main/ets/common/components/HighlightedInlineText.ets entry/src/main/ets/common/utils/HomeInlineSearch.ts entry/src/main/ets/common/components/TweetEntryCard.ets entry/src/main/ets/common/components/PictureEntryCard.ets entry/src/main/ets/common/components/HomeVideoGrid.ets tests/home-inline-search-source.test.ts tests/home-search-button-material-source.test.ts
git commit -m "feat: finish harmony home inline search"
```
