# Harmony YouTube Player Page Design

**Date:** 2026-03-31

## Goal

让 Harmony 端点击 YouTube 视频后，不再在文章卡片内展开网页播放器，而是进入独立的视频播放页。

## Problem

当前 [ArticleDetail.ets](/e:/Livo/apps/harmony/entry/src/main/ets/pages/ArticleDetail.ets) 会在视频卡片内部直接渲染 `Video` 或 `Web`。当 YouTube 直链解析失败时，页面会退回到 Web 播放器，导致用户看到“卡片里打开网页”的体验。

## Chosen Approach

1. 保留 `VideoResolverService` 的直链解析逻辑。
2. 新增一个独立的 `VideoPlayer` 页面，负责承载原生视频或 YouTube Web 回退。
3. `ArticleDetail` 中的 YouTube 卡片点击后直接跳转 `VideoPlayer`，不再在卡片内部展开播放器。
4. 非 YouTube 的直链视频仍保持原有文章内播放，缩小本次改动面。

## Data Flow

1. 用户在 [ArticleDetail.ets](/e:/Livo/apps/harmony/entry/src/main/ets/pages/ArticleDetail.ets) 点击 YouTube 视频卡片。
2. 页面调用路由辅助方法，传入 `videoUrl`、`previewUrl`、`title`。
3. [VideoPlayer.ets](/e:/Livo/apps/harmony/entry/src/main/ets/pages/VideoPlayer.ets) 加载后调用 [VideoResolverService.ets](/e:/Livo/apps/harmony/entry/src/main/ets/common/services/VideoResolverService.ets)。
4. 若解析出 `playableUrl`，使用原生 `Video` 播放。
5. 若没有直链但存在 YouTube fallback，页面内用 `Web` 承载回退播放器。

## Constraints

- 不再在文章卡片内渲染 YouTube Web 回退。
- 保持现有 YouTube 直链解析逻辑与回退 URL 规则。
- 只新增最小路由和页面，不重构整个文章详情布局。

## Verification

- 单测覆盖播放器页模式选择的纯逻辑。
- 跑 YouTube 播放相关单测。
- 跑 `pnpm --filter @livo/harmony run build:debug`。
