# Harmony Accounts Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Harmony 设置页新增一个完整的“账号关联”二级面板，支持四个 provider 的关联状态、自检、断开刷新，以及 Bilibili 关注预览与批量导入。

**Architecture:** 入口仍挂在现有 `SettingsContent` 的二级 sheet 体系内，UI 层新增 `AccountsSettingsPanel`，状态和 provider 逻辑下沉到 `AccountSessionService`、`AccountSelfCheckService`、`BilibiliFollowingsService`。设置组件只消费统一结果模型，不直接知道各 provider 的细节实现。

**Tech Stack:** ArkTS, ArkUI, HarmonyOS NEXT Stage 模型, AppRepository/FeedRepository, PageHeader, SettingListRow, Preferences/local cache

---

## File Map

- Create: `apps/harmony/entry/src/main/ets/common/services/AccountSessionService.ets`
- Create: `apps/harmony/entry/src/main/ets/common/services/AccountSelfCheckService.ets`
- Create: `apps/harmony/entry/src/main/ets/common/services/BilibiliFollowingsService.ets`
- Create: `apps/harmony/entry/src/main/ets/common/components/AccountsSettingsPanel.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/SettingsContent.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/SettingsSecondaryPanels.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/models/LivoModels.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/data/AppRepository.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/repositories/FeedRepository.ets`
- Verify: `pnpm --filter @livo/harmony run build:debug`

### Task 1: Wire The Settings Entry And Shared Models

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/components/AccountsSettingsPanel.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/SettingsContent.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/SettingsSecondaryPanels.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/models/LivoModels.ets`

- [ ] **Step 1: Add the shared account-related types**

Add the account enums and DTOs into `apps/harmony/entry/src/main/ets/common/models/LivoModels.ets`:

```ts
export type AccountProvider = 'youtube' | 'x' | 'instagram' | 'bilibili'

export interface AccountStatusResult {
  provider: AccountProvider
  linked: boolean
  displayName: string
  error: string
}

export interface AccountSelfCheckRow {
  name: string
  pass: boolean
  detail: string
}

export interface PendingBilibiliCreator {
  mid: number
  uname: string
  exists: boolean
}

export interface BilibiliImportProgress {
  total: number
  completed: number
  imported: number
  skipped: number
  failed: number
}
```

- [ ] **Step 2: Run a compile check to catch type shape mistakes early**

Run:

```bash
pnpm --filter @livo/harmony run build:debug
```

Expected: build may still fail because services/UI are not wired yet, but there should be no syntax errors in the model additions.

- [ ] **Step 3: Register the new settings sheet key and entry wiring**

Update `apps/harmony/entry/src/main/ets/common/components/SettingsContent.ets`:

```ts
type SettingsSheetKey =
  '' | 'appearance' | 'general' | 'data-control' | 'privacy' |
  'about' | 'favorites' | 'accounts'

private handleSettingTap(item: SettingItem): void {
  switch (item.title) {
    case '账户':
      this.openSheet('accounts')
      break
    // keep existing cases
  }
}
```

Also extend `initialSheetHeight()` with an `accounts` branch sized similarly to `appearance` or `privacy`.

- [ ] **Step 4: Create the panel shell and export path**

Create `apps/harmony/entry/src/main/ets/common/components/AccountsSettingsPanel.ets` with a minimal shell first:

```ts
@Component
export struct AccountsSettingsPanel {
  @State theme: ThemePalette = ThemeService.currentPalette()

  build() {
    Scroll() {
      Column({ space: 12 }) {
        SettingsPanelHeader('账号关联', this.theme)
        Text('账号关联面板开发中')
          .fontSize(14)
          .fontColor(this.theme.textSecondary)
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
  }
}
```

Then export/import it from `SettingsSecondaryPanels.ets` or directly into `SettingsContent.ets`, matching the current secondary panel pattern.

- [ ] **Step 5: Render the panel in the settings sheet switch**

In `SettingsContent.ets`, add the `accounts` branch beside the existing panels:

```ts
if (this.activeSheet === 'accounts') {
  AccountsSettingsPanel()
}
```

- [ ] **Step 6: Verify the shell builds**

Run:

```bash
pnpm --filter @livo/harmony run build:debug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 7: Commit the shell wiring**

```bash
git add apps/harmony/entry/src/main/ets/common/models/LivoModels.ets apps/harmony/entry/src/main/ets/common/components/SettingsContent.ets apps/harmony/entry/src/main/ets/common/components/AccountsSettingsPanel.ets apps/harmony/entry/src/main/ets/common/components/SettingsSecondaryPanels.ets
git commit -m "feat(harmony): add accounts settings panel shell"
```

### Task 2: Build The Account Session Service And Provider Status Cards

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/services/AccountSessionService.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/AccountsSettingsPanel.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/data/AppRepository.ets`

- [ ] **Step 1: Add the service contract**

Create `AccountSessionService.ets`:

```ts
import { AccountProvider, AccountStatusResult } from '../models/LivoModels'

export class AccountSessionService {
  static async status(provider: AccountProvider): Promise<AccountStatusResult> {
    return {
      provider,
      linked: false,
      displayName: '',
      error: '',
    }
  }

  static async link(provider: AccountProvider): Promise<AccountStatusResult> {
    return this.status(provider)
  }

  static async unlink(provider: AccountProvider): Promise<AccountStatusResult> {
    return this.status(provider)
  }
}
```

- [ ] **Step 2: Add AppRepository passthrough methods**

Update `apps/harmony/entry/src/main/ets/common/data/AppRepository.ets`:

```ts
static async accountStatus(provider: AccountProvider): Promise<AccountStatusResult> {
  return AccountSessionService.status(provider)
}

static async linkAccount(provider: AccountProvider): Promise<AccountStatusResult> {
  return AccountSessionService.link(provider)
}

static async unlinkAccount(provider: AccountProvider): Promise<AccountStatusResult> {
  return AccountSessionService.unlink(provider)
}
```

- [ ] **Step 3: Render four provider cards with loading and status fields**

In `AccountsSettingsPanel.ets`, add a provider list:

```ts
private readonly cards: Array<{ provider: AccountProvider; name: string; description: string }> = [
  { provider: 'youtube', name: 'YouTube', description: '关联 YouTube 会话并读取账号名称' },
  { provider: 'x', name: 'X / Twitter', description: '关联 X 会话并读取账号名称' },
  { provider: 'instagram', name: 'Instagram', description: '关联 Instagram 会话并读取账号名称' },
  { provider: 'bilibili', name: 'Bilibili', description: '关联 Bilibili 会话并支持导入关注列表' },
]
```

Add `@State statuses` and `@State loadingProvider` and render card rows that show:

```ts
Text(status.linked ? status.displayName || '已关联' : '未关联')
Button(status.linked ? '断开' : '关联')
Button('刷新状态')
```

- [ ] **Step 4: Load statuses in `aboutToAppear()`**

```ts
private async loadStatuses(): Promise<void> {
  for (const card of this.cards) {
    this.statuses.set(card.provider, await AppRepository.accountStatus(card.provider))
  }
}
```

If `Map` proves awkward in ArkTS state, switch to four dedicated `@State` objects or an array replace pattern.

- [ ] **Step 5: Wire link / unlink / refresh actions**

Button handlers:

```ts
private async handleLink(provider: AccountProvider): Promise<void> {
  this.loadingProvider = provider
  const next = await AppRepository.linkAccount(provider)
  this.updateStatus(next)
  this.loadingProvider = ''
}
```

Mirror for unlink and refresh.

- [ ] **Step 6: Verify all four cards render and actions compile**

Run:

```bash
pnpm --filter @livo/harmony run build:debug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 7: Commit the provider status layer**

```bash
git add apps/harmony/entry/src/main/ets/common/services/AccountSessionService.ets apps/harmony/entry/src/main/ets/common/data/AppRepository.ets apps/harmony/entry/src/main/ets/common/components/AccountsSettingsPanel.ets
git commit -m "feat(harmony): add account status cards"
```

### Task 3: Add The Self-Check Section

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/services/AccountSelfCheckService.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/AccountsSettingsPanel.ets`

- [ ] **Step 1: Implement the self-check aggregator**

Create `AccountSelfCheckService.ets`:

```ts
import { AccountProvider, AccountSelfCheckRow } from '../models/LivoModels'
import { AccountSessionService } from './AccountSessionService'

export class AccountSelfCheckService {
  static async run(): Promise<{
    summary: string
    rows: AccountSelfCheckRow[]
  }> {
    const providers: AccountProvider[] = [
      'youtube',
      'x',
      'instagram',
      'bilibili',
    ]
    const rows: AccountSelfCheckRow[] = []
    let passed = 0

    for (const provider of providers) {
      const status = await AccountSessionService.status(provider)
      const pass = status.linked && status.displayName.length > 0
      if (pass) passed += 1
      rows.push({
        name: provider,
        pass,
        detail: pass
          ? `通过: ${status.displayName}`
          : status.error ||
            (status.linked ? '已关联但未获取到账号名' : '未关联'),
      })
    }

    return {
      summary:
        passed === rows.length
          ? `一键自检通过（${passed}/${rows.length}）`
          : `一键自检未通过（${passed}/${rows.length}）`,
      rows,
    }
  }
}
```

- [ ] **Step 2: Add self-check state to the panel**

In `AccountsSettingsPanel.ets`:

```ts
@State selfChecking: boolean = false
@State selfCheckSummary: string = ''
@State selfCheckRows: AccountSelfCheckRow[] = []
```

- [ ] **Step 3: Add the self-check UI block above provider cards**

Render:

```ts
Button(this.selfChecking ? '检查中...' : '一键自检')
Text(this.selfCheckSummary)
ForEach(this.selfCheckRows, (row: AccountSelfCheckRow) => {
  Row() {
    Text(row.pass ? '✓' : '✕')
    Text(row.name)
    Text(row.detail)
  }
})
```

- [ ] **Step 4: Wire the click handler**

```ts
private async handleSelfCheck(): Promise<void> {
  this.selfChecking = true
  const result = await AccountSelfCheckService.run()
  this.selfCheckSummary = result.summary
  this.selfCheckRows = result.rows
  this.selfChecking = false
}
```

- [ ] **Step 5: Verify the self-check section builds**

Run:

```bash
pnpm --filter @livo/harmony run build:debug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 6: Commit the self-check feature**

```bash
git add apps/harmony/entry/src/main/ets/common/services/AccountSelfCheckService.ets apps/harmony/entry/src/main/ets/common/components/AccountsSettingsPanel.ets
git commit -m "feat(harmony): add account self-check section"
```

### Task 4: Add Bilibili Followings Preview And Import

**Files:**

- Create: `apps/harmony/entry/src/main/ets/common/services/BilibiliFollowingsService.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/data/AppRepository.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/repositories/FeedRepository.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/AccountsSettingsPanel.ets`

- [ ] **Step 1: Add the Bilibili followings service skeleton**

Create `BilibiliFollowingsService.ets`:

```ts
import {
  PendingBilibiliCreator,
  BilibiliImportProgress,
} from '../models/LivoModels'

export class BilibiliFollowingsService {
  static async preview(): Promise<PendingBilibiliCreator[]> {
    return []
  }

  static async importCreators(
    creators: PendingBilibiliCreator[],
    views: string[],
    onProgress: (progress: BilibiliImportProgress) => void,
  ): Promise<void> {
    onProgress({
      total: creators.length,
      completed: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
    })
  }
}
```

- [ ] **Step 2: Define the preview and import repository methods**

Update `AppRepository.ets`:

```ts
static async previewBilibiliFollowings(): Promise<PendingBilibiliCreator[]> {
  return BilibiliFollowingsService.preview()
}
```

If feed creation helpers are missing at the repository layer, add explicit helper methods in `FeedRepository.ets` instead of writing feed inserts directly inside the panel.

- [ ] **Step 3: Add the panel state for preview, selection, views, and progress**

In `AccountsSettingsPanel.ets`:

```ts
@State pendingCreators: PendingBilibiliCreator[] = []
@State selectedCreatorMids: number[] = []
@State selectedImportViews: string[] = ['videos']
@State importProgressText: string = ''
@State isPreviewingBilibili: boolean = false
@State isImportingBilibili: boolean = false
```

- [ ] **Step 4: Render the Bilibili section conditionally**

Only show when Bilibili is linked:

```ts
if (this.bilibiliStatus.linked) {
  // preview button
  // stats
  // creator checklist
  // import view chips
  // import button
  // progress text
}
```

- [ ] **Step 5: Wire preview action**

```ts
private async handlePreviewBilibili(): Promise<void> {
  this.isPreviewingBilibili = true
  this.pendingCreators = await AppRepository.previewBilibiliFollowings()
  this.selectedCreatorMids = this.pendingCreators.filter((item) => !item.exists).map((item) => item.mid)
  this.isPreviewingBilibili = false
}
```

- [ ] **Step 6: Implement import progress updates**

```ts
private async handleImportBilibili(): Promise<void> {
  this.isImportingBilibili = true
  const creators = this.pendingCreators.filter((item) => this.selectedCreatorMids.includes(item.mid))
  await BilibiliFollowingsService.importCreators(creators, this.selectedImportViews, (progress) => {
    this.importProgressText = `${progress.completed}/${progress.total} · 已导入 ${progress.imported} · 跳过 ${progress.skipped} · 失败 ${progress.failed}`
  })
  this.isImportingBilibili = false
}
```

- [ ] **Step 7: Refresh subscription data after import**

After import completes, call the existing feed refresh / reload path used elsewhere in Harmony so the imported feeds appear immediately in subscriptions.

- [ ] **Step 8: Verify the import section builds**

Run:

```bash
pnpm --filter @livo/harmony run build:debug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 9: Commit the Bilibili import feature**

```bash
git add apps/harmony/entry/src/main/ets/common/services/BilibiliFollowingsService.ets apps/harmony/entry/src/main/ets/common/data/AppRepository.ets apps/harmony/entry/src/main/ets/common/repositories/FeedRepository.ets apps/harmony/entry/src/main/ets/common/components/AccountsSettingsPanel.ets
git commit -m "feat(harmony): add bilibili followings import"
```

### Task 5: Fill In Provider-Specific Session Logic And Final Verification

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/services/AccountSessionService.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/AccountsSettingsPanel.ets`
- Verify: `apps/harmony/entry/src/main/ets/common/components/SettingsContent.ets`

- [ ] **Step 1: Replace the placeholder status implementation with real provider checks**

In `AccountSessionService.ets`, evolve the provider switch:

```ts
switch (provider) {
  case 'youtube':
    return await YouTubeAccountAdapter.status()
  case 'x':
    return await XAccountAdapter.status()
  case 'instagram':
    return await InstagramAccountAdapter.status()
  case 'bilibili':
    return await BilibiliAccountAdapter.status()
}
```

If adapters are not needed as separate files yet, keep them as private methods in the same service until complexity proves otherwise.

- [ ] **Step 2: Replace placeholder link/unlink actions with real flows**

Use Harmony-supported in-app Web / session flows and normalize all results back to `AccountStatusResult`.

- [ ] **Step 3: Run a focused manual regression**

Check these flows:

```text
1. 设置 -> 账户 -> 面板打开
2. 一键自检可执行
3. 四张卡片可点击关联/断开/刷新
4. Bilibili 已关联时能预览列表
5. 选择创作者并导入后，订阅列表能看到新源
```

- [ ] **Step 4: Run final build verification**

Run:

```bash
pnpm --filter @livo/harmony run build:debug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit the finished feature**

```bash
git add apps/harmony/entry/src/main/ets/common/services/AccountSessionService.ets apps/harmony/entry/src/main/ets/common/services/AccountSelfCheckService.ets apps/harmony/entry/src/main/ets/common/services/BilibiliFollowingsService.ets apps/harmony/entry/src/main/ets/common/components/AccountsSettingsPanel.ets apps/harmony/entry/src/main/ets/common/components/SettingsContent.ets apps/harmony/entry/src/main/ets/common/components/SettingsSecondaryPanels.ets apps/harmony/entry/src/main/ets/common/models/LivoModels.ets apps/harmony/entry/src/main/ets/common/data/AppRepository.ets apps/harmony/entry/src/main/ets/common/repositories/FeedRepository.ets
git commit -m "feat(harmony): add account linking settings"
```

## Self-Review

- Spec coverage: the plan covers settings entry wiring, provider cards, self-check, Bilibili preview/import, and final provider implementation.
- Placeholder scan: no `TODO` / `TBD` remain in task instructions; the only deferred choice is whether provider-specific adapters stay in one file or split, and both outcomes are described explicitly.
- Type consistency: all tasks use the same shared types (`AccountProvider`, `AccountStatusResult`, `PendingBilibiliCreator`, `BilibiliImportProgress`) and the same target files throughout.
