# Harmony Home Video Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Harmony 首页 `视频` 栏目改为双列封面卡片布局，同时保持现有点击跳转和其他栏目行为不变。

**Architecture:** 在首页页面保留现有模式切换和数据筛选逻辑，只为 `videos` 模式新增一个专用的视频网格渲染分支。新增首页专用视频卡片/网格组件承载双列布局，首页仅把已筛选的 `EntryCardModel[]` 与点击回调传入，避免继续把视频样式逻辑堆进 `Index.ets`。

**Tech Stack:** HarmonyOS NEXT ArkTS、ArkUI 声明式 UI、现有 `EntryCardModel` 数据模型、Node test、hvigor build。

---

### Task 1: 锁定首页视频模式分支与组件接口

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Create: `apps/harmony/entry/src/main/ets/common/components/HomeVideoGrid.ets`
- Test: `apps/harmony/tests/home-video-grid.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveHomeVideoGridColumns,
  resolveHomeVideoCardMeta,
} from '../entry/src/main/ets/common/components/HomeVideoGrid.ets'

test('resolveHomeVideoGridColumns keeps the home video feed in two columns', () => {
  assert.equal(resolveHomeVideoGridColumns(), 2)
})

test('resolveHomeVideoCardMeta prefers author over published label', () => {
  assert.equal(
    resolveHomeVideoCardMeta({
      author: '小Lin说',
      publishedLabel: '6天前',
    }),
    '小Lin说',
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test apps/harmony/tests/home-video-grid.test.ts
```

Expected: FAIL with module or export not found for `HomeVideoGrid.ets`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/harmony/entry/src/main/ets/common/components/HomeVideoGrid.ets` with the interface and pure helpers first:

```ts
import { EntryCardModel } from '../models/LivoModels'

export interface HomeVideoGridMetaTarget {
  author: string
  publishedLabel: string
}

export function resolveHomeVideoGridColumns(): number {
  return 2
}

export function resolveHomeVideoCardMeta(target: HomeVideoGridMetaTarget): string {
  const author = (target.author || '').trim()
  if (author) {
    return author
  }

  return (target.publishedLabel || '').trim()
}

@Component
export struct HomeVideoGrid {
  @Prop entries: EntryCardModel[] = []
  onOpenEntry: (entry: EntryCardModel) => void = () => {}

  build() {
    Column() {
      Text('TODO_GRID')
    }
  }
}
```

In `apps/harmony/entry/src/main/ets/pages/Index.ets`, prepare the import and leave the existing render path unchanged for now:

```ts
import { HomeVideoGrid } from '../common/components/HomeVideoGrid'
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test apps/harmony/tests/home-video-grid.test.ts
```

Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/components/HomeVideoGrid.ets apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/tests/home-video-grid.test.ts
git commit -m "test(harmony): lock home video grid helpers"
```

### Task 2: 实现首页双列视频卡片组件

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/components/HomeVideoGrid.ets`
- Test: `apps/harmony/tests/home-video-grid.test.ts`

- [ ] **Step 1: Write the failing test**

Expand `apps/harmony/tests/home-video-grid.test.ts`:

```ts
test('resolveHomeVideoCardMeta falls back to published label when author is absent', () => {
  assert.equal(
    resolveHomeVideoCardMeta({
      author: '',
      publishedLabel: '6天前',
    }),
    '6天前',
  )
})

test('resolveHomeVideoCardMeta returns empty string when both author and published label are absent', () => {
  assert.equal(
    resolveHomeVideoCardMeta({
      author: '',
      publishedLabel: '',
    }),
    '',
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test apps/harmony/tests/home-video-grid.test.ts
```

Expected: FAIL if the helper or exports are incomplete after wiring real component code.

- [ ] **Step 3: Write minimal implementation**

Replace the placeholder UI in `apps/harmony/entry/src/main/ets/common/components/HomeVideoGrid.ets` with a focused two-column grid:

```ts
import { EntryCardModel } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'

export interface HomeVideoGridMetaTarget {
  author: string
  publishedLabel: string
}

export function resolveHomeVideoGridColumns(): number {
  return 2
}

export function resolveHomeVideoCardMeta(target: HomeVideoGridMetaTarget): string {
  const author = (target.author || '').trim()
  if (author) {
    return author
  }

  return (target.publishedLabel || '').trim()
}

@Component
export struct HomeVideoGrid {
  @Prop entries: EntryCardModel[] = []
  onOpenEntry: (entry: EntryCardModel) => void = () => {}
  @State theme: ThemePalette = ThemeService.currentPalette()

  @Builder
  private VideoCard(entry: EntryCardModel) {
    Column({ space: 10 }) {
      Stack({ alignContent: Alignment.BottomStart }) {
        if (entry.imageUrl) {
          Image(entry.imageUrl)
            .width('100%')
            .aspectRatio(16 / 9)
            .objectFit(ImageFit.Cover)
            .borderRadius(18)
        } else {
          Column()
            .width('100%')
            .aspectRatio(16 / 9)
            .backgroundColor(this.theme.elevated)
            .borderRadius(18)
        }

        Text('视频')
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFFFFF')
          .padding({ left: 8, right: 8, top: 4, bottom: 4 })
          .backgroundColor('rgba(0,0,0,0.52)')
          .borderRadius(999)
          .margin({ left: 10, bottom: 10 })
      }

      Column({ space: 4 }) {
        Text(entry.title)
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        const meta = resolveHomeVideoCardMeta({
          author: entry.author,
          publishedLabel: entry.publishedLabel,
        })
        if (meta) {
          Text(meta)
            .fontSize(11)
            .fontColor(this.theme.textSecondary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .padding(6)
    .onClick(() => {
      this.onOpenEntry(entry)
    })
  }

  build() {
    GridRow({ columns: resolveHomeVideoGridColumns(), gutter: 10 }) {
      ForEach(this.entries, (entry: EntryCardModel) => {
        GridCol({ span: 1 }) {
          this.VideoCard(entry)
        }
      }, (entry: EntryCardModel) => entry.id)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test apps/harmony/tests/home-video-grid.test.ts
```

Expected: PASS with all helper tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/components/HomeVideoGrid.ets apps/harmony/tests/home-video-grid.test.ts
git commit -m "feat(harmony): add home video grid component"
```

### Task 3: 将首页 videos 模式切到视频网格

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/HomeVideoGrid.ets`
- Test: `apps/harmony/tests/home-video-grid.test.ts`

- [ ] **Step 1: Write the failing test**

Extend `apps/harmony/tests/home-video-grid.test.ts`:

```ts
import { resolveHomeVideoSceneKind } from '../entry/src/main/ets/pages/Index.ets'

test('resolveHomeVideoSceneKind uses grid scene for videos mode', () => {
  assert.equal(resolveHomeVideoSceneKind('videos'), 'grid')
})

test('resolveHomeVideoSceneKind keeps list scene for articles mode', () => {
  assert.equal(resolveHomeVideoSceneKind('articles'), 'list')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test apps/harmony/tests/home-video-grid.test.ts
```

Expected: FAIL because `resolveHomeVideoSceneKind` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

In `apps/harmony/entry/src/main/ets/pages/Index.ets`, add a pure helper near the mode definitions:

```ts
export function resolveHomeVideoSceneKind(
  mode: SubscriptionMode,
): 'list' | 'grid' {
  return mode === 'videos' ? 'grid' : 'list'
}
```

Then update the `videos` scene renderer to use `HomeVideoGrid` instead of `EntryCard` flow:

```ts
@Builder
private ModeEntriesScene(mode: SubscriptionMode) {
  if (resolveHomeVideoSceneKind(mode) === 'grid') {
    Scroll() {
      Column({ space: 0 }) {
        HomeVideoGrid({
          entries: this.filteredEntriesFor(mode),
          onOpenEntry: (entry: EntryCardModel) => {
            void openArticleDetail(entry.id)
          },
        })
      }
      .width('100%')
      .padding({ left: 12, right: 12, bottom: this.bottomAvoidArea + 28 })
    }
    .width('100%')
    .layoutWeight(1)
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.Spring)
    return
  }

  // 保留原来的文章流式列表逻辑
}
```

Keep all non-video modes on the existing `EntryCard` path.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test apps/harmony/tests/home-video-grid.test.ts
```

Expected: PASS with the new scene-kind assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/entry/src/main/ets/common/components/HomeVideoGrid.ets apps/harmony/tests/home-video-grid.test.ts
git commit -m "feat(harmony): switch home videos to grid scene"
```

### Task 4: 验证首页视频网格与现有链路兼容

**Files:**

- Modify: `apps/harmony/tests/home-video-grid.test.ts`
- Verify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Verify: `apps/harmony/entry/src/main/ets/common/components/HomeVideoGrid.ets`

- [ ] **Step 1: Write the failing test**

Add a final regression assertion to `apps/harmony/tests/home-video-grid.test.ts`:

```ts
test('resolveHomeVideoGridColumns remains two columns for stable thumbnail browsing', () => {
  assert.equal(resolveHomeVideoGridColumns(), 2)
})
```

This duplicates the user-facing contract to protect against accidental future regression.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test apps/harmony/tests/home-video-grid.test.ts
```

Expected: If an earlier refactor broke the helper export or changed the column count, this test fails before final verification.

- [ ] **Step 3: Write minimal implementation**

Confirm the final implementation remains:

```ts
export function resolveHomeVideoGridColumns(): number {
  return 2
}
```

Also keep the click-through path in `Index.ets` on article detail:

```ts
onOpenEntry: (entry: EntryCardModel) => {
  void openArticleDetail(entry.id)
}
```

- [ ] **Step 4: Run test and build verification**

Run:

```bash
node --test apps/harmony/tests/home-video-grid.test.ts
pnpm --filter @livo/harmony run build:debug
```

Expected:

- `node --test` reports all tests PASS
- `build:debug` ends with `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/tests/home-video-grid.test.ts apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/entry/src/main/ets/common/components/HomeVideoGrid.ets
git commit -m "test(harmony): verify home video grid flow"
```

## Self-Review

- Spec coverage: 已覆盖首页 `videos` 模式专用双列布局、封面/标题优先级、点击行为保持不变、缺失封面降级、构建验证；未触碰订阅页与播放链路，符合 spec 边界。
- Placeholder scan: 计划中的每个代码步骤都给了明确文件、代码片段和命令，没有 `TODO/TBD` 占位。
- Type consistency: 统一使用 `EntryCardModel`、`SubscriptionMode`、`HomeVideoGrid`、`resolveHomeVideoSceneKind`、`resolveHomeVideoGridColumns`、`resolveHomeVideoCardMeta` 这些命名，前后保持一致。

Plan complete and saved to `docs/superpowers/plans/2026-03-31-harmony-home-video-grid.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
