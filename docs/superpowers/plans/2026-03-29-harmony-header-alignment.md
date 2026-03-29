# Harmony Header Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify Harmony page headers around one shared component with consistent back-button/title alignment and click feedback.

**Architecture:** Keep the existing Harmony UI structure but consolidate header layout rules into one reusable component. Replace scattered hand-written top rows and panel titles with that shared component while preserving current chevron visuals and existing page actions.

**Tech Stack:** ArkTS, ArkUI declarative UI, Harmony component composition, existing `ThemeService` and `UiTokens`

---

### Task 1: Define Shared Header API And Tokens

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/ui/UiTokens.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/PageHeader.ets`

- [ ] Add explicit header spacing tokens for page inset, back slot width, title gap, and common heights.
- [ ] Expand `PageHeader.ets` into a reusable shared header that supports optional back button, optional subtitle, and optional trailing action area.
- [ ] Preserve the current chevron visual treatment while adding click feedback animation to the back action.

### Task 2: Migrate Settings Headers

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/SettingsContent.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/AppearanceSettingsPanel.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/SettingsSecondaryPanels.ets`

- [ ] Replace settings root header usage with the new shared header API.
- [ ] Replace sheet panel title blocks with the shared header so they follow the same left alignment rule.
- [ ] Preserve sheet drag handles and panel body spacing.

### Task 3: Migrate Detail And Discover Flow Headers

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/FeedSubscribeConfigView.ets`
- Modify: `apps/harmony/entry/src/main/ets/pages/DiscoverPreview.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/DiscoverContent.ets`

- [ ] Replace hand-written back-header rows with the shared header where the page uses the same alignment model.
- [ ] Keep page-specific trailing actions like edit, subscribe, or save.
- [ ] Preserve any page-specific centered content only if it is still required after alignment unification; otherwise normalize to shared left-aligned titles.

### Task 4: Verify Build Safety

**Files:**

- No source-file additions expected beyond Task 1-3 scope

- [ ] Run a targeted Harmony search to ensure no known old header patterns remain in the touched files.
- [ ] Run a fresh Harmony build or type-check style command available in the repo to catch ArkTS compile issues.
- [ ] Review the diff for accidental edits in generated or unrelated files before reporting completion.
