# Harmony Instagram 图片流展示修正设计

## 背景

Harmony 端已经能在 Instagram 发现预览中拿到来自 `picnob` 路由的图片流数据，但当前展示仍有 3 个明显问题：

1. 图片详情页单条帖子宫格中，最后一张带 `+N` 的图片会出现异常拉伸，占位与其它图片不一致。
2. 页头标题仍可能展示 `public posts - Picnob` 这类镜像源后缀，不符合用户认知。
3. 首页“图片”栏目仍沿用通用内容卡片，没有对齐图片订阅源详情页的图片流展示方式。

本次改动只处理展示层和标题净化，不改订阅协议、抓取来源或数据库结构。

## 目标

### 目标内

- 统一 Instagram/Picnob 图片源在详情页与首页“图片”栏目中的单条帖子展示。
- 修正图片宫格最后一格的尺寸和覆盖层表现。
- 去掉 `public posts - Picnob` 这类镜像站标题污染。

### 目标外

- 不新增新的 RSSHub 实例或抓取站点。
- 不改动“社交”栏目卡片样式。
- 不实现 desktop 端完全一致的复杂拼贴布局，先保持稳定规则网格。

## 方案对比

### 方案 A：分别在详情页和首页各自修 UI

优点：
- 改动局部、上手快。

缺点：
- 首页和详情页容易再次分叉。
- 标题、宫格、图片 fallback 规则会重复。

### 方案 B：抽共享图片流帖子卡片

优点：
- 首页与详情页视觉和行为统一。
- 后续继续逼近 desktop 时只需要改一处。
- 标题、说明文案、宫格规则都能集中维护。

缺点：
- 需要先整理一层共享 builder / helper。

### 推荐：方案 B

因为这次问题本质上不是某个单页样式 bug，而是“图片流帖子”这种内容类型在多个页面需要统一表达。共享组件能避免继续出现“详情页修好了，首页还是旧样式”的情况。

## 设计

### 1. 共享图片流帖子卡片

新增一个 Harmony 侧共享图片帖子 builder，输入为 `Entry`、主题、打开详情回调、标题净化结果，输出统一的图片流卡片。

卡片结构：

- 第一行：作者 + 时间
- 第二行：简短 caption，最多 2 行
- 第三部分：规则网格图片区

详情页 `FeedDetailView` 和首页 `Index` 的图片栏目都改为调用这套 builder。

### 2. 宫格规则

图片区仍使用稳定规则网格，不引入 desktop 那套更复杂的异形拼贴。

规则：

- 1 张图：单张大图
- 2-4 张图：2 列正方形网格
- 5 张及以上：3 列正方形网格
- 默认最多首屏展示 9 张图
- 超过 9 张时：
  - 第 9 格仍为正常正方形格子
  - 在第 9 格上叠加半透明遮罩和 `+N`
  - 不允许最后一格因为父布局拉伸成高条块

实现上，单个图片 item 的宽高都由统一尺寸函数给出，不能只设宽度、依赖外层布局自动撑高。

### 3. 标题净化

Instagram/Picnob 标题净化规则前移到公共工具中，覆盖以下模式：

- `xxx public posts - Picnob`
- `xxx (@handle) public posts - Picnob`
- 其它已知 `Picnob / dumpor / pixnoy` 镜像尾缀

净化后优先级：

1. 可读的人名标题，例如 `陈都灵`
2. 用户名 `du_chenduling`
3. 最差回退 `@du_chenduling`

此规则需要同时影响：

- 发现预览页页头
- 订阅后图片源详情页页头
- 首页“图片”栏目来源展示

### 4. 首页“图片”栏目改造

首页 `pictures` mode 不再复用当前通用 entry 卡片，而是直接渲染图片流帖子卡片。

预期效果：

- 每条图片 entry 直接展示图片宫格
- 弱化 feed 标题/摘要式展示
- 与订阅源详情页的视觉结构一致

首页和详情页之间允许保留少量容器差异，例如外层间距、滚动区域、安全区，但单条帖子卡片主体必须一致。

## 数据流

不新增数据字段，继续复用现有：

- `Entry.mediaUrls`
- `Entry.summary`
- `Entry.content`
- `Entry.author`
- `Entry.publishedAt`

图片列表仍由现有 `PictureGallery` helper 负责提取，标题净化继续复用 `SocialFeedTitles` 一侧的归一化逻辑，并在需要时增强镜像后缀清理。

## 影响文件

- `apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets`
- `apps/harmony/entry/src/main/ets/pages/Index.ets`
- `apps/harmony/entry/src/main/ets/common/utils/PictureGallery.ts`
- `apps/harmony/entry/src/main/ets/common/utils/SocialFeedTitles.ts`

如有必要，可新增一个共享 builder / helper 文件，专门负责图片流帖子卡片。

## 测试策略

新增或补充测试覆盖：

- Picnob 标题净化：`public posts - Picnob` 被清理
- 宫格尺寸规则：第 9 格不会走异常布局分支
- 首页图片模式选择：图片栏目走图片帖子渲染分支，而不是通用 entry 卡片

同时保留现有图片画廊与媒体解析测试，确保不回退到“图片流预览暂不可用”。

## 风险与控制

风险 1：共享 builder 过度耦合详情页状态。
控制：builder 只接收纯展示数据和回调，不直接依赖页面状态。

风险 2：首页切到图片流卡片后，单屏可见条目减少。
控制：先优先满足图片展示正确性，后续再根据真实体验调节卡片间距。

风险 3：标题净化过强，误删真实标题内容。
控制：只裁剪明确的镜像站尾缀模式，不做模糊删除。
