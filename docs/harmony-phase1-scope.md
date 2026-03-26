# Livo Harmony Phase 1 Scope

目标：明确桌面端到 HarmonyOS NEXT 的首期迁移范围、字段映射、平台重写边界和暂不迁移项，作为后续 RDB 设计、Repository 拆分和页面接线的基线。

基于当前代码判断：

- 桌面核心模型来源于 `packages/models/src/types.ts`
- Harmony 当前模型来源于 `apps/harmony/entry/src/main/ets/common/models/LivoModels.ets`
- Harmony 当前仍是“页面壳 + MockRepository + Preferences + 简单 RSS 请求”的演示结构

## 首期迁移目标

首期只解决“一个独立可用的移动端 RSS 阅读器”所必须的闭环：

1. 订阅源管理
2. RSS 拉取与本地持久化
3. 条目列表与详情阅读
4. 已读、未读、收藏状态
5. 少量必要设置

不把桌面端的所有能力原样搬到 Harmony。Harmony 首期不是桌面端的等价移植，而是移动阅读场景下的最小可用版本。

## Feed 字段映射

| 桌面字段 | Harmony 首期 | 结论 | 说明 |
|---|---|---|---|
| `id` | `id` | 保留 | 本地主键，后续 RDB 必需 |
| `title` | `title` | 保留 | 订阅源展示必需 |
| `url` | `url` | 保留 | RSS 拉取入口 |
| `siteUrl` | `siteUrl` | 保留 | 跳转原站、详情页来源展示 |
| `description` | `description` | 保留 | 订阅页卡片信息 |
| `imageUrl` | 暂不进入首期模型 | 延后 | 可后续做头像/封面增强 |
| `folder` | 暂不迁移 | 延后 | 移动端首期不做复杂文件夹组织 |
| `category` | `category` | 保留 | 轻量分类展示可保留 |
| `view` | `view` | 保留 | 决定文章/图片/视频等展示风格 |
| `maxEntries` | 暂不迁移 | 延后 | 首期先统一全局策略，不做每源覆盖 |
| `showInAll` | `showInAll` | 保留 | 首页聚合流仍需要 |
| `lastFetched` | `lastFetched` | 保留 | 刷新状态和调试需要 |
| `etag` | 新增到 Harmony 正式模型 | 保留但当前未实现 | 增量抓取会需要 |
| `lastModified` | 新增到 Harmony 正式模型 | 保留但当前未实现 | 增量抓取会需要 |
| `fetchSource` | 暂不迁移 | 延后 | 桌面聚合器相关，首期先不引入 |
| `upstreamUrl` | 暂不迁移 | 延后 | 聚合器/中转链路相关 |
| `remoteFeedId` | 暂不迁移 | 延后 | 远程聚合体系相关 |
| `errorCount` | `errorCount` | 保留 | 订阅健康状态需要 |
| `createdAt` | `createdAt` | 保留 | 排序、调试、导出有用 |

## Entry 字段映射

| 桌面字段 | Harmony 首期 | 结论 | 说明 |
|---|---|---|---|
| `id` | `id` | 保留 | 本地主键 |
| `feedId` | `feedId` | 保留 | 关联订阅源 |
| `title` | `title` | 保留 | 列表与详情核心字段 |
| `url` | `url` | 保留 | 原文跳转、去重参考 |
| `content` | `content` | 保留 | 详情阅读需要 |
| `summary` | `summary` | 保留 | 列表摘要与 AI 前置上下文 |
| `author` | `author` | 保留 | 列表元信息 |
| `authorAvatar` | 暂不迁移 | 延后 | 首期不是重点 |
| `imageUrl` | 可选保留 | 建议二期补 | 首页卡片和详情头图可后补 |
| `media` | 暂不迁移 | 延后 | 图片流/视频流要单独设计 |
| `publishedAt` | `publishedAt` | 保留 | 时间排序与展示 |
| `isRead` | `isRead` | 保留 | 阅读闭环必需 |
| `isStarred` | `isStarred` | 保留 | 收藏入口必需 |
| `createdAt` | `createdAt` | 保留 | 调试和本地排序有用 |

补充说明：

- Harmony 当前额外有 `readingTimeMinutes` 和 `tags`，它们适合保留，但应该视为 Harmony 的扩展展示字段，而不是必须与桌面严格同构。
- 首期不建议把 `MediaItem[]` 直接搬进来，否则会把图片流、视频流和缓存策略一起提前引入。

## Settings 字段筛选

桌面端 `AppSettings` 很大，Harmony 首期只保留移动端强相关项。

### 首期保留

| 桌面设置字段 | Harmony 首期字段 | 结论 | 说明 |
|---|---|---|---|
| `general.theme` | `themeMode` | 保留 | 基本体验项 |
| `general.language` | 新增到 Harmony 正式设置模型 | 保留 | 多语言能力基础项 |
| `general.refreshInterval` | `refreshIntervalMinutes` | 保留 | 自动刷新依赖 |
| `general.imageProxy` | `imageProxyEnabled` | 保留 | 网络与图片兜底可保留 |
| `translation.enabled` | 暂不直接暴露 | 延后 | 先别把设置做在能力前面 |
| `ai` 是否启用 | `aiSummaryEnabled` | 保留占位 | 可先保留开关，但未必首期接能力 |

### 首期不保留

| 桌面设置字段 | 结论 | 原因 |
|---|---|---|
| `proxyMode` / `proxyUrl` | 不迁移 | 移动端首期不做复杂代理策略配置 |
| `minimizeToTray` / `startInTray` | 不迁移 | 桌面专属 |
| `markReadOnScroll` | 延后 | 先做明确的已读动作，避免过早引入滚动策略 |
| `fontSize` / `contentWidth` / `contentLineHeight` / `customCSS` | 延后 | 阅读个性化后补 |
| `uiFontFamily` / `contentFontFamily` | 不迁移 | Harmony 原生字体策略不同 |
| `rsshubInstance` | 延后 | 首期先支持标准 RSS 源 |
| `accentColor` / `opaqueSidebar` / `reduceMotion` | 延后 | 首期不是视觉定制阶段 |
| `thumbnailRatio` | 延后 | 依赖媒体卡片方案 |
| `hoverMarkAsRead` | 不迁移 | 移动端无 hover 语义 |
| `autoExpandLongSocialMedia` | 延后 | 社交流未首期迁移 |
| `dimRead` / `groupByDate` / `renderMarkAsRead` | 延后 | 可在阅读体验优化阶段再决定 |
| `showRecommended` | 延后 | 推荐流不属于首期必需 |
| `viewTabs` / `feedColumns` | 不迁移 | 桌面信息密度配置，不适合直接搬到移动端 |
| `videoPagination` / `videosPerPage` / `bilibiliOpenInPage` | 不迁移 | 视频/B 站能力不在首期 |
| `data.*` | 暂不暴露到设置页 | 可以内部默认，不必先让用户配置 |
| `aggregator.*` | 不迁移 | 属于聚合器和设备协同体系 |
| `translation.targetLanguage` / `autoTranslate` | 延后 | 等翻译能力真实接入后再定 |
| `ai.provider` / `apiKey` / `model` 等完整 AI 配置 | 延后 | 首期不建议把复杂 AI 配置直接暴露到移动端页面 |

## 首期功能范围

### 要做

- 订阅源的新增、编辑、删除、列表展示
- RSS 拉取、解析、增量更新、失败回退
- 条目本地存储与列表展示
- 详情页正文阅读
- 标记已读、标记未读、收藏
- 主题、语言、刷新频率、图片代理等少量设置

### 暂不做

- 桌面托盘、菜单、快捷键、上下文菜单
- 自动更新检查与安装包更新提示
- 本地文件保存、下载器、数据目录打开
- OPML 导入导出
- AI 对话、流式聊天、多提供商完整配置
- 账号体系、YouTube/B 站/X/Instagram 绑定
- 社交媒体专门视图、视频专门视图、媒体画廊
- 私有聚合器、本地 agent、远程聚合设备能力
- 桌面搜索面板、命令面板、多列布局和宽屏阅读布局

## 复用与重写边界

### 可以继续复用的部分

| 模块 | 结论 | 说明 |
|---|---|---|
| `packages/models` 中的领域概念 | 复用概念，不直接复用代码 | ArkTS 与 TS/React 运行环境不同，字段设计可对齐 |
| `packages/shared` 中的设置归并思路 | 复用策略，不直接复用代码 | `normalize/merge` 思路可以迁移到 ArkTS |
| `FeedViewType` 这样的枚举语义 | 复用 | 有利于多端保持一致 |
| 默认设置值的取舍逻辑 | 复用部分 | 但不能把桌面默认项整包照搬 |

### 必须重写的部分

| 模块 | 结论 | 原因 |
|---|---|---|
| 数据库存储 | 必须重写 | Electron JSON 文件库与 Harmony `Preferences/RDB` 完全不同 |
| 网络请求封装 | 必须重写 | 桌面端 Node/Electron 环境不同于 Harmony `@ohos.net.http` |
| 页面与状态组织 | 必须重写 | React + Zustand 不能直接迁入 ArkUI |
| IPC handlers/services | 必须重写 | Harmony 没有 Electron IPC 架构 |
| Readability、下载、代理、视频解析等平台服务 | 基本重写 | 平台 API 和权限模型不同 |

## 推荐的 Harmony 首期正式模型

### Feed

- `id`
- `title`
- `url`
- `siteUrl`
- `description`
- `category`
- `view`
- `showInAll`
- `lastFetched`
- `etag`
- `lastModified`
- `errorCount`
- `createdAt`
- `updatedAt`

### Entry

- `id`
- `feedId`
- `title`
- `url`
- `summary`
- `content`
- `author`
- `publishedAt`
- `isRead`
- `isStarred`
- `readingTimeMinutes`
- `tags`
- `createdAt`
- `updatedAt`

### HarmonySettings

- `themeMode`
- `language`
- `refreshIntervalMinutes`
- `autoRefresh`
- `imageProxyEnabled`
- `aiSummaryEnabled`

## Phase 1 结论

Harmony 首期应当围绕“标准 RSS 阅读器”来收敛，而不是围绕“桌面功能覆盖率”来推进。

下一步应该直接进入：

1. 基于这份范围表设计 Harmony 的 RDB 表结构
2. 定义 `FeedRepository`、`EntryRepository`、`SettingsRepository`
3. 逐步替换 `MockRepository`
