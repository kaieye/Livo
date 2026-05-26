import test from 'node:test'
import assert from 'node:assert/strict'

import {
  articleImageBlockServesAsVideoCover,
  resolveArticleVideoPreviewImage,
  resolvePictureDetailMediaItems,
  resolvePictureDetailTextBlocks,
  shouldRenderArticleParagraphBlock,
  shouldRenderArticleSummary,
} from '../entry/src/main/ets/common/coordinators/article/ArticleDetailContent.ts'

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

test('article detail paragraph dedup uses paragraph index not block index', () => {
  const videoBlock = {
    type: 'video',
    videoUrl: 'https://youtube.com/watch?v=abc',
  }
  const firstPara = {
    type: 'paragraph',
    text: 'Detailed paragraph one with lots of information',
  }
  const dupParagraph = { type: 'paragraph', text: 'Brief overview' }
  const laterParagraph = {
    type: 'paragraph',
    text: 'Detailed paragraph two with even more information',
  }

  const entry = {
    title: 'A video title',
    summary: 'Brief overview',
    contentParagraphs: [
      'Detailed paragraph one with lots of information',
      'Brief overview',
      'Detailed paragraph two with even more information',
    ],
    contentBlocks: [videoBlock, firstPara, dupParagraph, laterParagraph],
  }

  assert.equal(
    shouldRenderArticleSummary(entry),
    false,
    'summary should be hidden when it matches a content block paragraph',
  )
  assert.equal(
    shouldRenderArticleParagraphBlock(entry, firstPara, 1),
    true,
    'first unique paragraph should be shown even when summary is hidden',
  )
  assert.equal(
    shouldRenderArticleParagraphBlock(entry, dupParagraph, 2),
    true,
    'when summary is hidden, all paragraphs including duplicates are shown',
  )
  assert.equal(
    shouldRenderArticleParagraphBlock(entry, laterParagraph, 3),
    true,
    'later unique paragraph should be shown',
  )
})

test('article detail summary dedup checks all content block paragraphs', () => {
  const blocks = [
    { type: 'video', videoUrl: 'https://youtube.com/watch?v=xyz' },
    { type: 'paragraph', text: 'First paragraph different from summary' },
    { type: 'paragraph', text: 'Second paragraph also different' },
    { type: 'paragraph', text: 'This matches the summary exactly' },
  ]

  const entry = {
    title: 'Video Title',
    summary: 'This matches the summary exactly',
    contentParagraphs: [
      'First paragraph different from summary',
      'Second paragraph also different',
      'This matches the summary exactly',
    ],
    contentBlocks: blocks,
  }

  assert.equal(
    shouldRenderArticleSummary(entry),
    false,
    'summary should be hidden when it matches any content block paragraph',
  )
})

test('article detail paragraph dedup works with video block before paragraph when summary is shown', () => {
  const videoBlock = {
    type: 'video',
    videoUrl: 'https://youtube.com/watch?v=abc',
    imageUrl: '',
  }
  const imageBlock = {
    type: 'image',
    imageUrl: 'https://img.youtube.com/vi/abc/hqdefault.jpg',
  }
  const firstPara = {
    type: 'paragraph',
    text: 'Detailed opening paragraph with original info',
  }
  const dupParagraph = { type: 'paragraph', text: 'Unique video description' }
  const otherParagraph = {
    type: 'paragraph',
    text: 'Completely different closing text',
  }

  const entry = {
    title: 'My Video',
    summary: 'Unique video description',
    contentParagraphs: [
      'Detailed opening paragraph with original info',
      'Unique video description',
      'Completely different closing text',
    ],
    contentBlocks: [
      videoBlock,
      imageBlock,
      firstPara,
      dupParagraph,
      otherParagraph,
    ],
  }

  assert.equal(
    shouldRenderArticleSummary(entry),
    false,
    'summary should be hidden when it matches a paragraph in content blocks',
  )
  assert.equal(
    shouldRenderArticleParagraphBlock(entry, firstPara, 2),
    true,
    'first unique paragraph should be shown when summary is hidden',
  )
  assert.equal(
    shouldRenderArticleParagraphBlock(entry, dupParagraph, 3),
    true,
    'when summary is hidden, all paragraphs are shown including ones matching summary',
  )
  assert.equal(
    shouldRenderArticleParagraphBlock(entry, otherParagraph, 4),
    true,
    'paragraph with different content should still be shown',
  )
})

test('article detail paragraph dedup hides paragraphs that match summary when summary is shown', () => {
  const videoBlock = {
    type: 'video',
    videoUrl: 'https://youtube.com/watch?v=abc',
    imageUrl: '',
  }
  const imageBlock = {
    type: 'image',
    imageUrl: 'https://img.youtube.com/vi/abc/hqdefault.jpg',
  }
  const firstPara = {
    type: 'paragraph',
    text: 'Detailed opening paragraph with original info',
  }
  const dupParagraph = { type: 'paragraph', text: 'Unique video description' }
  const otherParagraph = {
    type: 'paragraph',
    text: 'Completely different closing text',
  }

  const entry = {
    title: 'My Video',
    summary: 'Unique video description not found in paragraphs',
    contentParagraphs: [
      'Detailed opening paragraph with original info',
      'Unique video description',
      'Completely different closing text',
    ],
    contentBlocks: [
      videoBlock,
      imageBlock,
      firstPara,
      dupParagraph,
      otherParagraph,
    ],
  }

  assert.equal(
    shouldRenderArticleSummary(entry),
    true,
    'summary should be shown when it does not appear in any paragraph',
  )
  assert.equal(
    shouldRenderArticleParagraphBlock(entry, firstPara, 2),
    true,
    'first unique paragraph should be shown',
  )
  assert.equal(
    shouldRenderArticleParagraphBlock(entry, dupParagraph, 3),
    false,
    'paragraph duplicating summary should be hidden even at block index 3',
  )
  assert.equal(
    shouldRenderArticleParagraphBlock(entry, otherParagraph, 4),
    true,
    'paragraph with different content should still be shown',
  )
})

test('article detail summary dedup checks all content block paragraphs', () => {
  const blocks = [
    { type: 'video', videoUrl: 'https://youtube.com/watch?v=xyz' },
    { type: 'paragraph', text: 'First paragraph different from summary' },
    { type: 'paragraph', text: 'Second paragraph also different' },
    { type: 'paragraph', text: 'This matches the summary exactly' },
  ]

  const entry = {
    title: 'Video Title',
    summary: 'This matches the summary exactly',
    contentParagraphs: [
      'First paragraph different from summary',
      'Second paragraph also different',
      'This matches the summary exactly',
    ],
    contentBlocks: blocks,
  }

  assert.equal(
    shouldRenderArticleSummary(entry),
    false,
    'summary should be hidden when it matches any content block paragraph',
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
