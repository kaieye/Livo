# FeedFuse-main 可借鉴点分析

> 分析对象：`D:\project\FeedFuse-main`
>
> 目标：从一个同类 RSS/AI 阅读器项目中提炼 Livo 可以学习、迁移或避免的设计点。本文只做技术学习与产品设计参考，不建议按项目整体照搬。

## 1. 项目判断

FeedFuse 是一个自托管 Web RSS 阅读器，核心目标是把 `RSS 收集 -> 过滤 -> 阅读 -> 全文 -> AI 摘要/翻译 -> AI 解读` 串成一个连续工作流。它和 Livo 的功能方向接近，但技术形态不同：

| 维度     | FeedFuse-main                                  | Livo                                              |
| -------- | ---------------------------------------------- | ------------------------------------------------- |
| 应用形态 | Next.js Web + Worker + Docker 自托管           | Electron 桌面主应用 + Web 入口                    |
| 数据存储 | PostgreSQL 16                                  | 本地 SQLite / Web IndexedDB 适配                  |
| 后台任务 | pg-boss 队列，独立 worker 进程                 | 主进程本地 TaskRunner                             |
| 前端状态 | Zustand 为主                                   | Zustand + TanStack Query                          |
| RSS 能力 | RSS/Atom、OPML、全文、Fever 同步、播客附件     | RSS/Atom、发现、RSSHub、Fever、社交/视频/图片视图 |
| AI 能力  | 摘要、标题翻译、正文双语翻译、AI 解读、AI 过滤 | 摘要、翻译、AI Digest、AI Agent/对话              |
| 部署目标 | 服务端自托管，多用户隔离弱，带登录             | 本地优先，单机桌面体验                            |

我的判断：FeedFuse 更适合作为“阅读工作流、任务状态、异步 AI、Web 三栏阅读器”的参考；不适合作为 Livo 的整体架构模板。Livo 的本地优先、Electron 能力、社交媒体视图、Agent 能力是更大的产品边界，不能为了借鉴 FeedFuse 而退回普通 Web RSS 工具形态。

## 2. FeedFuse-main 结构概览

核心目录：

```text
FeedFuse-main/
├── src/app/                 # Next.js 页面和 API routes
├── src/features/            # 前端功能模块：reader / articles / feeds / settings
├── src/store/               # Zustand 状态
├── src/server/domains/      # 服务端领域模块：feeds / articles / reader / settings / fever / ai-digests
├── src/server/infra/        # DB、HTTP、队列、日志等基础设施
├── src/server/integrations/ # RSS、全文、AI、Fever、媒体代理
├── src/worker/              # pg-boss worker 与后台任务
└── src/test/                # 按 app/server/features/worker 分层测试
```

值得注意的是它的分层比较克制：

- `src/app/api/*` 主要做认证、参数校验、调用服务、返回统一响应。
- `src/server/domains/*` 放领域服务和仓储。
- `src/server/integrations/*` 放外部世界适配：RSS、OpenAI、全文抓取、媒体代理。
- `src/worker/*` 是异步任务编排，不直接承担 UI 状态。

这套分层和 Livo 当前 `main/handlers -> operations/services -> database/repositories` 的演进方向一致，尤其适合参考“薄入口 + 厚服务 + 明确仓储”的边界。

## 3. 核心链路

### 3.1 阅读器快照

相关文件：

- `src/app/api/reader/snapshot/route.ts`
- `src/server/domains/reader/services/readerSnapshotService.ts`
- `src/store/appStore.ts`

FeedFuse 的阅读器不是让前端分别请求分类、订阅源、文章列表、未读数、AI 任务状态，而是通过一个 `reader/snapshot` 接口返回：

- categories
- feeds
- articles.items
- articles.nextCursor
- articles.totalCount
- 每个 feed 的 unreadCount
- 文章过滤状态
- Fever 投影状态
- AI 摘要 session 快照
- 正文翻译资格判断
- 预览图代理后的 URL

这点和 Livo 已有的 `src/main/services/entry/reader-snapshot.ts` 很接近，但 FeedFuse 的快照承载信息更多，尤其是任务状态和服务端派生字段。

可借鉴点：

- Livo 的 ReaderSnapshot 可以继续扩展为“阅读器稳定视图模型”，减少渲染层二次拼装。
- 对分页 cursor，FeedFuse 使用 `(published_at, id)` 的 keyset cursor；Livo 当前 reader snapshot 使用 offset cursor。桌面 SQLite 里 offset 简单可用，但大列表稳定性和新增文章插入时的翻页一致性会弱一些。
- FeedFuse 对 selected article 的详情缓存、列表快照缓存、URL 选择态做了分离。Livo 的 `entry-store.ts` 已经有类似缓存，但可以进一步把“列表快照”和“详情实体”边界写成明确规范。

不建议照搬点：

- FeedFuse 的快照 SQL 偏 PostgreSQL，包含 lateral join、array/text 过滤等，不适合直接搬到 SQLite。
- 它把很多字段聚合进单个 SQL，短期效率高，但随着领域增多会提高 SQL 维护成本。Livo 可以保持仓储方法组合，但要保证最终返回给 renderer 的模型是稳定的。

### 3.2 RSS 抓取与入库

相关文件：

- `src/worker/index.ts`
- `src/server/integrations/rss/fetchFeedXml.ts`
- `src/server/integrations/rss/parseFeed.ts`
- `src/server/integrations/rss/ssrfGuard.ts`
- `src/server/domains/articles/repositories/articlesRepo.ts`

FeedFuse 的链路：

```text
API / 定时任务
  -> pg-boss queue: feed.fetch
  -> worker.fetchAndIngestFeed
  -> SSRF URL 检查
  -> Conditional GET: etag / last-modified
  -> rss-parser 解析
  -> sanitizeContent
  -> insertArticleIgnoreDuplicate
  -> article.filter 队列
  -> 可选全文/AI/标题翻译触发
```

可借鉴点：

- SSRF 防护做得明确：默认公网，`fake-ip` / `lan` / `custom` 通过环境变量显式放开。Livo 也有 `src/shared/url-policy.ts`，但可以对所有用户输入 URL 的抓取链路做一次统一审计，确保 RSS、图片代理、全文、发现都走同一类策略。
- 抓取结果记录了 `last_fetch_status`、用户友好错误、raw error。Livo 已有刷新日志和 errorCount，但可以考虑把“最近一次失败原因”和“原始失败详情”标准化到 feed 或 refresh run 中，方便 UI 展示和诊断。
- 播客源特殊处理：有音视频附件的文章跳过全文/AI 文本流程。这对 Livo 的视频/播客视图也适用，能避免无意义的 AI/全文任务。
- 入库后先过滤，再触发自动 AI 能力，避免浪费 AI 调用。

不建议照搬点：

- FeedFuse 的抓取强依赖服务端 PostgreSQL 队列。Livo 不应引入 pg-boss 或服务端 DB，只应学习任务模型。
- `worker/index.ts` 已经较大，随着功能继续增加会变成 worker 总控大文件。Livo 如果借鉴，应避免把所有任务 handler 都塞进一个文件。

### 3.3 后台任务与 run 状态

相关文件：

- `src/server/infra/queue/jobs.ts`
- `src/server/infra/queue/queue.ts`
- `src/server/domains/feeds/services/feedRefreshRunService.ts`
- `src/worker/articleTaskStatus.ts`
- `src/worker/workerRegistry.ts`

FeedFuse 把“执行任务”和“用户可见状态”分开：

- feed refresh 有 `feed_refresh_runs` 和 `feed_refresh_run_items`。
- article fulltext / ai_summary / ai_translate 有 `article_tasks`。
- AI 摘要还有更细的 session/event。
- 前端通过 runId 或 task snapshot 轮询，也通过 SSE 获取摘要/翻译流式状态。

Livo 已有 `TaskRunner`、`TaskRunStore`、`tasks:run-updated` 事件，并且 feed refresh 已有 runId。可以学习 FeedFuse 的地方是：把某些“用户会等待或失败后要重试”的任务状态持久化，而不仅仅放在内存 run store。

建议优先级：

1. 保留 Livo 本地 TaskRunner，不引入队列依赖。
2. 为 `entry readability / summarize / translate / digest / feed refresh` 这类长任务定义统一任务记录模型。
3. 内存状态继续负责实时进度；SQLite 记录负责最近状态、失败原因、重试入口。
4. UI 从“某按钮 loading”升级为“文章/订阅源/简报有任务状态”。

### 3.4 全文抓取

相关文件：

- `src/server/integrations/fulltext/fetchFulltextAndStore.ts`
- `src/server/integrations/fulltext/extractFulltext.ts`
- `src/server/integrations/fulltext/fulltextVerification.ts`

FeedFuse 的全文抓取比较完整：

- 先判断文章是否已有可用全文。
- 校验 link 安全性。
- 抓 HTML 时限制最大 2MB。
- 校验 HTTP 状态和 Content-Type。
- 使用 `@mozilla/readability` 解析。
- 对结果再次 sanitize。
- 检测 Cloudflare/验证页等不可用全文。
- 成功写 `content_full_html`，失败写 `content_full_error` 和 sourceUrl。

Livo 已经使用 `@mozilla/readability`，也有 `src/main/services/entry/readability.ts`。可借鉴的是“全文任务结果状态”：

- 成功全文和失败原因最好都落库。
- UI 可以明确区分：未抓取、抓取中、已抓取、失败、需要人工验证。
- AI 摘要/翻译可以读取该状态，避免全文抓取还没完成时就生成低质量摘要。

### 3.5 AI 摘要、翻译和 AI 解读

相关文件：

- `src/worker/aiSummaryStreamWorker.ts`
- `src/server/domains/articles/repositories/articleAiSummaryRepo.ts`
- `src/server/integrations/ai/streamSummarizeText.ts`
- `src/worker/immersiveTranslateWorker.ts`
- `src/server/integrations/ai/bilingualHtmlTranslator.ts`
- `src/worker/aiDigestGenerate.ts`
- `src/server/integrations/ai/aiDigestRerank.ts`
- `src/server/integrations/ai/aiDigestCompose.ts`

FeedFuse 的 AI 摘要不是简单调用接口后把结果塞进文章，而是有 session 模型：

- session 有 queued/running/succeeded/failed。
- draftText 持续更新。
- finalText 完成后落库。
- event 表记录 delta、snapshot、completed、failed。
- 失败会映射为用户可理解的 errorCode/errorMessage/rawErrorMessage。
- 生成期间检查 AI 配置指纹，配置变化时终止旧任务。

这个设计比 Livo 当前基于 requestId 的窗口事件流更持久。Livo 可以保留现有流式事件，但把“最后一次摘要/翻译任务状态”存到 SQLite，尤其适合：

- 用户关闭窗口后回来还能看到任务结果或失败原因。
- 文章列表能显示“摘要生成中/失败/已完成”。
- Agent 或自动规则触发的 AI 任务可追踪。

AI 解读方面，FeedFuse 的 `ai_digest` 是一种特殊 feed，AI 生成的报告作为 article 入库，并记录来源文章。这点和 Livo 的 digest run 类似，但 FeedFuse 的产品语义更像“智能报告订阅源”：

```text
AI Digest Config
  -> 定时窗口
  -> 候选文章
  -> AI rerank
  -> 标题/链接近似聚类去重
  -> AI compose HTML
  -> 插入 ai_digest feed 的文章
  -> 记录来源文章列表
```

Livo 可借鉴：

- 把 Digest 结果作为一种可阅读条目，不只是一个单独页面结果。
- Digest 来源列表应可点击回原文。
- 候选去重不只靠 entry identity，也要对标题/链接做一次报告级聚类。

不建议照搬：

- FeedFuse 的 AI Digest 失败时会在某些场景推进窗口避免阻塞，这适合定时报告，但 Livo 的用户主动生成场景可能更需要可重试而不是跳过。

### 3.6 前端阅读体验

相关文件：

- `src/app/(reader)/ReaderApp.tsx`
- `src/features/reader/components/ReaderLayout.tsx`
- `src/features/articles/components/ArticleList.tsx`
- `src/features/articles/components/ArticleView.tsx`
- `src/features/feeds/components/FeedList.tsx`

FeedFuse 的 UI 是典型三栏阅读器：

```text
┌───────────────┬────────────────────┬──────────────────────────────┐
│ 订阅源 / 分类 │ 文章列表 / 过滤 / 刷新 │ 正文 / 全文 / 摘要 / 翻译 / 来源 │
└───────────────┴────────────────────┴──────────────────────────────┘
```

成熟点：

- 桌面端左右栏宽度可拖拽，并持久化到设置。
- 平板端保留文章列表和正文双栏。
- 移动端变成列表/正文单栏切换，订阅源进抽屉。
- 全局快捷键集中在 ReaderLayout，避免面板之间抢键。
- 文章列表有轻量虚拟窗口和图片预加载队列。
- AI、全文、翻译的任务状态直接贴在文章正文区域，而不是只弹 toast。
- 左栏 feed 错误状态可 hover 查看。

Livo 的产品形态更宽，不一定要改成纯三栏，但有几个直接可学：

- 统一快捷键管理，尤其是阅读器导航、搜索、收藏、标记已读、摘要、翻译。
- 任务状态内联展示，比单纯 toast 更适合长任务。
- 列表图片预加载并发限制，避免大量封面抢资源。
- 订阅源错误在左栏露出，不要只藏在日志页。

### 3.7 设置中心与密钥处理

相关文件：

- `src/store/settingsStore.ts`
- `src/features/settings/settingsSchema.ts`
- `src/features/settings/utils/validateSettingsDraft.ts`
- `src/app/api/settings/ai/api-key/route.ts`
- `src/server/domains/settings/repositories/settingsRepo.ts`

FeedFuse 把设置分成 persisted 和 session：

- persisted 保存普通设置。
- session 保存 API Key 输入框状态、是否已有 key、是否清除 key。
- 保存时先验证 draft，再分别保存 settings 和 key。
- API Key 不直接回传明文，只回传 `hasApiKey`。

Livo 当前是本地应用，安全模型不同，但这个“密钥不进入普通设置 JSON”的边界值得保持或强化。尤其 Web 入口如果以后有更多能力，API Key 需要更明确地隔离。

### 3.8 日志与用户操作反馈

相关文件：

- `src/server/infra/logging/systemLogger.ts`
- `src/server/infra/logging/userOperationLogger.ts`
- `src/lib/userOperationCatalog.ts`
- `src/features/notifications/userOperationNotifier.ts`

FeedFuse 有两类日志：

- system log：外部请求、系统异常、清理任务等。
- user operation log/toast：用户触发的操作成功/失败/开始。

Livo 已经有 `user-operation-log` 和刷新日志，可以借鉴 FeedFuse 的点是：

- 为操作定义统一 catalog，而不是每个按钮自己写文案。
- deferred operation 有 started/success/error，且用 dedupeKey 防重复弹。
- 后台任务失败时 raw error 和 user error 分开，UI 展示 user error，调试看 raw error。

## 4. 最值得 Livo 借鉴的 10 个点

### 1. 把 ReaderSnapshot 作为阅读器主视图模型继续做厚

Livo 已有基础，建议继续把未读数、feed 错误、任务状态、AI 状态、全文状态等派生信息收敛到 snapshot，而不是让多个 store/组件自己拼。

### 2. 用 keyset cursor 替代 offset cursor

FeedFuse 用 `(publishedAt, id)` 做 cursor，比 offset 更适合新增文章插入时保持分页稳定。Livo 当前 offset cursor 简单，但未来文章量增加后可以改为基于 `publishedAt + id`。

### 3. 任务状态从“内存进度”升级为“可恢复状态”

Livo 的 TaskRunner 适合本地实时进度，但 AI/全文/刷新这些任务建议在 SQLite 里保留最近状态和失败原因。

### 4. 全文抓取落库成功/失败状态

不要只把 Readability 当一次性操作。全文抓取应该有状态机：idle / queued / running / succeeded / failed，并记录 sourceUrl/error。

### 5. AI 摘要和翻译引入 session 概念

保留现有流式体验，同时把 draft/final/error 作为文章相关状态保存。这样关闭窗口、切换文章、Agent 后台触发都更稳定。

### 6. AI Digest 可以更像“特殊信息源”

FeedFuse 把 AI 解读做成 `ai_digest` feed，报告也是 article。Livo 可以把 Digest 结果更自然地融入 Entry 模型，而不是只作为页面里的临时结果。

### 7. URL 安全策略统一审计

FeedFuse 的 SSRF guard 非常明确。Livo 的 RSS、全文、图片、视频代理、发现能力都涉及外部 URL，建议统一走同一套安全策略。

### 8. Feed 错误状态在左栏可见

FeedFuse 左栏对最近更新失败的 feed 做了显式标记和 tooltip。Livo 可以把刷新失败从“日志里可见”提升到“订阅源列表即可发现”。

### 9. 长任务反馈从 toast 移到内容区域

摘要、翻译、全文抓取不应只依赖 toast。文章正文区域直接展示 running/failed/retry 状态，用户更容易理解。

### 10. 测试组织按领域和链路分布

FeedFuse 的测试覆盖 worker、server repositories、services、routes、features。Livo 已有不少测试，但可以对主进程 operations/services 层补足更接近真实链路的测试，而不是只测工具函数。

## 5. 不建议迁移或要谨慎的点

### 1. 不建议引入 PostgreSQL / pg-boss

FeedFuse 的服务端队列适合自托管 Web。Livo 是本地优先桌面应用，继续使用 SQLite + 本地 TaskRunner 更符合产品定位。

### 2. 不建议照搬 Next.js API route 分层

Livo 的入口是 IPC handler 和 preload contract，不是 HTTP API。可以学习“入口薄、服务厚、仓储明确”，但不要把 IPC 硬改成 HTTP 思维。

### 3. 不建议让 worker 总控文件继续膨胀

FeedFuse 的 `src/worker/index.ts` 已经承担很多 handler。Livo 未来如果强化任务系统，应按任务领域拆文件并由 registry 注册。

### 4. 不建议收缩 Livo 的产品面

FeedFuse 是纯 RSS 阅读器增强 AI；Livo 已经覆盖 RSSHub、社交、视频、图片、Agent、本地桌面能力。借鉴应服务于 Livo 的更宽目标，而不是改成 FeedFuse clone。

### 5. 不建议完全采用 FeedFuse 的深色/磨砂 UI 风格

FeedFuse UI 在 Web 阅读器中完成度不错，但 Livo 已有自己的视觉体系。可以借鉴交互结构，不要直接照搬视觉语言。

## 6. 建议学习路线

### 第一阶段：低风险直接学习

优先读这些文件：

- `src/server/domains/reader/services/readerSnapshotService.ts`
- `src/store/appStore.ts`
- `src/server/integrations/rss/ssrfGuard.ts`
- `src/server/integrations/fulltext/fetchFulltextAndStore.ts`
- `src/features/articles/components/ArticleView.tsx`

学习目标：

- snapshot 如何组织主视图数据。
- 前端如何保留文章详情缓存。
- 外部 URL 抓取如何做安全边界。
- 全文/AI 任务状态如何进入阅读界面。

### 第二阶段：适合落地到 Livo 的改造

建议拆成独立小任务：

1. ReaderSnapshot 增加 feed 最近刷新错误、全文状态、AI 状态字段。
2. 将 snapshot cursor 从 offset 改为 keyset cursor。
3. 为全文抓取建立本地任务状态和失败原因。
4. 文章详情页内联展示全文/摘要/翻译任务状态与重试入口。
5. 左侧订阅源列表显示最近刷新失败状态。

### 第三阶段：更深的产品融合

适合在基础状态稳定后做：

1. AI Digest 结果进入 Entry/Feed 体系，支持像普通文章一样阅读、收藏、搜索。
2. AI 摘要/翻译 session 持久化，支持切换文章后恢复流式结果。
3. 用户操作 catalog 统一 toast、日志和任务状态文案。
4. 所有外部抓取链路统一 URL 安全策略。

## 7. 对照 Livo 当前代码的具体建议

### `src/main/services/entry/reader-snapshot.ts`

现状：已经返回 feeds、entries、counts、nextCursor。

建议：

- 增加 `feedStatus` 或扩展 feed 字段，包含最近刷新状态和错误。
- 增加 entry 的 `taskStatus`：全文、摘要、翻译。
- cursor 从 `{ offset, queryKey }` 改成 `{ publishedAt, id, queryKey }`。

### `src/renderer/src/store/entry-store.ts`

现状：已经区分列表缓存、详情缓存、snapshot 分页。

建议：

- 对 snapshot loadMore 增加“请求序号”保护，避免旧请求覆盖新视图。
- 将 selectedEntry 的任务状态合并逻辑和详情内容合并逻辑分开。
- 标记已读/收藏失败时考虑局部回滚或显式失败提示。

### `src/main/services/feed/feed-refresh.ts`

现状：本地 TaskRunner 已经支持 runId、进度、刷新日志、Fever 同步。

建议：

- 把单 feed 刷新结果持久化为结构化状态：status、userError、rawError、lastAttemptAt。
- 左栏和设置页都读同一份刷新状态。
- 主动刷新 all 时，像 FeedFuse 一样维护 run item 级别结果，方便 UI 显示哪个源失败。

### `src/main/services/ai/ai-pipeline.ts`

现状：流式摘要/翻译通过 requestId 发事件，Digest run 已有持久化。

建议：

- 摘要/翻译也引入 article-level session 表或字段。
- 失败映射拆成 userMessage/rawMessage/code。
- AI 配置变化时取消或标记旧任务失效，避免旧模型/旧 key 结果覆盖新配置下的操作。

### `src/main/services/system/task-runner.ts`

现状：适合作为本地任务运行核心。

建议：

- 不替换为 pg-boss。
- 增加可选持久化 sink，把部分 task run 的终态写入 SQLite。
- 增加任务类型契约，明确哪些任务允许 dedupe、重试、恢复、展示在 UI。

## 8. 最小可执行借鉴方案

我建议按这个顺序做，收益高且不破坏 Livo 现有结构：

1. **统一刷新错误状态**
   - 在 feed 存储或 refresh log 中记录 `lastRefreshStatus / lastRefreshError / lastRefreshRawError`。
   - 左侧 Feed 列表展示错误图标和 tooltip。

2. **全文任务状态化**
   - 给 entry 增加全文状态字段或独立 task 表。
   - Readability 失败不只 console，而是可见、可重试。

3. **ReaderSnapshot 扩容**
   - 将刷新错误、全文状态、AI 状态纳入 snapshot。
   - 前端减少额外请求和状态拼装。

4. **AI session 持久化**
   - 摘要/翻译从 requestId 临时流升级为 entry 关联 session。
   - 支持关闭/切换后恢复结果和失败原因。

5. **Digest 融入阅读流**
   - Digest run 生成的内容可以作为特殊 Entry。
   - 来源文章可点击回看。

## 9. 总体评价

FeedFuse-main 的强项不是技术栈本身，而是它把 RSS 阅读链路拆成了几条清晰的状态机：

- feed refresh run
- article filter
- fulltext task
- AI summary session
- AI translate session
- AI digest run

这些状态机让用户等待、失败、重试、后台自动触发都有可解释的落点。Livo 目前已有更丰富的能力和本地架构基础，最值得借鉴的是这种“任务可见、状态可恢复、阅读器快照统一派生”的思路。

不需要照搬 FeedFuse 的 Web/PG/队列技术栈。更适合 Livo 的路线是：保留 Electron + SQLite + 本地 TaskRunner，把 FeedFuse 的任务状态建模、ReaderSnapshot 聚合和安全抓取边界吸收到现有主进程服务体系里。
