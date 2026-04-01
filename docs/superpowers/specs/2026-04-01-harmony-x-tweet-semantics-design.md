# Harmony X Tweet Semantics Design

## 背景

当前 Harmony 端已经为 X 源引入了共享的 tweet 卡片基础能力：

- [`TweetEntryPresentation.ts`](E:/Livo/apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts) 负责把 entry/card 归一化为 tweet 展示态。
- [`TweetEntryCard.ets`](E:/Livo/apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets) 负责在订阅详情页和首页“社交”栏目渲染 tweet 风格卡片。

但现阶段这套展示仍然把所有 X 内容都视为“普通推文”，导致以下问题：

- `RT ...` 开头的内容会被当作普通正文直接展示，用户无法区分“转发”与“原创”。
- 引用推文会被压平成一大段文本，而不是“主推文 + 引用卡片”的结构。
- 这类语义错误比视觉细节更影响信息理解，因此需要先把内容语义分对。

## 目标

在 Harmony 端先补齐 X 内容的语义识别与展示分层，让用户能一眼区分：

- 普通推文
- 转发推文
- 引用推文

本次改动需要同时覆盖：

- 订阅详情页中的 X 推文列表
- 首页“社交”栏目中的 X 条目卡片

## 非目标

- 不在本次实现中追求完整还原 X 官方客户端视觉
- 不补蓝 V、官方 X 徽标、更多菜单等高仿真细节
- 不引入真实互动操作，仅做展示
- 不改变 Instagram、Bilibili、YouTube 等其他社交源的语义模型
- 不修改远程抓取和订阅发现策略

## 方案概览

采用“先扩展 tweet 语义模型，再由卡片按语义渲染”的方案。

### 推荐原因

- 语义判断放在 [`TweetEntryPresentation.ts`](E:/Livo/apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts) 更稳定，避免把字符串规则写死在 UI 组件里。
- [`TweetEntryCard.ets`](E:/Livo/apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets) 只负责消费语义模型，后面再补视觉细节时不需要推翻解析层。
- 首页和详情页已经共用同一张 tweet 卡片，扩语义后两处可以天然同步。

## 语义模型设计

在 `TweetEntryPresentation` 中新增语义字段：

- `kind: 'tweet' | 'retweet' | 'quote'`
- `retweetByLabel: string`
- `quotedTweet?: TweetQuotedPresentation`

新增引用卡片模型：

- `displayName`
- `username`
- `avatarUrl`
- `text`
- `mediaUrls`

### 语义定义

#### 普通推文 `tweet`

默认类型。

特征：

- 无明确转发语义
- 无明确“主文案 + 内嵌另一条推文”结构

展示：

- 按当前 tweet card 主体直接展示

#### 转发推文 `retweet`

保守识别以下场景：

- 文本以 `RT ` 开头
- 后续能提取出被转发作者的显示名或 handle
- 去掉 `RT ...` 头部后仍保留原推文主体内容

展示：

- 卡片顶部增加一条“某某已转帖/已转发”语义条
- 主卡片作者和正文切换为被转发的原推文作者和内容
- 不再把整段 `RT ...` 原样当成普通正文

#### 引用推文 `quote`

保守识别以下场景：

- 主文本存在明显的作者自身文案
- 后半段可分离出一段独立的被引用推文内容
- 被引用内容能提取出独立作者/handle/正文中的至少两项

展示：

- 主卡片显示当前作者自己的正文
- 正文下方增加一张内嵌引用卡片
- 内嵌卡片使用更紧凑的 tweet 子卡片样式

## 识别策略

坚持“保守识别，宁缺勿错”。

### 转发识别

优先规则：

1. 文本前缀匹配 `RT `
2. 后面紧跟可解析的作者片段，例如：
   - `RT @username: ...`
   - `RT Display Name ...`
3. 仅当能稳定拆出“转发者”和“原推文内容”时才标记为 `retweet`

兜底策略：

- 仅有 `RT ` 但无法稳定拆出原作者时，保持 `tweet`
- 不强行猜作者身份

### 引用推文识别

优先规则：

1. 主文本中存在明显的正文段落分隔
2. 后段文本包含独立作者标识或引用块边界
3. 后段内容可抽取为 `quotedTweet`

兜底策略：

- 若无法稳定分离引用块，则保持 `tweet`
- 不把普通多段文本误判成引用推文

## 展示设计

### `TweetEntryCard` 顶部新增语义条

当 `kind === 'retweet'` 时：

- 在作者行上方显示一条弱化语义标签
- 文案示例：`Elon Musk 已转帖`

视觉上只做轻量提示，不先做官方图标仿真。

### `TweetEntryCard` 引用块

当 `kind === 'quote'` 且存在 `quotedTweet` 时：

- 在主正文下方渲染一个内嵌引用卡片
- 引用卡片内容包含：
  - 头像
  - 显示名
  - `@username`
  - 正文
  - 最多少量媒体

引用卡片应明显属于主卡片内部，而不是一条新的独立列表项。

### 普通推文行为保持

当 `kind === 'tweet'` 时：

- 维持当前 tweet card 主体结构
- 不新增多余标识

## 文件边界

### 解析层

主要修改：

- [`TweetEntryPresentation.ts`](E:/Livo/apps/harmony/entry/src/main/ets/common/utils/TweetEntryPresentation.ts)

职责：

- 识别 `tweet / retweet / quote`
- 生成 retweet 语义字段
- 生成 quote 内嵌卡片字段

### 展示层

主要修改：

- [`TweetEntryCard.ets`](E:/Livo/apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets)

职责：

- 根据 `kind` 切换语义展示
- 渲染 retweet 顶部语义条
- 渲染 quote 内嵌卡片

### 页面接线

无需新增页面分支。

原因：

- [`FeedDetailView.ets`](E:/Livo/apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets) 和 [`Index.ets`](E:/Livo/apps/harmony/entry/src/main/ets/pages/Index.ets) 已经接到 `TweetEntryCard`
- 本次只需增强 presentation 和 card，本身就会同时影响两处入口

## 测试策略

补充以下回归：

- `RT @username: ...` 被识别为 `retweet`
- 无法稳定拆作者的 `RT ...` 保持 `tweet`
- 有明显引用结构的内容被识别为 `quote`
- 普通多段文本不误判为 `quote`
- `TweetEntryCard` 在 `retweet` 时渲染语义条
- `TweetEntryCard` 在 `quote` 时渲染内嵌引用卡片

## 风险与控制

### 风险 1：误判转发或引用

控制：

- 只做保守识别
- 识别不稳定时退回普通 `tweet`
- 不靠模糊猜测填充作者字段

### 风险 2：tweet parser 变得过于复杂

控制：

- 只支持本次需要的 3 类语义
- 不在本次引入更广泛的 X 富文本 AST
- 解析 helper 保持 focused，不扩展到其他平台

### 风险 3：首页和详情页表现再次分叉

控制：

- 仍由共享的 `TweetEntryCard` 统一渲染
- 页面文件不新增 X 特殊 UI

## 实施边界

本次实现只收在：

- X 推文语义识别
- 转发与引用的结构化展示
- 共享 tweet card 的语义渲染增强

不包含高仿真视觉、交互动作、抓取链路升级或其他平台同步改造。
