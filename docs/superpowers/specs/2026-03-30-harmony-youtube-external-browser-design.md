# Harmony YouTube External Browser Design

## Goal

让 Harmony 端的 YouTube 账户关联不再依赖内嵌 ArkWeb，而是改为拉起系统浏览器登录，并在应用内通过“检查关联 + 手动保存账号名”完成闭环。

## Context

- 当前 Harmony 端 `Web` 组件在用户的运行环境中触发 ArkWeb Core 初始化失败，YouTube 登录页会导致应用闪退。
- desktop 端当前并未实现 OAuth 回调，而是通过登录会话与页面信息判断是否已关联，并允许用户手动补全账号名。
- Harmony 端目前只有 Bilibili 具备内嵌登录后的自动检测与持久化能力，YouTube 只有基础状态存储。

## Design

### YouTube 登录模式

- `youtube` 改为外部浏览器模式。
- `bilibili` 保持现有 `AccountLogin` 内嵌页面模式，不改动现有检测逻辑。
- 登录按钮点击后，Harmony 使用 `startAbility` 打开系统浏览器并跳转到 Google/YouTube 登录地址。

### 关联确认流程

- 外部浏览器登录完成后，用户返回应用。
- 设置页中的 YouTube 卡片提供“检查”按钮和“手动保存账号名”输入区。
- 由于当前版本不接 OAuth 回调，也无法可靠读取系统浏览器登录态，所以“检查”主要用于给出明确提示，不自动完成关联。
- 真正的关联完成动作由“手动保存账号名”触发，保存后 `linked=true`，`displayName` 为用户输入值。

### 状态与提示

- YouTube 在外部浏览器打开成功后，卡片显示引导提示：
  “已在浏览器打开登录页，完成登录后返回此处检查或手动保存账号名。”
- 当 YouTube 尚未保存账号名时，`accountStatus` 返回未关联状态，错误信息保持为空，避免误导为系统异常。
- 手动保存后沿用现有 `AccountSessionService.setDisplayName()` 持久化逻辑。

### 代码边界

- 新增独立的外部链接服务，封装 `startAbility(action.view)`，避免在组件内直接处理系统跳转。
- 登录模式策略继续由 `AccountLoginWebPolicy` 统一描述，新增是否使用外部浏览器字段。
- `AccountsSettingsPanel` 负责根据 provider 选择登录模式，并渲染 YouTube 专属的检查/输入 UI。

## Verification

- 单元测试覆盖登录策略中 YouTube 外部浏览器模式。
- 手动测试确认：
  - 点击 YouTube“关联”后打开系统浏览器，而不是进入 `AccountLogin` 页面。
  - 返回设置页后可看到检查与手动保存入口。
  - 保存账号名后状态更新为已关联。
