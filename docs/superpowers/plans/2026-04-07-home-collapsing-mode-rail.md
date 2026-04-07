# Home Collapsing Mode Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Harmony home mode rail collapse into a single centered title-bar capsule as the page scrolls upward, while preserving the expanded fixed rail and current mode switching behavior.

**Architecture:** Keep the home rail as a fixed overlay owned by `Index.ets`, but drive its layout from a derived collapse progress based on the existing home header scroll signal. Teach `ContentModeRail.ets` to render both an expanded segmented rail and a collapsed single-mode capsule so the transition still feels like one control transforming instead of two unrelated controls swapping.

**Tech Stack:** ArkTS, ArkUI, HarmonyOS HDS navigation, source-based Node tests

---

### Task 1: Lock the collapsing rail API in tests

**Files:**

- Modify: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
- Create: `apps/harmony/tests/home-collapsing-mode-rail-source.test.ts`
- Test: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
- Test: `apps/harmony/tests/home-collapsing-mode-rail-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home page derives a collapsing mode rail progress and centers the collapsed rail in the title bar', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /private homeModeRailCollapseProgress\(\): number/)
  assert.match(source, /private HomeCollapsingModeRailLayer\(\)/)
  assert.match(
    source,
    /private HomeCollapsingModeRailLayer\(\) \{[\s\S]*this\.HomeModeRail\(\{[\s\S]*collapsed: this\.homeModeRailCollapseProgress\(\) >= 1[\s\S]*collapseProgress: this\.homeModeRailCollapseProgress\(\)/s,
  )
  assert.match(
    source,
    /private HomeCollapsingModeRailLayer\(\) \{[\s\S]*\.align\(Alignment\.Top\)/s,
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-collapsing-mode-rail-source.test.ts`
Expected: FAIL with missing `homeModeRailCollapseProgress` / `HomeCollapsingModeRailLayer`

- [ ] **Step 3: Write minimal implementation**

```ts
private homeModeRailCollapseProgress(): number {
  return Math.max(0, Math.min(this.headerBlurProgress / 1, 1))
}

@Builder
private HomeCollapsingModeRailLayer() {
  this.HomeModeRail({
    collapsed: this.homeModeRailCollapseProgress() >= 1,
    collapseProgress: this.homeModeRailCollapseProgress(),
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/home-collapsing-mode-rail-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/tests/home-mode-rail-scroll-source.test.ts apps/harmony/tests/home-collapsing-mode-rail-source.test.ts
git commit -m "test: lock home collapsing mode rail structure"
```

### Task 2: Add collapsed and transitional rendering to ContentModeRail

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/ContentModeRail.ets`
- Create: `apps/harmony/tests/content-mode-rail-collapsed-source.test.ts`
- Test: `apps/harmony/tests/content-mode-rail-collapsed-source.test.ts`
- Test: `apps/harmony/tests/content-mode-rail-material-source.test.ts`
- Test: `apps/harmony/tests/content-mode-rail-no-animation-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('content mode rail supports collapsed single-capsule rendering', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/ContentModeRail.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(source, /@Prop collapsed: boolean = false/)
  assert.match(source, /@Prop collapseProgress: number = 0/)
  assert.match(source, /private collapsedLabel\(\): string/)
  assert.match(source, /private collapsedIcon\(\)/)
  assert.match(source, /private CollapsedRail\(\)/)
  assert.match(
    source,
    /if \(this\.collapsed\) \{\s*this\.CollapsedRail\(\)\s*\}/s,
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/content-mode-rail-collapsed-source.test.ts`
Expected: FAIL with missing `collapsed` / `CollapsedRail`

- [ ] **Step 3: Write minimal implementation**

```ts
@Prop collapsed: boolean = false
@Prop collapseProgress: number = 0

private collapsedLabel(): string {
  return this.labelFor(this.mode)
}

@Builder
private CollapsedRail() {
  Row({ space: 6 }) {
    this.ModeIcon(this.mode)
    Text(this.collapsedLabel())
      .fontSize(14)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.activeTextColor())
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/content-mode-rail-collapsed-source.test.ts`
Expected: PASS

- [ ] **Step 5: Expand the implementation to full collapsed rendering**

```ts
@Builder
private CollapsedRail() {
  Row({ space: 6 }) {
    this.ModeIcon(this.mode)

    Text(this.collapsedLabel())
      .fontSize(14)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.activeTextColor())
  }
  .height(38)
  .padding({ left: 14, right: 14 })
  .justifyContent(FlexAlign.Center)
  .borderRadius(CHIP_RADIUS)
  .backgroundColor(this.indicatorColor())
  .border({ width: 0.6, color: this.indicatorBorderColor() })
}

build() {
  if (this.collapsed) {
    Stack() {
      this.CollapsedRail()
    }
    .height(46)
    .padding(4)
    .backgroundColor(this.railBackgroundColor())
    .backdropBlur(this.railBackdropBlur())
    .borderRadius(CARD_RADIUS_SM)
    .border({ width: 0.8, color: this.railBorderColor() })
    return
  }

  // existing expanded rail path stays here
}
```

- [ ] **Step 6: Run tests to verify collapsed rendering and existing material behavior**

Run: `node --test tests/content-mode-rail-collapsed-source.test.ts tests/content-mode-rail-material-source.test.ts tests/content-mode-rail-no-animation-source.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/components/ContentModeRail.ets apps/harmony/tests/content-mode-rail-collapsed-source.test.ts apps/harmony/tests/content-mode-rail-material-source.test.ts apps/harmony/tests/content-mode-rail-no-animation-source.test.ts
git commit -m "feat: add collapsed content mode rail rendering"
```

### Task 3: Drive the collapsing rail transition from home scroll progress

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
- Modify: `apps/harmony/tests/home-collapsing-mode-rail-source.test.ts`
- Test: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
- Test: `apps/harmony/tests/home-collapsing-mode-rail-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('home page moves the fixed rail into the title bar center as scroll progress increases', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /const HOME_MODE_RAIL_COLLAPSE_RANGE: number = 1/)
  assert.match(source, /private homeModeRailCollapseProgress\(\): number/)
  assert.match(source, /private homeCollapsedModeRailTopPadding\(\): number/)
  assert.match(source, /private homeCollapsedModeRailWidth\(\): Length/)
  assert.match(
    source,
    /private HomeCollapsingModeRailLayer\(\) \{[\s\S]*\.padding\(\{[\s\S]*top: this\.homeCollapsedModeRailTopPadding\(\)/s,
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-collapsing-mode-rail-source.test.ts`
Expected: FAIL with missing collapse range / top padding / width helpers

- [ ] **Step 3: Write minimal implementation**

```ts
const HOME_MODE_RAIL_COLLAPSE_RANGE: number = 1

private homeModeRailCollapseProgress(): number {
  return Math.max(0, Math.min(this.headerBlurProgress / HOME_MODE_RAIL_COLLAPSE_RANGE, 1))
}

private homeCollapsedModeRailTopPadding(): number {
  return this.topAvoidArea + 8
}

private homeCollapsedModeRailWidth(): Length {
  return '100%'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/home-collapsing-mode-rail-source.test.ts`
Expected: PASS

- [ ] **Step 5: Expand the implementation to the real transition**

```ts
private homeModeRailCollapseProgress(): number {
  return Math.max(0, Math.min(this.headerBlurProgress / 0.72, 1))
}

private homeExpandedModeRailTopPadding(): number {
  return HOME_MODE_CONTENT_TOP_SPACER_HEIGHT
}

private homeCollapsedModeRailTopPadding(): number {
  return this.topAvoidArea + 6
}

private homeModeRailTopPadding(): number {
  const progress = this.homeModeRailCollapseProgress()
  return this.homeExpandedModeRailTopPadding()
    + (this.homeCollapsedModeRailTopPadding() - this.homeExpandedModeRailTopPadding()) * progress
}

private homeCollapsedModeRailWidth(): number {
  return 112
}

private homeExpandedModeRailWidth(): string {
  return '100%'
}
```

- [ ] **Step 6: Run tests to verify fixed-layer ownership still passes**

Run: `node --test tests/home-mode-rail-scroll-source.test.ts tests/home-collapsing-mode-rail-source.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/tests/home-mode-rail-scroll-source.test.ts apps/harmony/tests/home-collapsing-mode-rail-source.test.ts
git commit -m "feat: drive home rail collapse from scroll progress"
```

### Task 4: Preserve search button spacing and collapsed interaction safety

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/ContentModeRail.ets`
- Create: `apps/harmony/tests/home-collapsing-mode-rail-interaction-source.test.ts`
- Test: `apps/harmony/tests/home-collapsing-mode-rail-interaction-source.test.ts`
- Test: `apps/harmony/tests/home-search-button-material-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('collapsed home rail keeps the search button clear and expands before switching', () => {
  const indexSource = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )
  const railSource = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/ContentModeRail.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(indexSource, /private homeCollapsedModeRailMaxWidth\(\): number/)
  assert.match(indexSource, /HOME_FLOATING_SEARCH_BUTTON_SIZE/)
  assert.match(railSource, /@Prop collapsed: boolean = false/)
  assert.match(
    railSource,
    /if \(this\.collapsed\) \{\s*this\.onExpandRequest\(\)\s*return\s*\}/s,
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-collapsing-mode-rail-interaction-source.test.ts`
Expected: FAIL with missing expand request behavior

- [ ] **Step 3: Write minimal implementation**

```ts
@Prop onExpandRequest: () => void = () => {}

private handleCollapsedTap(): void {
  this.onExpandRequest()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/home-collapsing-mode-rail-interaction-source.test.ts`
Expected: PASS

- [ ] **Step 5: Expand the implementation to real spacing and tap behavior**

```ts
private homeCollapsedModeRailMaxWidth(): number {
  return 132
}

private requestExpandedModeRail(): void {
  this.articlesScroller.scrollTo({ xOffset: 0, yOffset: 0, animation: { duration: 220, curve: Curve.EaseOut } })
}
```

- [ ] **Step 6: Run tests to verify search button and collapsed interaction constraints**

Run: `node --test tests/home-collapsing-mode-rail-interaction-source.test.ts tests/home-search-button-material-source.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/entry/src/main/ets/common/components/ContentModeRail.ets apps/harmony/tests/home-collapsing-mode-rail-interaction-source.test.ts apps/harmony/tests/home-search-button-material-source.test.ts
git commit -m "feat: protect collapsed rail interaction and spacing"
```

### Task 5: Verify the full collapsing mode rail behavior

**Files:**

- Modify: `apps/harmony/tests/home-collapsing-mode-rail-source.test.ts`
- Modify: `apps/harmony/tests/content-mode-rail-collapsed-source.test.ts`
- Test: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
- Test: `apps/harmony/tests/home-collapsing-mode-rail-source.test.ts`
- Test: `apps/harmony/tests/home-collapsing-mode-rail-interaction-source.test.ts`
- Test: `apps/harmony/tests/content-mode-rail-collapsed-source.test.ts`
- Test: `apps/harmony/tests/content-mode-rail-material-source.test.ts`
- Test: `apps/harmony/tests/home-search-button-material-source.test.ts`

- [ ] **Step 1: Tighten the final source assertions**

```ts
assert.match(source, /collapseProgress: this\.homeModeRailCollapseProgress\(\)/)
assert.match(source, /collapsed: this\.homeModeRailCollapseProgress\(\) >= 1/)
assert.match(source, /opacity\(1 - this\.homeModeRailCollapseProgress\(\)\)/)
```

- [ ] **Step 2: Run the focused regression suite**

Run: `node --test tests/home-mode-rail-scroll-source.test.ts tests/home-collapsing-mode-rail-source.test.ts tests/home-collapsing-mode-rail-interaction-source.test.ts tests/content-mode-rail-collapsed-source.test.ts tests/content-mode-rail-material-source.test.ts tests/home-search-button-material-source.test.ts tests/content-mode-rail-no-animation-source.test.ts`
Expected: PASS

- [ ] **Step 3: Review the diff for unintended layout regressions**

Run: `git diff -- apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/entry/src/main/ets/common/components/ContentModeRail.ets apps/harmony/tests`
Expected: only collapsing rail and related test changes

- [ ] **Step 4: Commit**

```bash
git add apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/entry/src/main/ets/common/components/ContentModeRail.ets apps/harmony/tests
git commit -m "feat: add collapsing home title mode rail"
```

## Spec Coverage Check

- Expanded fixed rail: covered by Tasks 2 and 3.
- Collapse into one centered title-bar capsule: covered by Tasks 2 and 3.
- Keep current mode label and icon: covered by Task 2.
- Search button stays clear: covered by Task 4.
- Collapsed tap expands before switching: covered by Task 4.
- Regression protection: covered by Tasks 1, 2, 4, and 5.

## Placeholder Scan

- No `TODO`, `TBD`, or deferred “handle later” steps remain.
- Every testing step includes an exact command and expected result.
- Every code step includes concrete file-level code to anchor implementation.

## Type Consistency Check

- `collapsed`, `collapseProgress`, and `onExpandRequest` are consistently named across `Index.ets`, `ContentModeRail.ets`, and tests.
- `homeModeRailCollapseProgress`, `homeModeRailTopPadding`, and `homeCollapsedModeRailMaxWidth` are consistently referenced as home-specific helpers.
