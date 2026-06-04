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

| 工作线                    | 优先级 | 目标                                                  | 主要收益                | 主要风险                  |
| ------------------------- | ------ | ----------------------------------------------------- | ----------------------- | ------------------------- |
| A. 刷新状态结构化         | P0     | feed 记录最近刷新状态、用户错误、原始错误             | 左栏可见失败、便于诊断  | schema 和 row mapper 改动 |
| C. Snapshot keyset cursor | P1     | 用 publishedAt/id 替代 offset cursor                  | 分页更稳定              | 与客户端去重的关系要处理  |
| D. 全文任务状态化         | P1     | readability 有可恢复状态和重试入口                    | 长任务体验更清楚        | 需要规范现有字段语义      |
| E. AI session 持久化      | P2     | 摘要/翻译从 requestId 临时流升级为 entry 关联 session | 切换文章/重启后可恢复   | 改动面较大                |
| F. Digest 融入阅读流      | P2     | AI Digest 可作为特殊 Entry/Feed 阅读                  | 产品体验更统一          | 数据模型决策较大          |
| H. UI 内联任务反馈        | P1     | 文章详情和左栏直接展示任务/失败状态                   | 用户不依赖 toast 猜状态 | UI 需要克制，不堆噪音     |
| I. 测试补强               | P0-P2  | 覆盖每条工作线的关键行为                              | 防止后续回归            | 需要控制测试粒度          |

## 2. 里程碑拆分

### M1：最小状态可见闭环

目标：用户能在文章页看到全文/AI 任务状态。

- [ ] I1. 为 A/D/H 增加最小测试

### M2：分页和任务状态稳定化

目标：大列表分页更稳定，任务状态不只存在内存。

- [ ] I2. 补剩余任务终态测试

### M3：AI session 和 Digest 产品融合

目标：AI 摘要/翻译可恢复，Digest 结果进入阅读流。

- [ ] I3. 补 AI session 和 Digest 链路测试

## 11. I 线：测试补强清单

### I1. P0 测试

- [ ] `src/main/database/sqlite-schema` 迁移测试。
- [ ] `feed-repository` 刷新状态读写。
- [ ] `reader-snapshot` 返回 feed 状态。
- [ ] URL 策略危险地址测试。
- [ ] Sidebar 错误状态渲染测试。

### I2. P1 测试

- [ ] `entry-store.loadMoreEntries` 旧请求不覆盖新状态。
- [ ] 文章详情任务状态条渲染。

### I3. P2 测试

- [ ] AI summary session queued/running/succeeded/failed。
- [ ] session draft 恢复。
- [ ] 配置变化中止旧任务。
- [ ] Digest 来源回跳。

## 12. 不做清单

- [ ] 不引入 PostgreSQL。
- [ ] 不引入 pg-boss。
- [ ] 不把 IPC 改成 HTTP API。
- [ ] 不把所有任务 handler 塞到一个 worker 总控文件。
- [ ] 不为了 AI Digest 改坏普通 Entry/Feed 的本地优先模型。
- [ ] 不直接照搬 FeedFuse 的 UI 视觉风格。

## 13. 推荐执行顺序

暂无。
