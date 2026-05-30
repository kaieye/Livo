# Desktop 端 TODO

> 基于 `docs/harmony-to-desktop.md` 分析，按优先级排列。

---

## P0 — 核心功能缺口

### 2. 文章详情页增强（接续）

- [x] **2.5** 整合内嵌视频播放（复用现有 VideoPlayer，补 ArticleDetail 页面内统一入口）
- [x] **2.6** 补原文/美化视图切换
- [x] **2.7** 增强星标动画 + 阅读进度保持（基于现有 Star/ReadProgress 能力）

### 3. 发现流程完善（接续）

- [x] **3.4** 实现内置订阅源分类浏览（ai/podcast/news/articles/social/pictures/videos）

### 4. 设置系统完善

- [ ] **4.1** 新增 AppearanceSettings 独立面板（迁移已有主题模式、强调色、字体、Custom CSS 控件）
- [ ] **4.2** 新增 PrivacySettings 面板（隐私相关配置）
- [ ] **4.3** 新增 RefreshLogSettings 面板（订阅源刷新历史记录）
- [ ] **4.4** 新增 AgentPermissionsSettings 面板（Agent 工具权限控制）
- [ ] **4.5** 增强 AISettings 面板（参考 Harmony 的 AIAssistantSettingsPanel）

---

## P1 — AI 能力对齐

### 5. Agent 工具系统

- [ ] **5.0** 定义 Agent 工具接口与权限枚举（优先放入共享包，保持 Harmony/Desktop 工具签名一致）
- [ ] **5.1** 实现 ToolRegistry（工具注册/查找/权限检查）
- [ ] **5.2** 实现 NavigationAgentTools（打开页面、切换Tab）
- [ ] **5.3** 实现 FeedAgentTools（订阅管理）
- [ ] **5.4** 实现 EntryAgentTools（文章操作）
- [ ] **5.5** 实现 SettingsAgentTools（设置修改）
- [ ] **5.6** 实现 DiscoverAgentTools（发现/推荐）
- [ ] **5.7** 实现 AccountAgentTools（账号管理）
- [ ] **5.8** 实现 DataAgentTools（数据操作）
- [ ] **5.9** 实现 ExternalAgentTools（外部能力）

### 6. Agent 循环核心

- [ ] **6.1** 实现 AgentLoop（多轮工具调用循环，MAX_ROUNDS=5）
- [ ] **6.2** 实现 AgentService（对外统一接口，run/resume/abort）
- [ ] **6.3** 实现 AgentContextBuilder（构建带页面上下文的 Agent 请求）
- [ ] **6.4** 实现 PolicyGuard（安全策略：prompt injection 防护、权限控制）
- [ ] **6.5** 实现 AgentTraceStore（工具调用追踪记录）
- [ ] **6.6** 实现 Agent 错误恢复机制（网络中断/API 限流后的 retry）
- [ ] **6.7** 实现 Agent 性能监控（每轮工具调用耗时统计）

### 7. AI 聊天面板增强

- [ ] **7.1** 实现 Typewriter 流式输出效果
- [ ] **7.2** 实现 Tool Trace 面板（显示每轮工具调用详情）
- [ ] **7.3** 实现 Agent 确认对话框（写入/删除/外链操作需用户确认）
- [ ] **7.4** 实现工具执行状态栏（AIChatRunStatusBar）
- [ ] **7.5** 实现会话历史持久化（ChatHistoryStore 等价物）
- [ ] **7.6** 标准化多 Provider 协议（Desktop 已有 provider 配置，补 ProviderProtocol、响应解析、错误归一）
- [ ] **7.7** 编写 Agent 循环单元测试（mock ToolRegistry）

### 8. AI 辅助阅读

- [ ] **8.1** 实现 ArticleAIAssistViewModel（文章详情页的 AI 功能状态管理）
- [ ] **8.2** 实现 SummaryFeatureCard（AI 摘要开关 + 快捷操作）
- [ ] **8.3** 实现 TranslationFeatureCard（AI 翻译开关 + 目标语言选择）
- [ ] **8.4** 实现多轮 AI 调用重试策略（TranslationPipeline 等价物）

---

## P2 — 媒体能力增强

### 9. 视频播放

- [ ] **9.1** 统一 YouTube 视频 URL 解析（合并 main `extractYouTubeId` 与 renderer `extractYoutubeVideoId`，抽到共享 util）
- [ ] **9.2** 为 Invidious 多实例回退补测试与失败观测
- [ ] **9.3** 为 Piped 回退补 HLS/combined stream 兼容测试
- [ ] **9.4** 页面化 WebView/iframe 回退播放
- [ ] **9.5** 统一视频直链检测（抽 `isDirectVideoUrl`，替换组件内分散正则）

### 10. 音频播放

- [ ] **10.1** 抽取 AudioPlaybackService（从 `CornerPlayer` / `usePlayerStore` 迁出播放、暂停、进度、倍速状态）
- [ ] **10.2** 产品化 AudioMiniBar（复用现有 CornerPlayer 交互，补全局队列/封面/来源状态）
- [ ] **10.3** 统一倍速控制策略

### 11. 图片/媒体增强

- [ ] **11.1** 实现图片保存到本地（MediaSaveService 等价物）
- [ ] **11.2** 实现图片画廊翻页浏览（EntryImageGallery 等价物）

---

## P3 — 体验优化

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
- [ ] **14.2** 增强 FavoritesPanel（补独立面板、排序、筛选、批量取消收藏）
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
- [ ] **17.3** 将 Agent 工具接口定义抽到共享包（两端一致的工具签名）
- [ ] **17.4** 将视频 URL 解析逻辑（YouTube ID 提取、Invidious/Piped 实例列表）抽到 `packages/utils`

---

## P3+ — Desktop 特有能力整合

- [ ] **18.1** 命令面板集成 Agent 工具（输入自然语言触发工具调用）
- [ ] **18.2** 全局快捷键扩展（收藏/翻译/摘要快捷键）
- [ ] **18.3** 独立页面适配拖拽布局（FeedDetail/ArticleDetail 支持面板宽度调整）
- [ ] **18.4** 右键上下文菜单增强（新增页面/面板的专属菜单项）

---

## 统计

| 优先级   | 项数   | 说明                                   |
| -------- | ------ | -------------------------------------- |
| P0       | 9      | 核心功能缺口（文章详情/发现/设置完善） |
| P1       | 28     | AI 能力对齐                            |
| P2       | 11     | 媒体能力产品化                         |
| P3       | 19     | 体验优化与细节完善                     |
| P3+      | 4      | Desktop 特有能力整合                   |
| 复用     | 4      | 跨端代码重构                           |
| **合计** | **75** |                                        |
