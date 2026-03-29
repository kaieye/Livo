# Harmony Header Alignment Design

**Date:** 2026-03-29

## Goal

Unify the top header layout used by the Harmony app so that:

- the back-button slot sits on a consistent horizontal baseline
- the left-aligned page title starts from a consistent horizontal position
- current chevron styling stays unchanged
- back-button interaction gets a clearer click animation

## Scope

This change covers Harmony pages and panels that currently render custom top headers in multiple ways:

- settings root header
- settings secondary panels shown in sheet overlays
- feed detail style pages
- discover flow pages with custom back headers
- subscription config pages

The desktop app is out of scope.

## Reference Rule

Follow the alignment rule observed in `E:\ClashBox-master` settings headers:

- outer page inset uses `16vp`
- back button keeps a fixed `40vp` slot
- when a back button exists, the title starts after an additional `8vp` gap
- when no back button exists, the title starts directly from the `16vp` inset

## Design

Introduce one reusable Harmony header component under the shared Harmony component folder.

The component should support:

- `title`
- optional `subtitle`
- `theme`
- `showBackButton`
- `onBack`
- optional trailing content for right-side actions
- configurable top/bottom padding so the same component can serve full pages and sheet panels

The component should preserve the existing chevron glyph look instead of replacing it with a new icon treatment.

## Interaction

Add click feedback to the back button without changing its visual style:

- keep the same chevron glyph styling now used in current pages
- add ArkUI click effect
- add a light pressed-state animation, such as scale and/or opacity adjustment, that feels responsive but subtle

## Affected Areas

The following existing implementations should be converged onto the shared header:

- `PageHeader.ets`
- `AppearanceSettingsPanel.ets`
- `SettingsSecondaryPanels.ets`
- `FeedDetailView.ets`
- `FeedSubscribeConfigView.ets`
- discover detail/config destinations that still hand-roll a back row

## Non-Goals

- redesigning the arrow glyph itself
- reworking page body spacing unrelated to the header
- changing information hierarchy beyond alignment and shared behavior

## Verification

Verification should confirm:

- all targeted pages compile
- left title alignment is consistent between pages with and without back buttons
- settings sheet panels and full pages both use the new shared rule
- back-button click feedback is present and does not break navigation
