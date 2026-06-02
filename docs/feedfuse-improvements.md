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
| 数据 | PostgreSQL + 复合索引 + cursor 分页 | 单个 `livo-data.json` 全量读写，已做内存索引与入库去重 | PG → **SQLite** |
| 后台任务 | pg-boss 任务队列 + worker 进程 | 主进程 `setInterval` | 队列 → **主进程任务调度** |
| 流式 | SSE + DB 事件表回放（支持多端续传） | IPC 事件（`webContents.send`） | SSE → **IPC 事件**（更轻，无需 DB 回放） |
| 提示词 | 统一模板层 + 用户可定制 | 硬编码在 handler | 直接借鉴 |

**结论**：FeedFuse 在 *AI 能力深度、内容治理（过滤/去重）、提示词工程、数据层* 上更成熟；Livo 在 *社交源抓取、Agent 工具系统、快捷键体系、虚拟化列表、双端架构* 上更强。本清单聚焦前者可补足 Livo 的部分。

---

## 一、借鉴清单总览

| # | 借鉴点 | Livo 现状 | 价值 | 工作量 |
| --- | --- | --- | --- | --- |
| **P0 高价值（明确短板）** | | | | |
| 4 | 本地存储升级为 SQLite | JSON 仍全量落盘，规模隐忧 | 高 | 大 |
| **P2 视产品方向选做** | | | | |
| 9 | 第三方同步协议（Fever 投影模式） | 无标准同步协议 | 视需求 | 大 |
| 10 | 播客订阅模型 | 有播放器，无订阅/剧集模型 | 视需求 | 中 |

---

## 二、P0 — 高价值（Livo 明确短板）

### 4. 本地存储从 JSON 升级为 SQLite

**Livo 现状**：桌面端把整库放在单个 `userData/data/livo-data.json`（`src/main/database.ts`）：整库加载进内存、500ms 防抖后 `writeFileSync` **全量落盘**。当前已在 JSON 层补齐条目身份去重、按订阅/未读/收藏的发布时间倒序内存索引和未读计数缓存，但条目量大时全量序列化仍是明显性能瓶颈。

**FeedFuse 做法**：PostgreSQL + 大量**复合降序索引**服务"最新优先"分页（如 `articles_feed_published_idx`、`articles_is_read_published_idx`），cursor 分页（`src/server/domains/articles/repositories/articlesRepo.ts`）。schema 见 `src/server/infra/db/migrations/*.sql`（33 个幂等顺序迁移）。

**借鉴建议**：
1. 桌面端迁移到 **SQLite**（`better-sqlite3`，同步 API 在主进程很合适），保留 `livo-data.json` 仅作为一次性导入/迁移来源。
2. SQLite 迁移时把现有 JSON 内存索引映射为真实复合/部分索引，并补 cursor 分页 IPC。
3. 借鉴 FeedFuse 的几个 schema 细节：
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

## 四、落地建议（推荐顺序）

1. **#4（SQLite）作为一个独立的中期重构** —— 它是其它功能（高效分页、AI 任务表、digest run 表）的地基，越早做越好。
2. **#9** 按产品方向择机。

> 注意：本项目 CLAUDE.md 要求改动符号前先用 GitNexus 做影响分析。上述任何一条落地前，建议先 `gitnexus_impact` 评估 blast radius，尤其 #4 涉及 `database.ts` 这种核心模块。
