# Harmony Floating Root Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the four Harmony root tabs to a shared floating-header layout where content scrolls behind the header instead of starting below a solid top block.

**Architecture:** Add a reusable floating root-page layout plus a transparent top spacer helper, then wire home, discover, subscriptions, and settings into that shell. Keep existing data loading, navigation, bottom-tab overlay rules, and per-page gestures intact while only changing layout composition.

**Tech Stack:** ArkTS, ArkUI `Stack`/`Scroll`/`List`/`Refresh`, Harmony Node tests, hvigor build.

---

## File Structure

- Create: `apps/harmony/entry/src/main/ets/common/components/FloatingRootPageLayout.ets`
  - Shared floating header shell and content-top spacer helper for root pages.
- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
  - Move the home root page to the floating shell and add top spacer inside scrollable content.
- Modify: `apps/harmony/entry/src/main/ets/common/components/DiscoverContent.ets`
  - Move discover root page to the floating shell and place the search panel inside real scroll content.
- Modify: `apps/harmony/entry/src/main/ets/common/components/SubscriptionsContent.ets`
  - Move subscriptions root page to the floating shell and add top spacer to each mode scene.
- Modify: `apps/harmony/entry/src/main/ets/common/components/SettingsContent.ets`
  - Remove header list item and use the floating shell above the settings list.
- Create: `apps/harmony/tests/root-floating-header-source.test.ts`
  - Lock the shared shell and four page integrations with source assertions.

### Task 1: Lock the Shared Floating Header Structure With a Failing Test

**Files:**

- Create: `apps/harmony/tests/root-floating-header-source.test.ts`
- Test: `apps/harmony/tests/root-floating-header-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('floating root pages share a common floating header shell', () => {
  const layoutSource = read(
    '../entry/src/main/ets/common/components/FloatingRootPageLayout.ets',
  )
  const indexSource = read('../entry/src/main/ets/pages/Index.ets')
  const discoverSource = read(
    '../entry/src/main/ets/common/components/DiscoverContent.ets',
  )
  const subscriptionsSource = read(
    '../entry/src/main/ets/common/components/SubscriptionsContent.ets',
  )
  const settingsSource = read(
    '../entry/src/main/ets/common/components/SettingsContent.ets',
  )

  assert.match(layoutSource, /export struct FloatingRootPageLayout/)
  assert.match(layoutSource, /PageHeader\(\{/)
  assert.match(indexSource, /FloatingRootPageLayout\(\{/)
  assert.match(discoverSource, /FloatingRootPageLayout\(\{/)
  assert.match(subscriptionsSource, /FloatingRootPageLayout\(\{/)
  assert.match(settingsSource, /FloatingRootPageLayout\(\{/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/root-floating-header-source.test.ts`
Expected: FAIL because the shared layout file and integrations do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `FloatingRootPageLayout.ets` with a floating `PageHeader` and a reusable top spacer builder/companion, then switch the four root pages to consume it.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/root-floating-header-source.test.ts`
Expected: PASS

### Task 2: Move Home, Discover, Subscriptions, and Settings Into the Shared Shell

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/DiscoverContent.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/SubscriptionsContent.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/SettingsContent.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/FloatingRootPageLayout.ets`
- Test: `apps/harmony/tests/root-floating-header-source.test.ts`

- [ ] **Step 1: Add content-top spacer calls inside each page's real scroll content**

Place the spacer as the first scroll item/section in:

- home `EntryList`, `PictureEntryList`, and video-grid scroll scene
- discover search/default scroll content
- subscriptions `FeedSection(mode)`
- settings list

- [ ] **Step 2: Replace fixed or in-list headers with the floating shell**

Wrap each root page body in `FloatingRootPageLayout({ ... })` and remove old direct `PageHeader` placement from fixed top columns or list items.

- [ ] **Step 3: Preserve current gestures and bottom-tab overlay behavior**

Keep:

- home refresh and horizontal pan switching
- discover overlay and bottom-tab reservation logic
- subscriptions overlay stack and horizontal pan switching
- settings sheet behavior

- [ ] **Step 4: Run focused source test**

Run: `node --test tests/root-floating-header-source.test.ts`
Expected: PASS

### Task 3: Verify Regressions Around the Touched Pages

**Files:**

- Test: `apps/harmony/tests/root-floating-header-source.test.ts`
- Test: `apps/harmony/tests/home-mode-rail-scroll-source.test.ts`
- Test: `apps/harmony/tests/subscriptions-mode-rail-scroll-source.test.ts`
- Test: `apps/harmony/tests/source-regressions.test.ts`

- [ ] **Step 1: Run focused layout regression tests**

Run: `node --test tests/root-floating-header-source.test.ts tests/home-mode-rail-scroll-source.test.ts tests/subscriptions-mode-rail-scroll-source.test.ts`
Expected: PASS

- [ ] **Step 2: Run broad source regressions**

Run: `node --test tests/source-regressions.test.ts`
Expected: PASS

- [ ] **Step 3: Run Harmony debug build**

Run: `pnpm build:harmony:debug`
Expected: build completes successfully
