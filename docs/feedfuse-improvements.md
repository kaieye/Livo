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
| 3 | AI 过滤 + AI 解读(Digest) | 完全缺失 | 高 | 大 |
| 4 | 本地存储升级为 SQLite | 单 JSON 全量读写，规模隐忧 | 高 | 大 |
| **P2 视产品方向选做** | | | | |
| 9 | 第三方同步协议（Fever 投影模式） | 无标准同步协议 | 视需求 | 大 |
| 10 | 播客订阅模型 | 有播放器，无订阅/剧集模型 | 视需求 | 中 |
| 11 | 前端交互细节（URL即状态/draft设置等） | 部分已有 | 低-中 | 小 |

---

## 二、P0 — 高价值（Livo 明确短板）

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

**Livo 现状**：部分实现——有音频播放器（`MediaPlayer.tsx`/`AudioMiniBar.tsx`/`player-store.ts`）、视频时长富集，以及 RSS/Atom `enclosure` 与 `itunes:*` 媒体字段解析，但**没有专门的播客订阅/剧集模型**。

**FeedFuse 做法**：入库后**播客文章跳过全文/AI/过滤队列**（`isPodcastSource` 分支），避免对音频做无意义的正文抓取。

**借鉴建议**：给播客类源一个专门的剧集列表视图；对播客条目跳过全文抓取与摘要等不适用的处理。

---

### 11. 前端交互细节（小而美）

Livo 前端整体成熟（虚拟化、快捷键体系、zustand 分层都很好），以下是 FeedFuse 几个值得借鉴的小点：

- **设置 draft 模式**：FeedFuse `src/store/settingsStore.ts` 用"草稿 + 校验 + 显式保存"，编辑时改 draft、校验通过才落库。比 Livo 多处即时写设置更可控。
- **详情/列表双缓存**：`appStore` 用 `articleDetailCache` + `articleSnapshotCache` 分离，保证右栏正文在列表刷新时稳定。

---

## 四、落地建议（推荐顺序）

1. **#4（SQLite）作为一个独立的中期重构** —— 它是其它功能（高效分页、AI 任务表、digest run 表）的地基，越早做越好。
2. **#3（AI 过滤/解读）** —— 在 #4 之后做，能复用提示词层和数据层。
3. **#9-#11** 按产品方向择机。

> 注意：本项目 CLAUDE.md 要求改动符号前先用 GitNexus 做影响分析。上述任何一条落地前，建议先 `gitnexus_impact` 评估 blast radius，尤其 #4 涉及 `database.ts` 这种核心模块。
