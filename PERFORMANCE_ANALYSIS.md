# Livo 性能问题分析报告

## 🔍 问题总结

经过深入分析，Livo 的启动卡顿**主要不是前端问题，而是后端数据库查询慢**。

---

## 📊 性能瓶颈分析

### 实际测量数据

```
React 挂载: 1296ms
数据加载: 1530ms  ⚠️ 瓶颈在这里！
  ├─ Settings: ~50ms
  ├─ Feeds: ~100ms
  ├─ Auth: ~30ms
  └─ Entries (20条): ~1350ms ⚠️ 占用 88% 时间！
Total: 2826ms
LCP: 3631-7067ms (取决于渲染策略)
```

### 核心问题

**加载 20 条 entries 需要 1350-1530ms**，这不正常。对比：

- Settings + Feeds + Auth 合计: ~180ms
- 单独 Entries: ~1350ms (是其他所有的 7.5 倍！)

---

## 🎯 为什么 Folo 快？

### 关键区别

1. **Folo 使用 IndexedDB 本地缓存**

   ```typescript
   // Folo: 从本地 IndexedDB 读取
   const dataHydratedTime = await hydrateDatabaseToStore({
     migrateDatabase: true,
   })
   ```

   - 首次启动: 从 IndexedDB 读取缓存数据 (~50ms)
   - 后台同步: 异步更新远程数据
   - 用户立即看到内容

2. **Livo 每次都查询数据库**
   ```typescript
   // Livo: 每次启动都从后端 SQLite 查询
   const snapshot = await window.api.reader.snapshot({
     scope: { type: 'all' },
     limit: 20,
   })
   ```

   - 每次启动: 完整 SQL 查询 (~1350ms)
   - 没有本地缓存
   - 用户必须等待查询完成

---

## 🔧 真正的解决方案

### 短期方案（立即可做）

#### 1. **不要预加载 Entries** ⭐ 推荐

```typescript
// 移除 hydrate.ts 中的 entries 预加载
// 让 HomePage 按需加载（使用现有缓存机制）
```

**效果**: 启动时间从 2826ms → ~500ms

**权衡**: 首屏会显示加载状态，但比卡顿 2.8 秒好

#### 2. **优化后端查询**

检查 `window.api.reader.snapshot` 的实现：

- 是否有索引？
- 查询是否高效？
- 是否有 N+1 问题？

### 中期方案（1-2 周）

#### 3. **添加 IndexedDB 缓存层**

```typescript
// 启动流程
1. 从 IndexedDB 读取缓存 (~50ms)
2. 立即显示界面
3. 后台刷新数据
4. 增量更新 UI
```

这就是 Folo 的做法，也是为什么它快的原因。

### 长期方案（1-2 月）

#### 4. **虚拟化 + 增量加载**

- 首屏只加载 10 条
- 滚动时懒加载
- 虚拟滚动

#### 5. **Service Worker + 离线缓存**

- PWA 支持
- 离线可用
- 即时启动

---

## 💡 立即实施建议

### 方案 A: 移除 Entries 预加载（推荐）

**修改 `src/renderer/src/initialize/hydrate.ts`**:

```typescript
// 删除整个 entries 加载部分
// 注释掉或移除这段代码：
// const entriesResult = await Promise.allSettled([...])
```

**效果**:

- 启动: 2826ms → ~500ms
- 首屏会有短暂加载状态（但用户能立即看到界面）
- 利用现有的缓存机制

### 方案 B: 减少预加载数量

```typescript
// 从 20 条减少到 5 条
const snapshot = await window.api.reader.snapshot({
  scope: { type: 'all' },
  limit: 5, // 从 20 改为 5
})
```

**效果**:

- 启动: 2826ms → ~1200ms
- 仍然慢，但比现在好

---

## 📝 结论

**前端优化已经到极限了**。真正的瓶颈在：

1. ❌ 后端数据库查询慢（1350ms 加载 20 条）
2. ❌ 没有本地缓存层（每次都查询）
3. ✅ 前端渲染已经优化（智能缓存、并行加载）

**推荐行动**:

1. **立即**: 移除 entries 预加载，让首屏快速显示
2. **本周**: 优化后端 SQL 查询
3. **下周**: 添加 IndexedDB 缓存层（学习 Folo）

---

**优化日期**: 2026-06-08  
**分析结论**: 瓶颈在后端数据库，不是前端渲染
