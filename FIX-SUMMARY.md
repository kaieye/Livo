# 订阅源持久化问题修复总结

## 问题描述

用户报告的问题：

1. 每次重启应用，订阅源都会消失
2. 从设置页面点击"同步订阅源"后，订阅源会出现
3. 当切换到其他栏目（比如视频、社交），再切回"全部"视图时，订阅源又会全部消失

## 根本原因分析

经过代码审查，发现了两个主要问题：

### 问题 1：`hydrate.ts` 中的条件判断过于严格

**位置：** `src/renderer/src/initialize/hydrate.ts:113`

**原代码：**

```typescript
if (feeds && feeds.length > 0) {
  useFeedStore.setState({ feeds, isLoading: false })
  // ...
}
```

**问题：**

- 如果 IPC 返回空数组（`feeds.length === 0`），条件不满足，不会更新 store
- 导致 store 保持初始状态（可能是旧的缓存数据或空数组）

**修复：**

```typescript
if (feeds !== null && feeds !== undefined) {
  useFeedStore.setState({ feeds, isLoading: false })
  // ...
}
```

### 问题 2：`queue.ts` 中 `feeds:updated` 事件处理存在漏洞

**位置：** `src/renderer/src/initialize/queue.ts:70-88`

**原代码：**

```typescript
useFeedStore.setState((state) => {
  const feedMap = new Map(state.feeds.map((f) => [f.id, f]))
  // 更新 feedMap
  return { feeds: Array.from(feedMap.values()) }
})
```

**问题：**

- 如果 `state.feeds` 是空数组，`feedMap` 从空数组构建，size 为 0
- 即使 payload 包含更新数据，但因为没有 existing feed，更新被忽略
- 最终返回空数组，导致 feeds 被清空

**触发场景：**

1. 应用启动时 feeds 还未从 IPC 加载完成（为空数组）
2. 此时触发了 `feeds:updated` 事件（可能是后台刷新）
3. partial update 逻辑从空数组构建 feedMap
4. 更新后返回仍然是空数组
5. feeds 被设置为空数组，覆盖了缓存

**修复：**

```typescript
useFeedStore.setState((state) => {
  // 🛡️ 安全检查：如果当前 feeds 为空，不要通过 map 合并更新
  if (state.feeds.length === 0) {
    console.warn('[Queue] state.feeds is empty, triggering full reload')
    setTimeout(() => loadFeeds(), 0)
    return state
  }
  // ... 正常更新逻辑
})
```

## 已添加的诊断代码

为了便于追踪问题，添加了详细的日志：

### 1. FeedStore 日志

- `hydrateFromCache`: 显示从缓存加载的 feeds 数量
- `loadFeeds`: 显示从 IPC 加载的 feeds 数量
- 状态订阅监听：当 feeds.length 变化时输出日志和堆栈跟踪

### 2. UrlSync 日志

- 显示视图切换时的状态变化
- 检测 setState 是否意外改变了 feeds 数量

### 3. Queue 事件日志

- 显示 `feeds:updated` 事件的详细信息
- 显示 partial update 过程中的中间状态

## 测试方法

1. **打开开发者工具** (F12)
2. **重启应用**，观察启动日志
3. **切换视图**（全部 → 视频 → 全部），观察是否有异常
4. **使用 `debug-feeds-state.html`** 检查 localStorage 状态
5. **参考 `test-feeds-persistence.sh`** 进行完整测试

## 预期效果

修复后：

- ✅ 重启应用时，feeds 应该从 localStorage 缓存立即显示
- ✅ 后台 IPC 加载完成后，feeds 会被更新为最新数据
- ✅ 切换视图时，feeds 不会消失
- ✅ `feeds:updated` 事件不会在 feeds 为空时导致清空

## 相关文件

修改的文件：

- `src/renderer/src/initialize/hydrate.ts` - 修复条件判断
- `src/renderer/src/initialize/queue.ts` - 添加空数组保护
- `src/renderer/src/store/feed-store.ts` - 添加诊断日志
- `src/renderer/src/router/use-url-sync.ts` - 添加诊断日志

新增的文件：

- `DIAGNOSIS.md` - 详细的诊断指南
- `debug-feeds-state.html` - localStorage 检查工具
- `test-feeds-persistence.sh` - 测试步骤指南
- `test-zustand-behavior.html` - Zustand setState 行为测试

## 后续建议

如果问题仍然存在：

1. **收集完整日志：** 从应用启动到问题复现的完整 Console 日志
2. **检查 localStorage：** 使用 `debug-feeds-state.html` 查看缓存内容
3. **检查后端：** 确认 IPC `window.api.feeds.list()` 返回的数据是否正确
4. **检查 feeds:updated 事件：** 确认后端是否在不合适的时机发送了空更新

## 相关 Commit

- `44d6b2b` - fix: prevent feeds state from being reset during URL sync
- `ea34e6b` - fix: persist feeds to localStorage cache after hydration and updates

这次修复建立在之前修复的基础上，进一步加强了边界情况的处理。
