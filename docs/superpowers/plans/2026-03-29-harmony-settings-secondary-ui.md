# Harmony Settings Secondary UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify Harmony settings secondary pages so they visually follow the Appearance panel pattern.

**Architecture:** Extract the reusable secondary-panel row and card-group styling from the current Appearance panel into shared builders inside the existing settings component area, then update the General, Data Control, Privacy, About, and Favorites secondary panels to consume the same visual language. Keep current sheet routing and data behavior unchanged while aligning spacing, typography, icons, right-side affordances, and grouped card structure.

**Tech Stack:** ArkTS, ArkUI declarative components, HarmonyOS sheet panels, existing ThemeService and UiTokens

---

### Task 1: Capture the Shared Secondary Panel UI Contract

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/AppearanceSettingsPanel.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/SettingsSecondaryPanels.ets`

- [ ] **Step 1: Identify the reusable visual primitives**

Document the shared row anatomy already used by the Appearance panel and map each current secondary panel to one of these row types:

```text
menu/info row:
  left icon
  title + subtitle
  right status text or chevron/menu affordance

toggle row:
  left icon
  title + subtitle
  right switch

card group:
  stacked rows
  internal divider lines
  rounded outer container
```

- [ ] **Step 2: Keep existing behavior boundaries**

Do not change:

```text
- sheet routing in SettingsContent
- persistence logic in AppRepository / ThemeService
- favorites list data loading and article opening
```

- [ ] **Step 3: Implement shared visual constants in existing settings panel files**

Use the existing constants already established in these files as the visual baseline:

```text
ROW_MIN_HEIGHT / PANEL_ROW_MIN_HEIGHT = 56
ROW_ICON_SIZE / PANEL_ICON_SIZE = 22
ROW_TITLE_SIZE / PANEL_TITLE_SIZE = 15
ROW_SUBTITLE_SIZE / PANEL_SUBTITLE_SIZE = 12
CARD_RADIUS_LG = 20
```

### Task 2: Refactor Appearance Panel Helpers So Other Panels Can Match It

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/AppearanceSettingsPanel.ets`

- [ ] **Step 1: Write the minimal shared builder helpers inside the Appearance panel file or mirror them exactly into secondary panels**

Target helper shapes:

```ts
@Builder
private DividerLine() { /* existing style retained */ }

@Builder
private MenuAction(label: string, options: AppearanceOption[], selectedValue: string, onSelect: (value: string) => void) {
  /* existing style retained */
}

@Builder
private ToggleRow(icon: Resource, title: string, subtitle: string, checked: boolean, onToggle: () => void) {
  /* existing style retained */
}
```

- [ ] **Step 2: Verify the Appearance panel still renders the same structure**

Appearance should still have:

```text
- first grouped card for theme / refresh / language
- second grouped card for toggles
- same drag handle behavior
```

### Task 3: Convert General and Data Control Panels to the Appearance Pattern

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/SettingsSecondaryPanels.ets`

- [ ] **Step 1: Update General panel rows to the same row anatomy**

General rows should visually match Appearance rows:

```ts
this.InfoRow(
  $r('sys.symbol.translate_c2e'),
  '应用语言',
  '当前界面语言',
  this.config.language,
  0,
)
this.InfoRow(
  $r('sys.symbol.arrow_clockwise'),
  '刷新间隔',
  '后台自动刷新频率',
  `${this.config.refreshIntervalMinutes} 分钟`,
  1,
)
this.InfoRow(
  $r('sys.symbol.link'),
  '默认订阅源',
  '远程订阅源地址',
  this.config.remoteFeedUrl ? '已配置' : '未配置',
  2,
)
```

But ensure each row adds:

```text
- surface background on the row itself
- matching corner radius
- right-side status alignment like Appearance
- grouped outer card with dividers
```

- [ ] **Step 2: Update Data Control panel row styling to match Appearance toggle rows**

Retain the same toggle behavior, but visually align it with:

```ts
Toggle({ type: ToggleType.Switch, isOn: checked })
  .selectedColor(this.theme.accent)
  .switchPointColor('#FFFFFF')
  .hitTestBehavior(HitTestMode.None)
```

- [ ] **Step 3: Run Harmony build to verify ArkTS compilation**

Run: `pnpm --filter @livo/harmony run build:debug`
Expected: `BUILD SUCCESSFUL`

### Task 4: Convert Privacy and About Panels from Text Cards to Setting-Style Cards

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/SettingsSecondaryPanels.ets`

- [ ] **Step 1: Replace Privacy freeform text cards with grouped info rows**

Keep the same three content blocks, but present them as:

```text
title
subtitle/description
leading icon
setting-style card group
```

- [ ] **Step 2: Replace About standalone info cards with grouped info rows**

Keep these data points:

```text
应用名称 / Livo
Harmony 端 / ArkTS / ArkUI
数据策略 / 本地优先
项目状态 / 开发中
```

Render them as grouped rows using the same rounded container and divider treatment as Appearance.

- [ ] **Step 3: Run Harmony build again after these panel changes**

Run: `pnpm --filter @livo/harmony run build:debug`
Expected: `BUILD SUCCESSFUL`

### Task 5: Align Favorites Panel Shell to the Same Secondary-Page Visual Language

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/SettingsSecondaryPanels.ets`

- [ ] **Step 1: Keep Favorites data behavior but align the panel chrome**

Keep:

```text
- loading state
- empty state
- article open on tap
- unstar action
```

Adjust:

```text
- header spacing
- section rhythm
- list card grouping feel
- empty/loading presentation tone
```

- [ ] **Step 2: Ensure Favorites still feels content-oriented, not forced into a fake settings row**

Do not convert article cards into simple metadata rows. Only align the surrounding shell and typography rhythm with the Appearance panel.

### Task 6: Final Verification

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/AppearanceSettingsPanel.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/SettingsSecondaryPanels.ets`

- [ ] **Step 1: Review affected panels against the approved goal**

Checklist:

```text
- General visually follows Appearance
- Data Control visually follows Appearance
- Privacy visually follows Appearance
- About visually follows Appearance
- Favorites shell visually follows Appearance
- no sheet routing changes
- no settings persistence regressions introduced
```

- [ ] **Step 2: Run the final build verification**

Run: `pnpm --filter @livo/harmony run build:debug`
Expected: `BUILD SUCCESSFUL`
