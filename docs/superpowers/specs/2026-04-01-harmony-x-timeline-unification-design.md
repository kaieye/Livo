# Harmony X Timeline Unification Design

## 背景

Harmony 端当前对 X 内容的展示已经具备基础识别和语义解析能力，但视觉结构仍以“Livo 摘要卡片”为主：

- 首页社交流在 [Index.ets](E:/Livo/apps/harmony/entry/src/main/ets/pages/Index.ets) 中通过 [TweetEntryCard.ets](E:/Livo/apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets) 输出大圆角白卡。
- 订阅详情页的 X 预览在 [FeedDetailView.ets](E:/Livo/apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets) 中复用同一组件。
- 展示数据由 [TweetEntryPresentation.ts](E:/Livo/apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts) 提供，但当前模型更偏“摘要卡片信息”，不足以支撑更接近 X 原帖时间线的层级。

用户目标不是简单调色，而是把所有 X 相关展示统一为更接近原生 tweet timeline 的视觉表达。

## 目标

将 Harmony 端所有 X 相关展示统一为一套时间线式 renderer，至少覆盖：

- 首页社交流中的 X 条目
- 订阅详情页中的 X 条目预览
- 所有已接入 [TweetEntryCard.ets](E:/Livo/apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets) 的 X 入口

实现后，X 条目需要具备以下观感：

- 从“大白卡摘要块”改为“平面列表单元”
- 更接近 X 原帖的头部信息层级
- 支持转帖提示、引用推文卡片、多图宫格和底部动作栏
- 首页与订阅详情页保持同一套视觉和语义输出

## 非目标

- 不改 Instagram、Bilibili、YouTube 的社交展示样式
- 不引入真实的点赞、评论、转发、收藏、分享交互
- 不做回复线程、长文折叠、登录态操作等客户端能力
- 不调整数据库结构或 RSS 抓取逻辑
- 不追求逐像素复刻 X 官方客户端

## 方案概览

采用“重建 X timeline 展示模型 + 统一组件渲染”的方案。

### 设计原因

- 现有 [TweetEntryCard.ets](E:/Livo/apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets) 已经承担统一入口职责，适合继续作为壳层，但其内部结构需要升级。
- 时间线样式需要比现有模型更多的语义字段，例如动作栏、转帖头、引用块头部和多图布局元信息，仅靠页面层拼接会导致首页和详情页再次分叉。
- [TweetEntryPresentation.ts](E:/Livo/apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts) 已具备 retweet / quote 的语义识别基础，是最合适的扩展点。

## 展示架构

### 统一展示入口

保留 [TweetEntryCard.ets](E:/Livo/apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets) 作为 X 条目唯一 renderer。

所有 X 入口都只做两件事：

1. 判定当前条目是否属于 X
2. 将原始 entry/card 数据映射为统一的 presentation，再交给 `TweetEntryCard`

页面层不再自行拼接 X 专属 UI 细节。

### 展示模型扩展

扩展 [TweetEntryPresentation.ts](E:/Livo/apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts) 输出的数据结构，至少包含：

- 主头部信息：显示名、用户名、头像、发布时间
- 条目语义：普通 tweet / retweet / quote
- 转帖提示：`谁已转帖`
- 正文文本
- 媒体列表
- 引用 tweet 头部与正文
- 底部动作栏所需的评论、转帖、点赞、浏览数字
- 供 UI 判断的展示布尔值或结构化动作项

保持展示层扩展，不修改持久化数据结构。

## 视觉设计

### 整体外观

- X 条目从大圆角卡片改为更接近平面列表单元
- 背景仍遵循 Livo 主题色板，但弱化厚重卡片感
- 条目间距显著收窄，依靠细边线或轻间隔区分内容
- 优先保留现有暗色/亮色主题兼容

### 头部

头部包含：

- 左侧圆形头像
- 第一行显示名、认证/平台标记、用户名、时间
- 右上可保留轻量的更多菜单占位图标样式，但本次无需真实菜单逻辑

显示名与用户名应同排呈现，优先模拟图二的信息密度。

### 正文

- 正文弱化“标题 + 摘要”的文章感，直接按 tweet 文本呈现
- 默认允许更自然的多行排版
- 维持合理的 `maxLines`，避免极长内容撑爆首页

### 转帖头

当 `presentation.kind === 'retweet'` 时，在正文上方显示“某某已转帖”提示行，作为次级灰色信息，而非独立大胶囊。

### 引用推文

引用推文采用内嵌次级卡片：

- 边框更轻
- 头部显示被引用者显示名和用户名
- 文本最多显示数行
- 与主 tweet 形成明显层级，但不喧宾夺主

### 图片宫格

- 单图：较宽的横向预览
- 双图：双列等高
- 三图/四图：标准宫格
- 图片圆角比现有更收敛，更接近 tweet 附图

### 动作栏

底部动作栏统一使用轻量图标 + 数字的结构，至少覆盖：

- 评论
- 转帖
- 喜欢
- 浏览
- 分享或更多

本次只做静态展示与点击区域视觉反馈，不做业务交互。

## 页面接线

### 首页

在 [Index.ets](E:/Livo/apps/harmony/entry/src/main/ets/pages/Index.ets) 中保留现有 X 识别分支，但将输出切到新的时间线式 `TweetEntryCard`。

首页社交流继续只对 X 条目启用该 renderer，其他社交内容保持当前实现。

### 订阅详情页

在 [FeedDetailView.ets](E:/Livo/apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets) 中继续通过 `isXPreview()` 识别 X 源，但同样改用统一后的时间线式 `TweetEntryCard`。

这样首页与详情页能够共享同一视觉与语义渲染。

## 测试策略

优先使用现有 Node 测试体系补强展示语义，而不是只做人工预览。

新增或补充以下回归：

- `TweetEntryPresentation` 能稳定输出 retweet / quote / media / metrics 所需字段
- X 条目动作栏数据缺失时能够优雅降级
- 首页仍通过统一 `TweetEntryCard` 渲染 X 社交流
- 订阅详情页仍通过统一 `TweetEntryCard` 渲染 X 预览

这次不强求 UI 像素级快照测试，但需要确保关键结构字段不会回退。

## 风险与控制

### 风险 1：不同 X feed 的 HTML 结构差异导致引用或转帖识别不稳定

控制：

- 继续让 `TweetEntryPresentation` 采用 best-effort 解析
- 对于不可解析字段，组件降级隐藏而不是渲染错误结构

### 风险 2：首页和详情页再次出现局部定制

控制：

- 页面层只保留“识别 + 调用”职责
- 所有 X 视觉变化都集中在 `TweetEntryCard` 与 `TweetEntryPresentation`

### 风险 3：时间线式样式影响现有主题兼容

控制：

- 继续使用 [ThemeService.ets](E:/Livo/apps/harmony/entry/src/main/ets/common/services/ThemeService.ets) 提供的主题色
- 使用现有 token 和 palette，不引入页面级硬编码大面积颜色体系

## 实施边界

本次实现只收敛在 Harmony 端 X 展示统一：

- 更新 X presentation 模型
- 重构 `TweetEntryCard` 成时间线 renderer
- 统一首页和订阅详情页接线
- 补充回归测试

不包含新的抓取源、登录逻辑、详情交互页或跨平台同步改造。
