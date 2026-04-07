# Home Right-Collapsing Mode Rail Design

## Goal

Adjust the Harmony home page mode rail so that its collapse motion no longer moves upward into the title center. Instead, it should collapse horizontally toward the right side of the page and end as a single capsule near the page's right edge.

## Scope

In scope:

- Home page rail positioning and collapse path in `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Home mode rail expanded/collapsed rendering behavior in `apps/harmony/entry/src/main/ets/common/components/ContentModeRail.ets`
- Source-based regression tests covering the new rightward collapse path

Out of scope:

- Search button behavior
- Subscriptions page rail behavior
- Root tab bar behavior
- Any unrelated title bar blur or search overlay redesign

## User Experience

### Expanded state

- The rail stays in its current fixed overlay position below the title area.
- It continues to show all four segments with the existing translucent material styling.

### Transition state

- As the page scrolls upward, the rail does not travel upward into the title bar center anymore.
- The rail progressively narrows in width.
- Non-selected segments fade away during the transition.
- The whole rail shifts horizontally toward the right side of the page.
- The vertical position stays visually stable relative to the current fixed rail row.

### Collapsed state

- The rail becomes a single capsule showing the active mode only.
- The capsule sits on the right side of the page, aligned within the home overlay area.
- It is not centered in the title bar.
- It remains visually separate from the search button.

## Interaction

- Expanded state keeps the current tap-to-switch mode behavior.
- Collapsed state keeps the current "tap to expand first" behavior.
- Horizontal swipe mode switching remains unchanged.

## Motion Rules

- Continue to drive the collapse from the existing `headerBlurProgress`.
- Use one clamped progress value from `0` to `1`.
- During the transition:
  - width shrinks
  - horizontal position moves right
  - vertical position stays essentially fixed
  - non-selected items fade out

## Layout Rules

- Keep the rail mounted in the root overlay layer so it stays above the title blur material.
- Preserve the existing content spacer so scrolling content does not jump.
- Keep a right-edge resting position based on page padding, not on title bar center geometry.
- Avoid overlap with the floating search button by keeping the collapsed capsule on the rail row, not the search-button row.

## Implementation Approach

### Index page

- Replace the current collapsed top-padding logic with a stable row-aligned top offset.
- Add a derived horizontal alignment or width calculation so the rail transitions toward the right side.
- Keep the home collapsing rail mounted from the root `build()` overlay layer.

### ContentModeRail

- Preserve the current single-layer collapsed capsule rendering.
- Keep expanded rail rendering unchanged except for transition-driven width behavior from the parent.

## Testing

- Add or update source tests asserting that the collapse path no longer targets the title-bar center.
- Add or update source tests asserting the home collapsing rail remains in the root overlay.
- Keep current collapsed-capsule and search-button source regressions passing.

## Risks

- The collapsed capsule could drift too close to the search button on narrower layouts if right spacing is not explicit.
- If width and horizontal translation use different progress curves, the motion can feel like sliding and snapping instead of one continuous collapse.
- If the top offset still depends on title-bar centering math, the rail may keep appearing too high even after moving right.

## Acceptance Criteria

- When the page is at the top, the full segmented rail appears where it does today.
- As the page scrolls upward, the rail narrows and moves toward the page's right side.
- The rail does not move into the title-bar center anymore.
- The collapsed state is a single capsule on the page's right side.
- The rail remains above the title blur material.
