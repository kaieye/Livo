# Harmony YouTube Player Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Harmony YouTube playback out of the article card and into a dedicated player page.

**Architecture:** Keep the existing YouTube direct-resolution service, add a dedicated `VideoPlayer` route, and let `ArticleDetail` navigate there for YouTube videos. The player page owns the direct-video-vs-web-fallback decision.

**Tech Stack:** ArkTS, ArkUI, Harmony router, `@ohos.web.webview`, Harmony `Video`, Node test runner

---

### Task 1: Add player page decision helper

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/utils/VideoPlayerState.ts`
- Test: `apps/harmony/tests/video-player-state.test.ts`

- [ ] Write the failing test for direct playback and fallback selection.
- [ ] Run `node --test apps/harmony/tests/video-player-state.test.ts` and confirm it fails.
- [ ] Implement the minimal helper.
- [ ] Run the test again and confirm it passes.

### Task 2: Add Harmony player route and page

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/navigation/AppRouter.ets`
- Modify: `apps/harmony/entry/src/main/resources/base/profile/main_pages.json`
- Create: `apps/harmony/entry/src/main/ets/pages/VideoPlayer.ets`

- [ ] Add route constants and params for `VideoPlayer`.
- [ ] Implement `VideoPlayer` using the helper and existing `VideoResolverService`.
- [ ] Keep YouTube fallback inside the player page, not in the article card.

### Task 3: Switch ArticleDetail YouTube clicks to the player page

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/ArticleDetail.ets`

- [ ] Route YouTube clicks to the dedicated player page.
- [ ] Preserve inline playback for direct non-YouTube media.
- [ ] Remove card-level YouTube web fallback rendering.

### Task 4: Verify behavior

**Files:**

- Test: `apps/harmony/tests/video-player-state.test.ts`
- Test: `apps/harmony/tests/youtube-playback-url.test.ts`

- [ ] Run `node --test apps/harmony/tests/video-player-state.test.ts apps/harmony/tests/youtube-playback-url.test.ts apps/harmony/tests/youtube-playback-display.test.ts apps/harmony/tests/video-playable-selection.test.ts`
- [ ] Run `pnpm --filter @livo/harmony run build:debug`
