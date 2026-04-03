# Harmony HDS Bottom Tabs Design

## Goal

Replace the current custom floating bottom navigation in the Harmony app with an HDS-based floating tab bar that matches the immersive material effect shown in `apps/harmony/light.md`, while keeping the existing root-scene switching architecture in place.

## Scope

In scope:

- Replace the current bottom navigation rendering used by the Harmony root page with an HDS-based implementation.
- Preserve the existing root tab state, scene transition logic, and overlay hide/show behavior.
- Reuse the existing tab definitions and labels from the current app router.
- Use HDS floating tab styling with adaptive immersive material.

Out of scope:

- Rewriting the app to use `HdsNavigation + HdsTabs + TabContent` as the full root container.
- Refactoring unrelated page structure, routing, or overlay architecture.
- Reworking header behavior or converting all top-level pages to HDS navigation shells.

## Current State

The current Harmony root navigation is centered in [`apps/harmony/entry/src/main/ets/pages/Index.ets`](apps/harmony/entry/src/main/ets/pages/Index.ets). That page:

- Holds the active root tab state with `activeRootTabId`, `highlightedRootTabId`, and transition state.
- Switches root scenes manually through `RootScene(...)`.
- Renders the custom bottom bar with [`apps/harmony/entry/src/main/ets/common/components/BottomTabs.ets`](apps/harmony/entry/src/main/ets/common/components/BottomTabs.ets).
- Hides the bottom bar when foreground overlays are active.

The existing bottom bar visually imitates a floating dock by combining blur, border, shadow, and custom media icons. It does not use HDS material capabilities.

## Proposed Approach

Introduce a new HDS-backed bottom navigation component for the Harmony root page, while preserving the existing page-content orchestration in `Index.ets`.

Recommended structure:

- Keep `Index.ets` as the owner of root-tab state and scene transitions.
- Replace the custom bottom bar instance in `Index.ets` with a new HDS tab component.
- Have the new component receive the active tab and emit tab selection callbacks back to `Index.ets`.
- Use HDS floating tab APIs to apply the adaptive immersive material effect from `light.md`.

This keeps the behavioral contract stable while swapping the visual/interaction shell to HDS.

## Component Design

### New HDS tab component

Create a new component in the Harmony shared components area, for example:

- `apps/harmony/entry/src/main/ets/common/components/HdsBottomTabs.ets`

Responsibilities:

- Render the four root tabs.
- Reflect the current active tab.
- Notify the parent when the user selects a different tab.
- Apply HDS floating styling and immersive material effect.

Non-responsibilities:

- Owning root-scene content.
- Driving route transitions itself.
- Managing overlay state.

### Existing custom component

The current `BottomTabs.ets` can remain temporarily for compatibility while `Index.ets` migrates to the HDS component. After validation, the project can decide whether to delete it or migrate other call sites in a follow-up change.

## State and Data Flow

The new HDS component should integrate with the existing root-tab state model:

- `Index.ets` remains the single source of truth for the selected root tab.
- The HDS tab component receives the current tab id as a prop.
- When the user taps a tab, the HDS component calls a callback such as `onTabRequest(tabId)`.
- `Index.ets` continues to call `requestRootTabSwitch(tabId)`.

Overlay behavior remains unchanged:

- `Index.ets` still decides when the bottom bar should be hidden.
- The new HDS component is wrapped in the same visibility/opacity handling already used for the custom bar.

## Visual Behavior

The HDS tab bar should match the intent of `apps/harmony/light.md`:

- Floating bottom placement.
- Adaptive immersive material effect via system-managed material settings.
- Standard HDS selection/highlight behavior.
- Harmony-consistent icon and label rendering.

Implementation preference:

- Use adaptive material first, following the recommended system strategy from `light.md`.
- Defer custom material-level switching unless required by runtime behavior or build compatibility.

## File Changes

Expected primary changes:

- Update [`apps/harmony/entry/src/main/ets/pages/Index.ets`](apps/harmony/entry/src/main/ets/pages/Index.ets) to replace the current custom bottom tab usage.
- Add a new HDS bottom tab component under [`apps/harmony/entry/src/main/ets/common/components`](apps/harmony/entry/src/main/ets/common/components).

Possible secondary changes:

- Update shared tab metadata usage if HDS tab-bar data needs a slightly different shape.
- Add or adjust design tokens only if necessary for spacing or sizing alignment.

Not planned in this change:

- Converting `SubscriptionsContent`, `DiscoverContent`, or `SettingsContent` to independent HDS tab containers.

## Risks

### HDS integration mismatch

The HDS tabs API may be optimized for use inside a full `HdsNavigation` shell. If the floating bar cannot be cleanly embedded as a standalone bottom component, the implementation may need a lightweight wrapper strategy inside `Index.ets`.

### State synchronization issues

If the HDS tab controller maintains its own selected index, it must remain synchronized with the app's `RootTabId` state. A mismatch could cause highlight drift or double transitions.

### Overlay visibility regressions

The current app deliberately hides the bottom bar in overlay-heavy states. The HDS version must preserve that behavior exactly.

## Testing and Verification

Verification should cover:

- Root tab selection switches scenes correctly.
- Active tab highlight stays in sync with app state.
- Overlay-driven hide/show still works.
- The Harmony app builds successfully after the change.

Preferred verification commands:

- `pnpm build:harmony:debug`

If code changes touch logic that can be covered by node-executable regression tests, add or update those tests. Pure visual HDS integration may instead rely mainly on build verification plus manual runtime inspection.

## Decision Summary

This change should adopt HDS for the bottom floating navigation effect only, without replacing the current root-scene architecture. That gives the app the immersive floating HDS visual treatment from `light.md` while keeping risk and scope controlled.
