# Harmony Instagram Picture Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Harmony Instagram/Picnob picture entries render like picture feeds across detail and home views, while removing mirror-title noise and fixing the last `+N` gallery tile layout.

**Architecture:** Keep the existing feed/media parsing pipeline, but unify picture-entry presentation behind a shared Harmony builder/helper. Normalize mirror-tainted Instagram titles in the existing social-title utility, then route both detail-page picture previews and home-picture mode through the same picture-entry card so they stay visually aligned.

**Tech Stack:** ArkTS, ArkUI declarative UI, HarmonyOS NEXT, Node test runner, existing Harmony feed/media helpers

---

### Task 1: Lock Title Normalization for Picnob Mirror Titles

**Files:**
- Modify: `apps/harmony/entry/src/main/ets/common/utils/SocialFeedTitles.ts`
- Test: `apps/harmony/tests/discover-remote-search-parsing.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test near the existing Instagram title normalization cases in `apps/harmony/tests/discover-remote-search-parsing.test.ts`:

```ts
test('formatInstagramFeedTitle strips picnob public posts suffix while preserving readable names', () => {
  assert.equal(
    formatInstagramFeedTitle('陈都灵 (@du_chenduling) public posts - Picnob', 'du_chenduling'),
    '陈都灵',
  )
  assert.equal(
    formatInstagramFeedTitle('du_chenduling public posts - Picnob', 'du_chenduling'),
    'du_chenduling',
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/discover-remote-search-parsing.test.ts`

Expected: FAIL on the new Picnob suffix case because the current formatter still returns the polluted title.

- [ ] **Step 3: Write minimal implementation**

Update the Instagram cleanup branch in `apps/harmony/entry/src/main/ets/common/utils/SocialFeedTitles.ts` so the formatter removes mirror suffixes before returning:

```ts
  cleaned = cleaned
    .replace(/\s*\(\s*@([a-zA-Z0-9._]{1,30})\s*\)\s+public\s+posts\s*-\s*picnob(?:\.[^\s]+)?$/i, '')
    .replace(/\s+public\s+posts\s*-\s*picnob(?:\.[^\s]+)?$/i, '')
    .replace(/\s*-\s*picnob(?:\.[^\s]+)?[\s\S]*$/i, '')
    .replace(/\s+public\s+posts[\s\S]*$/i, '')
    .trim()
```

Keep the existing fallback priority:

```ts
  return cleaned || fallback
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/discover-remote-search-parsing.test.ts`

Expected: PASS, including the new Picnob title cleanup case.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/utils/SocialFeedTitles.ts apps/harmony/tests/discover-remote-search-parsing.test.ts
git commit -m "fix: normalize instagram picnob mirror titles"
```

### Task 2: Extract a Shared Harmony Picture Entry Builder

**Files:**
- Create: `apps/harmony/entry/src/main/ets/common/components/PictureEntryCard.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/utils/PictureGallery.ts`
- Test: `apps/harmony/tests/picture-gallery.test.ts`

- [ ] **Step 1: Write the failing test**

Add a gallery sizing test to `apps/harmony/tests/picture-gallery.test.ts`:

```ts
test('resolvePictureGalleryCellHeight keeps gallery tiles square for dense instagram grids', () => {
  assert.equal(resolvePictureGalleryCellHeight(1, 320), 220)
  assert.equal(resolvePictureGalleryCellHeight(3, 320), 101)
})
```

Also add the import:

```ts
import {
  extractEntryGalleryImageUrls,
  resolvePictureGalleryCellHeight,
  resolvePictureGalleryColumns,
  shouldUseCachedPicturePreview,
} from '../entry/src/main/ets/common/utils/PictureGallery.ts'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/picture-gallery.test.ts`

Expected: FAIL because `resolvePictureGalleryCellHeight` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

In `apps/harmony/entry/src/main/ets/common/utils/PictureGallery.ts`, add a deterministic square-cell helper:

```ts
export function resolvePictureGalleryCellHeight(columns: number, availableWidth: number): number {
  if (columns <= 1) {
    return 220
  }
  const gaps = (columns - 1) * 6
  const width = Math.floor((availableWidth - gaps) / columns)
  return Math.max(88, width)
}
```

Then create `apps/harmony/entry/src/main/ets/common/components/PictureEntryCard.ets` with a reusable builder component that accepts the entry, theme tokens, gallery helpers, and `onOpen` callback:

```ts
@Component
export struct PictureEntryCard {
  @Prop entry: Entry
  @Prop theme: LivoTheme = ThemeService.lightPalette()
  @Prop title: string = ''
  @Prop availableWidth: number = 320
  onOpen: () => void = () => {}

  private galleryUrls(): string[] {
    return extractEntryGalleryImageUrls({
      summary: this.entry.summary,
      content: this.entry.content,
      articleUrl: this.entry.url,
      siteUrl: this.title,
      mediaUrls: this.entry.mediaUrls ?? [],
    })
  }
}
```

Inside that component, render:

```ts
const urls = this.galleryUrls()
const columns = resolvePictureGalleryColumns(urls.length)
const cellHeight = resolvePictureGalleryCellHeight(columns, this.availableWidth)
```

And use fixed item size instead of only width:

```ts
Stack({ alignContent: Alignment.Center }) {
  Image(url)
    .width('100%')
    .height(cellHeight)
    .objectFit(ImageFit.Cover)
    .borderRadius(12)

  if (photoIndex === 8 && urls.length > 9) {
    Row()
      .width('100%')
      .height(cellHeight)
      .borderRadius(12)
      .backgroundColor('rgba(0,0,0,0.28)')

    Text(`+${urls.length - 9}`)
      .fontSize(16)
      .fontWeight(FontWeight.Bold)
      .fontColor('#FFFFFF')
  }
}
```

In `apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets`, replace the inline `PictureEntryCard` builder body with a call to the shared component:

```ts
PictureEntryCard({
  entry,
  theme: this.theme,
  title: this.targetSiteUrl || this.targetUrl,
  availableWidth: 320,
  onOpen: () => {
    this.onOpenArticle(entry, this.articleDetailFeed(entry))
  },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/picture-gallery.test.ts`

Expected: PASS, including the new square-cell sizing case.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/components/PictureEntryCard.ets apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets apps/harmony/entry/src/main/ets/common/utils/PictureGallery.ts apps/harmony/tests/picture-gallery.test.ts
git commit -m "feat: share instagram picture entry card layout"
```

### Task 3: Route Feed Detail Pictures Through the Shared Card

**Files:**
- Modify: `apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets`
- Test: `apps/harmony/tests/picture-gallery.test.ts`

- [ ] **Step 1: Write the failing test**

Add a regression test to `apps/harmony/tests/picture-gallery.test.ts`:

```ts
test('extractEntryGalleryImageUrls preserves 9th visible image for +N overlay cards', () => {
  const urls = Array.from({ length: 12 }, (_, index) => `https://cdn.example.com/${index + 1}.jpg`)
  assert.equal(extractEntryGalleryImageUrls({
    summary: '',
    content: '',
    articleUrl: 'https://www.instagram.com/p/demo/',
    siteUrl: 'https://www.instagram.com/du_chenduling/',
    mediaUrls: urls,
  }).slice(0, 9).length, 9)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/picture-gallery.test.ts`

Expected: FAIL if the shared card extraction or visible-range handling was wired incorrectly during the refactor.

- [ ] **Step 3: Write minimal implementation**

In `apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets`, remove the old local gallery sizing helpers that only returned widths:

```ts
  private galleryItemWidth(entry: Entry): string {
    const columns = this.galleryColumns(entry)
    if (columns <= 1) {
      return '100%'
    }
    return columns === 2 ? '49%' : '32%'
  }
```

Keep only helpers still needed for captions or feed selection, and delegate actual gallery rendering to `PictureEntryCard.ets`. The detail view should no longer own a special last-tile branch; that logic lives only in the shared card.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/picture-gallery.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets apps/harmony/tests/picture-gallery.test.ts
git commit -m "refactor: use shared picture card in feed detail"
```

### Task 4: Make Home Pictures Mode Use Picture Feed Cards Instead of Generic Entry Cards

**Files:**
- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/models/LivoModels.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/components/PictureEntryCard.ets`
- Test: `apps/harmony/tests/livo-models-media-url.test.ts`

- [ ] **Step 1: Write the failing test**

Add a model-level test in `apps/harmony/tests/livo-models-media-url.test.ts` to ensure picture entries carry enough data for the shared card:

```ts
test('toEntryCardModel keeps picture-feed media urls for shared gallery rendering', () => {
  const model = toEntryCardModel({
    id: 'entry-1',
    feedId: 'feed-1',
    title: '🍓🧤',
    url: 'https://www.instagram.com/p/demo/',
    summary: 'caption',
    content: '<img src=\"https://cdn.example.com/1.jpg\" />',
    author: 'du_chenduling',
    publishedAt: Date.now(),
    readingTimeMinutes: 1,
    tags: [],
    mediaUrls: ['https://cdn.example.com/1.jpg', 'https://cdn.example.com/2.jpg'],
    isRead: false,
    isStarred: false,
    createdAt: 0,
    updatedAt: 0,
  }, {
    id: 'feed-1',
    title: '陈都灵',
    url: 'https://rsshub.pseudoyu.com/picnob/user/du_chenduling',
    view: FeedViewType.Pictures,
    showInAll: true,
    errorCount: 0,
    createdAt: 0,
    updatedAt: 0,
  })

  assert.deepEqual(model.mediaUrls, [
    'https://cdn.example.com/1.jpg',
    'https://cdn.example.com/2.jpg',
  ])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/harmony/tests/livo-models-media-url.test.ts`

Expected: FAIL because `EntryCardModel` does not currently expose `mediaUrls`.

- [ ] **Step 3: Write minimal implementation**

In `apps/harmony/entry/src/main/ets/common/models/LivoModels.ets`, add `mediaUrls?: string[]` to `EntryCardModel` and map it in `toEntryCardModel`:

```ts
export interface EntryCardModel {
  id: string
  feedId: string
  title: string
  summary: string
  imageUrl: string
  mediaUrls?: string[]
  author: string
```

```ts
    mediaUrls: entry.mediaUrls ?? [],
```

Then in `apps/harmony/entry/src/main/ets/pages/Index.ets`, split picture-mode rendering from generic entry rendering:

```ts
  @Builder
  private PictureEntryList(mode: SubscriptionMode) {
    List({ space: 10 }) {
      ForEach(this.filteredEntriesFor(mode), (entry: EntryCardModel, index: number) => {
        ListItem() {
          PictureEntryCard({
            entry: {
              id: entry.id,
              feedId: entry.feedId,
              title: entry.title,
              url: '',
              summary: entry.summary,
              content: '',
              author: entry.author,
              publishedAt: Date.now(),
              readingTimeMinutes: 1,
              tags: entry.tags,
              mediaUrls: entry.mediaUrls ?? [],
              isRead: entry.isRead,
              isStarred: entry.isStarred,
              createdAt: 0,
              updatedAt: 0,
            } as Entry,
            theme: this.theme,
            title: entry.feedTitle,
            availableWidth: 320,
            onOpen: () => this.openEntry(entry.id),
          })
        }
      }, (entry: EntryCardModel) => entry.id)
    }
  }
```

And route picture mode to that list:

```ts
      } else if (mode === 'pictures') {
        this.PictureEntryList(mode)
      } else {
        this.EntryList(mode)
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/harmony/tests/livo-models-media-url.test.ts`

Expected: PASS, and picture entries now carry gallery media through the home pipeline.

- [ ] **Step 5: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/models/LivoModels.ets apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/tests/livo-models-media-url.test.ts
git commit -m "feat: render home picture feeds with gallery cards"
```

### Task 5: Run Full Verification for Instagram Picture Presentation

**Files:**
- Verify only: `apps/harmony/tests/discover-remote-search-parsing.test.ts`
- Verify only: `apps/harmony/tests/picture-gallery.test.ts`
- Verify only: `apps/harmony/tests/livo-models-media-url.test.ts`
- Verify only: `apps/harmony/tests/feed-media-url.test.ts`
- Verify only: `apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets`
- Verify only: `apps/harmony/entry/src/main/ets/pages/Index.ets`

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --test apps/harmony/tests/discover-remote-search-parsing.test.ts
node --test apps/harmony/tests/picture-gallery.test.ts
node --test apps/harmony/tests/livo-models-media-url.test.ts
node --test apps/harmony/tests/feed-media-url.test.ts
```

Expected: PASS across all four test files.

- [ ] **Step 2: Run Harmony build**

Run:

```bash
pnpm --dir apps/harmony build:debug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Manual verification checklist**

Verify on device/emulator:

```text
1. 在“发现”页搜索 Instagram 源并进入预览
2. 确认页头不再显示 “public posts - Picnob”
3. 确认每条帖子最后一个 +N 图片格是正常正方形，不再纵向拉长
4. 进入“首页” -> “图片”栏目
5. 确认图片条目按作者/时间 + 图片宫格展示，而不是旧的通用文字卡片
```

- [ ] **Step 4: Commit**

```bash
git add apps/harmony/entry/src/main/ets/common/components/PictureEntryCard.ets apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets apps/harmony/entry/src/main/ets/common/models/LivoModels.ets apps/harmony/entry/src/main/ets/common/utils/PictureGallery.ts apps/harmony/entry/src/main/ets/common/utils/SocialFeedTitles.ts apps/harmony/entry/src/main/ets/pages/Index.ets apps/harmony/tests/discover-remote-search-parsing.test.ts apps/harmony/tests/picture-gallery.test.ts apps/harmony/tests/livo-models-media-url.test.ts
git commit -m "feat: unify harmony instagram picture presentation"
```

## Self-Review

- Spec coverage: covered title cleanup, shared picture card, square `+N` tile, and home-picture-mode rendering.
- Placeholder scan: no `TODO` / `TBD` placeholders remain; each task has explicit files, tests, and commands.
- Type consistency: the plan introduces `mediaUrls` on `EntryCardModel` before home-mode rendering relies on it, and keeps the shared picture card fed by existing `Entry`-shaped data.
