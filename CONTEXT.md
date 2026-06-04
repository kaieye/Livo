# Livo 领域词汇表 (Domain Glossary)

> 本文档定义 Livo 代码库的核心领域概念。模块命名、接口设计、架构决策均应使用此处的规范术语。

## 核心实体

### Feed（订阅源）

一个 RSS/Atom/JSON Feed 的本地表示。Feed 是条目的容器，定义了内容来源和展示方式。

**关键属性**:

- `view`: FeedViewType 枚举，决定 UI 展示模式（文章/社交媒体/视频/图片）
- `url`: RSS/Atom 端点 URL
- `provider`: `local`（本地直连）或 `fever`（通过 Fever API 同步）
- `fetchSource`: 抓取策略 — `auto`（默认直连）、`direct`、`local-agent`（本地代理）、`private-aggregator`（私有聚合器）
- `errorCount`: 连续抓取失败计数，用于健康状态判断

**相关模块**: `feed-subscriber`（订阅流程）、`feed-refresh`（定时刷新）、`feed-source-provider`（抓取源策略）、`feed-utils`、`feed-view`

### Entry（条目）

Feed 中的单条内容。Atom 语境下即 `<entry>`，RSS 语境下即 `<item>`。

**关键属性**:

- `feedId`: 所属 Feed 的外键
- `content`: RSS 原始正文（HTML）
- `readabilityContent`: 自动全文抓取的正文（不覆盖 RSS 原始正文）
- `aiSummary`: 自动生成的 AI 摘要
- `media`: 媒体附件列表（图片/视频/音频）
- `isRead` / `isStarred`: 阅读状态标记

**相关模块**: `entry-builder`（构建流程）、`entry-ingestion-pipeline`（入库管道）、`entry-action-effects`（操作副作用）、`entry-dedupe`（去重）、`entry-identity`（身份判定）

### FeedViewType（视图类型）

每个 Feed 归属于四种视图之一，决定 UI 布局：

| 枚举值            | 含义     | 布局模式     |
| ----------------- | -------- | ------------ |
| `Articles` (0)    | 文章     | 列表，非宽屏 |
| `SocialMedia` (1) | 社交媒体 | 列表，宽屏   |
| `Videos` (2)      | 视频     | 网格，宽屏   |
| `Pictures` (3)    | 图片     | 网格，宽屏   |

视图类型影响: 卡片渲染模式（`EntryCardModel`）、默认列可见性（`FEED_COLUMN_DEFAULTS`）、发现页分类筛选。

### ViewModel（视图模型）

从原始 `Entry` / `Feed` 数据派生的渲染用模型，由 renderer 端的 `lib/` 模块计算生成。关键类型：

- **EntryCardModel** — 列表/网格中的条目卡片。包含计算属性：`publishedLabel`（相对时间）、`viewBadgeColor`（CSS 颜色类）、`mediaUrls`（处理后媒体 URL）
- **FeedCardModel** — 侧边栏/Feed 列表中的订阅源卡片。包含 `unreadLabel`（"99+" 格式）、`isRefreshing`（刷新中状态）
- **ArticleDetailModel** — 文章详情页全量数据。包含 AI 摘要/翻译状态、阅读时长估算

ViewModel 是组件与 store 之间的 seam——组件消费 ViewModel，不直接读 store 原始数据。

### Subscription（订阅）

"订阅 Feed" 的动词概念。`feed-subscriber.ts` 封装完整的订阅流程：URL 规范化 → 去重检查 → 视图类型推断 → 预热策略选择 → 视频时长 enrich 调度。

### Discover（发现）

预置内容推荐系统。数据来源：

- **CURATED_FEEDS**: 人工精选的 RSS 源（分 8 个分类）
- **RSSHUB_ROUTES**: RSSHub 路由索引
- **RECOMMENDED_FEEDS**: 基于平台的推荐（YouTube/X/Instagram/Bilibili）
- **TRENDING_FEEDS**: 热门 Feed
- **FEED_BUNDLES**: 主题 Feed 合集

`discover-data.ts` 是纯数据文件（无逻辑），`discover-helpers.ts` 提供搜索/筛选函数。

### Profile Resolution（主页解析）

将社交媒体主页 URL（YouTube 频道、X 用户、Instagram 用户、Bilibili UP 主）解析为可订阅的 RSS 源候选列表。`profile-resolver.ts` 定义了解析流程和结果类型 `ResolvedProfileUrlResult`。

## 跨域概念

### AI Pipeline（AI 管线）

三个独立 AI 能力：

1. **AI Summary**（摘要）: 对单条 Entry 生成中文摘要
2. **AI Translation**（翻译）: 对单条 Entry 生成中文翻译
3. **AI Digest**（日报/周报）: 对时间窗口内的一组 Entry 生成综合摘要（`preset: 'today' | 'week'`）
4. **AI Semantic Filter**（语义过滤）: 基于自然语言条件判断 Entry 是否匹配
5. **AI Agent**（Agent 对话）: 通过 LLM 循环调用工具来操作应用

### Fever Sync（Fever 同步）

通过 Fever API 协议与外部 RSS 服务同步。涉及三个映射表：

- **FeverAccount**: 远端服务账户配置
- **FeverFeedMapping**: 远端 Feed ID ↔ 本地 Feed ID 映射
- **FeverItemMapping**: 远端条目 ID ↔ 本地 Entry ID 映射
- **FeverSyncState**: 增量同步游标

### Task Runner（任务执行器）

异步任务系统，管理 AI 摘要/翻译/摘要等长耗时操作。关键类型：

- `TaskRunRecord`: 任务运行记录，含状态机（queued → running → succeeded/failed/timeout）
- `TaskRunProgress`: 进度上报
- `dedupeKey`: 幂等去重键

### Aggregator（私有聚合器）

可选的私有 Feed 聚合服务，支持推送和定时轮询。配置通过 `AggregatorSettings` 管理，`aggregator-jobs.ts` 负责调度，`aggregator-store.ts` 负责持久化。

### IPC Contract（IPC 契约）

Main ↔ Renderer 通信的类型安全契约层。`ipc-contracts.ts` 定义：

- 通道名称常量（`IPC.FEED_ADD` 等）
- 参数元组类型（`IpcArgsByChannel`）
- 运行时校验器（`IPC_CONTRACTS`）
- 返回值信封（`IpcEnvelope<T>`: `{ ok, data } | { ok, error }`）

## 架构原则

| 术语         | 定义                                                                                    |
| ------------ | --------------------------------------------------------------------------------------- |
| **模块**     | 有接口和实现的任何东西（函数、类、包、切片）                                            |
| **接口**     | 调用方使用模块所需知道的一切：类型、不变量、错误模式、排序、配置                        |
| **实现**     | 接口背后的代码                                                                          |
| **深度**     | 接口处的杠杆：小接口背后的大量行为。深 = 高杠杆。浅 = 接口几乎和实现一样复杂            |
| **Seam**     | 接口所在之处；可以在不原地编辑的情况下改变行为的地方                                    |
| **适配器**   | 在 seam 处满足接口的具体实现                                                            |
| **杠杆**     | 调用方从深度中获得的好处                                                                |
| **局部性**   | 维护者从深度中获得的好处：变更、bug、知识集中在一处                                     |
| **删除测试** | 想象删除该模块。如果复杂性消失了，它是透传。如果复杂性分散到 N 个调用方，它在挣它的位置 |
