# 订阅源消失问题诊断指南

## 问题描述

- 重启应用后订阅源消失
- 点击"同步订阅源"后订阅源出现
- 切换到其他视图（视频、社交）再切回"全部"后，订阅源又消失

## 已添加的诊断日志

### 1. FeedStore 日志

- `[FeedStore] hydrateFromCache: N feeds` - 从 localStorage 缓存加载时
- `[FeedStore] loadFeeds: N feeds from IPC` - 从后端 IPC 加载时
- `[FeedStore] feeds.length changed: X → Y` - feeds 数组长度变化时（包含堆栈跟踪）

### 2. UrlSync 日志

- `[UrlSync] Updating view state` - URL 同步更新视图状态时
- `[UrlSync] ⚠️ Feeds count changed!` - 如果 setState 导致 feeds 数量变化

### 3. Queue 事件日志

- `[Queue] feeds:updated event` - 收到 feeds 更新事件时
- `[Queue] Current feeds count: N` - 当前 feeds 数量
- `[Queue] feedMap size before update: N` - 更新前的 feedMap 大小
- `[Queue] Updated feeds count: N` - 更新后的 feeds 数量

## 诊断步骤

1. **打开开发者工具** (F12 或 Ctrl+Shift+I)
2. **切换到 Console 标签**
3. **重启应用**，观察启动日志：

   ```
   [FeedStore] hydrateFromCache: X feeds
   [FeedStore] loadFeeds: Y feeds from IPC
   ```

   - 如果 X 和 Y 都是 0，说明 localStorage 和数据库都没有订阅源
   - 如果 X 是 0 但 Y > 0，说明 localStorage 缓存为空但数据库有数据
   - 如果 X > 0 但 Y 是 0，说明缓存有数据但数据库为空

4. **点击"同步订阅源"**，观察：

   ```
   [FeedStore] loadFeeds: Y feeds from IPC
   ```

5. **切换视图**（例如：全部 → 视频 → 全部），观察：

   ```
   [UrlSync] Updating view state: ...
   [FeedStore] feeds.length changed: X → Y
   ```

   - 如果出现 feeds.length 变化，会有堆栈跟踪显示是哪里导致的

6. **查看 localStorage 状态**
   - 打开 `debug-feeds-state.html` 文件（在项目根目录）
   - 或者在 Console 中执行：
     ```javascript
     const cached = localStorage.getItem('livo-feeds-cache')
     const feeds = cached ? JSON.parse(cached) : []
     console.log('Cached feeds:', feeds.length, feeds)
     ```

## 可能的问题场景

### 场景 A：localStorage 缓存为空

**现象：** 每次重启应用 feeds 都是空的，直到调用 loadFeeds()
**原因：** localStorage 写入失败或被清空
**解决：** 检查 localStorage 容量限制，确保 saveFeedsToCache 正确执行

### 场景 B：IPC 返回空数组

**现象：** hydrateDataToMemory 不更新 feeds
**原因：** hydrate.ts:113 的条件 `if (feeds && feeds.length > 0)` 导致空数组不更新
**解决：** 修改条件为 `if (feeds !== null && feeds !== undefined)`

### 场景 C：feeds:updated 事件导致 feeds 被清空

**现象：** 切换视图时触发 feeds:updated，feedMap 从空数组构建，导致结果为空
**原因：** state.feeds 为空数组，feedMap.size === 0，更新后仍为空
**解决：** 在 queue.ts 中添加检查，如果 state.feeds 为空，应该调用 loadFeeds()

### 场景 D：URL 同步覆盖 feeds

**现象：** setState 调用导致 feeds 被重置
**原因：** Zustand setState 误用（已在 commit 44d6b2b 中修复）
**状态：** 应该已修复

## 下一步操作

根据日志输出，确定是哪个场景，然后应用相应的修复。

## 临时解决方案

如果问题紧急，可以在 queue.ts 的 setState 中添加保护：

```typescript
useFeedStore.setState((state) => {
  // 如果当前 feeds 为空，不要更新，而是触发完整加载
  if (state.feeds.length === 0) {
    console.warn('[Queue] state.feeds is empty, triggering full reload instead')
    loadFeeds()
    return state
  }
  // ... 正常更新逻辑
})
```
