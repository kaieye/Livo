# Harmony Scrollable Mode Rail Design

**Goal**

让 Harmony 首页和订阅页的分段切换栏像普通内容一样随正文上下滚动，并在向上滑动时完全离开屏幕。

**Current State**

- 首页的 `ContentModeRail` 位于 [Index.ets](e:/Livo/apps/harmony/entry/src/main/ets/pages/Index.ets) 顶部固定区，位于 `Refresh` 容器之外。
- 订阅页的 `ContentModeRail` 位于 [SubscriptionsContent.ets](e:/Livo/apps/harmony/entry/src/main/ets/common/components/SubscriptionsContent.ets) 顶部固定区，位于各个 mode 的滚动内容之外。
- 因为 rail 不属于 scroll content，所以正文滚动时 rail 会固定停留在顶部。

**Chosen Approach**

采用最小改动方案：

- 保留首页和订阅页的 `PageHeader` 为固定头部。
- 将 `ContentModeRail` 移入各自的滚动内容区域，使其成为正文的一部分。
- 订阅页中与 rail 紧邻的数量/提示信息也一并放入滚动内容，避免 rail 滚走后信息仍悬停在顶部。

不采用“吸顶”或“假滚动联动”方案，避免引入额外状态同步和手势耦合。

**Behavior**

- 首页：
  - `PageHeader` 固定。
  - `ContentModeRail` 出现在正文顶部，位于推荐内容前面。
  - 下拉刷新仍然保留在首页内容区。
- 订阅页：
  - `PageHeader` 固定。
  - `ContentModeRail` 与订阅数量提示一起出现在正文顶部。
  - 各 mode 内容继续保持现有纵向滚动和横向切换能力。

**Implementation Notes**

- 首页需要把 rail 放进 `Refresh` 的内容树顶部。
- 订阅页需要把 rail 和统计信息移入 `FeedSection(mode)` 或其等价的每个 mode 的滚动内容入口。
- 现有横向 `PanGesture` 保持在 scene 内容容器上，不改交互语义。
- 不新增全局状态，不改主题链路，不重构 `ContentModeRail` 组件本身。

**Testing**

- 增加两个源码级回归测试：
  - 约束首页 `ContentModeRail` 位于 `Refresh` 内容区域内。
  - 约束订阅页 `ContentModeRail` 位于滚动内容区域内，并且顶部统计信息随其一起滚动。
- 继续运行现有 Harmony 回归测试与 `pnpm build:debug`。

**Risks**

- 首页 `Refresh` 与 rail 的层级调整后，可能影响顶部留白和下拉手势起始位置。
- 订阅页如果只移动 rail、不移动统计信息，会造成顶部视觉断裂；因此两者需要一起迁移。
