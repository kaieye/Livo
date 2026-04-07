# Home Right-Collapsing Mode Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the Harmony home mode rail so it collapses horizontally toward the right edge of the page instead of moving upward into the title center.

**Architecture:** Keep the home mode rail in the root overlay layer above the title blur, but change the home overlay layout math in `Index.ets` so the rail's top offset stays stable while its width and horizontal alignment move right with scroll progress. Keep `ContentModeRail.ets` responsible only for expanded versus collapsed visual states and let the parent own the rightward collapse path.

**Tech Stack:** ArkTS, ArkUI, HarmonyOS HDS navigation, source-based Node tests, hvigor build validation

---

### Task 1: Lock the new rightward collapse path in source tests

**Files:**

- Modify: `apps/harmony/tests/home-collapsing-mode-rail-source.test.ts`
- Modify: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
- Test: `apps/harmony/tests/home-collapsing-mode-rail-source.test.ts`
- Test: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`

- [ ] **Step 1: Write the failing test updates**

```ts
assert.match(
  source,
  /private homeCollapsedModeRailTopPadding\(\): number \{[\s\S]*HOME_FLOATING_SEARCH_BUTTON_TOP_PADDING[\s\S]*HOME_FLOATING_SEARCH_BUTTON_SIZE[\s\S]*HOME_MODE_RAIL_HEIGHT/s,
)
assert.match(source, /private homeModeRailRightInset\(\): number/)
assert.match(source, /private homeModeRailLeftPadding\(\): number/)
assert.match(
  source,
  /private HomeCollapsingModeRailLayer\(\) \{[\s\S]*left: this\.homeModeRailLeftPadding\(\)[\s\S]*right: this\.homeModeRailRightInset\(\)/s,
)
assert.match(
  source,
  /private HomeCollapsingModeRailLayer\(\) \{[\s\S]*alignItems\(HorizontalAlign\.End\)/s,
)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-collapsing-mode-rail-source.test.ts tests/home-mode-rail-scroll-source.test.ts`
Expected: FAIL with missing `homeModeRailRightInset` / `homeModeRailLeftPadding` or missing right-aligned overlay assertions

- [ ] **Step 3: Write minimal implementation targets in `Index.ets`**

```ts
private homeModeRailRightInset(): number {
  return PAGE_HORIZONTAL_PADDING
}

private homeModeRailLeftPadding(): number {
  return PAGE_HORIZONTAL_PADDING
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/home-collapsing-mode-rail-source.test.ts tests/home-mode-rail-scroll-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/tests/home-collapsing-mode-rail-source.test.ts apps/harmony/tests/home-mode-rail-scroll-source.test.ts
git commit -m "test: lock home right-collapsing rail layout"
```

### Task 2: Make the home overlay collapse horizontally toward the right edge

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `apps/harmony/tests/home-collapsing-mode-rail-source.test.ts`
- Test: `apps/harmony/tests/home-collapsing-mode-rail-source.test.ts`
- Test: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`

- [ ] **Step 1: Write the failing test for right-edge math**

```ts
assert.match(source, /private homeModeRailRightInset\(\): number/)
assert.match(source, /private homeModeRailLeftPadding\(\): number/)
assert.match(source, /private homeCollapsedModeRailWidth\(\): number/)
assert.match(
  source,
  /private homeModeRailLeftPadding\(\): number \{[\s\S]*PAGE_HORIZONTAL_PADDING[\s\S]*this\.homeModeRailCollapseProgress\(\)/s,
)
assert.match(
  source,
  /private HomeCollapsingModeRailLayer\(\) \{[\s\S]*\.padding\(\{[\s\S]*left: this\.homeModeRailLeftPadding\(\),[\s\S]*right: this\.homeModeRailRightInset\(\),[\s\S]*\}\)/s,
)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-collapsing-mode-rail-source.test.ts`
Expected: FAIL because the overlay still uses symmetric fixed page padding and centered alignment

- [ ] **Step 3: Implement the real rightward collapse math**

```ts
private homeModeRailRightInset(): number {
  return PAGE_HORIZONTAL_PADDING
}

private homeModeRailLeftPadding(): number {
  const progress = this.homeModeRailCollapseProgress()
  const availableRailTravel = Math.max(0, this.homeCollapsedModeRailMaxWidth() + 20)
  return PAGE_HORIZONTAL_PADDING + availableRailTravel * progress
}

@Builder
private HomeCollapsingModeRailLayer() {
  Stack({ alignContent: Alignment.Top }) {
    Column({ space: ROOT_MODE_RAIL_TOP_GAP }) {
      Row()
        .width('100%')
        .height(0)

      Row() {
        this.HomeModeRail({
          collapsed: this.homeModeRailCollapseProgress() >= 1,
          collapseProgress: this.homeModeRailCollapseProgress(),
        })
      }
      .width(this.homeModeRailCollapseProgress() >= 1 ? this.homeCollapsedModeRailWidth() : '100%')
      .constraintSize({
        maxWidth: this.homeModeRailCollapseProgress() >= 1 ? this.homeCollapsedModeRailMaxWidth() : undefined,
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.End)
    .align(Alignment.Top)
  }
  .width('100%')
  .padding({
    top: this.homeModeRailTopPadding(),
    left: this.homeModeRailLeftPadding(),
    right: this.homeModeRailRightInset(),
  })
  .zIndex(100)
}
```

- [ ] **Step 4: Run tests to verify the rightward path**

Run: `node --test tests/home-collapsing-mode-rail-source.test.ts tests/home-mode-rail-scroll-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/tests/home-collapsing-mode-rail-source.test.ts
git commit -m "feat: move home collapsing rail toward the right edge"
```

### Task 3: Keep the collapsed capsule visually single-layer while parent controls horizontal motion

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/ContentModeRail.ets`
- Modify: `apps/harmony/tests/content-mode-rail-collapsed-source.test.ts`
- Modify: `apps/harmony/tests/content-mode-rail-material-source.test.ts`
- Test: `apps/harmony/tests/content-mode-rail-collapsed-source.test.ts`
- Test: `apps/harmony/tests/content-mode-rail-material-source.test.ts`

- [ ] **Step 1: Write the failing test for parent-owned motion**

```ts
assert.match(source, /private railShellWidth\(\): Length/)
assert.match(source, /private railShellBackgroundColor\(\): string/)
assert.match(source, /private railShellBorderWidth\(\): number/)
assert.match(
  source,
  /private railShellBackgroundColor\(\): string \{[\s\S]*this\.collapsed \? '#00000000' : this\.railBackgroundColor\(\)/s,
)
assert.match(
  source,
  /private CollapsedRail\(\) \{[\s\S]*\.backgroundColor\(this\.indicatorColor\(\)\)[\s\S]*\.border\(\{ width: 0\.6, color: this\.indicatorBorderColor\(\) \}\)/s,
)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/content-mode-rail-collapsed-source.test.ts tests/content-mode-rail-material-source.test.ts`
Expected: FAIL if the component has drifted away from the single-layer collapsed shell behavior

- [ ] **Step 3: Implement the visual guardrails**

```ts
private railShellPadding(): Padding {
  if (this.collapsed) {
    return { left: 0, right: 0, top: 0, bottom: 0 }
  }

  return { left: 4, right: 4, top: 4, bottom: 4 }
}

private railShellBackgroundColor(): string {
  return this.collapsed ? '#00000000' : this.railBackgroundColor()
}

private railShellBorderWidth(): number {
  return this.collapsed ? 0 : 0.8
}
```

- [ ] **Step 4: Run tests to verify collapsed rendering still passes**

Run: `node --test tests/content-mode-rail-collapsed-source.test.ts tests/content-mode-rail-material-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/components/ContentModeRail.ets apps/harmony/tests/content-mode-rail-collapsed-source.test.ts apps/harmony/tests/content-mode-rail-material-source.test.ts
git commit -m "feat: preserve single-layer collapsed rail shell"
```

### Task 4: Verify right-edge spacing and search-button separation

**Files:**

- Modify: `apps/harmony/tests/home-collapsing-mode-rail-interaction-source.test.ts`
- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Test: `apps/harmony/tests/home-collapsing-mode-rail-interaction-source.test.ts`
- Test: `apps/harmony/tests/home-search-button-material-source.test.ts`

- [ ] **Step 1: Write the failing spacing test**

```ts
assert.match(indexSource, /private homeModeRailRightInset\(\): number/)
assert.match(indexSource, /private homeCollapsedModeRailTopPadding\(\): number/)
assert.match(indexSource, /private homeCollapsedModeRailMaxWidth\(\): number/)
assert.match(
  indexSource,
  /private HomeCollapsingModeRailLayer\(\) \{[\s\S]*alignItems\(HorizontalAlign\.End\)[\s\S]*right: this\.homeModeRailRightInset\(\)/s,
)
assert.match(
  railSource,
  /if \(this\.collapsed\) \{\s*this\.onExpandRequest\(\)\s*return\s*\}/s,
)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-collapsing-mode-rail-interaction-source.test.ts tests/home-search-button-material-source.test.ts`
Expected: FAIL if the right-edge inset or collapsed expand-first behavior is missing

- [ ] **Step 3: Implement the spacing guardrails**

```ts
private homeCollapsedModeRailMaxWidth(): number {
  return 132
}

private homeModeRailRightInset(): number {
  return PAGE_HORIZONTAL_PADDING
}
```

- [ ] **Step 4: Run tests to verify interaction and spacing**

Run: `node --test tests/home-collapsing-mode-rail-interaction-source.test.ts tests/home-search-button-material-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/tests/home-collapsing-mode-rail-interaction-source.test.ts apps/harmony/entry/src/main/ets/pages/Index.ets
git commit -m "test: guard home rail right-edge spacing"
```

### Task 5: Run the focused regression suite and Harmony build

**Files:**

- Modify: `apps/harmony/tests/home-collapsing-mode-rail-source.test.ts`
- Modify: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
- Modify: `apps/harmony/tests/content-mode-rail-collapsed-source.test.ts`
- Modify: `apps/harmony/tests/content-mode-rail-material-source.test.ts`
- Test: `apps/harmony/tests/home-collapsing-mode-rail-source.test.ts`
- Test: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
- Test: `apps/harmony/tests/home-collapsing-mode-rail-interaction-source.test.ts`
- Test: `apps/harmony/tests/content-mode-rail-collapsed-source.test.ts`
- Test: `apps/harmony/tests/content-mode-rail-material-source.test.ts`
- Test: `apps/harmony/tests/home-search-button-material-source.test.ts`

- [ ] **Step 1: Tighten the final source assertions**

```ts
assert.doesNotMatch(source, /title-bar center/)
assert.match(source, /alignItems\(HorizontalAlign\.End\)/)
assert.match(source, /left: this\.homeModeRailLeftPadding\(\)/)
assert.match(source, /right: this\.homeModeRailRightInset\(\)/)
```

- [ ] **Step 2: Run the focused source regression suite**

Run: `node --test tests/home-collapsing-mode-rail-source.test.ts tests/home-mode-rail-scroll-source.test.ts tests/home-collapsing-mode-rail-interaction-source.test.ts tests/content-mode-rail-collapsed-source.test.ts tests/content-mode-rail-material-source.test.ts tests/home-search-button-material-source.test.ts`
Expected: PASS

- [ ] **Step 3: Run Harmony build validation**

Run: `pnpm build:harmony:debug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Review the implementation diff**

Run: `git diff -- apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/entry/src/main/ets/common/components/ContentModeRail.ets apps/harmony/tests`
Expected: only rightward collapse path and related regression changes

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/entry/src/main/ets/common/components/ContentModeRail.ets apps/harmony/tests
git commit -m "feat: make home mode rail collapse to the right"
```

## Spec Coverage Check

- Rightward horizontal collapse path: covered by Tasks 1 and 2.
- Stable vertical placement: covered by Task 2.
- Single-capsule collapsed state: covered by Task 3.
- Separation from search button: covered by Task 4.
- Root overlay above title blur: covered by Tasks 1, 2, and 5.

## Placeholder Scan

- No `TODO`, `TBD`, or deferred implementation notes remain.
- Every testing step includes an exact command and expected outcome.
- Every code change step includes concrete file-level code to anchor implementation.

## Type Consistency Check

- `homeModeRailCollapseProgress`, `homeModeRailLeftPadding`, and `homeModeRailRightInset` are used consistently as home overlay helpers.
- `collapsed`, `collapseProgress`, and `onExpandRequest` remain the `ContentModeRail` interface used by `Index.ets`.
- Collapsed single-layer shell helpers remain `railShellBackgroundColor`, `railShellBorderWidth`, and `railShellBackdropBlur` in `ContentModeRail.ets`.
