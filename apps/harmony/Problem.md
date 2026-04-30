# 项目代码 Review 记录

> 每 5 个文件停顿一次，等待用户说"继续"再推进。

## 遍历顺序（自下而上：基础配置 → 数据 → 模型 → 仓储 → 服务 → 工具 → UI/组件 → 导航 → 页面 → 入口）

### 第 01 批（已完成）

1. `entry/src/main/ets/common/AppConfig.ets`
2. `entry/src/main/ets/common/data/AppRepository.ets`
3. `entry/src/main/ets/common/data/ArrayLazyDataSource.ets`
4. `entry/src/main/ets/common/data/DiscoverBuiltinFeeds.ets`
5. `entry/src/main/ets/common/data/SeedData.ets`

### 第 02 批（已完成）

6. `entry/src/main/ets/common/models/LivoModels.ets`
7. `entry/src/main/ets/common/repositories/EntryRepository.ets`
8. `entry/src/main/ets/common/repositories/FeedRepository.ets`
9. `entry/src/main/ets/common/services/AccountSelfCheckService.ets`
10. `entry/src/main/ets/common/services/AccountSessionService.ets`

### 第 03 批（已完成）

11. `entry/src/main/ets/common/services/AppDatabaseService.ets`
12. `entry/src/main/ets/common/services/AppPreferenceService.ets`
13. `entry/src/main/ets/common/services/AppContextService.ets`
14. `entry/src/main/ets/common/services/ArticleAssistService.ets`
15. `entry/src/main/ets/common/services/BilibiliFollowingsService.ets`

### 第 04 批（已完成）

16. `entry/src/main/ets/common/services/DiscoverRemoteSearchService.ets`
17. `entry/src/main/ets/common/services/DiscoverService.ets`
18. `entry/src/main/ets/common/services/ExternalUrlService.ets`
19. `entry/src/main/ets/common/services/MediaSaveService.ets`
20. `entry/src/main/ets/common/services/MovingPhotoService.ets`

#### 第 04 批发现的问题及修复

| #   | 文件                                              | 问题                                                                | 修复                                                                                                                                                                                   |
| --- | ------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `DiscoverRemoteSearchService.ets`                 | 文件 947 行，混合了 X/Instagram/Bilibili/YouTube 四个平台的搜索逻辑 | 拆分为 4 个子服务：`discover-remote/XUserSearchService.ets`、`InstagramUserSearchService.ets`、`BilibiliUserSearchService.ets`、`YouTubeChannelSearchService.ets`；主文件缩减至 ~70 行 |
| 2   | `MediaSaveService.ets` + `MovingPhotoService.ets` | 两个文件各自实现了相同的 HTTP 下载 → 写沙盒文件逻辑，代码重复       | 提取公共工具 `utils/MediaDownloadUtil.ets`，两个服务均改为调用 `downloadToSandbox()`                                                                                                   |
| 3   | `MediaSaveService.ets`                            | 扩展名判断用多个 `===` 串联，可读性差                               | 改用 `Array.includes()`                                                                                                                                                                |
| 4   | `ExternalUrlService.ets`                          | ✅ 无问题                                                           | —                                                                                                                                                                                      |
| 5   | `DiscoverService.ets`                             | ✅ 功能内聚，无需拆分                                               | —                                                                                                                                                                                      |

#### 新增文件

- `entry/src/main/ets/common/services/discover-remote/XUserSearchService.ets`
- `entry/src/main/ets/common/services/discover-remote/InstagramUserSearchService.ets`
- `entry/src/main/ets/common/services/discover-remote/BilibiliUserSearchService.ets`
- `entry/src/main/ets/common/services/discover-remote/YouTubeChannelSearchService.ets`
- `entry/src/main/ets/common/utils/MediaDownloadUtil.ets`

---

### 第 05 批（已完成）

21. `entry/src/main/ets/common/services/VideoResolverService.ets`
22. `entry/src/main/ets/common/services/SocialFeedAvatarService.ets`
23. `entry/src/main/ets/common/services/RssFeedService.ets`
24. `entry/src/main/ets/common/services/ThemeService.ets`
25. `entry/src/main/ets/common/utils/OpmlParser.ets`

#### 第 05 批发现的问题及修复

| #   | 文件                          | 问题                                                 | 修复                                                                                                                                          |
| --- | ----------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `RssFeedService.ets`          | 943行，混合解析/HTTP/编排三层职责；~30处调试日志残留 | 拆分为 `rss-feed/RssFeedParser.ets`（纯解析）、`rss-feed/RssFeedFetcher.ets`（HTTP层）、`rss-feed/RssFeedService.ets`（编排）；旧文件改为转发 |
| 2   | `VideoResolverService.ets`    | ✅ 无问题                                            | —                                                                                                                                             |
| 3   | `SocialFeedAvatarService.ets` | ✅ 无问题                                            | —                                                                                                                                             |
| 4   | `ThemeService.ets`            | ✅ 无问题                                            | —                                                                                                                                             |
| 5   | `OpmlParser.ets`              | ✅ 无问题                                            | —                                                                                                                                             |

#### 顺带修复的 build 错误（遗留自第 04 批）

| 文件                              | 错误                                 | 修复                                  |
| --------------------------------- | ------------------------------------ | ------------------------------------- |
| `BilibiliUserSearchService.ets`   | 内联对象类型 `{ result?: ... }`      | 提取为具名接口                        |
| `YouTubeChannelSearchService.ets` | map 返回无类型对象字面量             | 加 `: ResolvedDiscoverCandidate` 标注 |
| `InstagramUserSearchService.ets`  | `{ ...candidate, targetUrl }` spread | 改为手动字段赋值                      |
| `BilibiliFollowingsService.ets`   | `TextDecoder` 未定义                 | 改用 `util.TextDecoder`               |
| `ArticleAssistService.ets`        | `TextDecoder` 未定义                 | 改用 `util.TextDecoder`               |
| `AppDatabaseService.ets`          | `throw error`（非 Error 类型）       | 改为 `throw new Error(...)`           |
| `RssFeedFetcher.ets`              | 数组/对象 spread（ArkTS 不支持）     | 改为 `concat()` + 手动 key 赋值       |

#### 新增文件

- `entry/src/main/ets/common/services/rss-feed/RssFeedParser.ets`
- `entry/src/main/ets/common/services/rss-feed/RssFeedFetcher.ets`
- `entry/src/main/ets/common/services/rss-feed/RssFeedService.ets`

### 第 06 批（已完成）

26. `entry/src/main/ets/common/utils/HtmlParser.ets`
27. `entry/src/main/ets/common/utils/FeedChangeSignal.ets`
28. `entry/src/main/ets/common/utils/HomeModeMeta.ets`
29. `entry/src/main/ets/common/utils/HomeReloadPolicy.ets`
30. `entry/src/main/ets/common/utils/RefreshStateManager.ets`

#### 第 06 批发现的问题及修复

| #   | 文件             | 问题                   | 修复             |
| --- | ---------------- | ---------------------- | ---------------- |
| 1   | `HtmlParser.ets` | 每个函数都有 WHAT 注释 | 移除全部多余注释 |
| 2-5 | 其余 4 个文件    | ✅ 无问题              | —                |

### 第 07 批（已完成）

31. `entry/src/main/ets/common/utils/RootTabVisibilityPolicy.ets`
32. `entry/src/main/ets/common/utils/MediaDownloadUtil.ets`
33. `entry/src/main/ets/entryability/EntryAbility.ets`
34. `entry/src/main/ets/common/navigation/AppRouter.ets`
35. `entry/src/main/ets/pages/Index.ets`

#### 第 07 批发现的问题及修复

| #   | 文件                          | 问题                                                                                                                                                      | 修复                                                                                    |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | `RootTabVisibilityPolicy.ets` | ✅ 无问题                                                                                                                                                 | —                                                                                       |
| 2   | `MediaDownloadUtil.ets`       | ✅ 无问题                                                                                                                                                 | —                                                                                       |
| 3   | `EntryAbility.ets`            | ✅ 无问题                                                                                                                                                 | —                                                                                       |
| 4   | `AppRouter.ets`               | `ROOT_TABS` 用 IIFE 构造对象冗余；`openDiscoverPreview` 是无意义转发                                                                                      | 提取 `makeTab()` 辅助函数；删除 `openDiscoverPreview`                                   |
| 5   | `Index.ets`                   | 4499行，混合8+职责；`describeError`/`cloneHomeSnapshotEntry`/`resolveEntryMode`/`filterEntriesByMode`/`isTweetLikeEntry`/搜索逻辑等纯函数内联在 struct 中 | 提取纯函数到 `HomeEntryUtils.ets` 和 `HomeSearchHelper.ets`；`Index.ets` 缩减至 4334 行 |

#### 新增文件

- `entry/src/main/ets/common/utils/HomeEntryUtils.ets`
- `entry/src/main/ets/common/utils/HomeSearchHelper.ets`

#### 第 07 批补充拆分（Index.ets 继续精简）

| 操作                        | 内容                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| `HomeModeRail` Builder 简化 | 删除4个重复的 if/else 分支，统一用 `this.mode`                                |
| 提取 `HomePullDebugSession` | 9个 pull-debug 字段 + 4个方法 → `utils/HomePullDebugSession.ets`              |
| 提取 `HomePerfLogger`       | `homePerfSessionId/StartedAt` 字段 + 3个日志方法 → `utils/HomePerfLogger.ets` |
| `modeSceneState` 辅助方法   | 合并5处重复的 `resolveModeSceneRenderState` 调用                              |
| **最终行数**                | 4499 → 4189（减少 310 行），`pnpm build:debug` 通过                           |

#### 新增文件（补充）

- `entry/src/main/ets/common/utils/HomePullDebugSession.ets`
- `entry/src/main/ets/common/utils/HomePerfLogger.ets`

---

## 进度

- 已审查文件数：**35**
- 总文件数（估算）：**~124**
- 当前进度：**35 / 124 ≈ 28.2%**
- 状态：✅ 第 07 批已完成（含 Index.ets 深度拆分），`pnpm build:debug` 通过，进入第 08 批
