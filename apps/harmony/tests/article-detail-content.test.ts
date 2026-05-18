import test from 'node:test'
import assert from 'node:assert/strict'

import {
  articleImageBlockServesAsVideoCover,
  resolveArticleVideoPreviewImage,
  resolvePictureDetailMediaItems,
  resolvePictureDetailTextBlocks,
  shouldRenderArticleParagraphBlock,
  shouldRenderArticleSummary,
} from '../entry/src/main/ets/common/utils/article/ArticleDetailContent.ts'

test('article detail summary hides duplicated title and opening paragraph', () => {
  assert.equal(
    shouldRenderArticleSummary({
      title: 'Launch Notes',
      summary: 'Launch Notes',
      contentParagraphs: ['Different body'],
      contentBlocks: [],
    }),
    false,
  )

  assert.equal(
    shouldRenderArticleSummary({
      title: 'Launch Notes',
      summary: 'The first paragraph repeats here.',
      contentParagraphs: ['The first paragraph repeats here.'],
      contentBlocks: [],
    }),
    false,
  )
})

test('article detail paragraph hides empty text and duplicated lead summary', () => {
  const entry = {
    title: 'A clean article',
    summary: 'This is the useful summary',
    contentParagraphs: ['Opening paragraph keeps the summary visible'],
    contentBlocks: [],
  }

  assert.equal(
    shouldRenderArticleParagraphBlock(
      entry,
      { type: 'paragraph', text: '   ' },
      0,
    ),
    false,
  )
  assert.equal(
    shouldRenderArticleParagraphBlock(
      entry,
      { type: 'paragraph', text: 'This is the useful summary' },
      0,
    ),
    false,
  )
  assert.equal(
    shouldRenderArticleParagraphBlock(
      entry,
      { type: 'paragraph', text: 'A later body paragraph' },
      3,
    ),
    true,
  )
})

test('picture detail helpers split media and text blocks', () => {
  const blocks = [
    { type: 'paragraph', text: 'caption' },
    { type: 'video', imageUrl: 'cover.jpg', videoUrl: 'live.mp4' },
    { type: 'image', imageUrl: 'still.jpg' },
  ]

  assert.deepEqual(resolvePictureDetailTextBlocks(blocks), [
    { type: 'paragraph', text: 'caption' },
  ])
  assert.deepEqual(resolvePictureDetailMediaItems(blocks), [
    { kind: 'livePhoto', imageUrl: 'cover.jpg', videoUrl: 'live.mp4' },
    { kind: 'image', imageUrl: 'still.jpg', videoUrl: '' },
  ])
})

test('video preview helpers keep trailing image as cover without rendering it twice', () => {
  const blocks = [
    { type: 'video', videoUrl: 'clip.mp4' },
    { type: 'image', imageUrl: 'cover.jpg' },
  ]

  assert.equal(
    resolveArticleVideoPreviewImage(blocks, blocks[0], 0),
    'cover.jpg',
  )
  assert.equal(articleImageBlockServesAsVideoCover(blocks, 1), true)
})
