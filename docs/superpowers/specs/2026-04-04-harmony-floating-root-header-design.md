# Harmony Floating Root Header Design

**Goal**

把 Harmony 四个一级页面统一成“悬浮页头 + 底下真实滚动内容”的结构：页头只承载标题与按钮，内容容器铺满页面顶部，向上滚动时从页头后方经过。

**Current State**

- 首页 [Index.ets](e:/Livo/apps/harmony/entry/src/main/ets/pages/Index.ets) 使用 `Column + PageHeader + Refresh/Scroll` 结构，页头在内容流之外，形成独立顶部区域。
- 发现页 [DiscoverContent.ets](e:/Livo/apps/harmony/entry/src/main/ets/common/components/DiscoverContent.ets) 将 `PageHeader` 和搜索面板一起放在滚动区上方，滚动内容只能从页头下方开始。
- 订阅页 [SubscriptionsContent.ets](e:/Livo/apps/harmony/entry/src/main/ets/common/components/SubscriptionsContent.ets) 同样把 `PageHeader` 固定在顶部，滚动内容在下面单独起始。
- 设置页 [SettingsContent.ets](e:/Livo/apps/harmony/entry/src/main/ets/common/components/SettingsContent.ets) 甚至把 `PageHeader` 作为 `ListItem` 放在列表里，视觉上仍然是一整块顶部区域。

**Chosen Approach**

采用统一页面壳方案：

- 新增一个一级页公共布局组件，负责渲染顶部悬浮 `PageHeader`。
- 新增一个顶部透明占位组件，放进各页真实滚动内容的最前面，用来给标题可读区留出空间。
- 四个一级页都改成“底层全屏滚动内容 + 顶层悬浮页头”的 `Stack` 层级，不改各自业务数据流、路由和底部 tab 避让逻辑。

不采用单独改 `PageHeader` 的方案，因为这次需求本质上是页面层级调整，不是页头组件本身的样式重绘。

**Behavior**

- 四个一级页都保留当前大标题风格。
- 页头只显示标题和原有按钮，不再占据一整块实心头部容器。
- 内容容器从页面顶部开始铺满，首屏通过透明占位与页头错开。
- 用户向上滚动时，列表、卡片、搜索区域或设置分组会从页头后方经过。
- 首页继续保留搜索按钮、下拉刷新、横向 mode 切换。
- 发现页继续保留搜索面板和发现结果，只调整其与页头的层级关系。
- 订阅页继续保留 mode rail、订阅源统计和横向切换。
- 设置页继续保留现有列表与底部 sheet。

**Implementation Notes**

- 新组件建议放在 `entry/src/main/ets/common/components/FloatingRootPageLayout.ets`。
- 新增一个透明占位组件或 builder，统一计算 `topAvoidArea + PAGE_TOP_PADDING + 页头高度 + 间距`。
- 首页把现有 `PageHeader` 从 `Column` 顶部区抽到悬浮层，`Refresh` 内容内部最前面插入透明占位。
- 发现页把“页头 + 搜索框”拆开：页头悬浮，搜索框进入真实滚动内容顶部。
- 订阅页把页头悬浮，mode scene 继续保留全屏滚动；每个 scene 的滚动内容顶部增加透明占位。
- 设置页不再把 `PageHeader` 放进 `ListItem`，而是把列表首项改成透明占位。

**Testing**

- 新增源码级回归测试，约束：
  - 公共悬浮页面壳存在并封装 `PageHeader`。
  - 首页、发现页、订阅页、设置页都接入这个公共壳。
  - 设置页不再把 `PageHeader` 当作 `ListItem` 内容直接渲染。
- 运行受影响的现有 Harmony Node 回归测试，覆盖首页、发现页、订阅页、设置页相关结构。
- 运行 `pnpm build:harmony:debug` 验证 ArkTS 编译通过。

**Risks**

- 发现页的搜索面板从固定顶区移入真实滚动内容后，顶部间距如果算错，会出现标题压住输入框或首屏空白过大。
- 首页与订阅页的横向滑动手势仍要保持在 scene 容器上，不能被新的页面壳吞掉。
- 设置页改成真正悬浮头后，底部 sheet 的 overlay 状态不能受影响。
