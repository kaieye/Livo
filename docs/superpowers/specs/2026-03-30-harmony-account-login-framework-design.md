# Harmony Account Login Framework Design

## Background

Harmony 端当前的账户登录页已经对 Bilibili 做了较多特化逻辑，但 YouTube 仍然只是打开官网首页，且 Google 登录链路在应用内 WebView 中存在闪退风险。继续把各平台行为堆在 `AccountLogin.ets` 中，会让页面承担过多 provider-specific 责任，后续接入更多平台时维护成本会快速升高。

这次设计的目标是把账户登录页改成一个可扩展的统一框架，让 Bilibili、YouTube 等 provider 的登录检测、持久化和异常处理解耦，同时保留应用内 WebView 登录体验。

## Goals

- 把 `AccountLogin.ets` 收敛为通用页面壳层。
- 为不同账号 provider 引入独立登录处理器。
- 将 YouTube 登录入口改为直达 Google/YouTube 登录链，而不是 YouTube 官网首页。
- 避免登录流程中的未处理异常导致应用退回桌面。
- 保持现有 Bilibili 登录体验与设置页状态展示链路可用。

## Non-Goals

- 这次不接入 OAuth SDK 或系统浏览器方案。
- 这次不实现完整的 Google/YouTube 凭证解析，只先把登录页框架与状态检测能力建好。
- 这次不重构账户设置页整体 UI 以外的更多页面结构。

## Proposed Architecture

### 1. Login URL Provider Layer

`AccountSessionService.loginUrl(provider)` 继续保留为统一入口，但职责仅限“返回该 provider 的登录起始 URL”。

- `youtube` 返回直接进入 Google/YouTube 登录链的 URL。
- `bilibili` 保持当前登录页地址。
- 其他 provider 继续返回各自起始地址。

这样页面壳层不需要知道各平台入口规则。

### 2. Provider Login Handler Layer

新增一组 provider-specific handler，建议放在 `apps/harmony/entry/src/main/ets/common/services/account-login/` 下：

- `AccountLoginHandler`：统一接口定义。
- `BilibiliLoginHandler`：承接当前 Bilibili 的 cookie、登录检测、状态持久化逻辑。
- `YouTubeLoginHandler`：处理 Google/YouTube 登录链、跳转识别、成功判定与异常保护。
- `AccountLoginHandlerFactory`：根据 `provider` 返回对应 handler。

建议统一接口包含以下能力：

- `aboutToAppear()`
- `aboutToDisappear()`
- `onPageBegin()`
- `onPageEnd()`
- `onErrorReceive()`
- `resolveLoginUrl()` 可选
- `buildPersistResult()` 或 `tryHandleLoginSuccess()` 用于写回账号状态

核心原则是页面把 WebView 事件转发给 handler，具体如何判断“登录成功”完全由 handler 自己决定。

### 3. Generic Page Shell Layer

`AccountLogin.ets` 只保留：

- 路由参数读取
- WebView 初始化
- loading / error UI
- 把生命周期和页面事件转发给 handler

页面不再内嵌 Bilibili 或 YouTube 的具体检测细节。这样后续新增 provider 时，只需要新增 handler，不必继续修改页面壳层核心流程。

## YouTube Login Design

### Entry

YouTube 登录入口改为 Google/YouTube 登录链，而不是 `https://m.youtube.com/`。目标是让用户点击“关联”后直接进入登录页。

### Detection

`YouTubeLoginHandler` 重点识别以下域名和跳转状态：

- `accounts.google.com`
- `accounts.youtube.com`
- `www.youtube.com`
- `m.youtube.com`

处理器会在 `onPageEnd()` 和必要的轮询点上判断：

- 当前是否仍在 Google 登录链中
- 是否已经回到已登录的 YouTube 页面
- 是否出现关键 cookie / 页面标记 / 用户信息线索

### Failure Protection

Google 登录链中的跳转、新窗口、外链、WebView 内异常都不能直接冒泡成未处理异常。处理器应：

- 将异常转成可见的错误状态
- 写入统一日志前缀
- 保证页面仍停留在应用内，而不是闪退

### Persistence

若识别到 YouTube 已登录，handler 需要通过已有账户状态存储接口写回：

- `linked`
- `displayName`

这样设置页无需知道 YouTube 的具体登录细节，只消费统一的 `AccountStatusResult`。

## Bilibili Migration Plan

当前 `AccountLogin.ets` 中已有的 Bilibili 特化逻辑，不直接删除，而是迁移到 `BilibiliLoginHandler` 中，保持以下行为不变：

- 初始 `SESSDATA` 读取
- cookie 轮询
- nav 接口校验
- 登录成功后写回 `accountLinkResult*`

迁移完成后，`AccountLogin.ets` 不再直接包含 Bilibili 登录实现细节。

## Error Handling

统一错误处理约束：

- handler 内部异常必须被捕获并转为页面状态或账户卡片状态。
- 路由失败继续沿用当前设置页卡片错误态展示。
- 关键日志统一带上 provider 和阶段，便于从日志判断失败位置。

推荐日志格式：

- `AccountLoginShell ...`
- `YouTubeLoginHandler ...`
- `BilibiliLoginHandler ...`

## Testing Strategy

先补最小回归测试，再做实现。

建议测试覆盖：

1. handler factory 能正确返回 provider 对应 handler
2. YouTube 登录 URL 不再是 `m.youtube.com`
3. YouTube 登录链域名识别逻辑可测
4. Bilibili 登录逻辑迁移后行为保持一致
5. 登录页路由 / WebView 异常不会形成未处理崩溃

由于 Harmony 端当前没有完整 UI 自动化框架，这次优先抽取可单测的纯函数与状态判定工具，继续沿用现有 Node `--experimental-strip-types --test` 的测试方式。

## Implementation Steps

1. 抽出 `AccountLoginHandler` 接口与 factory。
2. 迁移 Bilibili 登录逻辑到 `BilibiliLoginHandler`。
3. 新建 `YouTubeLoginHandler`，实现登录入口、跳转检测和异常保护。
4. 收敛 `AccountLogin.ets` 为壳层。
5. 补回归测试并做 Harmony debug 构建验证。

## Risks

- ArkWeb 对 Google 登录链的支持可能仍有限，部分行为需要继续迭代兼容。
- 若 Google 登录依赖 WebView 未暴露的新窗口能力，应用内方案仍可能受平台限制。
- 这次先搭好框架，若后续发现平台级限制无法绕过，再评估系统浏览器回退方案。

## Decision

采用“统一登录框架 + provider handler”的方案实现 Harmony 端账户登录页重构，并优先纳入 YouTube 与 Bilibili 两个平台。
