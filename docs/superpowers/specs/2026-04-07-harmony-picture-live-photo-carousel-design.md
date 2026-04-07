# Harmony Picture Live Photo Carousel Design

## Goal

让 Harmony 首页“图片”栏目中的推文图片卡片同时支持静态图片和 live 图片。live 图片默认显示静态封面，并和普通图片一起进入卡片 `Swiper`；用户点击播放按钮后，直接在当前卡片页内播放。

## Current State

- `EntryCardModel.mediaUrls` 在 `LivoModels.ets` 中被裁成纯图片 URL。
- `PictureEntryCard.ets` 已有 `Swiper`，但每一页只会渲染 `Image`。
- 直接视频 URL 会在别处被视为视频媒体，因此 live 图片无法进入图片轮播。

## Design

### Data model

- 保留现有 `mediaUrls` 作为静态图片列表，避免影响已有图片调用点。
- 为图片卡片新增一份原始媒体 URL 集合，专门给图片轮播解析使用，包含静态图和直接视频 URL。
- 在 `PictureGallery.ts` 增加“图片轮播媒体项”解析，输出两类项：
  - `image`
  - `livePhoto`

### Pairing rule

- 优先按媒体原始顺序解析。
- 如果相邻的静态图和直接视频 URL 成对出现，则合并成一个 `livePhoto` 轮播项，静态图作为封面，视频 URL 作为播放源。
- 没有相邻封面的直接视频 URL 也保留为 `livePhoto` 项，并优先回退到卡片主图作为封面。

### Card interaction

- 图片卡片媒体区继续使用 `Swiper`。
- `image` 页显示静态图片。
- `livePhoto` 页默认显示封面和播放按钮。
- 点击播放按钮后，仅当前页切换为内嵌 `Video` 播放。
- 切换到其他页时停止播放并恢复封面态。
- 不自动播放，不允许多个页同时播放。

### Testing

- 为纯逻辑解析补 Node 测试，覆盖静态图、相邻 live 图配对、无封面回退。
- 为 `PictureEntryCard.ets` 补源码回归测试，锁定 `Swiper`、播放按钮、内嵌 `Video` 和切页停止播放这些实现约束。

## Scope

- 仅调整 Harmony 图片卡片的数据准备与渲染逻辑。
- 不改详情页的视频块策略。
- 不做无关 UI 重构。
