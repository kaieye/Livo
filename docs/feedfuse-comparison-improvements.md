# FeedFuse 对比改进记录

> 记录时间：2026-06-02  
> 对比对象：`D:\project\FeedFuse-main`  
> 本文只记录对 Livo 有借鉴价值的工程改进，不把 FeedFuse 的服务端 Web 架构直接套到 Livo 的本地优先桌面架构上。

## 核心判断

FeedFuse 和 Livo 都是 RSS 阅读器，但产品重心不同：

- FeedFuse 是自托管 Web 应用，核心优势在服务端领域分层、PostgreSQL 数据建模、后台队列、API 契约、任务状态和测试覆盖。
- Livo 是 Electron 本地优先桌面应用，核心优势在桌面集成、社交/视频/图片订阅源适配、跨平台入口、媒体呈现和 Agent 能力。

Livo 不需要照搬 Next.js、PostgreSQL、Docker 部署和登录模型。真正值得学习的是 FeedFuse 对“长期维护复杂阅读工作流”的工程处理方式：把用户操作、异步任务、数据查询、错误返回、后台处理、UI 派生状态和测试边界做成清晰 Module。

## 快速对照

| 维度         | FeedFuse                                                         | Livo                                                                                                                       | 对 Livo 的启发                                         |
| ------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 运行模型     | Next.js Web + Worker + PostgreSQL                                | Electron main/preload/renderer + SQLite + Web 入口                                                                         | 保持本地优先，不迁移架构；学习任务状态、契约和测试组织 |
| 数据层       | `server/domains/*/repositories` 按领域组织 SQL                   | `database.ts` 转发到 `SqliteAdapter` 门面，SQLite 访问已按领域 repository 化                                               | 继续保持本地优先 SQLite，不抽可替换数据库接口          |
| 异步任务     | pg-boss 队列，`QUEUE_CONTRACTS` 集中配置重试/并发/去重           | 刷新已接入本地 Task Runner；其他后台触发仍分散                                                                             | 继续把长任务迁入可观察的 run 状态，不引入服务端队列    |
| API/IPC 契约 | Zod 校验 + `ok/fail` 统一响应 + `AppError`                       | 已建立 IPC channel type guard、统一 Envelope、`registerChannel` 包装、settings handler 契约测试和 Web adapter API 形状测试 | 保持契约测试模板与跨平台 API 形状同步                  |
| 测试         | 约 218 个测试文件，覆盖 repository/service/route/worker/UI utils | 约 62 个测试文件，集中在纯工具与部分 service                                                                               | 优先补 store、SQLite adapter、列表模型、任务运行器测试 |
| 安全         | SSRF guard、media proxy guard、结构化错误                        | 外链 sanitizer、Electron proxy、session header policy                                                                      | 增加 URL 安全策略 Module，按桌面场景调整规则           |

## 中优先级改进

### 1. 用运行状态替代长时间操作的“事件猜测”

**参考 FeedFuse**

- `src/app/api/feed-refresh-runs/[runId]/route.ts`
- `src/app/api/ai-digests/runs/[runId]/route.ts`
- `src/features/articles/components/ArticleList.tsx` 中的 run status polling

FeedFuse 对刷新、AI digest 等异步操作返回 runId，前端轮询或订阅状态。

**Livo 当前状态**

- 批量刷新已通过 Task Runner 返回 `runId`，`feeds:refresh-progress` 只保留为实时提示。
- 添加社交订阅后的后台 bootstrap 通过事件刷新。
- AI chat 有 stream event，AI summary/translation 和 digest 状态不完全统一。

**建议**

后续只继续处理仍未接入 run store 的长任务。UI 监听事件可以保留，但事件只做实时提示，最终状态以 run store 为准。

### 2. 领域目录组织再收敛

**参考 FeedFuse**

- `src/server/domains/*`
- `src/server/integrations/*`
- `src/features/*`

FeedFuse 的目录按 domains、integrations、infra、features 分层，导航成本较低。

**Livo 当前状态**

- `src/main/services` 平铺较多文件。
- `src/renderer/src/components/entry` 聚集大量不同视图。

**建议**

渐进重组，不做一次性搬家：

- `main/services/feed/*`
- `main/services/ai/*`
- `main/services/discover/*`
- `main/services/media/*`

只有在改对应功能时顺手迁移，避免大面积 import churn。

### 3. 测试策略从“工具函数测试”扩展到“契约测试”

**参考 FeedFuse**

FeedFuse 测试覆盖 route、repository、service、worker、UI utils、settings schema、queue contracts。它的测试数量多，不是因为每个组件都测细节，而是关键契约有测试。

**Livo 当前状态**

- 已有不少纯逻辑测试：URL、settings、actions、feed refresh、database dedupe、agent loop 等。
- 缺口集中在 store action、SQLite adapter 集成、复杂 UI 派生逻辑。

**建议顺序**

1. SQLite repository 测试：feed/entry/digest/fever 查询与 migration。
2. Store action 测试：load snapshot、pagination、mark read/star、失败回滚。

## 不建议照搬的地方

### 1. 不建议把 Livo 改成 Next.js/服务端 Web 架构

Livo 的桌面本地优先定位是核心差异。迁到服务端会牺牲本地数据主权、桌面集成、媒体策略和离线体验。

### 2. 不建议引入 PostgreSQL 作为桌面主存储

FeedFuse 用 PostgreSQL 是因为自托管多进程 Web + Worker。Livo 使用 SQLite 更适合单用户桌面应用。真正该学的是 migration、repository 和查询契约，而不是数据库品类。

### 3. 不建议直接引入 pg-boss 或服务端队列

桌面端可先做轻量 Task Runner。只有当任务需要跨进程持久队列、崩溃恢复、长期重试时，再考虑 SQLite-backed job queue。

### 4. 不建议照搬 FeedFuse 的 SSRF 策略

服务器必须保护内网，桌面应用则经常需要访问 localhost、NAS、局域网服务。Livo 应该做“可解释、可提示、可配置”的 URL policy。

## 可执行路线

### 长期治理

1. services 按领域目录迁移。
2. shared types 拆分。
3. 将视频时长、Fever sync 纳入 Task Runner。

## 借鉴清单摘要

最需要谨慎学：

1. 服务端部署模型。
2. PostgreSQL。
3. pg-boss 队列。
4. 严格 SSRF 策略。

Livo 现有能力更强的地方：

1. 桌面端和系统集成。
2. 社交、视频、图片类订阅适配。
3. 媒体展示与修复策略。
4. Agent 工具系统。
5. 本地优先体验。

后续改进应围绕 Livo 的优势做工程加固，而不是把 FeedFuse 的产品形态复制过来。
