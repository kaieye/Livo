# Harmony HDS Bottom Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Harmony app's custom floating bottom tab bar with an HDS-based floating tab bar that uses adaptive immersive material while preserving the existing root-scene switching logic.

**Architecture:** Keep [`apps/harmony/entry/src/main/ets/pages/Index.ets`](e:/Livo/apps/harmony/entry/src/main/ets/pages/Index.ets) as the owner of root tab state and scene transitions. Introduce a small pure helper for HDS tab metadata and adaptive material configuration, cover that helper with Node tests, then build a new ArkTS `HdsBottomTabs` component on top of `@kit.UIDesignKit` and wire it into `Index.ets` without changing the surrounding scene/overlay architecture.

**Tech Stack:** ArkTS, HarmonyOS HDS (`@kit.UIDesignKit`), Node test runner, pnpm/hvigor Harmony build pipeline

---

## File Structure

- Create: `apps/harmony/entry/src/main/ets/common/utils/HdsBottomTabConfig.ts`
  - Pure tab metadata helpers and adaptive material selection helpers that can run under Node tests.
- Create: `apps/harmony/tests/hds-bottom-tab-config.test.ts`
  - Regression coverage for tab order, active-index mapping, and adaptive material fallback logic.
- Create: `apps/harmony/entry/src/main/ets/common/components/HdsBottomTabs.ets`
  - HDS floating bottom tab component that renders the immersive tab bar and emits tab selection events.
- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
  - Swap the current custom `BottomTabs` usage for the new `HdsBottomTabs` component while preserving hide/show behavior and existing root-tab callbacks.
- Optional follow-up only if required by compiler: `apps/harmony/entry/src/main/ets/common/navigation/AppRouter.ets`
  - Reuse existing `ROOT_TABS`/`RootTabId`; only touch if helper extraction needs a small export cleanup.

## Task 1: Add Pure HDS Bottom Tab Config Helpers

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/utils/HdsBottomTabConfig.ts`
- Test: `apps/harmony/tests/hds-bottom-tab-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveHdsBottomTabItems,
  rootTabIdToHdsIndex,
  hdsIndexToRootTabId,
  resolveAdaptiveMaterialLevel,
} from '../entry/src/main/ets/common/utils/HdsBottomTabConfig.ts'

test('resolveHdsBottomTabItems keeps the existing root tab order and labels', () => {
  assert.deepEqual(
    resolveHdsBottomTabItems().map((item) => ({
      id: item.id,
      label: item.label,
    })),
    [
      { id: 'home', label: '首页' },
      { id: 'subscriptions', label: '订阅' },
      { id: 'discover', label: '发现' },
      { id: 'settings', label: '设置' },
    ],
  )
})

test('rootTabIdToHdsIndex maps root tabs to stable HDS tab indices', () => {
  assert.equal(rootTabIdToHdsIndex('home'), 0)
  assert.equal(rootTabIdToHdsIndex('subscriptions'), 1)
  assert.equal(rootTabIdToHdsIndex('discover'), 2)
  assert.equal(rootTabIdToHdsIndex('settings'), 3)
})

test('hdsIndexToRootTabId falls back to home for invalid indices', () => {
  assert.equal(hdsIndexToRootTabId(0), 'home')
  assert.equal(hdsIndexToRootTabId(2), 'discover')
  assert.equal(hdsIndexToRootTabId(99), 'home')
})

test('resolveAdaptiveMaterialLevel keeps adaptive immersive behavior when immersive material is supported', () => {
  assert.equal(
    resolveAdaptiveMaterialLevel(['IMMERSIVE', 'ADAPTIVE']),
    'ADAPTIVE',
  )
})

test('resolveAdaptiveMaterialLevel falls back to smooth when immersive material is unavailable', () => {
  assert.equal(resolveAdaptiveMaterialLevel(['ADAPTIVE']), 'SMOOTH')
  assert.equal(resolveAdaptiveMaterialLevel([]), 'SMOOTH')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/hds-bottom-tab-config.test.ts`

Expected: FAIL with module-not-found or missing-export errors for `HdsBottomTabConfig.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { ROOT_TABS, RootTabId } from '../navigation/AppRouter'

export interface HdsBottomTabItem {
  id: RootTabId
  label: string
}

export type HdsMaterialLevelName = 'ADAPTIVE' | 'SMOOTH'

export function resolveHdsBottomTabItems(): HdsBottomTabItem[] {
  return ROOT_TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
  }))
}

export function rootTabIdToHdsIndex(tabId: RootTabId): number {
  const index = ROOT_TABS.findIndex((tab) => tab.id === tabId)
  return index >= 0 ? index : 0
}

export function hdsIndexToRootTabId(index: number): RootTabId {
  const item = ROOT_TABS[index]
  return item ? item.id : 'home'
}

export function resolveAdaptiveMaterialLevel(
  supportedTypes: string[],
): HdsMaterialLevelName {
  return supportedTypes.includes('IMMERSIVE') ? 'ADAPTIVE' : 'SMOOTH'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/hds-bottom-tab-config.test.ts`

Expected: PASS for all helper mapping and fallback cases.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/utils/HdsBottomTabConfig.ts apps/harmony/tests/hds-bottom-tab-config.test.ts
git commit -m "test: add hds bottom tab config helpers"
```

## Task 2: Implement the HDS Floating Bottom Tabs Component

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/components/HdsBottomTabs.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/utils/HdsBottomTabConfig.ts` only if the first green pass needs tiny helper additions
- Test: `apps/harmony/tests/hds-bottom-tab-config.test.ts`

- [ ] **Step 1: Write the failing test for any new helper needed by the component**

If Task 1 was enough, add one more failing test to pin the floating bottom margin the component will consume:

```ts
test('resolveHdsBottomTabBarBottomMargin keeps the floating offset aligned with the current dock spacing', () => {
  const { resolveHdsBottomTabBarBottomMargin } =
    await import('../entry/src/main/ets/common/utils/HdsBottomTabConfig.ts')
  assert.equal(resolveHdsBottomTabBarBottomMargin(18), 28)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/hds-bottom-tab-config.test.ts`

Expected: FAIL because `resolveHdsBottomTabBarBottomMargin` does not exist yet.

- [ ] **Step 3: Write minimal helper addition and the HDS component**

Helper addition in `apps/harmony/entry/src/main/ets/common/utils/HdsBottomTabConfig.ts`:

```ts
export function resolveHdsBottomTabBarBottomMargin(floatGap: number): number {
  return floatGap + 10
}
```

Initial component in `apps/harmony/entry/src/main/ets/common/components/HdsBottomTabs.ets`:

```ts
import {
  HdsTabs,
  HdsTabsController,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { SymbolGlyphModifier } from '@kit.ArkUI'

import { RootTabId } from '../navigation/AppRouter'
import {
  HdsBottomTabItem,
  hdsIndexToRootTabId,
  resolveAdaptiveMaterialLevel,
  resolveHdsBottomTabBarBottomMargin,
  resolveHdsBottomTabItems,
  rootTabIdToHdsIndex,
} from '../utils/HdsBottomTabConfig'
import { BOTTOM_TAB_FLOAT_GAP } from '../ui/UiTokens'

interface HdsBottomTabIconPair {
  normal: SymbolGlyphModifier
  selected: SymbolGlyphModifier
}

@Component
export struct HdsBottomTabs {
  @Prop activeTab: RootTabId = 'home'
  onTabRequest: (tabId: RootTabId) => void = () => {}

  private controller: HdsTabsController = new HdsTabsController()
  private items: HdsBottomTabItem[] = resolveHdsBottomTabItems()

  aboutToAppear(): void {
    this.syncController()
  }

  aboutToUpdate(): void {
    this.syncController()
  }

  private syncController(): void {
    try {
      this.controller.changeIndex(rootTabIdToHdsIndex(this.activeTab))
    } catch (_) {
    }
  }

  private materialLevel(): hdsMaterial.MaterialLevel {
    const supported = hdsMaterial.getSystemMaterialTypes().map((type) => `${type}`)
    return resolveAdaptiveMaterialLevel(supported) === 'ADAPTIVE'
      ? hdsMaterial.MaterialLevel.ADAPTIVE
      : hdsMaterial.MaterialLevel.SMOOTH
  }

  private iconPair(tabId: RootTabId): HdsBottomTabIconPair {
    switch (tabId) {
      case 'subscriptions':
        return {
          normal: new SymbolGlyphModifier($r('sys.symbol.rectangle_stack')).fontColor([
            $r('sys.color.ohos_id_color_bottom_tab_icon_off'),
          ]),
          selected: new SymbolGlyphModifier($r('sys.symbol.rectangle_stack_fill')).fontColor([
            $r('sys.color.ohos_id_color_activated'),
          ]),
        }
      case 'discover':
        return {
          normal: new SymbolGlyphModifier($r('sys.symbol.sparkle')).fontColor([
            $r('sys.color.ohos_id_color_bottom_tab_icon_off'),
          ]),
          selected: new SymbolGlyphModifier($r('sys.symbol.sparkle')).fontColor([
            $r('sys.color.ohos_id_color_activated'),
          ]),
        }
      case 'settings':
        return {
          normal: new SymbolGlyphModifier($r('sys.symbol.gearshape')).fontColor([
            $r('sys.color.ohos_id_color_bottom_tab_icon_off'),
          ]),
          selected: new SymbolGlyphModifier($r('sys.symbol.gearshape_fill')).fontColor([
            $r('sys.color.ohos_id_color_activated'),
          ]),
        }
      default:
        return {
          normal: new SymbolGlyphModifier($r('sys.symbol.house')).fontColor([
            $r('sys.color.ohos_id_color_bottom_tab_icon_off'),
          ]),
          selected: new SymbolGlyphModifier($r('sys.symbol.house_fill')).fontColor([
            $r('sys.color.ohos_id_color_activated'),
          ]),
        }
    }
  }

  build() {
    HdsTabs({ controller: this.controller }) {
      ForEach(this.items, (item: HdsBottomTabItem) => {
        TabContent() {
          Column()
            .width('100%')
            .height(1)
        }
        .tabBar(new BottomTabBarStyle(this.iconPair(item.id), item.label))
      }, (item: HdsBottomTabItem) => item.id)
    }
    .vertical(false)
    .barPosition(BarPosition.End)
    .barOverlap(true)
    .constraintSize({ minHeight: 0 })
    .barFloatingStyle({
      barBottomMargin: resolveHdsBottomTabBarBottomMargin(BOTTOM_TAB_FLOAT_GAP),
      systemMaterialEffect: {
        materialType: hdsMaterial.MaterialType.ADAPTIVE,
        materialLevel: this.materialLevel(),
      },
    })
    .onChange((index: number) => {
      this.onTabRequest(hdsIndexToRootTabId(index))
    })
  }
}
```

- [ ] **Step 4: Run test to verify the helper pass still holds**

Run: `node --test apps/harmony/tests/hds-bottom-tab-config.test.ts`

Expected: PASS with the new bottom-margin helper included.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/utils/HdsBottomTabConfig.ts apps/harmony/tests/hds-bottom-tab-config.test.ts apps/harmony/entry/src/main/ets/common/components/HdsBottomTabs.ets
git commit -m "feat: add hds bottom tabs component"
```

## Task 3: Integrate HDS Bottom Tabs into the Root Index Page

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/HdsBottomTabs.ets` only if the integration exposes a small API gap
- Verify manually in the built app after the compile step

- [ ] **Step 1: Write the failing test for any integration helper if needed**

If no additional pure helper is required, skip adding a new test file and instead pin the integration with a build failure expectation:

Run: `pnpm --dir apps/harmony build:debug`

Expected: FAIL before integration because `Index.ets` still imports and renders the old custom `BottomTabs`, so the HDS experience is not yet wired in.

- [ ] **Step 2: Replace the old bottom tab import and usage in `Index.ets`**

Update the imports:

```ts
- import { BottomTabs } from '../common/components/BottomTabs'
+ import { HdsBottomTabs } from '../common/components/HdsBottomTabs'
```

Replace the rendered component near the bottom of `build()`:

```ts
-      BottomTabs({
-        activeTab: this.highlightedRootTabId,
-        theme: this.theme,
-        useTabsController: true,
-        onTabRequest: (tabId: RootTabId) => {
-          this.requestRootTabSwitch(tabId)
-        },
-      })
+      HdsBottomTabs({
+        activeTab: this.highlightedRootTabId,
+        onTabRequest: (tabId: RootTabId) => {
+          this.requestRootTabSwitch(tabId)
+        },
+      })
         .visibility(this.shouldHideBottomTabs() ? Visibility.Hidden : Visibility.Visible)
         .opacity(this.shouldHideBottomTabs() ? 0 : 1)
         .animation({ duration: 90, curve: Curve.EaseOut })
```

Keep all existing `shouldHideBottomTabs()` logic unchanged.

- [ ] **Step 3: Adjust the HDS component if the first compile reveals controller-loop issues**

If `onChange` fires during controller sync and causes redundant tab switching, gate it with a small internal guard:

```ts
@State private suppressChange: boolean = false

private syncController(): void {
  try {
    this.suppressChange = true
    this.controller.changeIndex(rootTabIdToHdsIndex(this.activeTab))
  } catch (_) {
  } finally {
    this.suppressChange = false
  }
}

.onChange((index: number) => {
  if (this.suppressChange) {
    return
  }
  this.onTabRequest(hdsIndexToRootTabId(index))
})
```

- [ ] **Step 4: Run the Harmony build to verify integration**

Run: `pnpm --dir apps/harmony build:debug`

Expected: PASS and produce the debug Harmony build artifacts without ArkTS/HDS compile errors.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/entry/src/main/ets/common/components/HdsBottomTabs.ets
git commit -m "feat: switch harmony index to hds bottom tabs"
```

## Task 4: Final Verification and Cleanup

**Files:**

- Verify only unless a final tiny fix is required

- [ ] **Step 1: Run focused Node regression coverage**

Run: `node --test apps/harmony/tests/hds-bottom-tab-config.test.ts`

Expected: PASS.

- [ ] **Step 2: Run an existing representative regression test to catch unrelated breakage in the Harmony test harness**

Run: `node --test apps/harmony/tests/home-video-grid.test.ts`

Expected: PASS.

- [ ] **Step 3: Run the full Harmony debug build one more time**

Run: `pnpm --dir apps/harmony build:debug`

Expected: PASS.

- [ ] **Step 4: Manual runtime spot-check in the emulator or device if available**

Run one of:

```bash
pnpm --dir apps/harmony run:debug
```

or

```bash
pnpm --dir apps/harmony install:debug
```

Expected manual checks:

- The bottom tab bar is floating instead of the old custom dock.
- The bar shows HDS immersive material rather than the previous custom blur shell.
- Tapping `首页 / 订阅 / 发现 / 设置` still switches root scenes.
- Overlay-heavy states still hide the bottom bar as before.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/entry/src/main/ets/common/components/HdsBottomTabs.ets apps/harmony/entry/src/main/ets/common/utils/HdsBottomTabConfig.ts apps/harmony/tests/hds-bottom-tab-config.test.ts
git commit -m "chore: verify hds bottom tabs integration"
```

## Self-Review

- Spec coverage:
  - HDS-based bottom tab replacement: covered by Tasks 2 and 3.
  - Preserve existing root-scene architecture: covered by Task 3, which keeps `Index.ets` ownership unchanged.
  - Preserve overlay hide/show behavior: covered by Task 3 and Task 4 manual verification.
  - Adaptive immersive material from `light.md`: covered by Tasks 1 and 2 through helper fallback and HDS component configuration.
- Placeholder scan:
  - No `TODO`, `TBD`, or “similar to” placeholders remain.
- Type consistency:
  - `RootTabId`, `HdsBottomTabItem`, `rootTabIdToHdsIndex`, `hdsIndexToRootTabId`, and `resolveAdaptiveMaterialLevel` use one naming scheme across tasks.
