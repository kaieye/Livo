# Livo AI Agent 剩余优化计划

> 范围：`src/main/agent`、`src/main/services/ai`、`src/renderer/src/components/ai`、`src/renderer/src/store/ai-chat-store.ts`、以及相关 `@shared` 类型与设置。
> 本文只保留待完成或部分完成的 Agent 优化项；已完成内容已从计划正文移除。

## 1. 当前状态

暂无剩余待完成项。

## 2. 后续提案

- 引入向量记忆（嵌入式 LanceDB / sqlite-vss）以支持“按语义找过往会话”。
- 让 Agent 能在后台异步运行，需要新的 job runner 与 UI 通知。
- 引入工具评分机制：模型可在 prompt 内对工具结果打分，自动屏蔽噪声工具。
- Sandbox 化外部工具执行，降低主进程被恶意 HTML 影响的可能。
