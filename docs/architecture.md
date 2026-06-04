# Livo 架构审查报告

> 审查日期：2025-07  
> 基准版本：d47cbbd (`feat: track AI tasks with run state`)

## 词汇约定

- **Module** — 任何有接口和实现的东西（函数、类、包、切片）
- **Interface** — 调用方需要知道的全部：类型、不变量、错误模式、顺序、配置
- **Implementation** — 接口背后的代码
- **Depth** — 接口的 leverage：小接口背后的大量行为。**Deep** = 高 leverage。**Shallow** = 接口几乎和实现一样复杂
- **Seam** — 接口所在的位置；行为可以在不原地编辑的情况下改变的地方
- **Locality** — 维护者从 depth 中得到的好处：变更、bug、知识集中在一处
- **Deletion test** — 想象删除这个模块。如果复杂度消失，它是透传的。如果复杂度重新出现在 N 个调用方，它正在 earn its keep

## 一、已解决的架构问题

### #2 app-manager.ts 上帝对象拆分 ✅

**位置**：`src/main/app-manager.ts`

**问题**：431 行的 AppManager 类承担了过多职责——13 个 handler 注册、网络会话策略（Referer 伪装/Cache 控制）、11 个应用级 IPC 通道、平台集成、缓存协议、托盘创建、菜单注册全在一个类中。

**解决方案**：

- 提取 `src/main/services/system/session-policies.ts`（~120 行）——Chromium 会话策略（Referer 伪装、User-Agent 剥离、媒体缓存）
- 提取 `src/main/handlers/app-handlers.ts`（~90 行）——12 个应用级 IPC 通道，与其他 13 个 handler 模块保持一致

**效果**：`app-manager.ts` 从 431 行缩减到 215 行，`onReady()` 启动流程一目了然。

---

### #3+#4 Feed 订阅逻辑去重 + feed-handlers 瘦身 ✅

**位置**：`src/main/agent/tools/feed-tools.ts` + `src/main/handlers/feed-handlers.ts`

**问题**：Agent 工具的 `subscribeByUrl()` 和 IPC handler 的 `FEED_ADD` 包含几乎相同的 URL 规范化、查重、抓取、View 检测、Feed 创建、Entry 插入逻辑（~60 行核心重复）。更关键的是 Agent 工具的 URL 规范化比 handler 少了 3 种变体（没有 legacy URL 处理、没有 limit enforcement），存在不一致的隐患。

**解决方案**：

- 创建 `src/main/services/feed/feed-subscriber.ts`——统一服务，封装完整的 URL 规范化（6 种变体 + limit enforcement）、查重、抓取、View 检测、Feed 创建、Entry 插入
- Agent 工具和 IPC handler 均调用此服务
- Handler 保留自己的"已有源更新"逻辑（Recommended 升级、View 修正、bootstrap/warmup）

**效果**：

- Feed 订阅核心逻辑在一处维护
- Agent 工具获得 handler 级别的 URL 规范化能力（修复不一致隐患）
- `feed-handlers.ts` FEED_ADD handler 缩减 ~80 行

---

### #6 entry-store.ts 关注点分离 ✅

**位置**：`src/renderer/src/store/entry-store.ts`

**问题**：788 行的 zustand store 混合了四个关注点——缓存管理（4 个 Map + TTL 逻辑）、客户端去重、store 状态+动作、IPC 调用。

**解决方案**：

- 提取 `src/renderer/src/lib/entry-cache.ts`（~170 行）——三级缓存层（list/detail/snapshot），含 TTL 过期、in-flight 去重、快照-详情合并
- 提取 `src/renderer/src/lib/entry-client-dedupe.ts`（~65 行）——基于内容的客户端去重（Instagram asset ID、标题+时间桶 fallback）

**效果**：`entry-store.ts` 从 788 行缩减到 628 行，缓存和去重逻辑可独立测试。

---

### #7 discover-handlers.ts 巨型文件拆分 ✅

**位置**：`src/main/handlers/discover-handlers.ts`

**问题**：2664 行的 handler 文件中，`registerDiscoverHandlers()` 从第 2021 行才开始，前 2020 行是 43 个内联 helper 函数（YouTube ~400 行、Twitter/X ~600 行、Bilibili ~200 行、Instagram ~380 行、通用 ~300 行），属于典型的"handler 承载 service 逻辑"反模式。

**解决方案**：按平台拆分为 4 个服务文件：

- 新建 `src/main/services/discovery/discover-youtube.ts`（~280 行）——YouTube 频道搜索、订阅者抓取
- 新建 `src/main/services/discovery/discover-x.ts`（~610 行）——X/Twitter 用户搜索、头像/粉丝抓取、Nitter 回退
- 新建 `src/main/services/discovery/discover-bilibili.ts`（~140 行）——Bilibili 用户名/头像、用户搜索
- 扩展 `src/main/services/discovery/discover-instagram-search.ts`（+530 行）——Instagram 头像抓取、用户搜索
- 扩展 `src/main/services/discovery/discover-helpers.ts`（+30 行）——新增 `decodeHtmlEntities`、`FALLBACK_RSSHUB_INSTANCES`

**效果**：`discover-handlers.ts` 从 2664 行缩减到 959 行（-64%），`registerDiscoverHandlers()` 前移至第 316 行，每个平台可独立测试。

---

## 二、评估后跳过的候选方案

### #1 database.ts "透传模块"

**判定**：**Facade 模式，不应删除。**

`database.ts` 的 40+ 个函数都是一行委托到 `SqliteAdapter`，但应用**删除测试**后：删除它会将单例管理、JSON 迁移、稳定导入面的复杂度扩散到 18 个调用方。它作为 Data Access Layer Facade 隐藏了 5 个 Repository（Feed、Entry、Digest、Fever、Maintenance），这正是 leverage。

---

### #5 shared/ barrel 拆分

**判定**：**投入产出比太低，跳过。**

`src/shared/types/index.ts` 的 barrel 重导出了运行时代码（`ipc-contracts.ts` 的 500+ 行验证器、`settings.ts` 的 merge/normalize 等），导致 `import { IPC } from '../../shared/types'` 路径名暗示"纯类型"却拉入运行时代码。但 44 个文件使用此路径，拆分会触及全部 44 个文件的 import，收益仅为"路径名更诚实"。无已知 bug 由此引起。

---

### #8 ai-handlers.ts 管线内联 ✅

**位置**：`src/main/handlers/ai-handlers.ts`

**解决方案**：提取 `src/main/services/ai/ai-pipeline.ts`（~420 行）——`generateAIDigest`、`runAISummarizeTask`、`runAITranslateTask` 三大管线 + 流式输出辅助函数。

**效果**：`ai-handlers.ts` 从 746 行缩减到 ~230 行（-69%），handler 仅保留 IPC 胶水层。

---

### #9 IPC 双重错误处理 ✅

**位置**：`src/main/ipc/register-channel.ts` + 各 handler

**解决方案**：新建 `src/main/ipc/handler-error.ts`，提供 `throwIpcError`、`toHandlerError`、`toHandlerErrorWith` 三个标准化工具。6 个 handler 文件（feed、video、fever、discover、account、readability）统一使用 `toHandlerError()` 替代内联的 `catch (error) → { success: false, error: String(error) }` 模式。保留 renderer 的 `result.success` 契约，不改变响应形状。

---

### #10 Fever write-back 逻辑分裂 ✅

**位置**：`src/main/services/fever/fever-sync.ts` + `src/main/handlers/entry-handlers.ts`

**解决方案**：将 `feverWriteBack()` 从 `entry-handlers.ts` 移入 `fever-sync.ts` 并导出，`entry-handlers.ts` 改为导入调用。

**效果**：Fever 同步四阶段（sync feeds → sync items → write back → queue）全部集中在 `fever-sync.ts`。`entry-handlers.ts` 减少 4 个不再需要的导入。

---

## 四、模块结构总览（重构后）

```
src/main/
├── app-manager.ts          (215 行)  ← 从 431 缩减
├── handlers/
│   ├── app-handlers.ts     (NEW, 90 行)
│   ├── entry-handlers.ts   (~90 行)   ← 从 139 缩减（feverWriteBack 移出）
│   ├── feed-handlers.ts    (~620 行)  ← 从 ~706 缩减
│   ├── ai-handlers.ts      (~230 行)  ← 从 746 缩减（#8）
│   └── discover-handlers.ts (959 行)  ← 从 2664 缩减
├── ipc/
│   ├── register-channel.ts
│   └── handler-error.ts    (NEW, ~50 行)   ← #9
├── services/
│   ├── ai/
│   │   └── ai-pipeline.ts  (NEW, ~420 行)  ← #8
│   ├── discovery/
│   │   ├── discover-helpers.ts            (NEW, +30 行)
│   │   ├── discover-youtube.ts            (NEW, ~280 行)
│   │   ├── discover-x.ts                  (NEW, ~610 行)
│   │   ├── discover-bilibili.ts           (NEW, ~140 行)
│   │   └── discover-instagram-search.ts   (+530 行)
│   ├── feed/
│   │   └── feed-subscriber.ts (NEW, 175 行)
│   ├── fever/
│   │   └── fever-sync.ts     (~330 行)  ← +feverWriteBack（#10）
│   └── system/
│       └── session-policies.ts (NEW, 120 行)
├── database.ts             (保留 — Facade 模式)

src/renderer/src/
├── lib/
│   ├── entry-cache.ts          (NEW, 170 行)
│   └── entry-client-dedupe.ts  (NEW, 65 行)
└── store/
    └── entry-store.ts          (628 行)  ← 从 788 缩减
```
