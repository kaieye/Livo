# Home Collapsing Mode Rail Design

## Goal

On the Harmony home page, the fixed mode rail below the title should collapse into a single centered capsule inside the title bar as the page scrolls upward.

The interaction should feel like one control transforming, not one control disappearing and another appearing.

## Scope

In scope:

- Home page only: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Home mode rail rendering: `apps/harmony/entry/src/main/ets/common/components/ContentModeRail.ets`
- Source-based regression tests for the collapsing behavior

Out of scope:

- Subscriptions page rail behavior
- Search button behavior
- Root tab behavior
- New animation systems or unrelated layout refactors

## User Experience

### Expanded state

- The rail remains fixed below the title, exactly where it is today.
- It shows all four segments: articles, social, pictures, videos.
- It keeps the current translucent and blurred material styling.

### Transition state

- As the page scrolls upward, the rail progressively shrinks.
- Non-selected segments fade out during the transition.
- The selected segment remains visually anchored and becomes the dominant element.
- The whole control moves upward toward the visual center of the mini title bar.

### Collapsed state

- The rail becomes a single capsule centered in the title bar.
- It shows only the currently selected mode's icon and label.
- The search button stays on the right and does not overlap the centered capsule.

## Interaction

- Expanded state: current behavior remains, users can tap any segment to switch modes.
- Collapsed state: tapping the capsule expands the rail back to the full segmented control first.
- The collapsed capsule itself does not directly switch to other modes.
- Horizontal swipe mode switching continues to work as it does today.

## Motion Rules

- Drive the transition from the existing home scroll progress signal rather than introducing a separate scroll-tracking system.
- Use a clamped transition progress from 0 to 1.
- The expanded and collapsed states should be endpoints of one continuous transform:
  - width shrinks
  - x/y position changes
  - non-selected items fade out
  - selected item remains readable throughout

## Layout Rules

- The fixed rail layer remains outside the scroll content.
- Scroll content keeps a spacer equal to the expanded rail footprint so content does not jump.
- The collapsed capsule must align with the visual center of the title bar, not the center of the page content.
- The right-side floating search button remains above the page and keeps its current hit area.

## Implementation Approach

### Index page

- Keep the home rail in a fixed overlay layer.
- Add a derived collapse progress based on existing header blur progress.
- Add a dedicated collapsed-title placement for the rail within the home root page.
- Preserve current content top spacing for the expanded layout.

### ContentModeRail

- Add rendering support for two visual modes:
  - expanded segmented rail
  - collapsed single-capsule rail
- Keep the same selected icon and label mapping in both modes.
- Keep the same material style family across both modes.

## Testing

- Add source tests asserting the home page owns a fixed collapsing rail wrapper.
- Add source tests asserting the collapsed rail renders a single selected item state.
- Keep current tests covering non-animated mode switching and fixed overlay placement passing.

## Risks

- Misalignment with the title bar center if the transform is based on page width instead of title bar geometry.
- Overlap with the floating search button on narrow layouts.
- Abrupt visual change if opacity and width transitions do not share the same progress.

## Acceptance Criteria

- When the home page is at the top, the full segmented rail is shown below the title.
- When the page is scrolled upward enough, the rail becomes one centered capsule in the title bar.
- The centered capsule shows the current mode only.
- The search button remains visible and non-overlapping.
- The page content remains clickable throughout.
