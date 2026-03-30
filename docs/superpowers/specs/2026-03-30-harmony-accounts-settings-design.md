# Harmony 账号关联设置设计

## 背景

当前 Harmony 端设置页已经具备统一的二级面板结构，但“账户”入口仍是占位内容，没有承接 desktop 端已经存在的账号关联能力。desktop 端的账号关联功能包含四类 provider 的状态管理与操作：

- `YouTube`
- `X / Twitter`
- `Instagram`
- `Bilibili`

其中还包含两类扩展能力：

- 一键自检：批量检查各 provider 的关联状态
- Bilibili 关注导入：预览关注列表、选择导入对象、选择导入到“视频 / 社交媒体 / 文章”视图并显示导入进度

本次目标是在 Harmony 端新增一个与 desktop 端职责对齐的“账号关联”设置面板，同时保持 Harmony 当前的页面结构、页头、sheet 面板体验和数据流模式一致。

## 目标

本次设计的目标是：

1. 在 Harmony 设置页新增可进入的“账号关联”二级面板。
2. 该面板在视觉结构上对齐 Harmony 现有设置二级面板，在功能范围上覆盖 desktop 端账号关联页的主要能力。
3. 支持 `YouTube / X / Instagram / Bilibili` 四个 provider 的状态展示、关联、断开、刷新状态。
4. 支持“一键自检”。
5. 支持 Bilibili 关注列表预览、选择导入对象、选择导入视图、批量导入进度反馈。
6. 使用 Harmony 原生可维护的服务分层，而不是直接搬运 Electron 端实现。

## 非目标

本次不解决以下问题：

- 不在本轮实现 YouTube 内部稳定播放问题。
- 不要求 Harmony 与 desktop 共享同一套 cookie/session 宿主实现。
- 不重构现有所有设置面板，只在现有设置结构内增加“账号关联”能力。
- 不修改 desktop 端账号关联 UI。

## 方案对比

### 方案 A：只增加简单账户卡片

仅在 Harmony 设置中增加四个 provider 的状态卡和“关联 / 断开”按钮，不做一键自检与 Bilibili 导入。

优点：

- 改动最小
- 风险最低

缺点：

- 明显低于 desktop 能力
- 用户已经明确要求“全都做”

### 方案 B：完整搬运 desktop 逻辑

尽量按 desktop 端结构直接复制 provider 配置、一键自检和 Bilibili 导入逻辑。

优点：

- 功能对齐快

缺点：

- Electron 与 Harmony 宿主差异大
- 容易把桌面端假设带进 Harmony
- 后续维护成本高

### 方案 C：推荐方案，UI 能力全量对齐，服务按 Harmony 分层重建

在 Harmony 设置中新增完整的“账号关联”二级面板，UI 与功能范围对齐 desktop，但底层通过 Harmony 自己的服务层实现状态查询、登录会话、Bilibili 导入与自检。

优点：

- 用户可见能力最完整
- 与 Harmony 现有设置结构兼容
- 后续维护和扩展更清晰

缺点：

- 实现量明显大于简单设置项
- 需要新建几层服务与若干状态模型

结论：采用方案 C。

## 用户体验设计

### 入口位置

在 Harmony 设置主页中保留现有“账户”行，但点击后不再是占位逻辑，而是打开新的“账号关联”设置面板。

入口保持现有信息架构：

- 一级设置页中的“账户”
- 进入后展示独立的二级 sheet 面板

### 面板结构

账号关联面板沿用 Harmony 当前设置二级面板的结构：

1. 顶部 handle
2. 与其他二级面板一致的 `PageHeader`
3. 一键自检区域
4. provider 卡片列表
5. Bilibili 扩展导入区
6. 底部安全留白

### provider 卡片内容

每个 provider 卡片显示：

- provider 名称
- 简短说明
- 当前状态
- 当前展示名或错误信息
- 主操作按钮
- 次操作按钮

典型状态为：

- 未关联
- 检查中
- 已关联但未获取到展示名
- 已关联且拿到展示名
- 错误态

按钮行为：

- `关联`
- `断开`
- `刷新状态`

### 一键自检

面板顶部提供“一键自检”按钮，点击后并行检查四个 provider 的状态，并显示：

- 总体通过/未通过摘要
- 每个 provider 的结果行
- 失败原因或状态说明

### Bilibili 导入区

当 Bilibili 已关联时，面板显示扩展导入区，支持：

- 拉取关注列表
- 显示预览统计
- 选择需要导入的创作者
- 选择导入视图：
  - `视频`
  - `社交媒体`
  - `文章`
- 启动批量导入
- 显示导入进度和完成摘要

## 架构设计

### UI 组件

新增或扩展以下组件：

- `AccountsSettingsPanel.ets`
  - 账号关联二级面板主组件
- `AccountProviderCard.ets` 或在面板内部以 `@Builder` 方式实现
  - 单个 provider 卡片
- `BilibiliImportSection.ets` 或在面板内部实现
  - Bilibili 关注预览与导入区

现有入口改动：

- `SettingsContent.ets`
  - 让“账户”入口打开新面板
- `SettingsSecondaryPanels.ets`
  - 注册或导出账号关联面板

### 服务分层

#### 1. `AccountSessionService.ets`

职责：

- 查询 provider 当前状态
- 发起关联动作
- 发起断开动作
- 刷新 provider 状态
- 对外返回统一的 `AccountStatusResult`

建议统一返回结构：

- `provider`
- `linked`
- `displayName`
- `error`

#### 2. `AccountSelfCheckService.ets`

职责：

- 并行执行四个 provider 的状态检查
- 汇总结果
- 生成自检摘要与逐项结果

#### 3. `BilibiliFollowingsService.ets`

职责：

- 获取 Bilibili 关注列表
- 读取/写入本地缓存
- 计算可导入项、已存在项
- 批量导入 feed
- 回传导入进度

### 数据模型

建议新增以下模型：

- `AccountProvider`
- `AccountStatusResult`
- `AccountSelfCheckRow`
- `PendingBilibiliCreator`
- `BilibiliImportProgress`
- `BilibiliImportViewOption`

这些模型可以放在 Harmony 端现有模型文件中，或新增到设置/账户相关模型文件中，避免继续把设置相关类型堆进单一大文件。

## 平台实现策略

### 通用 provider 状态

Harmony 端与 desktop 不同，不应默认依赖 Electron `session` 能力。状态查询应通过 Harmony 可控方式实现，原则是：

- UI 层只认统一状态模型
- provider 细节下沉到 `AccountSessionService`

### provider 关联

provider 的关联能力应优先按以下方式实现：

- 若现有 Harmony 端已存在可复用的 provider 登录或会话能力，则直接接入
- 若不存在，则新增应用内 Web 登录流，并在服务层统一暴露结果

### Bilibili 导入

Bilibili 导入逻辑应尽量复用 Harmony 端现有 feed 创建与持久化能力，而不是绕开当前 `AppRepository` / `FeedRepository` 数据路径。

导入成功后需保证：

- 订阅列表立即刷新
- 首页分栏可见
- 发现/订阅页状态同步

## 错误处理

以下情况需要明确处理：

- provider 状态查询失败
- 关联动作中途取消
- provider 已关联但无法读取展示名
- Bilibili 关注列表为空
- Bilibili 获取关注列表失败
- 批量导入部分成功、部分失败
- 导入中断或重复导入

错误呈现原则：

- provider 卡片内显示局部错误
- 一键自检显示逐项失败原因
- 批量导入显示明确的 `已导入 / 跳过 / 失败` 数量

## 状态流

### 面板进入

1. 用户点击设置中的“账户”
2. 打开账号关联二级 sheet
3. 面板进入后加载 provider 状态
4. 若 Bilibili 已关联，允许拉取缓存中的关注列表摘要

### 一键自检

1. 用户点击“一键自检”
2. 并行调用四个 provider 状态查询
3. 更新摘要和逐项结果

### Bilibili 导入

1. 用户点击“预览关注列表”
2. 服务拉取或读取缓存
3. 返回待导入创作者列表和统计
4. 用户选择创作者和导入目标视图
5. 点击导入
6. 服务逐项创建 feed 并回报进度
7. 完成后刷新本地订阅列表与相关页面状态

## 测试与验证

最小验证集：

1. `pnpm --filter @livo/harmony run build:debug` 通过
2. 设置主页“账户”入口可打开账号关联面板
3. 一键自检可执行并展示结果
4. 四个 provider 卡片状态能渲染
5. Bilibili 预览、选择、导入流程能走通
6. 导入后的订阅源会立即出现在订阅列表中
7. provider 错误态和空态不会导致面板崩溃

## 实施步骤

1. 为 Harmony 设置页增加“账号关联”二级面板入口与面板壳。
2. 抽象 provider 状态模型与统一服务接口。
3. 接入四个 provider 的状态查询、关联、断开、刷新动作。
4. 实现一键自检聚合逻辑。
5. 实现 Bilibili 关注列表预览、选择与批量导入。
6. 补齐导入完成后的订阅刷新与 UI 同步。
7. 完成构建验证与手工回归。

## 风险与取舍

最大风险不在设置 UI，而在 provider 会话能力与 Bilibili 导入链路：

- provider 会话在 Harmony 上的实现方式与 desktop 不同，不能假设 cookie/会话能力完全等价
- Bilibili 导入不是单纯列表展示，它会影响订阅列表、本地数据库和首页分栏

因此本设计有意把 UI 层和服务层切开，避免把 provider 细节写死在设置组件里。
