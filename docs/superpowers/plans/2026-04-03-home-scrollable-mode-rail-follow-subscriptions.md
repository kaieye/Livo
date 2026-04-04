# Home Scrollable Mode Rail Follow Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home page mode rail scroll away with the mode content using the same UI organization pattern as the subscriptions page.

**Architecture:** Keep `PageHeader` fixed at the top of the home page, but move `ContentModeRail` into each mode scene's actual vertical scroll content so the rail and the cards share one scroll container. Reuse the existing per-mode scene structure and refresh gesture, and keep horizontal padding on the inner content builders so card width does not shrink.

**Tech Stack:** ArkTS, ArkUI `Refresh`/`Scroll`/`List`, Node source regression tests

---

### Task 1: Lock the expected home structure with a failing test

**Files:**

- Create: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`

- [ ] **Step 1: Write the failing test**

```ts
test('home mode rail is rendered inside the mode scene content instead of the fixed home header', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  const homeRootStart = source.indexOf('private HomeRootPage() {')
  const pageShowStart = source.indexOf('onPageShow(): void {')
  const modeSceneStart = source.indexOf(
    'private ModeEntriesScene(mode: SubscriptionMode) {',
  )
  const homeRoot = source.slice(homeRootStart, pageShowStart)
  const modeScene = source.slice(modeSceneStart, homeRootStart)

  assert.doesNotMatch(homeRoot, /ContentModeRail\(\{/)
  assert.match(modeScene, /ContentModeRail\(\{/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-mode-rail-scroll-source.test.ts`
Expected: FAIL because `ContentModeRail` is still inside `HomeRootPage()`

- [ ] **Step 3: Write minimal implementation**

```ts
@Builder
private EntrySection(mode: SubscriptionMode) {
  Column({ space: 10 }) {
    ContentModeRail({ ... })
    // mode-specific content
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/home-mode-rail-scroll-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/home-mode-rail-scroll-source.test.ts entry/src/main/ets/pages/Index.ets
git commit -m "feat: move home mode rail into scroll content"
```

### Task 2: Align home scene builders with the subscriptions page scroll organization

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`

- [ ] **Step 1: Extract per-mode scroll content builders**

```ts
@Builder
private EntrySection(mode: SubscriptionMode) { ... }

@Builder
private PictureEntrySection() { ... }

@Builder
private VideoEntrySection(mode: SubscriptionMode) { ... }
```

- [ ] **Step 2: Keep padding on inner content, not outer scroll wrappers**

```ts
.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
```

- [ ] **Step 3: Wrap each scene in a single vertical scroll container**

```ts
Scroll() {
  this.EntrySection(mode)
}
```

- [ ] **Step 4: Keep the existing horizontal swipe gesture on the outer `Refresh` stack**

```ts
.gesture(
  PanGesture({ direction: PanDirection.Horizontal })
    .onActionEnd((event: GestureEvent) => {
      this.handleModeSwipe(event)
    })
)
```

- [ ] **Step 5: Re-check source structure manually**

Confirm:

- `HomeRootPage()` fixed header contains only `PageHeader`
- `ContentModeRail` appears in the mode content builders
- Card/list padding remains inside the content builders

### Task 3: Verify behavior and stability

**Files:**

- Test: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
- Test: `apps/harmony/tests/subscriptions-mode-rail-scroll-source.test.ts`
- Test: `apps/harmony/tests/system-bar-style.test.ts`
- Test: `apps/harmony/tests/theme-refresh.test.ts`
- Test: `apps/harmony/tests/hds-bottom-tab-config.test.ts`
- Test: `apps/harmony/tests/home-video-grid.test.ts`

- [ ] **Step 1: Run the focused source regression tests**

Run: `node --test tests/home-mode-rail-scroll-source.test.ts tests/subscriptions-mode-rail-scroll-source.test.ts`
Expected: PASS

- [ ] **Step 2: Run the related home/system regression tests**

Run: `node --test tests/system-bar-style.test.ts tests/theme-refresh.test.ts tests/hds-bottom-tab-config.test.ts tests/home-video-grid.test.ts`
Expected: PASS

- [ ] **Step 3: Run the Harmony debug build**

Run: `pnpm build:debug`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Device smoke check**

Run:

```bash
pnpm install:debug
pnpm run:debug
```

Expected:

- app launches successfully
- home page enters normally
- home mode rail scrolls away with content

- [ ] **Step 5: Commit**

```bash
git add entry/src/main/ets/pages/Index.ets tests/home-mode-rail-scroll-source.test.ts
git commit -m "feat: align home mode rail scroll behavior with subscriptions"
```
