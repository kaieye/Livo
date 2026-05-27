# Desktop 端功能补齐 TODO 清单

> 基于 `docs/harmony-to-desktop.md` 分析，按优先级排列。
> 任务依赖关系：→ 表示前置依赖，完成前置任务后再推进。

---

## 执行前校准

本清单不再把 Harmony 能力简单等价为 Desktop “未实现”。Desktop 已经存在一批基础能力，后续任务应按以下口径执行：

| 能力              | Desktop 当前状态                                | TODO 口径                                         |
| ----------------- | ----------------------------------------------- | ------------------------------------------------- |
| 文章 AI 摘要/翻译 | `EntryContent.tsx` 已有 UI 和 IPC 调用          | 抽 ViewModel、补 FeatureCard、补重试/测试         |
| AI Chat           | 已有 stream IPC 和基础面板                      | 接 Agent loop、工具调用、Trace、确认机制          |
| YouTube 解析      | `video-proxy.ts` 已有 Invidious/Piped 回退      | 统一解析逻辑、补测试、页面化播放                  |
| 音频播放          | `CornerPlayer` 已支持播放/进度/倍速/下载        | 服务化、全局 AudioMiniBar 产品化                  |
| 强调色            | 已有 8 色、自定义 hex、CSS variables            | 补 ThemePalette token 覆盖、拆 AppearanceSettings |
| 收藏              | 已有 `starred` 视图和 Star 操作                 | 增强 FavoritesPanel、排序/筛选/批量操作           |
| OPML              | 已有导入/导出、进度事件、并发导入               | 补刷新日志、失败明细、批次可观测性                |
| 多平台发现        | 已有 YouTube/X/Instagram/Bilibili 搜索 handlers | 补预览、配置、内置目录浏览                        |

GitNexus 使用状态：

- 已执行 `npx gitnexus analyze --force --embeddings`，`context`/`impact` 可用，`query` 可走 exact-scan fallback。
- `query` 仍会提示 `FTS indexes missing`，执行任务时以 `gitnexus context`、`gitnexus impact`、`rg` 交叉验证。
- 当前 Codex 会话未暴露 GitNexus MCP tools，先使用 CLI；需要配置 MCP 时另行处理，不混入功能开发。

---

## P0.5 — 技术基建（前置条件）预估工时：3-5 天

> 在 P0 任务开始前完成，为后续页面迁移提供基础架构。

- [x] **0.1** 启用页面路由方案（优先复用已安装的 `react-router-dom` 7） ✅ `3771914`
  - 完成标准：编写路由配置原型，支持 6+ 独立页面导航，URL 与 Store 状态双向同步
  - 实现：`createHashRouter` 7 条路由 (`/`, `/:viewType`, `/feed/:id`, `/starred`, `/discover`, `/settings`)，`useUrlSync` 双向同步 hook，Sidebar 改用 `useNavigate()`
  - 文件：`router/route-paths.ts`, `router/routes.tsx`, `router/use-url-sync.ts`, `router/index.tsx`
- [x] **0.2** 建立页面级组件目录结构（`pages/` 与 `components/` 分离） ✅ (含 0.1)
  - 完成标准：创建 `src/renderer/src/pages/` 目录，迁移现有 Layout 逻辑
  - 实现：`pages/HomePage.tsx` 封装 Layout + URL 同步，`App.tsx` 转为 `<Outlet />` 根布局
- [x] **0.3** 定义 ViewModel 接口层（EntryCardViewModel / FeedCardModel / ArticleDetailModel） ✅ `cd9a43f`
  - 完成标准：类型定义抽到 `packages/models`，组件消费 ViewModel 而非直接读 Store
  - 实现：`EntryCardViewModel`(22 属性), `FeedCardModel`(16 属性), `ArticleDetailModel`(28 属性)，导出于 `@livo/models`
  - 文件：`packages/models/src/view-models.ts`
- [x] **0.4** 抽取 Coordinator 层原型（从 `EntryList.tsx` 拆分 `HomeFeedCoordinator`） ✅ `6b2a4d1`
  - 完成标准：分页/模式切换/预取逻辑独立成文件，`EntryList.tsx` 的核心渲染与数据协调职责分离，行数减少约 20%-30%
  - 实现：`useHomeFeedCoordinator` hook（feed scope / loading / filtering / pagination / search），EntryList 3279→3012 行 (−8.1%)，媒体工具函数抽至 `entry-media-utils.ts`
  - 文件：`hooks/useHomeFeedCoordinator.ts`, `lib/entry-media-utils.ts`

---

## P0 — 核心功能缺口（影响基本体验）预估工时：8-12 天

### 1. 独立页面路由系统

- [x] **1.1** 新增 Subscriptions 页面（订阅管理 + Mode Rail 切换 Articles/Social/Videos/Pictures） → 依赖: 0.1, 0.2 ✅
  - 完成标准:`pages/SubscriptionsPage.tsx` + `components/subscriptions/SubscriptionsModeRail.tsx` + `components/subscriptions/FeedGroupList.tsx`,按 category 分组,4 模式切换,page-local mode 状态
  - 文件:`lib/feed-filters.ts` (新建 `isUserFeed` predicate)、`lib/feed-grouping.ts` (language-neutral grouping util)、`router/routes.tsx` (注册 `/subscriptions`)
- [x] **1.2** 新增 FeedDetail 页面（订阅源详情：元信息、预览卡片、文章列表、订阅/编辑操作） → 依赖: 0.1, 0.2, 0.3 ✅
  - 实现:`pages/FeedDetailPage.tsx`(498 行) — Hero(avatar/title/meta)、操作栏(refresh/openSite/edit-disabled/unsubscribe)、文章预览列表(点击回 `/feed/:id` 选中)、未订阅预览模式、空/加载/notFound 状态、a11y(landmark + aria-label)
  - 文件:`locales/{en,zh-CN}/feed-detail.ts`(新建 namespace)、`router/{routes,route-paths}.tsx`(注册 `/feed-detail/:feedId` + `ROUTES.feedDetail`)、`components/subscriptions/FeedGroupList.tsx`(跳转入口)
  - 复用:`lib/feed-filters.ts isUserFeed`、`lib/view-type-keys.ts VIEW_TYPE_I18N_KEYS`、`useFeedStore`/`useEntryStore`
  - 遗留(留待 1.3 解决):Edit 按钮已禁用(Coming Soon)；setTimeout(0) 绕 Layout reset effect；FeedHeroAvatar/ArticlePreviewRow img-fallback 重复；refreshFeed 隐式 reload home scope
- [ ] **1.3** 新增 ArticleDetail 页面（复用现有 EntryContent 能力，页面化承载 AI 辅助、社交详情、图片画廊、内嵌视频） → 依赖: 0.1, 0.2, 0.3
- [ ] **1.4** 新增 VideoPlayer 页面（复用现有 YouTube 解析 + iframe/webview 回退，统一全屏播放入口） → 依赖: 0.1, 0.2
- [ ] **1.5** 新增 ImageViewer 页面（图片全屏查看） → 依赖: 0.1, 0.2
- [ ] **1.6** 新增 AccountLogin 页面（账号登录流程） → 依赖: 0.1, 0.2

### 2. 文章详情页增强

- [ ] **2.1** 抽取 AI 摘要面板（从 EntryContent 内联逻辑迁出，调用已有 summarize IPC，保留加载/错误状态） → 依赖: 1.3
- [ ] **2.2** 抽取 AI 翻译面板（从 EntryContent 内联逻辑迁出，调用已有 translate IPC，补语言选择与错误呈现） → 依赖: 1.3
- [ ] **2.3** 整合社交内容详情视图（复用现有 SocialOverlay/SocialContent 组件，补页面级作者、互动、引用渲染） → 依赖: 1.3
- [ ] **2.4** 整合图片画廊模式（复用 OverlayMediaGallery，补 PictureDetailMedia 等价体验） → 依赖: 1.3
- [ ] **2.5** 整合内嵌视频播放（复用现有 VideoPlayer，补 ArticleDetail 页面内统一入口） → 依赖: 1.3
- [ ] **2.6** 补原文/美化视图切换 → 依赖: 1.3
- [ ] **2.7** 增强星标动画 + 阅读进度保持（基于现有 Star/ReadProgress 能力） → 依赖: 1.3

### 3. 发现流程完善

- [ ] **3.1** 新增 DiscoverPreview 步骤（订阅前预览源内容） → 依赖: 0.1
- [ ] **3.2** 新增 DiscoverSubscribeConfig 步骤（选择视图类型、分类、确认订阅） → 依赖: 3.1
- [ ] **3.3** 完善多平台用户搜索体验（已有 YouTube/X/Instagram/Bilibili handlers，补结果预览、错误提示、平台状态）
- [ ] **3.4** 实现内置订阅源分类浏览（ai/podcast/news/articles/social/pictures/videos）

### 4. 设置系统完善

- [ ] **4.1** 新增 AppearanceSettings 独立面板（迁移已有主题模式、强调色、字体、Custom CSS 控件）
- [ ] **4.2** 新增 PrivacySettings 面板（隐私相关配置）
- [ ] **4.3** 新增 RefreshLogSettings 面板（订阅源刷新历史记录） → 依赖: 14.1
- [ ] **4.4** 新增 AgentPermissionsSettings 面板（Agent 工具权限控制） → 依赖: 5.1, 6.4
- [ ] **4.5** 增强 AISettings 面板（参考 Harmony 的 AIAssistantSettingsPanel，423行）

---

## P1 — AI 能力对齐 预估工时：10-15 天

### 5. Agent 工具系统

- [ ] **5.0** 定义 Agent 工具接口与权限枚举（优先放入共享包，保持 Harmony/Desktop 工具签名一致）
  - 完成标准：工具名称、参数 schema、权限级别、确认需求可被两端复用
- [ ] **5.1** 实现 ToolRegistry（工具注册/查找/权限检查） → 依赖: 5.0
  - 完成标准：支持 30+ 工具注册，权限检查延迟 < 1ms
- [ ] **5.2** 实现 NavigationAgentTools（打开页面、切换Tab）
  - `open_root_tab`、`go_back`、`open_article_detail`、`open_feed_detail`
  - `open_settings_panel`、`open_video_player`、`open_image_viewer`
- [ ] **5.3** 实现 FeedAgentTools（订阅管理）
  - `list_subscribed_feeds`、`add_feed`、`remove_feed`
  - `refresh_feed`、`search_feeds`、`get_feed_detail`
- [ ] **5.4** 实现 EntryAgentTools（文章操作）
  - `get_today_updates`、`get_unread_entries`、`get_favorite_entries`
  - `get_entry_detail`、`mark_as_read`、`star_entry`
- [ ] **5.5** 实现 SettingsAgentTools（设置修改）
  - `set_theme_mode`、`set_accent_color`、`set_language`
  - `get_current_settings`、`update_ai_config`
- [ ] **5.6** 实现 DiscoverAgentTools（发现/推荐）
  - `list_builtin_feeds`、`add_builtin_subscription`
- [ ] **5.7** 实现 AccountAgentTools（账号管理）
  - `get_account_status`、`link_account`、`unlink_account`
- [ ] **5.8** 实现 DataAgentTools（数据操作）
  - `export_opml`、`clear_data`
- [ ] **5.9** 实现 ExternalAgentTools（外部能力）
  - `web_search`（DuckDuckGo HTML 搜索）

### 6. Agent 循环核心

- [ ] **6.1** 实现 AgentLoop（多轮工具调用循环，MAX_ROUNDS=5） → 依赖: 5.1-5.9
- [ ] **6.2** 实现 AgentService（对外统一接口，run/resume/abort） → 依赖: 6.1
- [ ] **6.3** 实现 AgentContextBuilder（构建带页面上下文的 Agent 请求） → 依赖: 6.2
- [ ] **6.4** 实现 PolicyGuard（安全策略：prompt injection 防护、权限控制） → 依赖: 6.2
- [ ] **6.5** 实现 AgentTraceStore（工具调用追踪记录） → 依赖: 6.2
- [ ] **6.6** 实现 Agent 错误恢复机制（网络中断/API 限流后的 retry） → 依赖: 6.2
- [ ] **6.7** 实现 Agent 性能监控（每轮工具调用耗时统计） → 依赖: 6.2

### 7. AI 聊天面板增强

- [ ] **7.1** 实现 Typewriter 流式输出效果
- [ ] **7.2** 实现 Tool Trace 面板（显示每轮工具调用详情） → 依赖: 6.5
- [ ] **7.3** 实现 Agent 确认对话框（写入/删除/外链操作需用户确认） → 依赖: 6.4
- [ ] **7.4** 实现工具执行状态栏（AIChatRunStatusBar） → 依赖: 6.5
- [ ] **7.5** 实现会话历史持久化（ChatHistoryStore 等价物）
- [ ] **7.6** 标准化多 Provider 协议（Desktop 已有 provider 配置，补 ProviderProtocol、响应解析、错误归一）
- [ ] **7.7** 编写 Agent 循环单元测试（mock ToolRegistry） → 依赖: 6.1

### 8. AI 辅助阅读

- [ ] **8.1** 实现 ArticleAIAssistViewModel（文章详情页的 AI 功能状态管理） → 依赖: 1.3
- [ ] **8.2** 实现 SummaryFeatureCard（AI 摘要开关 + 快捷操作） → 依赖: 8.1
- [ ] **8.3** 实现 TranslationFeatureCard（AI 翻译开关 + 目标语言选择） → 依赖: 8.1
- [ ] **8.4** 实现多轮 AI 调用重试策略（TranslationPipeline 等价物） → 依赖: 8.1

---

## P2 — 媒体能力增强 预估工时：3-5 天

### 9. 视频播放

- [ ] **9.1** 统一 YouTube 视频 URL 解析（合并 main `extractYouTubeId` 与 renderer `extractYoutubeVideoId`，抽到共享 util）
- [ ] **9.2** 为 Invidious 多实例回退补测试与失败观测（现有 `video-proxy.ts` 已实现）
- [ ] **9.3** 为 Piped 回退补 HLS/combined stream 兼容测试（现有 `video-proxy.ts` 已实现）
- [ ] **9.4** 页面化 WebView/iframe 回退播放（复用现有 Bilibili/YouTube 回退逻辑）
- [ ] **9.5** 统一视频直链检测（抽 `isDirectVideoUrl`，替换组件内分散正则）

### 10. 音频播放

- [ ] **10.1** 抽取 AudioPlaybackService（从 `CornerPlayer` / `usePlayerStore` 迁出播放、暂停、进度、倍速状态）
- [ ] **10.2** 产品化 AudioMiniBar（复用现有 CornerPlayer 交互，补全局队列/封面/来源状态）
- [ ] **10.3** 统一倍速控制策略（保留现有 0.5x ~ 2.0x 或按 Harmony 收敛到 0.75x ~ 2.0x）

### 11. 图片/媒体增强

- [ ] **11.1** 实现图片保存到本地（MediaSaveService 等价物）
- [ ] **11.2** 实现图片画廊翻页浏览（EntryImageGallery 等价物）

---

## P3 — 体验优化 预估工时：4-7 天

### 12. 主题系统完善

- [ ] **12.1** 完善强调色系统（已有 8 色 + 自定义 hex，补组件覆盖和设置页归属）
- [ ] **12.2** 实现完整 ThemePalette（参考 Harmony 的 14 个 Token，映射到 CSS variables）
- [ ] **12.3** 实现页面/视图转场动画

### 13. 首页体验

- [ ] **13.1** 实现 ContentModeRail（首页内容模式快速切换栏）
- [ ] **13.2** 实现 HomeInlineSearch（首页内搜索覆盖层）
- [ ] **13.3** 实现 HomeSkeletonEntryCard（骨架屏加载状态）

### 14. 数据管理

- [ ] **14.1** 实现 RefreshLogStore（刷新历史记录存储）
- [ ] **14.2** 增强 FavoritesPanel（基于已有 `starred` 视图，补独立面板、排序、筛选、批量取消收藏）
- [ ] **14.3** 实现 FeedRefreshCoordinator（刷新协调器，分批刷新 + 限流）

### 15. 订阅体验

- [ ] **15.1** 实现 FeedDetailHeroAvatar（订阅源大图头部）
- [ ] **15.2** 实现 SubscriptionsAvatarHydration（头像预加载）
- [ ] **15.3** 实现 FeedSubscribeViewTypeRail（订阅时视图类型选择）
- [ ] **15.4** 增强 OPML 导入（分批刷新 + 进度提示）

### 16. 其他细节

- [ ] **16.1** 接入 AI 回复 Markdown 渲染（复用已有 `react-markdown`，补链接/HTML 安全策略）
- [ ] **16.2** 实现网络搜索服务（DuckDuckGo，无需 API Key）
- [ ] **16.3** 实现 ExternalUrlService（外链统一处理 + 安全警告）
- [ ] **16.4** 实现连接测试服务（AIAssistantConnectionTestService 等价物）

---

## 跨端复用项（非新功能，降低后续维护成本）

- [ ] **17.1** 将数据模型转换逻辑（toFeedCardModel / toEntryCardModel）抽到 `packages/models`
- [ ] **17.2** 将 ViewModel 类型定义（EntryCardModel / FeedCardModel / ArticleDetailModel）抽到共享包
- [ ] **17.3** 将 Agent 工具接口定义抽到共享包（对应 5.0，两端一致的工具签名）
- [ ] **17.4** 将视频 URL 解析逻辑（YouTube ID 提取、Invidious/Piped 实例列表）抽到 `packages/utils`

---

## P3+ — Desktop 特有能力整合 预估工时：2-3 天

> 将 Desktop 端独有的能力（命令面板、全局快捷键、拖拽面板）与新增功能整合。

- [ ] **18.1** 命令面板集成 Agent 工具（输入自然语言触发工具调用） → 依赖: P1 全部
  - 完成标准：CommandPalette 支持输入 "打开收藏" 等自然语言指令
- [ ] **18.2** 全局快捷键扩展（收藏/翻译/摘要快捷键）
  - 完成标准：新增 3-5 个全局快捷键，与现有 HotkeyScope 系统兼容
- [ ] **18.3** 独立页面适配拖拽布局（FeedDetail/ArticleDetail 支持面板宽度调整）
  - 完成标准：新增页面支持拖拽调整宽度，宽度持久化到 LocalStorage
- [ ] **18.4** 右键上下文菜单增强（新增页面/面板的专属菜单项）
  - 完成标准：FeedDetail/ArticleDetail 有专属右键菜单

---

## 任务验证标准示例

以下为部分关键任务的完成标准示例，实际执行时应为每个任务补充类似标准：

| 任务                | 验证标准                                                          |
| ------------------- | ----------------------------------------------------------------- |
| 0.1 路由方案        | 支持 6+ 独立页面导航，URL 变化与 Store 状态同步                   |
| 1.3 ArticleDetail   | 能展示文章正文，并复用/承载 AI 摘要、社交详情、图片画廊、内嵌视频 |
| 5.1 ToolRegistry    | 支持 30+ 工具注册，权限检查延迟 < 1ms，类型安全                   |
| 6.1 AgentLoop       | 能通过 5 轮工具调用完成 "打开设置 → 改主题 → 确认" 流程           |
| 9.1 YouTube 解析    | 10 种 YouTube URL 格式在 main/renderer 共用实现中结果一致         |
| 12.1 强调色系统     | 现有 8 种强调色和自定义 hex 切换后，按钮/链接/选中态同步变色      |
| 14.2 FavoritesPanel | 能展示收藏列表，支持取消收藏，支持按时间/来源排序                 |

---

## 统计

| 优先级   | 项数     | 预估工时      | 说明                                        |
| -------- | -------- | ------------- | ------------------------------------------- |
| P0.5     | ~~4~~ ✅ | ~~3-5 天~~ ✅ | 技术基建（前置条件）— 已完成 2026-05-27     |
| P0       | 20       | 8-12 天       | 核心功能缺口，影响基本体验                  |
| P1       | 28       | 10-15 天      | AI 能力对齐，差异化竞争力                   |
| P2       | 11       | 3-5 天        | 媒体能力产品化，已有基础实现                |
| P3       | 19       | 4-7 天        | 体验优化与细节完善                          |
| P3+      | 4        | 2-3 天        | Desktop 特有能力整合                        |
| 复用     | 4        | 2-3 天        | 跨端代码重构                                |
| **合计** | **86**   | **29-50 天**  | 已按 Desktop 现状重估，执行时继续按迭代拆分 |
