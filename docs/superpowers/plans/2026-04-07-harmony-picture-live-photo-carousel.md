# Harmony Picture Live Photo Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Harmony 图片栏目卡片把静态图和 live 图片一起放进轮播，并支持卡片内播放 live 图片。

**Architecture:** 保持现有图片卡片结构不变，在 `EntryCardModel` 上补充原始媒体 URL 供图片流使用，再通过 `PictureGallery.ts` 解析出 `image/livePhoto` 轮播项。`PictureEntryCard.ets` 只消费解析后的媒体项，根据当前页状态在封面和 `Video` 之间切换。

**Tech Stack:** ArkTS, ArkUI `Swiper`/`Video`, Node `node:test`

---

### Task 1: Add failing media parsing tests

**Files:**

- Modify: `apps/harmony/tests/picture-gallery.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('resolvePictureCarouselMediaItems groups adjacent image and video as a live photo slide', () => {
  const items = resolvePictureCarouselMediaItems(
    [
      'https://cdn.example.com/one.jpg',
      'https://cdn.example.com/live.mp4',
      'https://cdn.example.com/two.jpg',
    ],
    'https://cdn.example.com/fallback.jpg',
  )

  assert.deepEqual(items, [
    {
      kind: 'livePhoto',
      imageUrl: 'https://cdn.example.com/one.jpg',
      videoUrl: 'https://cdn.example.com/live.mp4',
    },
    {
      kind: 'image',
      imageUrl: 'https://cdn.example.com/two.jpg',
      videoUrl: '',
    },
  ])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/picture-gallery.test.ts`
Expected: FAIL because `resolvePictureCarouselMediaItems` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface PictureCarouselMediaItem {
  kind: 'image' | 'livePhoto'
  imageUrl: string
  videoUrl: string
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/picture-gallery.test.ts`
Expected: PASS

### Task 2: Add failing model/source regression tests

**Files:**

- Modify: `apps/harmony/tests/livo-models-media-url.test.ts`
- Modify: `apps/harmony/tests/source-regressions.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
assert.match(livoModelsSource, /rawMediaUrls\?: string\[]/)
assert.match(returnedObjectSource, /rawMediaUrls:/)
assert.match(source, /Swiper\(\)/)
assert.match(source, /Video\(\{/)
assert.match(source, /private playLivePhoto/)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/livo-models-media-url.test.ts tests/source-regressions.test.ts`
Expected: FAIL because the raw media field and live-photo card behavior are not implemented.

- [ ] **Step 3: Write minimal implementation**

```ts
rawMediaUrls: selectPictureCarouselMediaUrls(
  entry.mediaUrls ?? [],
  pictureMediaUrls,
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/livo-models-media-url.test.ts tests/source-regressions.test.ts`
Expected: PASS

### Task 3: Implement picture card live-photo playback

**Files:**

- Modify: `apps/harmony/entry/src/main/ets/common/models/LivoModels.ets`
- Modify: `apps/harmony/entry/src/main/ets/common/utils/PictureGallery.ts`
- Modify: `apps/harmony/entry/src/main/ets/common/components/PictureEntryCard.ets`
- Modify: `apps/harmony/entry/src/main/ets/pages/Index.ets`

- [ ] **Step 1: Implement the minimal parsing helpers**

```ts
export function selectPictureCarouselMediaUrls(
  mediaUrls: string[],
  fallbackImageUrls: string[] = [],
): string[] {
  return uniqueUrls([...mediaUrls, ...fallbackImageUrls]).filter(
    (url) => isImageUrl(url) || isDirectVideoUrl(url),
  )
}
```

- [ ] **Step 2: Render mixed `Swiper` slides in the card**

```ts
if (item.kind === 'livePhoto' && this.activeLivePhotoIndex === index) {
  Video({
    src: item.videoUrl,
    controller: this.livePhotoController,
    previewUri: item.imageUrl,
  })
} else {
  Image(item.imageUrl || this.pictureUrl)
}
```

- [ ] **Step 3: Reset playback on slide change**

```ts
.onChange((index: number) => {
  this.stopLivePhotoPlayback()
  this.activeMediaIndex = index
})
```

- [ ] **Step 4: Run targeted tests**

Run: `node --test tests/picture-gallery.test.ts tests/livo-models-media-url.test.ts tests/source-regressions.test.ts`
Expected: PASS
