# Harmony Discover Chip Recommendations Design

## Background

Harmony 端“发现”页已经有推荐源 fallback 机制，但当前推荐数据主要是通用文章源。`YouTube`、`Bilibili`、`X`、`Instagram` 这几个 chip 切换后，往往因为缺少对应平台的内置推荐数据而出现空列表，导致各平台入口体验不完整。

本次改动只补齐 Discover 页的内置推荐源覆盖，不调整现有搜索、订阅、远程探测、详情预览和订阅状态判断逻辑。

## Goals

- 让“发现”页的每个 chip 在空搜索状态下都能展示一组推荐源。
- 保持现有推荐区、搜索区、订阅判断和点击跳转行为不变。
- 推荐源数据尽量稳定、可读，并与当前平台筛选逻辑兼容。

## Non-Goals

- 不做动态推荐、个性化推荐或在线拉取推荐。
- 不改动 Discover 页的 UI 结构和交互方式。
- 不新增平台类型，也不重构 Discover 搜索架构。
- 不修改订阅后的刷新、预览或内容解析逻辑。

## Approach

采用“扩充静态推荐数据”的最小方案：

- 继续复用 `DiscoverService.ets` 中现有的 `RECOMMENDED_FEEDS`。
- 为 `YouTube`、`Bilibili`、`X`、`Instagram` 分别补一批内置示例源。
- 保持 `discoverFeedPlatform()` 作为推荐源归类入口，不新增额外筛选层。
- `DiscoverContent.ets` 中的 `recommendedFallback()` 与 `localRecommendedResults()` 逻辑不改，只让它们拿到更完整的数据集。

## Data Design

### Recommended Feed Coverage

`RECOMMENDED_FEEDS` 需要满足以下覆盖规则：

- `all`：继续展示整张推荐表的混合结果。
- `youtube`：至少有 4 个视频类推荐源。
- `bilibili`：至少有 4 个视频类或动态类推荐源。
- `x`：至少有 4 个社交类推荐源。
- `instagram`：至少有 4 个图片类推荐源。

### Feed Shape

每条推荐源继续沿用当前结构：

- `title`
- `url`
- `siteUrl`
- `description`
- `view`
- `category`

不新增字段，避免连带修改推荐卡片、结果列表和订阅配置页。

### Platform Mapping

推荐源必须与当前 `discoverFeedPlatform()` 兼容：

- `YouTube` 推荐源使用 `youtube.com` 或 `/youtube/` 路径。
- `Bilibili` 推荐源使用 `bilibili.com` 或 `/bilibili/` 路径。
- `X` 推荐源使用 `x.com`、`twitter.com`、`nitter` 或 `/x/user/` 路径。
- `Instagram` 推荐源使用 `instagram.com` 或 `/instagram/` 路径。

这样可以保证 chip 切换时无需额外分支，就能正确命中推荐结果。

## UX Behavior

空搜索时：

- 每个 chip 都展示自己的推荐源列表。
- 已经订阅过的推荐源继续被过滤掉。
- 如果某个 chip 的推荐源部分被订阅过滤，剩余推荐数量允许减少，但不应因为数据表本身缺项而天然为空。

搜索时：

- 保持当前行为，远程结果优先，本地推荐匹配作为兜底。
- 平台 chip 下的推荐搜索只在该平台的数据范围内匹配。

## Source Selection Principles

示例源选择遵循以下标准：

- 公开可访问，尽量不依赖登录。
- 来源名称用户可识别，不用测试名或占位名。
- URL 形式与现有 Harmony 订阅链路兼容。
- 尽量选择长期稳定的官方号、知名账号或公共内容源。

## Testing

至少补一条回归测试，覆盖：

- `DiscoverService.ets` 的推荐数据在 `youtube`、`bilibili`、`x`、`instagram` 四个平台下都能返回非空结果。

如有需要，可额外补充 source-based 测试，确认 `DiscoverContent.ets` 仍通过 `filteredRecommendedFeedsByPlatform()` 生成 fallback，而不是引入新的分叉逻辑。

## Risks

- 某些社交平台示例源未来可能失效，但这属于数据维护问题，不影响本次结构设计。
- 如果后续用户大量订阅同一平台的推荐源，某个 chip 仍可能因为“已订阅过滤”而暂时变少；这属于现有产品逻辑，非本次缺陷。

## Rollout

本次作为纯本地数据增强上线，不需要数据迁移，也不需要兼容开关。
