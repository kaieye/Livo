# Harmony Scrollable Mode Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mode rail on the Harmony home and subscriptions pages scroll away with the page content instead of staying fixed at the top.

**Architecture:** Keep `PageHeader` fixed on both pages, but move `ContentModeRail` into the vertical scroll content so it behaves like ordinary body content. On subscriptions, move the source-hint/count row together with the rail so the entire secondary header block scrolls away as one unit.

**Tech Stack:** ArkTS, ArkUI `Refresh`/`Scroll`/`List`, Harmony Node tests, hvigor build.

---

## File Structure

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
  - Move the home `ContentModeRail` from the fixed header block into the refresh content tree.
- Modify: `apps/harmony/entry/src/main/ets/common/components/SubscriptionsContent.ets`
  - Move the subscriptions `ContentModeRail` and the source info row into each mode's scroll content section.
- Create: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
  - Assert the home page mode rail is inside the refresh content region.
- Create: `apps/harmony/tests/subscriptions-mode-rail-scroll-source.test.ts`
  - Assert the subscriptions page mode rail and info row are inside the scroll content region.

### Task 1: Lock Home Rail Placement With a Failing Test

**Files:**

- Create: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Test: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home mode rail is rendered inside the refresh content area', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )
  const refreshStart = source.indexOf(
    'Refresh({ refreshing: $$this.isRefreshing })',
  )
  const refreshEnd = source.indexOf('  onPageShow(): void {')

  assert.notEqual(refreshStart, -1)
  assert.notEqual(refreshEnd, -1)

  const refreshSection = source.slice(refreshStart, refreshEnd)
  assert.match(refreshSection, /ContentModeRail\(\{/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-mode-rail-scroll-source.test.ts`
Expected: FAIL because `ContentModeRail` is still outside the `Refresh` section.

- [ ] **Step 3: Write minimal implementation**

Update `Index.ets` so the fixed top block keeps only `PageHeader`, and move `ContentModeRail` to the top of the `Refresh` content tree. Keep existing padding and horizontal swipe gesture behavior.

```ts
Column({ space: 10 }) {
  PageHeader({
    title: '今日推荐',
    theme: this.theme,
    trailingImage: $r('app.media.magnifyingglass'),
    trailingButtonCircular: true,
    trailingSymbolSize: 22,
    trailingButtonBackground: this.theme.isDark ? '#242A33' : '#E6E8E9',
    onTrailingClick: () => { /* existing logic unchanged */ },
  })
}
.width('100%')
.padding({
  left: PAGE_HORIZONTAL_PADDING,
  right: PAGE_HORIZONTAL_PADDING,
  top: this.topAvoidArea + PAGE_TOP_PADDING,
  bottom: 10,
})

Refresh({ refreshing: $$this.isRefreshing }) {
  Column({ space: 10 }) {
    ContentModeRail({
      mode: this.mode,
      theme: this.theme,
      onChange: (mode: SubscriptionMode) => {
        this.requestModeSwitch(mode)
      },
    })

    Stack() {
      this.ModeEntriesScene('articles')
      this.ModeEntriesScene('social')
      this.ModeEntriesScene('pictures')
      this.ModeEntriesScene('videos')
    }
    .width('100%')
    .layoutWeight(1)
    .gesture(
      PanGesture({ direction: PanDirection.Horizontal })
        .onActionEnd((event: GestureEvent) => {
          this.handleModeSwipe(event)
        })
    )
  }
  .width('100%')
  .height('100%')
  .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/home-mode-rail-scroll-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/home-mode-rail-scroll-source.test.ts apps/harmony/entry/src/main/ets/pages/Index.ets
git commit -m "feat: make home mode rail scroll with content"
```

### Task 2: Lock Subscriptions Rail Placement With a Failing Test

**Files:**

- Create: `apps/harmony/tests/subscriptions-mode-rail-scroll-source.test.ts`
- Modify: `apps/harmony/entry/src/main/ets/common/components/SubscriptionsContent.ets`
- Test: `apps/harmony/tests/subscriptions-mode-rail-scroll-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('subscriptions mode rail and source summary are rendered inside the feed section scroll content', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/SubscriptionsContent.ets',
      import.meta.url,
    ),
    'utf8',
  )
  const feedSectionStart = source.indexOf(
    '  @Builder\n  private FeedSection(mode: SubscriptionMode) {',
  )
  const feedSectionEnd = source.indexOf(
    '  @Builder\n  private ModeFeedsScene(mode: SubscriptionMode) {',
  )

  assert.notEqual(feedSectionStart, -1)
  assert.notEqual(feedSectionEnd, -1)

  const feedSection = source.slice(feedSectionStart, feedSectionEnd)
  assert.match(feedSection, /ContentModeRail\(\{/)
  assert.match(feedSection, /Text\\(this\\.sourceHint\\)/)
  assert.match(
    feedSection,
    /Text\\(`\\$\\{this\\.filteredFeeds\\(\\)\\.length\\} 个订阅源`\\)/,
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/subscriptions-mode-rail-scroll-source.test.ts`
Expected: FAIL because the rail and summary row still live in the fixed header block.

- [ ] **Step 3: Write minimal implementation**

Move `ContentModeRail` and the summary row from `SubscriptionsRoot()` into `FeedSection(mode)`, above the `订阅源` section title. Keep `PageHeader` fixed in `SubscriptionsRoot()`.

```ts
@Builder
private FeedSection(mode: SubscriptionMode) {
  Column({ space: 14 }) {
    ContentModeRail({
      mode: this.mode,
      theme: this.theme,
      onChange: (mode: SubscriptionMode) => {
        this.requestModeSwitch(mode)
      },
    })

    Row() {
      Text(this.sourceHint)
        .fontSize(META_FONT_SIZE)
        .fontColor(this.theme.textSecondary)

      Blank()

      Text(`${this.filteredFeeds().length} 个订阅源`)
        .fontSize(META_FONT_SIZE)
        .fontColor(this.theme.textMuted)
    }
    .width('100%')
    .padding({ left: 4, right: 4 })
    .transition(livoMotion.enterRise(50))

    Text('订阅源')
      .fontSize(15)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.theme.textMuted)
      .padding({ left: 4 })
      .width('100%')

    // existing empty state / feed list / spacer logic remains
  }
  .width('100%')
  .alignItems(HorizontalAlign.Start)
  .justifyContent(FlexAlign.Start)
  .constraintSize({ minHeight: '100%' })
  .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: PAGE_BOTTOM_GAP })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/subscriptions-mode-rail-scroll-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/subscriptions-mode-rail-scroll-source.test.ts apps/harmony/entry/src/main/ets/common/components/SubscriptionsContent.ets
git commit -m "feat: make subscriptions mode rail scroll with content"
```

### Task 3: Run Regression Verification

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/SubscriptionsContent.ets`
- Test: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
- Test: `apps/harmony/tests/subscriptions-mode-rail-scroll-source.test.ts`
- Test: `apps/harmony/tests/hds-bottom-tab-config.test.ts`
- Test: `apps/harmony/tests/home-video-grid.test.ts`

- [ ] **Step 1: Run focused source tests**

Run: `node --test tests/home-mode-rail-scroll-source.test.ts tests/subscriptions-mode-rail-scroll-source.test.ts`
Expected: PASS

- [ ] **Step 2: Run existing regressions around the touched areas**

Run: `node --test tests/hds-bottom-tab-config.test.ts tests/home-video-grid.test.ts`
Expected: PASS

- [ ] **Step 3: Run Harmony debug build**

Run: `pnpm build:debug`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit final verified state**

```bash
git add apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/entry/src/main/ets/common/components/SubscriptionsContent.ets apps/harmony/tests/home-mode-rail-scroll-source.test.ts apps/harmony/tests/subscriptions-mode-rail-scroll-source.test.ts
git commit -m "feat: make harmony mode rails scroll with page content"
```
