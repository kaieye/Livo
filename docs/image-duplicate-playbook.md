# Livo 图片重复问题排查与修复手册

这份文档记录了本次“推文图片重复（尤其第一张和第二张重复）+ 首图反复重载”的实战修复方法。

适用场景：
- `SocialMedia` / `Pictures` 栏目中，同一条帖内出现重复图片
- 切换到具体订阅源时，首图明显重新加载
- 不止单个订阅源出现，多个源偶发或稳定复现

---

## 1. 根因分类（本次命中）

### A. 同一图片存在多种 URL 形态
- 例如 `media.picnob.info/get?url=...`
- 例如 `pixnoy.com/p/pt_*?o=...`（`o` 中是 base64 原图地址）
- 例如最终的 `scontent*.cdninstagram.com/...`

如果不先归一化，前端会把同一图当成不同图。

### B. 去重 key 设计不稳
- 仅依赖某些 `assetId` 可能把“同帖不同图”错误合并
- 非 IG 链接若丢掉 query，容易把不同资源压成同 key

### C. 渲染层 key 复用
- React 列表 `key` 冲突会造成节点复用错位，视觉上出现“前两张一样”

### D. 图片 fallback 链过宽
- 某些错误回退会把不同图片都回退到同一个候选 URL，导致撞图

### E. 媒体类型混入
- Instagram/Picnob 中 `video` 项带封面图，若混进 photo 网格会和首图重复

---

## 2. 修复策略（按顺序）

### Step 1: URL 归一化优先
在 `decodeMediaUrl` 中统一处理：
- HTML entity 解码
- `media.picnob.info/get?url=` 还原原图
- `pixnoy.com/p/pt_*?o=` 解码 `o` 为原图 URL（关键）
- nitter 图片路径归一

本次修改位置：
- `Livo/src/renderer/src/components/entry/EntryList.tsx`
- `Livo/src/renderer/src/components/entry/WideViewContent.tsx`

### Step 2: 去重 key 升级
- IG 类优先使用更稳定的文件级 key（例如 `igfile:*`）
- 非 IG 保留 query 参与 key（避免误合并）
- 只有 URL key 不可用时才回退 `assetId`

### Step 3: 渲染前再做一层强制去重
在 `SocialMediaGallery` 内再生成 `uniquePhotos`：
- 组合 key：`ig_cache_key` + `igfile` + 通用 dedupe key
- 渲染只使用 `uniquePhotos`

### Step 4: 渲染 key 保证唯一
- 不要仅用 token
- 使用 `token + index` 避免 React 复用错位

### Step 5: IG/Picnob 仅保留 photo
- 过滤掉 `m.type === "video"` 的媒体项，避免视频封面混入图片网格

### Step 6: 收窄 onError fallback 链
- 减少会导致不同图片回退到同一 URL 的候选项
- 重点避免 `cover` 类回退污染

---

## 3. 快速复现/验证方法

### A. 数据层排查（Node 脚本）
建议用本地 DB（`%APPDATA%/livo/data/livo-data.json`）做抽样：
- 检查同帖 `media[0]` 与 `media[1]` 是否 URL 形态不同但内容同图
- 检查是否存在 `pt_*?o=` 与 `scontent` 混用
- 检查 `ig_cache_key`、文件名、asset id 的一致性/冲突

可复用仓库已有脚本思路：
- `Livo/debug-pair.cjs`
- `Livo/debug-duplicates.cjs`
- `Livo/check-db-dupes.cjs`

### B. UI 层验证点
1. “全部 -> 某具体订阅源”切换后，首图不应明显重新加载
2. 同帖 9 宫格中前两张不应重复
3. 不同订阅源（至少 3 个）各抽 3 条帖复测

---

## 4. 回归检查清单（每次改媒体逻辑必跑）

- `npm run typecheck`
- 进入 `SocialMedia` 与 `Pictures` 各验证一次
- 验证以下源类型至少各 1 个：
  - Instagram/Picnob
  - YouTube（防止 query key 误伤）
  - 普通图文 RSS
- 检查 React 控制台是否有重复 key 警告

---

## 5. 关键代码位置

- URL 解码与归一：
  - `Livo/src/renderer/src/components/entry/EntryList.tsx`
  - `Livo/src/renderer/src/components/entry/WideViewContent.tsx`
- 推文图片收集与去重：
  - `Livo/src/renderer/src/components/entry/EntryList.tsx`
- 画廊渲染与 fallback：
  - `Livo/src/renderer/src/components/entry/EntryList.tsx` (`SocialMediaGallery`)

---

## 6. 经验结论（避免再次踩坑）

- 不要把“媒体 URL 解析”和“渲染层去重”只做一层，至少两层兜底
- 对 IG 镜像源，`pt_*?o=` 必须还原，否则迟早出现重复/重载错位
- 渲染 key 必须稳定且唯一，不能只靠“看起来像唯一”的 token
- 出现“首图总重载”时，优先查 `onError` fallback 是否把多图收敛到同一 URL

