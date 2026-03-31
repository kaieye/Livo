# Harmony YouTube Direct Playback Design

## Goal

让 Harmony 端对于 YouTube 订阅源中的视频，尽可能像 desktop 一样优先在应用内直接播放，而不是停留在“无法解析直链”状态。

本次只解决 Harmony 端已有纯客户端链路的稳定性，不引入新后端服务，不改变现有文章详情页的主要交互。

## Current Gap

desktop 端之所以更容易成功，不只是因为它也会尝试 Invidious/Piped，而是因为：

1. 解析入口明确，先提取 YouTube video id。
2. 先走 Invidious，再走 Piped。
3. 优先选择真正可播放的 combined mp4 / hls。
4. 解析结果交给原生播放器，而不是先落回网页。
5. 解析运行在 Electron 主进程 `net` 环境中，兼容性比 Harmony 端直接请求公共实例更强。

Harmony 当前问题主要在 [VideoResolverService.ets](/e:/Livo/apps/harmony/entry/src/main/ets/common/services/VideoResolverService.ets)：

1. 解析策略虽然类似 desktop，但没有把“可播放流选择规则”抽清楚。
2. Invidious / Piped 的候选流筛选还不够贴近 desktop。
3. 解析失败和超时边界不够细，最终经常落成“无法解析直链”。

## Chosen Approach

采用“强化 Harmony 端现有直链解析链”的方案，不新增服务。

具体做法：

1. 对齐 desktop 的 YouTube id 提取与流选择规则。
2. 把 Invidious 和 Piped 的候选结果判断抽成纯函数，便于测试。
3. 优先返回：
   - Invidious 的最高质量可播放 mp4 combined stream
   - Piped 的 hls
   - Piped 的非 `videoOnly` mp4 stream
4. 保持 [ArticleDetail.ets](/e:/Livo/apps/harmony/entry/src/main/ets/pages/ArticleDetail.ets) 当前主流程不变：
   - 解析成功：应用内原生 `Video` 播放
   - 解析失败：仍显示现有失败提示

## Non-Goals

这次不做：

1. 新增后端解析服务
2. 接入 OAuth 或 YouTube 官方 API
3. 恢复 YouTube 网页壳作为默认回退
4. 重做文章详情页 UI

## Implementation Outline

### 1. Video Resolver

调整 [VideoResolverService.ets](/e:/Livo/apps/harmony/entry/src/main/ets/common/services/VideoResolverService.ets)：

1. 保留现有实例列表。
2. 新增更明确的流选择辅助函数：
   - 选择最佳 Invidious playable stream
   - 选择最佳 Piped playable stream
3. 把“解析失败”区分为：
   - 无 video id
   - 实例请求失败
   - 返回成功但没有可用流

### 2. Tests

在 `apps/harmony/tests/` 新增针对解析策略的测试：

1. Invidious 有多个流时，优先最高质量 mp4。
2. Piped 有 hls 时，优先 hls。
3. Piped 只有 mixed mp4 时，返回 mixed mp4。
4. 无可用流时，返回空字符串。

### 3. Playback Integration

[ArticleDetail.ets](/e:/Livo/apps/harmony/entry/src/main/ets/pages/ArticleDetail.ets) 只做必要收口：

1. 保持现有 `resolveAndPlayYouTubeVideo()` 入口。
2. 继续优先用 `activeVideoPlayableUrl` 驱动原生 `Video`。
3. 不新增新的回退页面逻辑。

## Risks

1. 公共 Invidious/Piped 实例本身仍可能不稳定，这次只能提升成功率，不能保证 100%。
2. 即使拿到 URL，Harmony 原生 `Video` 对某些流格式仍可能兼容有限。
3. 如果最终问题主要来自 Harmony 网络栈而不是流选择规则，本次收益会有限。

## Verification

实施后至少验证：

1. `node --test apps/harmony/tests/*.test.ts`
2. `pnpm --filter @livo/harmony run build:debug`
3. 真机点击 YouTube 订阅源视频，确认能否直接在应用内进入原生播放器
