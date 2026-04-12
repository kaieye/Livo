import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

import { selectArticleVideoUrls } from '../entry/src/main/ets/common/utils/ArticleVideoSource.ts'

const livoModelsSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'apps/harmony/entry/src/main/ets/common/models/LivoModels.ets',
  ),
  'utf8',
)

function loadSelectPictureMediaUrls(): (mediaUrls: string[]) => string[] {
  const match = livoModelsSource.match(
    /export function selectPictureMediaUrls\(mediaUrls: string\[\]\): string\[\] \{[\s\S]*?\n\}/,
  )

  assert.ok(match, 'expected selectPictureMediaUrls helper in LivoModels.ets')

  const plainFunctionSource = match[0]
    .replace('export function', 'function')
    .replace('(mediaUrls: string[]): string[]', '(mediaUrls)')
    .replaceAll('(url: string)', '(url)')
    .replace('const result: string[] = []', 'const result = []')

  const script = `${plainFunctionSource}\nmodule.exports = selectPictureMediaUrls;`
  const context = {
    module: { exports: undefined as unknown },
  }

  vm.runInNewContext(script, context)
  return context.module.exports as (mediaUrls: string[]) => string[]
}

test('selectArticleVideoUrls prioritizes direct media urls from feed metadata', () => {
  const videoUrls = selectArticleVideoUrls(
    '',
    ['https://cdn.example.com/video.mp4'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  )

  assert.deepEqual(videoUrls, ['https://cdn.example.com/video.mp4'])
})

test('selectArticleVideoUrls falls back to extracted article video urls when feed media urls are absent', () => {
  const videoUrls = selectArticleVideoUrls(
    '',
    [],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  )

  assert.deepEqual(videoUrls, ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'])
})

test('selectArticleVideoUrls falls back to supported video page urls from feed metadata when direct media urls are absent', () => {
  const videoUrls = selectArticleVideoUrls(
    '',
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://www.youtube.com/channel/UC1234567890'],
  )

  assert.deepEqual(videoUrls, ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'])
})

test('selectArticleVideoUrls keeps only unique direct media urls when available', () => {
  const videoUrls = selectArticleVideoUrls(
    '',
    [
      'https://cdn.example.com/video.mp4',
      'https://cdn.example.com/video.mp4',
      'https://cdn.example.com/video.m3u8',
    ],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  )

  assert.deepEqual(videoUrls, [
    'https://cdn.example.com/video.mp4',
    'https://cdn.example.com/video.m3u8',
  ])
})

test('selectArticleVideoUrls prefers article watch url over feed embed-like youtube urls', () => {
  const videoUrls = selectArticleVideoUrls(
    'https://www.youtube.com/watch?v=HeVuAKDtWX8',
    ['https://www.youtube.com/watch?v=HeVuAKDtWX8'],
    ['https://www.youtube.com/watch?v=HeVuAKDtWX8'],
  )

  assert.deepEqual(videoUrls, ['https://www.youtube.com/watch?v=HeVuAKDtWX8'])
})

test('EntryCardModel keeps picture card source fields for the home pictures stream', () => {
  assert.match(livoModelsSource, /mediaUrls\?: string\[]/)
  assert.match(livoModelsSource, /rawMediaUrls\?: string\[]/)
  assert.match(livoModelsSource, /articleUrl: string/)
  assert.match(livoModelsSource, /publishedAt: number/)
})

test('toEntryCardModel maps raw picture card fields from entry data', () => {
  assert.match(
    livoModelsSource,
    /export function toEntryCardModel\(entry: Entry, feed: Feed\): EntryCardModel/,
  )

  assert.match(
    livoModelsSource,
    /const pictureMediaUrls = extractEntryGalleryImageUrls\(\{[\s\S]*summary: entry\.summary,[\s\S]*content: entry\.content,[\s\S]*articleUrl: entry\.url,[\s\S]*siteUrl: feed\.siteUrl \?\? feed\.url,[\s\S]*mediaUrls: entry\.mediaUrls \?\? \[\],[\s\S]*\}\)/,
  )
  assert.match(livoModelsSource, /articleUrl:\s*entry\.url/)
  assert.match(livoModelsSource, /publishedAt:\s*entry\.publishedAt/)
  assert.match(livoModelsSource, /content:\s*entry\.content/)
  assert.match(
    livoModelsSource,
    /mediaUrls:\s*selectPictureMediaUrls\(pictureMediaUrls\)/,
  )
  assert.match(
    livoModelsSource,
    /rawMediaUrls:\s*extractPictureCarouselMediaUrls\(\{/,
  )
})

test('selectPictureMediaUrls keeps image urls and excludes obvious non-picture media', () => {
  const selectPictureMediaUrls = loadSelectPictureMediaUrls()

  assert.deepEqual(
    Array.from(
      selectPictureMediaUrls([
        'https://cdn.example.com/photo.jpg',
        'https://cdn.example.com/photo.jpg',
        'https://cdn.example.com/clip.mp4',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://scontent.cdninstagram.com/v/t51.2885-15/987654321?stp=dst-jpg_e35',
        'https://cdn.example.com/gallery/image.webp?size=large',
        'https://example.com/post/123',
      ]),
    ),
    [
      'https://cdn.example.com/photo.jpg',
      'https://scontent.cdninstagram.com/v/t51.2885-15/987654321?stp=dst-jpg_e35',
      'https://cdn.example.com/gallery/image.webp?size=large',
    ],
  )
})

test('selectPictureMediaUrls keeps googleusercontent and ytimg image hosts', () => {
  const selectPictureMediaUrls = loadSelectPictureMediaUrls()

  assert.deepEqual(
    Array.from(
      selectPictureMediaUrls([
        'https://lh3.googleusercontent.com/abc123=s1600-rw',
        'https://i.ytimg.com/vi/demo/hqdefault.jpg',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      ]),
    ),
    [
      'https://lh3.googleusercontent.com/abc123=s1600-rw',
      'https://i.ytimg.com/vi/demo/hqdefault.jpg',
    ],
  )
})

test('toEntryCardModel derives picture gallery urls from html when mediaUrls are absent', () => {
  assert.match(
    livoModelsSource,
    /const pictureMediaUrls = extractEntryGalleryImageUrls\(\{[\s\S]*summary: entry\.summary,[\s\S]*content: entry\.content,[\s\S]*articleUrl: entry\.url,[\s\S]*siteUrl: feed\.siteUrl \?\? feed\.url,[\s\S]*mediaUrls: entry\.mediaUrls \?\? \[\],[\s\S]*\}\)/,
  )
})

test('toArticleDetailModel uses picture-specific media parsing for picture feeds', () => {
  assert.match(
    livoModelsSource,
    /const blocks = feed\.view === FeedViewType\.Pictures\s*\? buildPictureDetailContentBlocks\(entry, feed, card\.imageUrl\)\s*:\s*buildArticleContentBlocks\(entry\.content, entry\.url \|\| feed\.siteUrl \|\| feed\.url, entry\.url, entry\.mediaUrls \?\? \[\]\)/s,
  )
  assert.match(
    livoModelsSource,
    /function buildPictureDetailContentBlocks\(entry: Entry, feed: Feed, fallbackImageUrl: string\): ArticleContentBlock\[]/,
  )
  assert.match(
    livoModelsSource,
    /const orderedMediaUrls = extractPictureCarouselMediaUrls\(\{/,
  )
  assert.match(
    livoModelsSource,
    /const mediaItems = resolvePictureCarouselMediaItems\(orderedMediaUrls, fallbackImageUrl\)/,
  )
  assert.match(
    livoModelsSource,
    /type: 'video',\s*text: '',\s*imageUrl: item\.imageUrl \|\| fallbackImageUrl,\s*videoUrl: item\.videoUrl/s,
  )
  assert.match(
    livoModelsSource,
    /type: 'image',\s*text: '',\s*imageUrl: item\.imageUrl,\s*videoUrl: ''/s,
  )
})
