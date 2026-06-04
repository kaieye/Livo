# FeedFuse 借鉴落地 TODO

> 来源文档：`docs/feedfuse-main-analysis.md`
>
> 目标：把 FeedFuse-main 中值得学习的设计，拆成适合 Livo 当前 Electron + SQLite + TaskRunner 架构的可执行任务。本文不是排期承诺，而是后续实现时的任务清单和依赖顺序。

## 0. 执行原则

- 不引入 PostgreSQL、pg-boss、Next.js API route 等 FeedFuse 的服务端技术栈。
- 保留 Livo 的本地优先模型：Electron 主进程、SQLite、本地 TaskRunner、IPC contract。
- 优先补强已有结构，不新建并行架构。
- 先把状态建模和 UI 可见性做实，再考虑 AI Digest 这类产品层融合。
- 涉及 schema、IPC、共享类型的任务必须配最小迁移和测试。

## 1. 工作线总览

| 工作线                    | 优先级 | 目标                                                  | 主要收益                | 主要风险                     |
| ------------------------- | ------ | ----------------------------------------------------- | ----------------------- | ---------------------------- |
| A. 刷新状态结构化         | P0     | feed 记录最近刷新状态、用户错误、原始错误             | 左栏可见失败、便于诊断  | schema 和 row mapper 改动    |
| C. Snapshot keyset cursor | P1     | 用 publishedAt/id 替代 offset cursor                  | 分页更稳定              | 与客户端去重的关系要处理     |
| D. 全文任务状态化         | P1     | readability 有可恢复状态和重试入口                    | 长任务体验更清楚        | 需要规范现有字段语义         |
| E. AI session 持久化      | P2     | 摘要/翻译从 requestId 临时流升级为 entry 关联 session | 切换文章/重启后可恢复   | 改动面较大                   |
| F. Digest 融入阅读流      | P2     | AI Digest 可作为特殊 Entry/Feed 阅读                  | 产品体验更统一          | 数据模型决策较大             |
| G. URL 安全策略审计       | P0     | 所有外部抓取入口使用统一策略                          | 降低 SSRF/危险 URL 风险 | 本地 RSSHub 和内网场景要保留 |
| H. UI 内联任务反馈        | P1     | 文章详情和左栏直接展示任务/失败状态                   | 用户不依赖 toast 猜状态 | UI 需要克制，不堆噪音        |
| I. 测试补强               | P0-P2  | 覆盖每条工作线的关键行为                              | 防止后续回归            | 需要控制测试粒度             |

## 2. 里程碑拆分

### M1：最小状态可见闭环

目标：用户能在文章页看到全文/AI 任务状态。

- [ ] H2. 文章详情内联任务状态条
- [ ] I1. 为 A/D/H 增加最小测试

### M2：分页和任务状态稳定化

目标：大列表分页更稳定，任务状态不只存在内存。

- [ ] C1. 设计 keyset cursor 协议
- [ ] C2. EntryRepository 支持 keyset 查询
- [ ] C3. entry-store 的 snapshot 分页加请求序号保护
- [ ] D2. 全文抓取进入 TaskRunner 并持久化终态
- [ ] I2. 补 keyset cursor 和任务终态测试

### M3：AI session 和 Digest 产品融合

目标：AI 摘要/翻译可恢复，Digest 结果进入阅读流。

- [ ] E1. 设计 AI session 最小 schema
- [ ] E2. 新增 entry 级摘要/翻译 IPC
- [ ] E3. hooks 改为 entryId + session 驱动
- [ ] F1. 写 ADR：Digest 是特殊 Feed 还是特殊 Entry 类型
- [ ] I3. 补 AI session 和 Digest 链路测试

## 3. A 线：刷新状态结构化

### A3. 全量刷新 run item 结果

- [ ] 评估是否复用现有 TaskRunRecord 的 `progress.data`，先不新增表。
- [ ] `refreshAllFeeds` 内记录每个 feed 的结果数组：
  - feedId
  - feedTitle
  - status
  - newEntries
  - error
- [ ] `REFRESH_LOG_LIST` 可选返回最近一次全量刷新明细。

验收：

- UI 可以知道“哪几个源失败”，而不是只有 failedCount。
- 不影响当前 refresh progress 事件。

风险：

- 这一步可在 A1/A2 后做，不要阻塞最小失败可见闭环。

## 5. C 线：Snapshot keyset cursor

### C1. 设计 cursor 协议

当前：

```ts
{
  v: (1, offset, queryKey)
}
```

建议：

```ts
{
  v: (2, publishedAt, id, queryKey)
}
```

- [ ] 保持 cursor 仍为 base64url opaque string。
- [ ] 解码时兼容 v1，老 cursor fallback 到第一页即可。
- [ ] queryKey 继续包含 scope/unreadOnly/limit，避免跨查询误用 cursor。

验收：

- 切换视图后旧 cursor 不会串页。
- 新文章插入后，下一页不会因为 offset 漂移跳过或重复太多。

### C2. EntryRepository 支持 keyset 查询

- [ ] `EntryListOptions` 增加：
  - `beforePublishedAt?: number`
  - `beforeId?: string`
- [ ] SQL 条件增加：

```sql
AND (e.published_at < ? OR (e.published_at = ? AND e.id < ?))
```

- [ ] 保持排序：

```sql
ORDER BY e.published_at DESC, e.id DESC
```

- [ ] `getEntries` 返回下一页 cursor 所需的最后一条原始 row。

注意：

- Livo 当前在 SQL 后做 `dedupeEntriesForRead`，这会影响 page size。keyset 应以 SQL 原始排序为准，必要时多取若干条作为 overscan，再 dedupe 到目标 limit。

验收：

- 文章新增到列表顶部后，继续加载更多仍稳定。
- 同一 publishedAt 的多条 entry 按 id 稳定分页。

测试：

- `entry-repository` 分页测试。
- `reader-snapshot` cursor 编解码测试。

### C3. Renderer 防旧请求覆盖

- [ ] 在 `src/renderer/src/store/entry-store.ts` 的 `loadMoreEntries` snapshot 分支增加 requestId 或 queryKey 二次检查。
- [ ] 如果用户在加载更多期间切换 feed，旧响应不得合并到新列表。

验收：

- 快速切换 feed + 加载更多不会串数据。

## 6. D 线：全文任务状态化

### D2. Readability 抓取走 TaskRunner

当前 `IPC.READABILITY_FETCH` 是直接 fetch。

- [ ] 新增 task contract：`ENTRY_FULLTEXT_FETCH_TASK`。
- [ ] handler 中 enqueue task，并返回 runId。
- [ ] 成功后写入 entry：
  - readabilityContent
  - readabilityTitle
  - readabilityExcerpt
  - readabilitySiteName
  - readabilityLength
  - readabilityFetchedAt
  - 清空 readabilityError
- [ ] 失败后写入 readabilityError。

验收：

- 关闭再打开文章仍能看到全文结果或失败原因。
- 同一 entry 多次点击不会并发抓取多个相同任务。
- 失败后有重试入口。

测试：

- `readability-handlers.test.ts`
- `task-runner` dedupe 测试补充。
- `entry-repository.updateEntry` 写入 readability 字段测试。

## 7. E 线：AI session 持久化

### E1. 先定义最小 session 模型

建议先做摘要，翻译后置。

- [ ] 新增 SQLite 表：

```sql
CREATE TABLE entry_ai_summary_sessions (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  status TEXT NOT NULL,
  draft_text TEXT NOT NULL DEFAULT '',
  final_text TEXT,
  error_code TEXT,
  error_message TEXT,
  raw_error_message TEXT,
  model TEXT,
  source_hash TEXT,
  run_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  finished_at INTEGER,
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);
```

- [ ] 先不建 event 表；draftText 足够恢复 UI。
- [ ] 后续如果需要更细粒度调试，再补 `entry_ai_summary_events`。

验收：

- 每篇 entry 能查到最近一个 active/latest session。
- 失败原因用户可读，raw message 只用于日志/诊断。

### E2. 新增 entry 级摘要 IPC

当前 `AI_SUMMARIZE` 只接受 content。

- [ ] 新增 IPC：
  - `AI_SUMMARIZE_ENTRY`
  - `AI_SUMMARY_SESSION_GET`
- [ ] 由主进程读取 entry 内容，选择优先级：
  - readabilityContent
  - content
  - summary
- [ ] 写入 session draft/final/error。
- [ ] 保留现有 `AI_SUMMARIZE` 给通用文本摘要使用。

验收：

- Entry 摘要不再要求 renderer 传整篇 HTML/text。
- session 状态能通过 ReaderSnapshot 或 session get 取回。

### E3. hooks 改为 session 驱动

- [ ] `useAISummary` 增加 entryId 模式。
- [ ] 初始值来自 snapshot/session。
- [ ] 流式 chunk 更新本地 draft，同时主进程持久化 draft。
- [ ] entry 切换时，不再丢掉已完成/失败 session。

验收：

- 切换文章再回来，摘要结果仍在。
- 生成失败后仍显示失败卡片和重试按钮。

### E4. 翻译 session

- [ ] 在摘要 session 稳定后再做翻译。
- [ ] 保留当前段落级并发翻译策略。
- [ ] session 下挂 segment 状态：
  - index
  - sourceText
  - translatedText
  - status
  - errorMessage

验收：

- 单段失败可重试。
- 配置变化时旧 session 标记 failed/config_changed，不覆盖新任务。

## 8. F 线：Digest 融入阅读流

### F1. 先写 ADR

必须先决策，不直接实现。

- [ ] 比较两种模型：
  - A：Digest run 仍在 `ai_digest_runs`，详情页单独展示。
  - B：Digest run 生成特殊 Entry，挂在特殊 Feed 下。
- [ ] 评估影响：
  - entries FK 要求 feed_id。
  - Feed 类型是否增加 `kind: 'rss' | 'ai_digest'`。
  - 搜索、收藏、已读、导出、Agent 上下文是否纳入 Digest。

推荐倾向：

- 长期选 B：Digest 作为特殊 Entry/Feed，阅读体验统一。
- 短期先做来源可点击和详情页体验，不急着改 feed 模型。

### F3. Digest 候选去重增强

- [ ] 借鉴 FeedFuse 的标题/链接聚类。
- [ ] 在 `src/main/services/ai/ai-digest.ts` 或 digest pipeline 中加入：
  - canonical link 去 tracking 参数
  - title normalization
  - bigram/Jaccard 相似度
- [ ] 只用于 Digest 候选，不影响全局 Entry 去重。

验收：

- 同一新闻多源转载不会占满报告候选。
- 不影响普通阅读列表中的原始信息完整性。

## 9. G 线：URL 安全策略审计

### G1. 明确 URL 策略分层

当前 `src/shared/url-policy.ts` 主要做协议/credentials/suspicious 判断，不做 DNS/IP 解析。

- [ ] 新增主进程专用策略模块，例如：
  - `src/main/services/system/network-url-policy.ts`
- [ ] 分层：
  - shared：字符串协议和 HTML URL 安全。
  - main：DNS/IP/localhost/private CIDR 判断。
- [ ] 保留桌面场景下本地 RSSHub 可用。

建议模式：

| 场景              | 默认策略                                |
| ----------------- | --------------------------------------- |
| 用户打开外部链接  | 允许 http/https，阻止 credentials       |
| RSS 抓取          | 允许公网 + 用户配置的 RSSHub/local 模式 |
| Readability 全文  | 同 RSS 抓取                             |
| 图片代理/视频解析 | 禁止危险协议，必要时校验重定向          |
| Discover preview  | 同 RSS 抓取                             |

### G2. 审计所有外部抓取入口

- [ ] `src/main/services/feed/rss-parser.ts`
- [ ] `src/main/services/feed/feed-source-provider.ts`
- [ ] `src/main/services/entry/readability.ts`
- [ ] `src/main/services/video/video-proxy.ts`
- [ ] `src/main/services/video/video-duration.ts`
- [ ] `src/main/services/discovery/*`
- [ ] `src/main/handlers/app-handlers.ts` 中 external/open/download 相关入口

验收：

- 每个网络入口都有明确策略。
- 内网/localhost 是显式允许，不是无意放开。

测试：

- localhost
- 127.0.0.1
- 0.0.0.0
- 169.254.169.254
- 10.0.0.0/8
- 192.168.0.0/16
- IPv6 loopback
- 带 username/password URL
- redirect 到危险地址

## 10. H 线：UI 内联任务反馈

### H2. 文章详情内联任务状态

目标示意：

```text
┌──────────────────────────────────────────────┐
│ 正在抓取全文...                              │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ AI 摘要生成失败：AI 配置无效                  │
│ [重试] [打开设置]                             │
└──────────────────────────────────────────────┘
```

- [ ] 在 `EntryContent` / `ArticleDetailPage` 的正文顶部展示任务状态条。
- [ ] 状态来源统一使用 entry taskSnapshot。
- [ ] 失败状态提供重试按钮。
- [ ] 配置缺失状态提供打开设置入口。

涉及文件：

- `src/renderer/src/components/entry/EntryContent.tsx`
- `src/renderer/src/pages/ArticleDetailPage.tsx`
- `src/renderer/src/components/entry/AISummaryPanel.tsx`
- `src/renderer/src/components/entry/BilingualContent.tsx`

验收：

- toast 仍可存在，但主要状态不依赖 toast。
- 切换文章后状态不串。
- 长文、窄屏下不遮挡正文。

### H3. 快捷键帮助补齐 AI/全文操作

- [ ] 检查 `GlobalShortcutsProvider` 和 `ShortcutHelp`。
- [ ] 补充摘要、翻译、全文、刷新当前视图等快捷键。
- [ ] 避免输入框和弹窗内触发。

验收：

- 快捷键文档和真实绑定一致。

## 11. I 线：测试补强清单

### I1. P0 测试

- [ ] `src/main/database/sqlite-schema` 迁移测试。
- [ ] `feed-repository` 刷新状态读写。
- [ ] `reader-snapshot` 返回 feed 状态。
- [ ] URL 策略危险地址测试。
- [ ] Sidebar 错误状态渲染测试。

### I2. P1 测试

- [ ] keyset cursor 编解码。
- [ ] `EntryRepository.getEntries` keyset 分页。
- [ ] `entry-store.loadMoreEntries` 旧请求不覆盖新状态。
- [ ] readability task succeeded/failed 写库。
- [ ] 文章详情任务状态条渲染。

### I3. P2 测试

- [ ] AI summary session queued/running/succeeded/failed。
- [ ] session draft 恢复。
- [ ] 配置变化中止旧任务。
- [ ] Digest 来源回跳。
- [ ] Digest 候选聚类去重。

## 12. 不做清单

- [ ] 不引入 PostgreSQL。
- [ ] 不引入 pg-boss。
- [ ] 不把 IPC 改成 HTTP API。
- [ ] 不把所有任务 handler 塞到一个 worker 总控文件。
- [ ] 不为了 AI Digest 改坏普通 Entry/Feed 的本地优先模型。
- [ ] 不直接照搬 FeedFuse 的 UI 视觉风格。

## 13. 推荐执行顺序

1. H2：把已派生的 entry 任务状态展示到文章详情。
2. G1 + G2：统一外部抓取安全策略。
3. C1 + C2 + C3：改 snapshot cursor。
4. D2：全文抓取进入 TaskRunner 并持久化终态。
5. E1-E3：AI 摘要 session。
6. E4：AI 翻译 session。
7. F1 + F3：Digest 融入阅读流。

## 14. 首批可开工任务卡片

### TODO-005：文章详情内联任务状态条

- 类型：UI
- 优先级：P1
- 涉及文件：
  - `src/renderer/src/components/entry/EntryContent.tsx`
  - `src/renderer/src/pages/ArticleDetailPage.tsx`
  - `src/renderer/src/components/entry/AISummaryPanel.tsx`
- 验收：
  - 全文/摘要失败直接显示在正文区域。
  - 提供重试入口。

### TODO-006：主进程 URL 安全策略审计

- 类型：security + tests
- 优先级：P0
- 涉及文件：
  - `src/shared/url-policy.ts`
  - `src/main/services/system/network-url-policy.ts`
  - `src/main/services/feed/rss-parser.ts`
  - `src/main/services/entry/readability.ts`
  - `src/main/services/video/*`
  - `src/main/services/discovery/*`
- 验收：
  - 危险地址有测试。
  - 本地 RSSHub 场景不被误杀。

### TODO-007：ReaderSnapshot keyset cursor

- 类型：repository + snapshot + renderer store
- 优先级：P1
- 涉及文件：
  - `src/main/database/repositories/entry-repository.ts`
  - `src/main/services/entry/reader-snapshot.ts`
  - `src/renderer/src/store/entry-store.ts`
- 验收：
  - 新文章插入后加载更多稳定。
  - 同 publishedAt 多 entry 不乱序。

### TODO-008：Readability 抓取任务化

- 类型：TaskRunner + persistence
- 优先级：P1
- 涉及文件：
  - `src/main/handlers/readability-handlers.ts`
  - `src/main/services/entry/readability.ts`
  - `src/main/services/system/task-contracts.ts`
  - `src/main/services/system/task-runner.ts`
  - `src/main/database/repositories/entry-repository.ts`
- 验收：
  - 成功/失败写入 entry。
  - 重试不并发重复跑。

### TODO-009：AI 摘要 session 最小实现

- 类型：schema + AI service + IPC + UI
- 优先级：P2
- 依赖：TODO-005
- 涉及文件：
  - `src/main/database/sqlite-schema.ts`
  - `src/main/services/ai/ai-pipeline.ts`
  - `src/main/handlers/ai-handlers.ts`
  - `src/shared/ipc-contracts.ts`
  - `src/renderer/src/hooks/useAISummary.ts`
- 验收：
  - 摘要切换文章后可恢复。
  - 失败原因持久化。
