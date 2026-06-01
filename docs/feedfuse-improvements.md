# 从 FeedFuse 可借鉴的改进清单

> 对比时间：2026-06-01
> 参照项目：**FeedFuse**（`D:\project\FeedFuse-main`）— Next.js 16 + React 19 + PostgreSQL 16 + pg-boss + OpenAI 的**自托管 Web** RSS 阅读器
> 本项目：**Livo** — Electron 33 + Vite + React 19 + zustand + react-query 的**本地优先桌面/Web** RSS 阅读器

本文档逐条记录 FeedFuse 中实现得比 Livo 更好、值得借鉴的地方，并针对 Livo 的桌面端架构给出适配建议。每条都标注了双方的关键文件路径，便于直接定位。

---

## 〇、先理解两者的架构差异

两个项目定位不同，**不能照搬**，借鉴时要做"服务端 → 桌面端"的映射。

| 维度 | FeedFuse（服务端） | Livo（桌面端） | 借鉴时的映射 |
| --- | --- | --- | --- |
| 形态 | 自托管 Web，多用户/多设备 | Electron 桌面 + Web，单用户本地 | — |
| 数据 | PostgreSQL + 复合索引 + cursor 分页 | 单个 `livo-data.json` 全量读写 | PG → **SQLite** |
| 后台任务 | pg-boss 任务队列 + worker 进程 | 主进程 `setInterval` | 队列 → **主进程任务调度** |
| 流式 | SSE + DB 事件表回放（支持多端续传） | IPC 事件（`webContents.send`） | SSE → **IPC 事件**（更轻，无需 DB 回放） |
| 提示词 | 统一模板层 + 用户可定制 | 硬编码在 handler | 直接借鉴 |

**结论**：FeedFuse 在 *AI 能力深度、内容治理（过滤/去重）、提示词工程、数据层* 上更成熟；Livo 在 *社交源抓取、Agent 工具系统、快捷键体系、虚拟化列表、双端架构* 上更强。本清单聚焦前者可补足 Livo 的部分。

---

## 一、借鉴清单总览

| # | 借鉴点 | Livo 现状 | 价值 | 工作量 |
| --- | --- | --- | --- | --- |
| **P0 高价值（明确短板）** | | | | |
| 2 | 过滤规则接线 | block/star/mark_read 已接；notify/readability/summarize 待做 | 高 | 中→小 |
| 3 | AI 过滤 + AI 解读(Digest) | 完全缺失 | 高 | 大 |
| 4 | 本地存储升级为 SQLite | 单 JSON 全量读写，规模隐忧 | 高 | 大 |
| **P2 视产品方向选做** | | | | |
| 9 | 第三方同步协议（Fever 投影模式） | 无标准同步协议 | 视需求 | 大 |
| 10 | 播客订阅模型 | 有播放器，无订阅/剧集模型 | 视需求 | 中 |
| 11 | 前端交互细节（URL即状态/draft设置等） | 部分已有 | 低-中 | 小 |
| 12 | 后台刷新调度健壮性 | `setInterval` | 低-中 | 中 |

---

## 二、P0 — 高价值（Livo 明确短板）

### 2. 过滤规则接线（部分完成：block/star/mark_read 已接；notify/readability/summarize 待做）

**Livo 现状**：已落地核心接线——
- 新增 `evaluateActionRules`（`src/shared/actions.ts`）：纯函数，对 entry + feed 评估所有启用规则，返回 `{ blocked, star, markRead, effects }`。
- 规则同步链路：渲染端 `useActionsStore` 每次增删改 → IPC `actions:sync` → 主进程 `action-rules-store.ts`（持久化到文件 + 内存缓存）。
- `feed-refresh.ts` 入库前调用 `applyActionRules`：`block` → 跳过入库；`star` / `mark_read` → 预置标记。
- **未完成的效果**：`notify` / `readability` / `summarize` 需要桌面通知接线、异步 AI/抓取任务队列与 `aiSummary` 存储字段，待 #3/#4 之后再接。

**FeedFuse 做法**：入库即过滤，pipeline 清晰（`src/worker/articleFilterWorker.ts`）：
> 关键词预过滤 → 去重判定 →（必要时拉全文）→ AI 过滤 → 通过才触发自动摘要/标题翻译。
规则来源 `ui_settings.rss.articleFilter`，服务在 `src/server/domains/articles/services/articleFilterService.ts`。

---

### 3. AI 过滤 + AI 解读（Digest）

**Livo 现状**：**完全缺失**。Livo 的 AI 集中在「Agent 工具系统」（强）和基础摘要/翻译/对话，没有"AI 判定是否过滤"，也没有"多源汇总成高层简报"。

**FeedFuse 做法**：
- **AI 过滤** `src/server/domains/articles/services/articleFilterJudge.ts`：让模型判定文章是否命中过滤条件，作为关键词过滤之外的语义层。
- **AI 解读（Digest）**：把一批文章汇总成更高层的趋势归纳，工程上很讲究——
  - `aiDigestRerank.ts`：让模型从候选里挑相关 id，并用 **guardrail 校验返回 id 必须是候选子集**（防幻觉）。
  - `aiDigestCompose.ts`：**map-reduce-fold**——≤4 篇单次生成；多篇分批提炼要点 → fold 压缩到约 60k 字预算内 → reduce 成结构化报告；按候选数动态调单篇字符上限，防上下文爆掉。
  - 数据上有 `ai_digest_configs` / `ai_digest_runs` 表，run 用 `unique(feed_id, window_start_at)` 防同一时间窗重复生成。

**借鉴建议**：
1. **AI 过滤**：作为规则过滤（见 #2）的可选补充，对"标题/摘要"做一次轻量语义判定即可，不必拉全文，控制成本。
2. **AI 解读**：可作为 Livo 的一个新视图（"今日简报 / 本周趋势"）。即使桌面端，也建议照搬 map-reduce-fold 的**上下文预算控制**与 rerank 的**子集 guardrail**——这是避免长文档场景下 token 超限和模型幻觉的关键设计。
3. Livo 已有 Agent 工具系统，AI 解读可以复用其 OpenAI 调用与 trace 基础设施。

---

### 4. 本地存储从 JSON 升级为 SQLite

**Livo 现状**：桌面端把整库放在单个 `userData/data/livo-data.json`（`src/main/database.ts`）：整库加载进内存、500ms 防抖后 `writeFileSync` **全量落盘**。条目量大时全量序列化是明显性能瓶颈，且无法做高效分页/检索。

**FeedFuse 做法**：PostgreSQL + 大量**复合降序索引**服务"最新优先"分页（如 `articles_feed_published_idx`、`articles_is_read_published_idx`），cursor 分页（`src/server/domains/articles/repositories/articlesRepo.ts`）。schema 见 `src/server/infra/db/migrations/*.sql`（33 个幂等顺序迁移）。

**借鉴建议**：
1. 桌面端迁移到 **SQLite**（`better-sqlite3`，同步 API 在主进程很合适），保留 `livo-data.json` 仅作为一次性导入/迁移来源。
2. 关键索引照搬思路：`(feed_id, published_at DESC)`、`(is_read, published_at DESC)`、去重键唯一索引。
3. 借鉴 FeedFuse 的几个 schema 细节：
   - **去重唯一约束** `unique(feed_id, dedupe_key)` 在入库层天然防重复。
   - **任务唯一索引** `article_tasks unique(article_id, type)`——保证每篇文章每类 AI 任务只有一个实例，避免并发重复入队（Livo 若做 AI 任务队列可直接用）。
   - **单行设置表** `app_settings (id=1)` + `alter table ... add column if not exists` 的幂等迁移风格。
4. 配合 react-query：Livo 已用 `query-sync-storage-persister`（`src/renderer/src/lib/query-client.ts`），换 SQLite 后数据查询走 IPC + cursor 分页即可。

> 工作量最大，但它是 Livo 长期扩展性的根。建议在条目规模增长前尽早做。

---

## 三、P2 — 视产品方向选做

### 9. 第三方同步协议（Fever 投影模式）

**Livo 现状**：无 Fever/Google Reader/Inoreader/Miniflux 等标准同步协议（但有独特的 Bilibili/YouTube/Instagram 账号链接，定位不同）。

**FeedFuse 做法**：Fever 协议适配隔离在 `src/server/integrations/fever/**`，核心思想是**把外部协议投影到本地统一模型**——上游对象经 `fever_*` 映射表投影到本地 `feeds(provider='fever')` / `articles`，而不是另起一套平行 schema。账号级队列互斥、远端权威 + 写回顺序保证一致性。

**借鉴建议**：若 Livo 要支持多设备同步，照搬"**外部协议投影到本地统一模型**"的设计模式，新源类型只是 `provider` 字段的不同，复用同一套 feeds/entries 表与渲染。

---

### 10. 播客订阅模型

**Livo 现状**：部分实现——有音频播放器（`MediaPlayer.tsx`/`AudioMiniBar.tsx`/`player-store.ts`）和视频时长富集，但**没有专门的播客订阅/剧集模型**，`enclosure` 只用于图片信号检测。

**FeedFuse 做法**（`parseFeed.ts` 的 `extractMediaAttachments`）：完整解析 `<enclosure>` 与 Atom `link rel=enclosure`（仅收 `audio/*`/`video/*`）、`itunes:duration`（HH:MM:SS）、`itunes:image`；入库后**播客文章跳过全文/AI/过滤队列**（`isPodcastSource` 分支），避免对音频做无意义的正文抓取。

**借鉴建议**：补全 `enclosure`/`itunes:*` 字段解析，给播客类源一个专门的剧集列表视图；对播客条目跳过全文抓取与摘要等不适用的处理。

---

### 11. 前端交互细节（小而美）

Livo 前端整体成熟（虚拟化、快捷键体系、zustand 分层都很好），以下是 FeedFuse 几个值得借鉴的小点：

- **设置 draft 模式**：FeedFuse `src/store/settingsStore.ts` 用"草稿 + 校验 + 显式保存"，编辑时改 draft、校验通过才落库。比 Livo 多处即时写设置更可控。
- **详情/列表双缓存**：`appStore` 用 `articleDetailCache` + `articleSnapshotCache` 分离，保证右栏正文在列表刷新时稳定。
- **预览图懒加载 + 并发队列**：`ArticleList.tsx` 用 IntersectionObserver 懒加载且**并发限 2**预加载，避免一次性发起大量图片请求。

---

### 12. 后台刷新调度健壮性

**Livo 现状**：`src/main/services/feed-refresh.ts` 用 `setInterval` 按全局间隔刷新。

**FeedFuse 做法**：pg-boss 声明式队列契约（`src/server/infra/queue/contracts.ts`）——重试/退避/去重/死信/并发**一处声明**；`feed.fetch` 用 `singletonKey` 做**单 feed 刷新互斥**；`feed_refresh_runs` 表跟踪每轮刷新进度供前端轮询。

**借鉴建议**：桌面端不必引入 pg-boss，但可借鉴三点——① 每个 feed 维护**独立到期时间**（按 `fetch_interval_minutes`）而非全局统一间隔；② **单 feed 刷新互斥**（避免上一轮没完又触发）；③ **刷新进度跟踪**（给用户可见的"刷新中 3/20"）。

---

## 四、落地建议（推荐顺序）

1. **补 #2 剩余效果（notify/readability/summarize）** —— 小改动、体验提升明显。
2. **#4（SQLite）作为一个独立的中期重构** —— 它是其它功能（高效分页、AI 任务表、digest run 表）的地基，越早做越好。
3. **#3（AI 过滤/解读）** —— 在 #2 收尾/#4 之后做，能复用提示词层和数据层。
4. **#9-#12** 按产品方向择机。

> 注意：本项目 CLAUDE.md 要求改动符号前先用 GitNexus 做影响分析。上述任何一条落地前，建议先 `gitnexus_impact` 评估 blast radius，尤其 #4 涉及 `database.ts` 这种核心模块。
