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

当前文档中的可执行问题已处理完毕，保留以下架构约束作为后续实现边界。

## 2. 不做清单

- 不引入 PostgreSQL。
- 不引入 pg-boss。
- 不把 IPC 改成 HTTP API。
- 不把所有任务 handler 塞到一个 worker 总控文件。
- 不为了 AI Digest 改坏普通 Entry/Feed 的本地优先模型。
- 不直接照搬 FeedFuse 的 UI 视觉风格。

## 3. 推荐执行顺序

暂无。
