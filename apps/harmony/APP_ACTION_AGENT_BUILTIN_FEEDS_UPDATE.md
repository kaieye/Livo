# Livo 操作助手 - 内嵌订阅源功能更新

## 📦 新增功能

### 1. 查看推荐订阅源 (`list_builtin_feeds`)

**功能描述**: 查看应用内嵌的推荐订阅源列表，支持按分类查看。

**支持的分类**:

- `all` - 全部推荐订阅源
- `articles` - 文章类
- `social` - 社交类
- `pictures` - 图片类
- `videos` - 视频类
- `ai` - AI相关
- `podcast` - 播客
- `news` - 新闻

**使用示例**:

```
用户: 查看推荐订阅源
助手: 推荐订阅源 - 全部分类（显示前30个，共500+个）：
      1. 阮一峰的网络日志 - 阮一峰的网络日志，分享编程、科技与每周资讯汇总...
      2. 少数派 - 少数派致力于帮助用户提升工作效率和生活品质...
      3. TechCrunch - TechCrunch startup and technology news...
      ...

用户: 查看文章类的推荐订阅源
助手: 推荐订阅源 - 文章分类（显示前30个，共200+个）：
      ...

用户: 查看视频类的推荐订阅
助手: 推荐订阅源 - 视频分类（显示前30个，共50+个）：
      ...
```

### 2. 添加推荐订阅源 (`add_builtin_subscription`)

**功能描述**: 从应用内嵌的推荐订阅源列表中直接添加到用户的订阅列表。

**使用示例**:

```
用户: 添加推荐订阅 阮一峰
助手: ✓ 成功添加推荐订阅源：阮一峰的网络日志
      分类：内置

用户: 添加这个少数派
助手: ✓ 成功添加推荐订阅源：少数派
      分类：内置

用户: 添加推荐订阅 不存在的源
助手: 未找到名为 "不存在的源" 的推荐订阅源。

      您可能想要添加：
      1. 阮一峰的网络日志
      2. 少数派
      3. 小众软件
```

## 🔧 技术实现

### 数据源

内嵌订阅源数据来自：

```
entry/src/main/ets/common/data/discover-builtin-feeds/
├── articles.json    # 文章类订阅源
├── social.json      # 社交类订阅源
├── pictures.json    # 图片类订阅源
├── videos.json      # 视频类订阅源
├── ai.json          # AI相关订阅源
├── podcast.json     # 播客订阅源
├── news.json        # 新闻订阅源
├── ins.json         # Instagram订阅源
├── seed-feeds.json  # 种子订阅源
└── trending-feeds.json # 热门订阅源
```

### 核心代码

#### 1. 导入内嵌订阅源数据

```typescript
import {
  builtinDiscoverFeedsAll,
  DiscoverBuiltinFeed,
  builtinDiscoverFeedsByView,
  FeedViewType,
} from '../data/DiscoverBuiltinFeeds'
```

#### 2. 查看推荐订阅源函数

```typescript
async function listBuiltinFeeds(
  args: Record<string, Object>,
): Promise<AppActionResult> {
  const category = (args['category'] as string) || 'all'
  let feeds: DiscoverBuiltinFeed[] = []

  if (category === 'all') {
    feeds = builtinDiscoverFeedsAll()
  } else {
    // 按分类筛选
    const viewMap: Record<string, FeedViewType> = {
      articles: FeedViewType.Articles,
      social: FeedViewType.SocialMedia,
      pictures: FeedViewType.Pictures,
      videos: FeedViewType.Videos,
    }
    // ...
  }

  // 返回前30个推荐订阅源
  return {
    success: true,
    message: `推荐订阅源 - ${categoryName}分类...`,
    data: { count: feeds.length, feeds: feeds.slice(0, 30) },
  }
}
```

#### 3. 添加推荐订阅源函数

```typescript
async function addBuiltinSubscription(
  args: Record<string, Object>,
): Promise<AppActionResult> {
  const feedTitle = args['feedTitle'] as string

  // 在所有内嵌订阅源中查找
  const allBuiltinFeeds = builtinDiscoverFeedsAll()
  const matchedFeed = allBuiltinFeeds.find(
    (f) =>
      f.title.toLowerCase().includes(feedTitle.toLowerCase()) ||
      feedTitle.toLowerCase().includes(f.title.toLowerCase()),
  )

  // 检查是否已订阅
  const existingFeeds = await FeedRepository.default.list()
  const alreadySubscribed = existingFeeds.some((f) => f.url === matchedFeed.url)

  // 添加到订阅
  const feed = await FeedRepository.default.create({
    url: matchedFeed.url,
    title: matchedFeed.title,
    category: matchedFeed.category,
    view: matchedFeed.view,
  })

  return {
    success: true,
    message: `✓ 成功添加推荐订阅源：${feed.title}`,
  }
}
```

### 意图识别规则

```typescript
// 查看推荐/内嵌订阅源
if (
  (lowerPrompt.includes('推荐') ||
    lowerPrompt.includes('内嵌') ||
    lowerPrompt.includes('内置') ||
    lowerPrompt.includes('discover')) &&
  lowerPrompt.includes('订阅')
) {
  // 解析分类
  let category = 'all'
  if (lowerPrompt.includes('文章')) category = 'articles'
  else if (lowerPrompt.includes('社交')) category = 'social'
  // ...

  const result = await listBuiltinFeeds({ category })
  return { text: result.message }
}

// 添加推荐订阅源
if (
  lowerPrompt.includes('添加') &&
  lowerPrompt.includes('订阅') &&
  (lowerPrompt.includes('推荐') ||
    lowerPrompt.includes('这个') ||
    lowerPrompt.includes('那个'))
) {
  const titleMatch =
    prompt.match(/[""](.*?)["']/) || prompt.match(/添加\s+(.+)/)
  if (titleMatch) {
    const feedTitle = titleMatch[1]
    const result = await addBuiltinSubscription({ feedTitle })
    return { text: result.message }
  }
}
```

## 📊 数据统计

### 内嵌订阅源数量

| 分类     | 数量      |
| -------- | --------- |
| articles | ~200+     |
| social   | ~50+      |
| pictures | ~30+      |
| videos   | ~50+      |
| ai       | ~20+      |
| podcast  | ~20+      |
| news     | ~20+      |
| **总计** | **~500+** |

### 热门订阅源示例

#### 文章类

- 阮一峰的网络日志
- 少数派
- TechCrunch
- Paul Graham - Essays
- MIT Technology Review

#### 视频类

- 影视飓风 - Bilibili
- 极客湾Geekerwan - Bilibili
- 老师好我叫何同学 - Bilibili
- TED Talks Daily
- Lex Fridman - YouTube

#### 社交类

- Elon Musk / @elonmusk
- 各种Twitter/X账号

## 🎯 使用场景

### 场景1: 新用户快速订阅

```
用户: 我刚开始用，有什么推荐的订阅源吗？
助手: 推荐订阅源 - 全部分类（显示前30个，共500+个）：
      1. 阮一峰的网络日志 - 分享编程、科技与每周资讯汇总
      2. 少数派 - 提升工作效率和生活品质
      3. TechCrunch - 科技创业资讯
      ...

      您可以直接说"添加推荐订阅 阮一峰"来快速订阅！
```

### 场景2: 按兴趣分类查看

```
用户: 我想看视频类的推荐订阅
助手: 推荐订阅源 - 视频分类（显示前30个，共50+个）：
      1. 影视飓风 - Bilibili - 专业影视制作团队
      2. 极客湾Geekerwan - Bilibili - 芯片与硬件性能测评
      3. 老师好我叫何同学 - Bilibili - 创意视频探索科技
      ...
```

### 场景3: 快速添加订阅

```
用户: 添加推荐订阅 少数派
助手: ✓ 成功添加推荐订阅源：少数派
      分类：内置
```

## 🧪 测试用例

### 新增测试

```typescript
describe('runAppActionAgent - 内嵌订阅源相关', () => {
  it('应该识别查看推荐订阅源的意图', async () => {
    const result = await runAppActionAgent('查看推荐订阅源')
    expect(result.executedActions).toContain('list_builtin_feeds')
  })

  it('应该识别查看文章分类推荐订阅源', async () => {
    const result = await runAppActionAgent('查看文章类的推荐订阅源')
    expect(result.executedActions).toContain('list_builtin_feeds')
  })

  it('应该识别查看视频分类推荐订阅源', async () => {
    const result = await runAppActionAgent('查看视频类的推荐订阅')
    expect(result.executedActions).toContain('list_builtin_feeds')
  })

  it('应该识别添加推荐订阅的意图', async () => {
    const result = await runAppActionAgent('添加推荐订阅 阮一峰')
    expect(result.executedActions).toContain('add_builtin_subscription')
  })
})
```

## 📝 更新文件列表

| 文件                        | 更新内容                                                 |
| --------------------------- | -------------------------------------------------------- |
| `AppActionAgentService.ets` | 新增 `listBuiltinFeeds` 和 `addBuiltinSubscription` 函数 |
| `AppActionPanel.ets`        | 更新建议按钮和工具标签                                   |
| `app-action-agent.test.ts`  | 新增内嵌订阅源相关测试用例                               |

## 🚀 后续优化方向

1. **模糊匹配优化**: 改进订阅源名称匹配算法，支持更灵活的搜索
2. **分页显示**: 当推荐订阅源数量较多时，支持分页查看
3. **收藏推荐**: 允许用户收藏喜欢的推荐订阅源组合
4. **智能推荐**: 根据用户已有订阅，智能推荐相似的订阅源
5. **搜索功能**: 支持在内嵌订阅源中搜索关键词

## ✅ 完成清单

- [x] 导入内嵌订阅源数据
- [x] 实现 `listBuiltinFeeds` 函数
- [x] 实现 `addBuiltinSubscription` 函数
- [x] 添加工具定义
- [x] 更新意图识别规则
- [x] 更新UI建议按钮
- [x] 更新工具标签
- [x] 添加测试用例
- [x] 编写更新文档
