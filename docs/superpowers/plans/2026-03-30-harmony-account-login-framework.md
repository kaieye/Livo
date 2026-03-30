# Harmony Account Login Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Harmony 账户登录页重构成统一的 provider handler 框架，并修复 YouTube 关联入口与 Google 登录链在应用内 WebView 中的稳定性问题。

**Architecture:** `AccountSessionService` 继续只负责 provider 登录入口与账户状态存储，`AccountLogin.ets` 收敛为通用页面壳层，所有 provider-specific 登录检测和持久化下沉到 `account-login` 目录下的 handler。Bilibili 现有逻辑整体迁移到独立 handler，YouTube 新增独立 handler 和可单测的域名/URL 检测工具，避免继续把平台逻辑堆在页面里。

**Tech Stack:** ArkTS, ArkUI, HarmonyOS NEXT ArkWeb, Preferences, AppStorage, Node `--experimental-strip-types --test`, `pnpm --filter @livo/harmony run build:debug`

---

## File Map

- Create: `apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandler.ets`
- Create: `apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandlerFactory.ets`
- Create: `apps/harmony/entry/src/main/ets/common/services/account-login/BilibiliLoginHandler.ets`
- Create: `apps/harmony/entry/src/main/ets/common/services/account-login/YouTubeLoginHandler.ets`
- Create: `apps/harmony/entry/src/main/ets/common/utils/YouTubeLoginUrl.ts`
- Create: `apps/harmony/entry/src/main/ets/common/utils/YouTubeLoginDetection.ts`
- Create: `apps/harmony/tests/account-login-handler-factory.test.ts`
- Create: `apps/harmony/tests/youtube-login-url.test.ts`
- Create: `apps/harmony/tests/youtube-login-detection.test.ts`
- Modify: `apps/harmony/entry/src/main/ets/common/services/AccountSessionService.ets`
- Modify: `apps/harmony/entry/src/main/ets/pages/AccountLogin.ets`
- Verify: `node --experimental-strip-types --test apps/harmony/tests/account-login-handler-factory.test.ts apps/harmony/tests/youtube-login-url.test.ts apps/harmony/tests/youtube-login-detection.test.ts apps/harmony/tests/bilibili-login-detection.test.ts apps/harmony/tests/bilibili-account-status.test.ts apps/harmony/tests/account-link-result.test.ts apps/harmony/tests/account-navigation-error.test.ts`
- Verify: `pnpm --filter @livo/harmony run build:debug`

### Task 1: Add YouTube Login URL And Detection Utilities

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/utils/YouTubeLoginUrl.ts`
- Create: `apps/harmony/entry/src/main/ets/common/utils/YouTubeLoginDetection.ts`
- Create: `apps/harmony/tests/youtube-login-url.test.ts`
- Create: `apps/harmony/tests/youtube-login-detection.test.ts`
- Modify: `apps/harmony/entry/src/main/ets/common/services/AccountSessionService.ets`

- [ ] **Step 1: Write the failing URL test**

Create `apps/harmony/tests/youtube-login-url.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveYouTubeLoginUrl } from '../entry/src/main/ets/common/utils/YouTubeLoginUrl'

test('resolveYouTubeLoginUrl uses direct Google sign-in entry instead of mobile home page', () => {
  const url = resolveYouTubeLoginUrl()

  assert.equal(url.startsWith('https://accounts.google.com/'), true)
  assert.equal(url.includes('service=youtube'), true)
  assert.equal(url.includes('continue='), true)
  assert.equal(url.includes('https%3A%2F%2Fm.youtube.com%2F'), true)
  assert.equal(url.includes('https://m.youtube.com/'), false)
})
```

- [ ] **Step 2: Write the failing detection test**

Create `apps/harmony/tests/youtube-login-detection.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { detectYouTubeLoginState } from '../entry/src/main/ets/common/utils/YouTubeLoginDetection'

test('detectYouTubeLoginState keeps Google sign-in pages in-progress', () => {
  const result = detectYouTubeLoginState({
    currentUrl:
      'https://accounts.google.com/v3/signin/identifier?service=youtube',
    title: 'Sign in - Google Accounts',
    documentCookies: '',
    pageHtml: '<html><body>Google sign in</body></html>',
  })

  assert.equal(result.inLoginFlow, true)
  assert.equal(result.loggedIn, false)
  assert.equal(result.displayName, '')
})

test('detectYouTubeLoginState recognizes logged-in YouTube page with account menu markers', () => {
  const result = detectYouTubeLoginState({
    currentUrl: 'https://m.youtube.com/',
    title: 'YouTube',
    documentCookies: 'SAPISID=abc; SID=def',
    pageHtml: JSON.stringify({
      topbar: {
        desktopTopbarRenderer: { avatar: { thumbnails: [{ url: 'x' }] } },
      },
      accountName: 'Ch0s1nz',
    }),
  })

  assert.equal(result.inLoginFlow, false)
  assert.equal(result.loggedIn, true)
  assert.equal(result.displayName, 'Ch0s1nz')
  assert.equal(result.hasSessionCookie, true)
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:

```bash
node --experimental-strip-types --test apps/harmony/tests/youtube-login-url.test.ts apps/harmony/tests/youtube-login-detection.test.ts
```

Expected: FAIL with module-not-found errors for `YouTubeLoginUrl` and `YouTubeLoginDetection`.

- [ ] **Step 4: Write the minimal URL utility**

Create `apps/harmony/entry/src/main/ets/common/utils/YouTubeLoginUrl.ts`:

```ts
const YOUTUBE_CONTINUE_URL = 'https://m.youtube.com/'

export function resolveYouTubeLoginUrl(): string {
  return (
    'https://accounts.google.com/ServiceLogin' +
    '?service=youtube' +
    '&uilel=3' +
    '&passive=true' +
    '&continue=' +
    encodeURIComponent(YOUTUBE_CONTINUE_URL)
  )
}
```

- [ ] **Step 5: Write the minimal detection utility**

Create `apps/harmony/entry/src/main/ets/common/utils/YouTubeLoginDetection.ts`:

```ts
export interface YouTubeLoginDetectionInput {
  currentUrl: string
  title: string
  documentCookies: string
  pageHtml: string
}

export interface YouTubeLoginDetectionResult {
  inLoginFlow: boolean
  loggedIn: boolean
  hasSessionCookie: boolean
  displayName: string
}

function includesHost(url: string, needle: string): boolean {
  return url.toLowerCase().includes(needle)
}

function extractDisplayName(source: string): string {
  const matched =
    source.match(/"accountName"\s*:\s*"([^"]+)"/) ||
    source.match(/"name"\s*:\s*"([^"]+)"/)
  return matched?.[1]?.trim() || ''
}

export function detectYouTubeLoginState(
  input: YouTubeLoginDetectionInput,
): YouTubeLoginDetectionResult {
  const html = input.pageHtml || ''
  const currentUrl = (input.currentUrl || '').trim()
  const title = (input.title || '').trim()
  const cookies = (input.documentCookies || '').trim()
  const hasSessionCookie = /(?:^|;\s*)(?:SAPISID|SID|SSID|HSID)=/i.test(cookies)
  const displayName = extractDisplayName(html)
  const inLoginFlow =
    includesHost(currentUrl, 'accounts.google.com') ||
    includesHost(currentUrl, 'accounts.youtube.com') ||
    /sign in/i.test(title)
  const loggedIn =
    !inLoginFlow &&
    (hasSessionCookie ||
      !!displayName ||
      /avatar/i.test(html) ||
      /"loggedIn"\s*:\s*true/i.test(html))

  return {
    inLoginFlow,
    loggedIn,
    hasSessionCookie,
    displayName,
  }
}
```

- [ ] **Step 6: Point `AccountSessionService.loginUrl('youtube')` to the new utility**

Update `apps/harmony/entry/src/main/ets/common/services/AccountSessionService.ets`:

```ts
import { resolveYouTubeLoginUrl } from '../utils/YouTubeLoginUrl'

static loginUrl(provider: AccountProvider): string {
  switch (provider) {
    case 'youtube':
      return resolveYouTubeLoginUrl()
    // keep the existing providers unchanged
  }
}
```

- [ ] **Step 7: Run the focused tests to verify they pass**

Run:

```bash
node --experimental-strip-types --test apps/harmony/tests/youtube-login-url.test.ts apps/harmony/tests/youtube-login-detection.test.ts
```

Expected: PASS for both tests.

- [ ] **Step 8: Commit the utility layer**

```bash
git add apps/harmony/entry/src/main/ets/common/utils/YouTubeLoginUrl.ts apps/harmony/entry/src/main/ets/common/utils/YouTubeLoginDetection.ts apps/harmony/tests/youtube-login-url.test.ts apps/harmony/tests/youtube-login-detection.test.ts apps/harmony/entry/src/main/ets/common/services/AccountSessionService.ets
git commit -m "feat(harmony): add youtube login utilities"
```

### Task 2: Introduce The Shared Login Handler Contract And Factory

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandler.ets`
- Create: `apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandlerFactory.ets`
- Create: `apps/harmony/tests/account-login-handler-factory.test.ts`

- [ ] **Step 1: Write the failing factory test**

Create `apps/harmony/tests/account-login-handler-factory.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccountLoginHandler } from '../entry/src/main/ets/common/services/account-login/AccountLoginHandlerFactory'

test('createAccountLoginHandler returns provider-specific handler ids', () => {
  assert.equal(createAccountLoginHandler('bilibili').provider, 'bilibili')
  assert.equal(createAccountLoginHandler('youtube').provider, 'youtube')
  assert.equal(createAccountLoginHandler('x').provider, 'x')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --experimental-strip-types --test apps/harmony/tests/account-login-handler-factory.test.ts
```

Expected: FAIL with module-not-found for `AccountLoginHandlerFactory`.

- [ ] **Step 3: Add the shared handler interface**

Create `apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandler.ets`:

```ts
import webview from '@ohos.web.webview'
import { AccountProvider } from '../../models/LivoModels'

export interface AccountLoginShellState {
  setLoading(value: boolean): void
  setLoadError(value: string): void
  completeAndClose(displayName: string): void
}

export interface AccountLoginHandler {
  readonly provider: AccountProvider
  aboutToAppear(
    controller: webview.WebviewController,
    shell: AccountLoginShellState,
  ): void
  aboutToDisappear(): void
  onPageBegin(url: string): void
  onPageEnd(url: string): void
  onErrorReceive(error: string, isMainFrame: boolean): void
}
```

- [ ] **Step 4: Add the factory with a temporary fallback handler**

Create `apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandlerFactory.ets`:

```ts
import webview from '@ohos.web.webview'
import { AccountProvider } from '../../models/LivoModels'
import {
  AccountLoginHandler,
  AccountLoginShellState,
} from './AccountLoginHandler'

class PassiveAccountLoginHandler implements AccountLoginHandler {
  readonly provider: AccountProvider

  constructor(provider: AccountProvider) {
    this.provider = provider
  }

  aboutToAppear(
    _controller: webview.WebviewController,
    _shell: AccountLoginShellState,
  ): void {}
  aboutToDisappear(): void {}
  onPageBegin(_url: string): void {}
  onPageEnd(_url: string): void {}
  onErrorReceive(_error: string, _isMainFrame: boolean): void {}
}

export function createAccountLoginHandler(
  provider: AccountProvider,
): AccountLoginHandler {
  return new PassiveAccountLoginHandler(provider)
}
```

- [ ] **Step 5: Run the factory test to verify it passes**

Run:

```bash
node --experimental-strip-types --test apps/harmony/tests/account-login-handler-factory.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit the contract and factory**

```bash
git add apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandler.ets apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandlerFactory.ets apps/harmony/tests/account-login-handler-factory.test.ts
git commit -m "feat(harmony): add account login handler contract"
```

### Task 3: Migrate Bilibili Logic Into A Dedicated Handler

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/services/account-login/BilibiliLoginHandler.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandlerFactory.ets`
- Modify: `apps/harmony/entry/src/main/ets/pages/AccountLogin.ets`
- Verify: `apps/harmony/tests/bilibili-login-detection.test.ts`
- Verify: `apps/harmony/tests/bilibili-account-status.test.ts`

- [ ] **Step 1: Add the failing integration compile step**

Run:

```bash
pnpm --filter @livo/harmony run build:debug
```

Expected: PASS before refactor, serving as the baseline that must still pass after the migration.

- [ ] **Step 2: Copy the current Bilibili state machine into a handler class**

Create `apps/harmony/entry/src/main/ets/common/services/account-login/BilibiliLoginHandler.ets` and move the existing Bilibili-specific members from `AccountLogin.ets` into a class:

```ts
import webview from '@ohos.web.webview'
import { AppRepository } from '../../data/AppRepository'
import { goBack } from '../../navigation/AppRouter'
import { detectBilibiliLogin } from '../../utils/BilibiliLoginDetection'
import {
  AccountLoginHandler,
  AccountLoginShellState,
} from './AccountLoginHandler'

const SETTINGS_ACTIVE_SHEET_KEY = 'settingsActiveSheetKey'

export class BilibiliLoginHandler implements AccountLoginHandler {
  readonly provider = 'bilibili' as const
  private controller?: webview.WebviewController
  private shell?: AccountLoginShellState
  private handledSuccess: boolean = false
  private handlingSuccess: boolean = false
  private cookiePollId: number = -1

  aboutToAppear(
    controller: webview.WebviewController,
    shell: AccountLoginShellState,
  ): void {
    this.controller = controller
    this.shell = shell
    this.startCookiePolling()
  }

  aboutToDisappear(): void {
    this.stopCookiePolling()
    void webview.WebCookieManager.saveCookieAsync()
    if (!this.handledSuccess) {
      void this.persistIfAvailable(false)
    }
  }

  onPageBegin(_url: string): void {}

  onPageEnd(_url: string): void {
    void this.persistIfAvailable(true)
  }

  onErrorReceive(_error: string, _isMainFrame: boolean): void {}

  private startCookiePolling(): void {
    this.stopCookiePolling()
    this.cookiePollId = setInterval(() => {
      void this.persistIfAvailable(true)
    }, 1200)
  }

  private stopCookiePolling(): void {
    if (this.cookiePollId >= 0) {
      clearInterval(this.cookiePollId)
      this.cookiePollId = -1
    }
  }

  private async persistIfAvailable(shouldAutoBack: boolean): Promise<void> {
    // Move the current AccountLogin.ets Bilibili detection/persist logic here unchanged.
    // Keep the same AppStorage keys and logging prefixes, but rename the prefix to BilibiliLoginHandler.
    if (shouldAutoBack && this.handledSuccess) {
      setTimeout(() => {
        void goBack()
      }, 120)
    }
  }
}
```

- [ ] **Step 3: Register the Bilibili handler in the factory**

Update `apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandlerFactory.ets`:

```ts
import { BilibiliLoginHandler } from './BilibiliLoginHandler'

export function createAccountLoginHandler(
  provider: AccountProvider,
): AccountLoginHandler {
  switch (provider) {
    case 'bilibili':
      return new BilibiliLoginHandler()
    default:
      return new PassiveAccountLoginHandler(provider)
  }
}
```

- [ ] **Step 4: Strip Bilibili-specific state out of the page shell**

Update `apps/harmony/entry/src/main/ets/pages/AccountLogin.ets`:

```ts
import { createAccountLoginHandler } from '../common/services/account-login/AccountLoginHandlerFactory'

@State loading: boolean = true
@State loadError: string = ''
private handler = createAccountLoginHandler('youtube')

aboutToAppear(): void {
  // keep route param parsing and UA setup
  this.handler = createAccountLoginHandler(this.provider)
  this.handler.aboutToAppear(this.webController, {
    setLoading: (value: boolean) => { this.loading = value },
    setLoadError: (value: string) => { this.loadError = value },
    completeAndClose: (_displayName: string) => {},
  })
}

aboutToDisappear(): void {
  this.handler.aboutToDisappear()
}
```

Also replace the existing Bilibili branches in `.onPageBegin`, `.onPageEnd`, and `.onErrorReceive` with direct handler forwarding.

- [ ] **Step 5: Run the existing Bilibili tests**

Run:

```bash
node --experimental-strip-types --test apps/harmony/tests/bilibili-login-detection.test.ts apps/harmony/tests/bilibili-account-status.test.ts
```

Expected: PASS, proving the extracted helper-based behavior stayed compatible.

- [ ] **Step 6: Run the Harmony build after the migration**

Run:

```bash
pnpm --filter @livo/harmony run build:debug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 7: Commit the Bilibili handler migration**

```bash
git add apps/harmony/entry/src/main/ets/common/services/account-login/BilibiliLoginHandler.ets apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandlerFactory.ets apps/harmony/entry/src/main/ets/pages/AccountLogin.ets
git commit -m "refactor(harmony): move bilibili login flow into handler"
```

### Task 4: Add The YouTube Handler With In-App Google Login Protection

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/services/account-login/YouTubeLoginHandler.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandlerFactory.ets`
- Modify: `apps/harmony/entry/src/main/ets/pages/AccountLogin.ets`
- Verify: `apps/harmony/tests/youtube-login-detection.test.ts`

- [ ] **Step 1: Extend the detection test with an error-path assertion**

Append to `apps/harmony/tests/youtube-login-detection.test.ts`:

```ts
test('detectYouTubeLoginState stays logged-out on generic YouTube home without session evidence', () => {
  const result = detectYouTubeLoginState({
    currentUrl: 'https://m.youtube.com/',
    title: 'YouTube',
    documentCookies: '',
    pageHtml: '<html><body>browse</body></html>',
  })

  assert.equal(result.inLoginFlow, false)
  assert.equal(result.loggedIn, false)
  assert.equal(result.hasSessionCookie, false)
})
```

- [ ] **Step 2: Run the focused test to verify the baseline still passes**

Run:

```bash
node --experimental-strip-types --test apps/harmony/tests/youtube-login-detection.test.ts
```

Expected: PASS

- [ ] **Step 3: Create the YouTube handler**

Create `apps/harmony/entry/src/main/ets/common/services/account-login/YouTubeLoginHandler.ets`:

```ts
import webview from '@ohos.web.webview'
import { AppRepository } from '../../data/AppRepository'
import { goBack } from '../../navigation/AppRouter'
import {
  AccountLoginHandler,
  AccountLoginShellState,
} from './AccountLoginHandler'
import { detectYouTubeLoginState } from '../../utils/YouTubeLoginDetection'

export class YouTubeLoginHandler implements AccountLoginHandler {
  readonly provider = 'youtube' as const
  private controller?: webview.WebviewController
  private shell?: AccountLoginShellState
  private handledSuccess: boolean = false

  aboutToAppear(
    controller: webview.WebviewController,
    shell: AccountLoginShellState,
  ): void {
    this.controller = controller
    this.shell = shell
  }

  aboutToDisappear(): void {
    void webview.WebCookieManager.saveCookieAsync()
  }

  onPageBegin(_url: string): void {}

  onPageEnd(url: string): void {
    void this.tryHandleSuccess(url)
  }

  onErrorReceive(error: string, isMainFrame: boolean): void {
    if (isMainFrame && this.shell) {
      console.error(`YouTubeLoginHandler main-frame error: ${error}`)
      this.shell.setLoadError('Google 登录页加载失败，请稍后重试')
      this.shell.setLoading(false)
    }
  }

  private async tryHandleSuccess(currentUrl: string): Promise<void> {
    if (!this.controller || !this.shell || this.handledSuccess) {
      return
    }

    try {
      const title = this.controller.getTitle()
      const documentCookies =
        await this.controller.runJavaScript('document.cookie')
      const pageHtml = await this.controller.runJavaScript(
        'document.documentElement?.outerHTML || ""',
      )
      const detection = detectYouTubeLoginState({
        currentUrl,
        title,
        documentCookies: String(documentCookies || ''),
        pageHtml: String(pageHtml || ''),
      })

      console.info(
        `YouTubeLoginHandler detect currentUrl=${currentUrl} inLoginFlow=${detection.inLoginFlow} loggedIn=${detection.loggedIn} displayName=${detection.displayName}`,
      )

      if (!detection.loggedIn) {
        return
      }

      this.handledSuccess = true
      const displayName = detection.displayName || 'YouTube 已关联'
      const status = await AppRepository.setDisplayName('youtube', displayName)
      if (!status.linked || status.error) {
        this.handledSuccess = false
        this.shell.setLoadError(status.error || '保存 YouTube 登录状态失败')
        return
      }

      AppStorage.setOrCreate('accountLinkResultProvider', 'youtube')
      AppStorage.setOrCreate('accountLinkResultDisplayName', displayName)
      AppStorage.setOrCreate('accountLinkResultLinked', true)
      AppStorage.setOrCreate('accountLinkResultAt', Date.now())
      AppStorage.setOrCreate('accountsStatusRefreshAt', Date.now())
      setTimeout(() => {
        void goBack()
      }, 120)
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`
      console.error(`YouTubeLoginHandler exception: ${message}`)
      this.shell.setLoadError('Google 登录过程中发生异常，请稍后重试')
      this.shell.setLoading(false)
    }
  }
}
```

- [ ] **Step 4: Register the YouTube handler in the factory**

Update `apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandlerFactory.ets`:

```ts
import { YouTubeLoginHandler } from './YouTubeLoginHandler'

export function createAccountLoginHandler(
  provider: AccountProvider,
): AccountLoginHandler {
  switch (provider) {
    case 'bilibili':
      return new BilibiliLoginHandler()
    case 'youtube':
      return new YouTubeLoginHandler()
    default:
      return new PassiveAccountLoginHandler(provider)
  }
}
```

- [ ] **Step 5: Forward main-frame errors through the handler from the page shell**

Update `apps/harmony/entry/src/main/ets/pages/AccountLogin.ets`:

```ts
.onErrorReceive((event: OnErrorReceiveEvent) => {
  const isMainFrame = !!event.request?.isMainFrame()
  if (isMainFrame) {
    this.loading = false
  }
  this.handler.onErrorReceive(event.errorInfo?.description || 'unknown', isMainFrame)
})
```

- [ ] **Step 6: Run the YouTube-focused tests and the factory test**

Run:

```bash
node --experimental-strip-types --test apps/harmony/tests/youtube-login-detection.test.ts apps/harmony/tests/youtube-login-url.test.ts apps/harmony/tests/account-login-handler-factory.test.ts
```

Expected: PASS

- [ ] **Step 7: Run the Harmony build**

Run:

```bash
pnpm --filter @livo/harmony run build:debug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 8: Commit the YouTube handler**

```bash
git add apps/harmony/entry/src/main/ets/common/services/account-login/YouTubeLoginHandler.ets apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandlerFactory.ets apps/harmony/entry/src/main/ets/pages/AccountLogin.ets
git commit -m "feat(harmony): add youtube account login handler"
```

### Task 5: Finish The Generic AccountLogin Shell And Full Regression Pass

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/AccountLogin.ets`
- Verify: `apps/harmony/tests/account-link-result.test.ts`
- Verify: `apps/harmony/tests/account-navigation-error.test.ts`
- Verify: `apps/harmony/tests/bilibili-login-detection.test.ts`
- Verify: `apps/harmony/tests/bilibili-account-status.test.ts`
- Verify: `apps/harmony/tests/account-login-handler-factory.test.ts`
- Verify: `apps/harmony/tests/youtube-login-url.test.ts`
- Verify: `apps/harmony/tests/youtube-login-detection.test.ts`

- [ ] **Step 1: Remove leftover provider-specific page fields**

Update `apps/harmony/entry/src/main/ets/pages/AccountLogin.ets` so the page only keeps generic shell state:

```ts
@State pageTitle: string = '账号关联'
@State loginUrl: string = ''
@State provider: AccountProvider = 'youtube'
@State loading: boolean = true
@State loadError: string = ''
private webController: webview.WebviewController = new webview.WebviewController()
private handler = createAccountLoginHandler('youtube')
```

Delete page-local Bilibili-only fields such as:

```ts
@State handledSuccess: boolean = false
@State handlingSuccess: boolean = false
@State initialBilibiliSessData: string = ''
@State initialBilibiliLinked: boolean = false
private bilibiliCookiePollId: number = -1
private readonly bilibiliCookieProbeUrls: string[] = []
```

- [ ] **Step 2: Keep only generic shell behavior in Web callbacks**

The page callbacks should look like:

```ts
.onPageBegin((event: OnPageBeginEvent) => {
  this.loading = true
  this.loadError = ''
  this.handler.onPageBegin(event.url || this.webController.getUrl())
})
.onPageEnd((event: OnPageEndEvent) => {
  this.loading = false
  this.handler.onPageEnd(event.url || this.webController.getUrl())
})
```

No provider branching should remain inside `AccountLogin.ets`.

- [ ] **Step 3: Run the full Node regression suite**

Run:

```bash
node --experimental-strip-types --test apps/harmony/tests/account-login-handler-factory.test.ts apps/harmony/tests/youtube-login-url.test.ts apps/harmony/tests/youtube-login-detection.test.ts apps/harmony/tests/bilibili-login-detection.test.ts apps/harmony/tests/bilibili-account-status.test.ts apps/harmony/tests/account-link-result.test.ts apps/harmony/tests/account-navigation-error.test.ts
```

Expected: PASS across all 7 test files.

- [ ] **Step 4: Run the final Harmony build**

Run:

```bash
pnpm --filter @livo/harmony run build:debug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Run the manual regression checklist**

Check these flows on device or emulator:

```text
1. 设置 -> 账户 -> YouTube -> 关联，页面直接进入 Google/YouTube 登录链，而不是 YouTube 首页
2. Google 登录页加载失败时，应用停留在当前页并显示错误文案，不闪退到桌面
3. 完成 YouTube 登录后，返回账户页并显示 “YouTube - 用户名” 或 “YouTube - YouTube 已关联”
4. Bilibili 登录后仍能自动回到设置页，并显示已关联状态
5. 断开后再次关联不会因为路由或 WebView 异常直接退回桌面
```

- [ ] **Step 6: Commit the shell cleanup and verification**

```bash
git add apps/harmony/entry/src/main/ets/pages/AccountLogin.ets apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandlerFactory.ets apps/harmony/entry/src/main/ets/common/services/account-login/BilibiliLoginHandler.ets apps/harmony/entry/src/main/ets/common/services/account-login/YouTubeLoginHandler.ets apps/harmony/entry/src/main/ets/common/services/account-login/AccountLoginHandler.ets apps/harmony/entry/src/main/ets/common/utils/YouTubeLoginUrl.ts apps/harmony/entry/src/main/ets/common/utils/YouTubeLoginDetection.ts apps/harmony/tests/account-login-handler-factory.test.ts apps/harmony/tests/youtube-login-url.test.ts apps/harmony/tests/youtube-login-detection.test.ts
git commit -m "refactor(harmony): unify account login handlers"
```

## Self-Review

- Spec coverage: covered the unified handler contract, handler factory, Bilibili migration, YouTube direct Google entry URL, page-shell cleanup, error protection, and full regression/build verification.
- Placeholder scan: no `TODO`, `TBD`, or “implement later” placeholders remain. The single “move current logic unchanged” note in Task 3 is constrained to a named source file and a specific behavior-preserving migration step rather than an undefined future task.
- Type consistency: the plan consistently uses `AccountLoginHandler`, `AccountLoginShellState`, `createAccountLoginHandler`, `resolveYouTubeLoginUrl`, and `detectYouTubeLoginState` across all later tasks.
