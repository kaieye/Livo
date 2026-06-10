# Desktop 应用集成 Supabase 指南

## 1. 安装依赖

在 `D:\project\Livo-project\Livo` 目录下运行：

```bash
pnpm add @supabase/supabase-js
```

## 2. 配置 Supabase

### 2.1 获取 Supabase Keys

1. 进入 Supabase Dashboard：https://supabase.com/dashboard/project/qyzfulidhowhyjenzjpz
2. 点击 **Settings** > **API**
3. 复制 **Project URL** 和 **anon public** key
4. 将它们填入 `src/shared/supabase-config.ts`

### 2.2 配置深链接回调

#### Windows

在 `config/electron-builder.config.mjs` 中添加：

```javascript
win: {
  // ... 现有配置
  protocols: [
    {
      name: 'Livo',
      schemes: ['livo'],
    },
  ]
}
```

#### macOS

在 `config/electron-builder.config.mjs` 中添加：

```javascript
mac: {
  // ... 现有配置
  protocols: [
    {
      name: 'Livo',
      schemes: ['livo'],
    },
  ]
}
```

### 2.3 处理深链接回调

在 `src/main/index.ts` 中添加（如果还没有）：

```typescript
import { app } from 'electron'
import { handleOAuthCallback } from './services/account/supabase-auth'

// 处理深链接
app.setAsDefaultProtocolClient('livo')

// macOS
app.on('open-url', async (event, url) => {
  event.preventDefault()
  if (url.startsWith('livo://auth/callback')) {
    const result = await handleOAuthCallback(url)
    if (result.success) {
      // 通知渲染进程登录成功
      mainWindow?.webContents.send('auth:success')
    } else {
      // 通知渲染进程登录失败
      mainWindow?.webContents.send('auth:error', result.error)
    }
  }
})

// Windows / Linux
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', async (event, commandLine) => {
    const url = commandLine.find((arg) => arg.startsWith('livo://'))
    if (url && url.startsWith('livo://auth/callback')) {
      const result = await handleOAuthCallback(url)
      if (result.success) {
        mainWindow?.webContents.send('auth:success')
      } else {
        mainWindow?.webContents.send('auth:error', result.error)
      }
    }
  })
}
```

## 3. 更新现有代码

### 3.1 修改 `account-auth.ts`

将 `src/main/services/account/account-auth.ts` 中的导入改为：

```typescript
// 旧代码
import {
  getGoogleOAuthAccountState,
  linkGoogleOAuthAccount,
  unlinkGoogleOAuthAccount,
} from './google-oauth'

// 新代码
import {
  getAccountState,
  linkGoogleOAuthAccount,
  linkWechatOAuthAccount,
  unlinkAccount,
} from './supabase-auth'
```

### 3.2 添加微信登录支持

在 `src/main/services/account/account-auth.ts` 的 `linkAccount` 函数中：

```typescript
export async function linkAccount(
  provider: AccountProvider,
): Promise<{ success: boolean; error?: string }> {
  if (provider === 'google') {
    return linkGoogleOAuthAccount()
  }

  // 新增：微信登录
  if (provider === 'wechat') {
    return linkWechatOAuthAccount()
  }

  // 其他 provider 保持原逻辑...
}
```

## 4. 测试

### 4.1 测试 Google 登录

1. 运行 Desktop 应用：`pnpm dev`
2. 点击 Google 登录
3. 浏览器会打开 Google 授权页面
4. 授权后会跳转到 `livo://auth/callback?...`
5. Desktop 应用接收回调，完成登录

### 4.2 测试微信登录

1. 点击微信登录
2. 浏览器会打开微信二维码页面
3. 用微信扫码授权
4. 跳转回 Desktop 应用

## 5. 微信登录部署说明

当前主线方案不再依赖独立的微信 OAuth 中转项目。

微信登录应直接由当前实际接入的应用或后端内置实现处理；只有在受限回调环境下，才考虑保留单独中转层作为历史兼容方案。

## 6. 常见问题

### Q: Deep Link 不工作？

A: 确保 `app.setAsDefaultProtocolClient('livo')` 在 `app.whenReady()` 之前调用。

### Q: 微信登录失败？

A: 检查：

1. 当前应用内置的微信 OAuth 流程是否配置完整
2. 微信开放平台回调域名是否配置正确
3. OAuth Callback URL 是否指向当前实际使用的后端或应用入口

### Q: Session 没有持久化？

A: Supabase 会自动持久化到 localStorage（Web）或文件（Desktop），确保 `persistSession: true`。

## 7. 下一步

- [ ] 实现登录界面 UI
- [ ] 添加登录状态管理（Zustand）
- [ ] 实现用户信息显示
- [ ] 对接后台管理功能
