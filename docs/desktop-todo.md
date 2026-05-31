# Desktop 端 TODO

> 基于 `docs/harmony-to-desktop.md` 分析，按优先级排列。

---

## P0 — 核心功能缺口

### 4. 设置系统完善

- [x] **4.5** 增强 AISettings 面板（参考 Harmony 的 AIAssistantSettingsPanel）

---

## P1 — AI 能力对齐

### 5. Agent 工具系统

> 已实现（main 进程，OpenAI 兼容 function calling）。核心契约抽到 `@livo/models`（见 17.3），实现位于 `apps/desktop/src/main/agent/`。

- [x] **5.0** 定义 Agent 工具接口与权限枚举（`packages/models/src/agent.ts`，两端工具签名一致）
- [x] **5.1** 实现 ToolRegistry（工具注册/查找/校验 + 模型工具定义）
- [x] **5.2** 实现 NavigationAgentTools（打开 Tab/文章/订阅/设置面板/视频/图片，经 `agent:navigate` 事件下发渲染进程）
- [x] **5.3** 实现 FeedAgentTools（列出/添加/删除/刷新/刷新全部/取文章）
- [x] **5.4** 实现 EntryAgentTools（今日更新、详情、未读统计、收藏、全部已读）
- [x] **5.5** 实现 SettingsAgentTools（查看设置、主题、强调色、通用、翻译、AI 运行配置；不读写 API Key）
- [x] **5.6** 实现 DiscoverAgentTools（浏览内置推荐源、添加推荐订阅）
- [x] **5.7** 实现 AccountAgentTools（状态、刷新、登录、解绑）
- [x] **5.8** 实现 DataAgentTools（查看刷新日志、导出 OPML、清空刷新日志、清理旧文章）
- [x] **5.9** 实现 ExternalAgentTools（DuckDuckGo 网络搜索，无需 API Key）

### 6. Agent 循环核心

- [x] **6.1** 实现 AgentLoop（多轮工具调用循环，MAX_AGENT_ROUNDS=5，原生 + 文本工具调用回退）
- [x] **6.2** 实现 AgentService（对外统一接口 run/resume/abort，挂起态托管 + TTL）
- [x] **6.3** 实现 AgentContextBuilder（订阅/今日更新/未读上下文，受 read 权限控制）
- [x] **6.4** 实现 PolicyGuard（五级权限控制 + prompt injection 防护提示 + 写入/删除/外链确认）
- [x] **6.5** 实现 AgentTraceStore（工具调用追踪记录，文件持久化，最多 50 条）
- [x] **6.6** 实现 Agent 错误恢复机制（LLM 调用指数退避重试，区分可重试/中止）
- [x] **6.7** 实现 Agent 性能监控（每轮 LLM/工具耗时统计，随结果返回 metrics）

### 7. AI 聊天面板增强

- [x] **7.1** 实现 Typewriter 流式输出效果（移植 Harmony `Typewriter`，`lib/typewriter.ts`，自适应 chunk + 追平模型）
- [x] **7.2** 实现 Tool Trace 面板（`AIChatTracePanel`，读 `agent.listTraces`/`clearTraces`，可展开查看每轮工具调用）
- [x] **7.3** 实现 Agent 确认对话框（`AIChatConfirmationCard`，写入/删除/外链操作经 `pendingId` + `agent.resume` 确认执行）
- [x] **7.4** 实现工具执行状态栏（`AIChatRunStatusBar`，实时工具状态 + 计时器，订阅 `agent:tool-event`）
- [x] **7.5** 实现会话历史持久化（`store/chat-history-store.ts` + `AIChatHistoryPanel`，localStorage，最多 50 条）
- [x] **7.6** 标准化多 Provider 协议（`services/provider-protocol.ts`，格式检测 + 错误归一，接入 ai/agent handlers，10 用例）
- [x] **7.7** 编写 Agent 循环单元测试（mock ToolRegistry，覆盖 registry/policy/harness，18 用例）

> 备注：聊天面板已从旧的裸 `chatStream` 切换到主进程 Agent 循环（`window.api.agent.run/resume/abort`），后端 main/preload 此前已就绪，本次补齐渲染端集成。导航工具下发的 `agent:navigate` 事件渲染端消费仍待接入（见 18.1）。

### 8. AI 辅助阅读

- [x] **8.1** 实现 ArticleAIAssistViewModel（`hooks/useArticleAIAssist.ts`，合并 summary/translation 状态机 + 组合 status + 语言标签 + 自动触发；ArticleDetailPage 已接入）
- [x] **8.2** 实现 SummaryFeatureCard（`components/settings/SummaryFeatureCard.tsx`，输出语言 + 自动摘要 + 开关；接入 TranslationSettings）
- [x] **8.3** 实现 TranslationFeatureCard（`components/settings/TranslationFeatureCard.tsx`，目标语言 + 自动翻译 + 开关；TranslationSettings 改为卡片化）
- [x] **8.4** 实现多轮 AI 调用重试策略（`services/ai-retry.ts`，指数退避 + 空结果重试 + 可重试错误判定 + 翻译多档降级；接入 summarize/translate handlers，8 用例）

> 备注：新增 `summary` 设置段（enabled/autoTrigger/language），打通 models + shared 归一化/合并。ArticleDetailPage 根据 summary.autoTrigger / translation.autoTranslate 在打开文章时自动执行（需已配置 API Key）。`useAISummary`/`useAITranslation` 保留为底层状态机供 EntryContent/WideViewContent 复用。

---

## P2 — 媒体能力增强

### 9. 视频播放

- [x] **9.1** 统一 YouTube 视频 URL 解析（抽到 `packages/utils/src/video-url.ts` 的 `extractYouTubeId`；renderer `extractYoutubeVideoId` 改为别名再导出，main `video-proxy` 复用，同时满足 17.4）
- [x] **9.2** 为 Invidious 多实例回退补测试与失败观测（`video-proxy` 重构为可注入 fetcher，`video-proxy.test.ts` 覆盖首实例成功/跳过失败实例/全失败）
- [x] **9.3** 为 Piped 回退补 HLS/combined stream 兼容测试（`selectPipedStream` 纯函数 + 回退链测试）
- [x] **9.4** 页面化 WebView/iframe 回退播放（`VideoPlayerPage` 已具备：直链/Bilibili webview/YouTube direct+iframe 回退）
- [x] **9.5** 统一视频直链检测（`isDirectVideoUrl` + `isEmbeddableVideoUrl` 抽到 `@livo/utils`，替换 VideoPlayerPage/ArticleDetailPage/MediaPlayer/ui-VideoPlayer/entry-video-source 内的散落正则）

> 备注：vitest 增加 `@livo/utils`/`@livo/models` → src 的别名，使纯函数与回退循环无需构建即可测试。共 11 个视频用例。

### 10. 音频播放

- [x] **10.1** 抽取 AudioPlaybackService（`lib/audio-playback.ts`，独立 detached audio element + 快照订阅 + 注入式 element 便于测试；播放状态跨视图保持。9 用例）
- [x] **10.2** 产品化 AudioMiniBar（`components/media/AudioMiniBar.tsx` + `store/player-store.ts`，补封面缩略图/来源/全局队列 prev-next/自动续播；`CornerPlayer` 改为其别名再导出）
- [x] **10.3** 统一倍速控制策略（`SPEED_OPTIONS` + `nextSpeed` 抽到 audio-playback，AudioMiniBar 复用）

> 备注：playback 状态（isPlaying/currentTime/duration/rate/muted）由 AudioPlaybackService 持有并镜像进 zustand store；metadata/队列由 store 持有。`usePlayerStore.play` 签名保持兼容（EntryContent 无需改动），新增 `playQueue/next/previous`。

### 11. 图片/媒体增强

- [x] **11.1** 实现图片保存到本地（MediaSaveService 等价物已就绪：`services/download.ts` 的 `downloadUrlToFile` + `IPC.APP_DOWNLOAD_URL` + preload `downloadUrl` + 右键菜单“保存图片/媒体”；本次补 ImageViewerPage 头部 + 画廊灯箱的保存按钮，对齐 Harmony ImageViewer）

---

## P3 — 体验优化

### 12. 主题系统完善

- [x] **12.1** 完善强调色系统（8 色 + 自定义 hex 现已有完整 UI：AppearanceSettings 新增取色器 swatch + `<input type=color>` + hex 文本框；自定义色自动派生 hover 亮调与 soft 透明底；Layout 焦点高亮改用 `--color-accent-rgb`，去除硬编码橙色）
- [x] **12.2** 实现完整 ThemePalette（`lib/theme-palette.ts` 移植 Harmony `ThemePalette` 全部 token：背景/表层/elevated/三级文本/divider/accentText/tabBarInactive/dragHandle 等；`paletteToCssVariables` 作为唯一来源，同时产出 Tailwind triplet token 与 Harmony 风格语义色 token，由 `appearance.ts` 在主题切换时整体下发；`tokens.css` 同步静态基线避免 FOUC，`tailwind.config` 补 elevated/divider/accent-text/tabbar-inactive）
- [x] **12.3** 实现页面/视图转场动画（`components/layout/PageTransition.tsx` 包裹 router `<Outlet/>`，按 `getTransitionKey` 路由分组播放 0.22s fade+slide 进场；home 家族路由共用稳定 key 不重挂 HomePage，详情/发现/订阅页各自分组触发动画；自动受 `.reduce-motion` 全局禁用约束）

> 备注：修复了一处 Harmony 迁移遗留缺陷——ArticleDetail/FeedDetail/Subscriptions/Discover 等新页面大量使用 `var(--color-bg-primary)`/`--color-text-primary`/`--color-border-secondary` 等 Harmony 风格语义 token，但这些变量此前**完全未定义**（页面背景/边框/主文本透明或继承）。现已在 `tokens.css` + `theme-palette.ts` 统一补齐为完整颜色值。仅 `--color-text-secondary`/`-tertiary` 与既有 Tailwind triplet 同名冲突，已通过 `-rgb` 后缀拆分解决（Tailwind 用 `*-rgb` triplet 支持 alpha，语义色用本名）。新增 14 个单测（theme-palette / page-transition / appearance accent），全套 182 用例通过。

### 13. 首页体验

- [x] **13.1** 实现 ContentModeRail（首页内容模式快速切换栏）
      → 已并入既有 Sidebar 的视图切换入口，不再单独挂顶部导航栏（曾尝试在 `Layout`
      顶部加 `ContentModeRail`，因与 Sidebar 重复，按需移除，避免双重切换入口）。
- [x] **13.2** 实现 HomeInlineSearch（首页内搜索覆盖层）
      → `components/entry/HomeInlineSearch.tsx`，对已加载条目做客户端过滤 +
      高亮的浮层下拉（标题/摘要/作者/来源），回车仍触发后端全量搜索；已接入 `EntryList` 头部。
- [x] **13.3** 实现 HomeSkeletonEntryCard（骨架屏加载状态）
      → 复核：`components/ui/Skeleton.tsx`（Article/Social/Grid + `SkeletonList`）已忠实
      镜像 `EntryCard`，并已接入 `EntryList` 与 `WideViewContent`，无需新增重复组件。

### 14. 数据管理

- [x] **14.1** 实现 RefreshLogStore（刷新历史记录存储）
- [x] **14.2** 增强 FavoritesPanel（补独立面板、排序、筛选、批量取消收藏）
- [x] **14.3** 实现 FeedRefreshCoordinator（刷新协调器，分批刷新 + 限流）

### 15. 订阅体验

- [x] **15.1** 实现 FeedDetailHeroAvatar（订阅源大图头部）
- [x] **15.2** 实现 SubscriptionsAvatarHydration（头像预加载）
- [x] **15.3** 实现 FeedSubscribeViewTypeRail（订阅时视图类型选择）
- [x] **15.4** 增强 OPML 导入（分批刷新 + 进度提示）

### 16. 其他细节

- [x] **16.1** 接入 AI 回复 Markdown 渲染（`AIChatMarkdown.tsx`，react-markdown + prose 样式 + 安全链接处理）
- [x] **16.2** 实现网络搜索服务（`services/web-search.ts`，DuckDuckGo HTML，无需 API Key，供 Agent web_search 工具调用）
- [x] **16.3** 实现 ExternalUrlService（`services/external-url.ts`，外链统一处理 + 协议验证 + 可疑检测 + 确认对话框）
- [x] **16.4** 实现连接测试服务（`services/connection-test.ts`，专用 probe + 空响应/429 重试 + Anthropic 检测）

---

## 跨端复用项（非新功能，降低后续维护成本）

- [x] **17.1** 将数据模型转换逻辑（toFeedCardModel / toEntryCardModel）抽到 `packages/models` ✅ `2026-05-31`
- [x] **17.2** 将 ViewModel 类型定义（EntryCardModel / FeedCardModel / ArticleDetailModel）抽到共享包 ✅ `2026-05-31`
- [x] **17.3** 将 Agent 工具接口定义抽到共享包（`packages/models/src/agent.ts`，两端一致的工具签名与运行时 wire 类型）
- [x] **17.4** 将视频 URL 解析逻辑（YouTube ID 提取、直链/可嵌入检测、Invidious/Piped 实例列表与流选择）抽到 `packages/utils/src/video-url.ts`（随 9.1/9.5 完成）

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
