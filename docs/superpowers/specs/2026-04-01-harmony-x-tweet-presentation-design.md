# Harmony X Tweet Presentation Design

## 背景

当前 Harmony 端对社交条目的展示仍以通用文章卡片为主：

- 订阅详情页在 [`FeedDetailView.ets`](E:/Livo/apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets) 中通过 `EntryCard()` 渲染非图片、非视频条目。
- 首页“社交”栏目在 [`Index.ets`](E:/Livo/apps/harmony/entry/src/main/ets/pages/Index.ets) 中通过 `EntryCard()` 渲染所有社交条目。

这导致 X 源内容虽然能展示，但视觉结构仍然偏“文章卡片”，与用户期望的 tweet 风格不一致，也无法在首页和订阅详情页保持统一。

## 目标

为 Harmony 端的 X 源条目提供更接近 tweet 的展示方式，并同时覆盖：

- 订阅详情页中的 X 条目列表
- 首页“社交”栏目中的 X 条目卡片

实现后，X 源在这两个入口应共享同一套卡片结构与解析规则；非 X 源展示不变。

## 非目标

- 不重做 Instagram、Bilibili、YouTube 的社交展示
- 不改动文章流、图片流、视频流的现有卡片样式
- 不引入点赞/转推/评论等交互能力，仅做展示
- 不追求 100% 还原官方 X 客户端，仅对齐信息层级与布局风格

## 方案概览

采用“共享 `TweetEntryCard` 组件”的方案。

### 原因

- X 内容与文章卡片结构差异较大，继续在现有通用卡片上打分支会让两处页面持续分叉。
- 首页“社交”和订阅详情页都需要统一样式，抽公共组件能保证后续修正一次即可两处生效。
- 当前数据模型中已经有 `title / summary / author / imageUrl / mediaUrls / articleUrl / feedImageUrl / publishedAt`，足够支撑一版 tweet 风格卡片。

## 组件设计

新增共享组件：

- [`TweetEntryCard.ets`](E:/Livo/apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets)

新增解析辅助：

- [`TweetEntryPresentation.ts`](E:/Livo/apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts)

### `TweetEntryCard` 结构

卡片结构按 tweet 信息层级组织：

1. 顶部信息行
   - 头像
   - 显示名
   - `@username`
   - 发布时间
2. 正文区
   - 主文案
   - 多行文本显示，默认限制在较合理高度内
3. 媒体区
   - 多图时显示为 tweet 风格宫格
   - 单图时显示单张大图
   - 存在外链预览时显示链接卡片
4. 底部元信息区
   - 评论、转推、点赞、浏览等数字
   - 能解析到才显示，无法解析则整体隐藏

### 视觉方向

- 白色或主题 surface 卡片背景
- 头像左置，信息向右展开
- 文本区更接近社交内容排版，而非文章标题 + 摘要
- 媒体区圆角、间距紧凑
- 底部互动信息弱化为次级灰色文本

## 数据解析设计

`TweetEntryPresentation.ts` 负责把现有 entry 数据转换为展示态对象。

### 输入来源

优先使用以下已有字段：

- `author`
- `title`
- `summary`
- `imageUrl`
- `mediaUrls`
- `articleUrl`
- `feedImageUrl`
- `publishedAt`

必要时从 `summary/content` 中补充解析：

- `@username`
- 外链卡片标题或站点标签
- 评论、转推、点赞、浏览等统计

### 解析优先级

1. 昵称优先取 `author` 或 feed 标题推断值
2. 用户名优先从 URL 或 HTML 中提取 `@username`
3. 正文优先取较像 tweet 正文的字段，避免直接复用文章式标题
4. 媒体优先使用现有 `mediaUrls`，不足时回退 `imageUrl`
5. 互动数字仅在解析可信时显示，不做猜测

### 失败兜底

- 提取不到 `@username` 时，仅显示昵称
- 提取不到互动信息时，不显示底部互动栏
- 提取不到外链卡片时，仅显示正文与媒体
- 媒体为空时仍保持 tweet 卡片，不退回旧文章卡片

## 页面接线

### 订阅详情页

在 [`FeedDetailView.ets`](E:/Livo/apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets) 中：

- 为 X 源条目增加识别分支
- 命中 X 源时，用 `TweetEntryCard`
- 图片源继续走 `PictureEntryCard`
- 其余类型继续走现有 `EntryCard`

### 首页“社交”栏目

在 [`Index.ets`](E:/Livo/apps/harmony/entry/src/main/ets/pages/Index.ets) 中：

- 首页 `social` 模式下对 X 条目走 `TweetEntryCard`
- 其他社交条目仍保持原有卡片
- 若首页 `EntryCardModel` 信息不足，则通过展示 helper 做最小映射，不修改其他 mode

## 模型与适配

尽量不扩张持久化模型，只在展示层增加适配。

如首页 `EntryCardModel` 缺少 tweet 所需字段，则允许增加轻量派生字段或 helper，但不新增数据库字段，不调整存储结构。

## 测试策略

新增或补充以下回归：

- X 条目会命中 tweet 展示分支
- 首页 `social` 模式与订阅详情页共用 tweet 组件
- tweet 解析 helper 能从现有 entry / entryCard 数据中稳定提取：
  - 用户名
  - 正文
  - 图片列表
  - 互动数字（如可解析）
- 无互动数字或无外链预览时能稳定降级

## 风险与控制

### 风险 1：不同 X feed 的 HTML 结构不一致

控制：

- 解析逻辑按“能拿多少拿多少”的 best-effort 设计
- 互动数字和外链卡片做可选显示，不作为主路径依赖

### 风险 2：首页与详情页展示再次分叉

控制：

- 两处统一依赖 `TweetEntryCard` 和同一份 presentation helper
- 避免在页面文件中各自拼接 X 专属 UI

### 风险 3：影响非 X 社交源

控制：

- 仅在明确识别为 X 源时切换到 tweet 卡片
- 其余社交源保留现状

## 实施边界

本次实现只收在 Harmony 端：

- X 源 tweet 风格展示
- 订阅详情页与首页“社交”两处统一
- 展示解析与组件复用

不包含新的远程抓取逻辑、订阅源发现策略调整或数据库结构升级。
