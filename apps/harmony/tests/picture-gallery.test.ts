import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createPictureGalleryTiles,
  extractEntryGalleryImageUrls,
  extractPictureCarouselMediaUrls,
  resolvePictureCarouselMediaItems,
  resolvePictureGalleryColumns,
  shouldUseCachedPicturePreview,
} from '../entry/src/main/ets/common/utils/PictureGallery.ts'

test('extractEntryGalleryImageUrls prefers distinct media urls for instagram gallery entries', () => {
  const urls = extractEntryGalleryImageUrls({
    summary: '',
    content: '',
    articleUrl: 'https://www.instagram.com/p/demo/',
    siteUrl: 'https://www.instagram.com/du_chenduling/',
    mediaUrls: [
      'https://scontent.cdninstagram.com/v/t51.2885-15/1?stp=dst-jpg_e35',
      'https://scontent.cdninstagram.com/v/t51.2885-15/2?stp=dst-jpg_e35',
      'https://scontent.cdninstagram.com/v/t51.2885-15/1?stp=dst-jpg_e35',
    ],
  })

  assert.deepEqual(urls, [
    'https://scontent.cdninstagram.com/v/t51.2885-15/1?stp=dst-jpg_e35',
    'https://scontent.cdninstagram.com/v/t51.2885-15/2?stp=dst-jpg_e35',
  ])
})

test('extractEntryGalleryImageUrls falls back to img tags in entry html', () => {
  const urls = extractEntryGalleryImageUrls({
    summary: '',
    content: `
      <p>caption</p>
      <img src="/images/a.jpg" />
      <img data-src="https://cdn.example.com/b.webp" />
    `,
    articleUrl: 'https://feeds.example.com/posts/1',
    siteUrl: 'https://feeds.example.com',
    mediaUrls: [],
  })

  assert.deepEqual(urls, [
    'https://feeds.example.com/images/a.jpg',
    'https://cdn.example.com/b.webp',
  ])
})

test('extractEntryGalleryImageUrls keeps special image hosts from html and media urls', () => {
  const urls = extractEntryGalleryImageUrls({
    summary: '<img src="https://lh3.googleusercontent.com/abc123=s1600-rw" />',
    content: '',
    articleUrl: 'https://feeds.example.com/posts/2',
    siteUrl: 'https://feeds.example.com',
    mediaUrls: ['https://i.ytimg.com/vi/demo/hqdefault.jpg'],
  })

  assert.deepEqual(urls, ['https://i.ytimg.com/vi/demo/hqdefault.jpg'])
})

test('resolvePictureCarouselMediaItems groups adjacent image and direct video as a live photo slide', () => {
  const items = resolvePictureCarouselMediaItems([
    'https://cdn.example.com/live-cover.jpg',
    'https://cdn.example.com/live-motion.mp4',
    'https://cdn.example.com/follow-up.jpg',
  ])

  assert.deepEqual(items, [
    {
      kind: 'livePhoto',
      imageUrl: 'https://cdn.example.com/live-cover.jpg',
      videoUrl: 'https://cdn.example.com/live-motion.mp4',
    },
    {
      kind: 'image',
      imageUrl: 'https://cdn.example.com/follow-up.jpg',
      videoUrl: '',
    },
  ])
})

test('resolvePictureCarouselMediaItems falls back to the card image when direct video has no adjacent cover', () => {
  const items = resolvePictureCarouselMediaItems(
    ['https://cdn.example.com/live-only.mov'],
    'https://cdn.example.com/card-cover.jpg',
  )

  assert.deepEqual(items, [
    {
      kind: 'livePhoto',
      imageUrl: 'https://cdn.example.com/card-cover.jpg',
      videoUrl: 'https://cdn.example.com/live-only.mov',
    },
  ])
})

test('extractPictureCarouselMediaUrls preserves mixed image and live-video order from html content', () => {
  const urls = extractPictureCarouselMediaUrls({
    summary: '',
    content: `
      <p>caption</p>
      <img src="https://cdn.example.com/cover-1.jpg" />
      <video src="https://cdn.example.com/live-1.mp4"></video>
      <img src="https://cdn.example.com/cover-2.jpg" />
    `,
    articleUrl: 'https://www.instagram.com/p/demo/',
    siteUrl: 'https://www.instagram.com/demo/',
    mediaUrls: [],
  })

  assert.deepEqual(urls, [
    'https://cdn.example.com/cover-1.jpg',
    'https://cdn.example.com/live-1.mp4',
    'https://cdn.example.com/cover-2.jpg',
  ])
})

test('resolvePictureGalleryColumns matches desktop-like density', () => {
  assert.equal(resolvePictureGalleryColumns(1), 1)
  assert.equal(resolvePictureGalleryColumns(2), 2)
  assert.equal(resolvePictureGalleryColumns(4), 2)
  assert.equal(resolvePictureGalleryColumns(5), 3)
})

test('createPictureGalleryTiles keeps instagram overflow tile square and marks remaining count', () => {
  const tiles = createPictureGalleryTiles([
    'https://cdn.example.com/1.jpg',
    'https://cdn.example.com/2.jpg',
    'https://cdn.example.com/3.jpg',
    'https://cdn.example.com/4.jpg',
    'https://cdn.example.com/5.jpg',
    'https://cdn.example.com/6.jpg',
    'https://cdn.example.com/7.jpg',
    'https://cdn.example.com/8.jpg',
    'https://cdn.example.com/9.jpg',
    'https://cdn.example.com/10.jpg',
    'https://cdn.example.com/11.jpg',
  ])

  assert.equal(tiles.length, 9)
  assert.equal(tiles[0]?.width, '32%')
  assert.equal(tiles[8]?.width, '32%')
  assert.equal(tiles[8]?.isSquare, true)
  assert.equal(tiles[8]?.overflowCount, 2)
})

test('createPictureGalleryTiles uses two columns for four pictures without overflow badge', () => {
  const tiles = createPictureGalleryTiles([
    'https://cdn.example.com/1.jpg',
    'https://cdn.example.com/2.jpg',
    'https://cdn.example.com/3.jpg',
    'https://cdn.example.com/4.jpg',
  ])

  assert.equal(tiles.length, 4)
  assert.equal(tiles[0]?.width, '49%')
  assert.equal(tiles[3]?.overflowCount, 0)
  assert.equal(
    tiles.every((tile) => tile.isSquare),
    true,
  )
})

test('shouldUseCachedPicturePreview requires picture entries to be present', () => {
  assert.equal(shouldUseCachedPicturePreview(false, undefined), false)
  assert.equal(shouldUseCachedPicturePreview(true, undefined), false)
  assert.equal(
    shouldUseCachedPicturePreview(false, {
      entries: [],
    }),
    false,
  )
  assert.equal(
    shouldUseCachedPicturePreview(false, {
      entries: [{ id: '1' }],
    }),
    false,
  )
  assert.equal(
    shouldUseCachedPicturePreview(true, {
      etag: '',
      lastModified: '',
      feedTitle: 'Feed',
      siteUrl: 'https://www.instagram.com/demo/',
      imageUrl: '',
      description: '',
      entries: [],
    }),
    false,
  )
  assert.equal(
    shouldUseCachedPicturePreview(true, {
      etag: '',
      lastModified: '',
      feedTitle: 'Feed',
      siteUrl: 'https://www.instagram.com/demo/',
      imageUrl: '',
      description: '',
      entries: [{ id: '1' }],
    } as never),
    true,
  )
  assert.equal(
    shouldUseCachedPicturePreview(false, {
      etag: '',
      lastModified: '',
      feedTitle: 'Feed',
      siteUrl: '',
      imageUrl: '',
      description: '',
      entries: [{ id: '1' }],
    } as never),
    true,
  )
})
