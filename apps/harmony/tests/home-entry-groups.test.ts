import test from 'node:test'
import assert from 'node:assert/strict'
import { groupHomeEntriesByMode } from '../entry/src/main/ets/common/utils/HomeEntryGroups.ts'
import type { EntryCardModel } from '../entry/src/main/ets/common/models/LivoModels.ets'

function createEntry(id: string, viewLabel: string): EntryCardModel {
  return {
    id,
    feedId: `feed-${id}`,
    title: `title-${id}`,
    summary: `summary-${id}`,
    imageUrl: '',
    feedImageUrl: '',
    author: '',
    articleUrl: '',
    publishedAt: 0,
    publishedLabel: '',
    readingLabel: '',
    tags: [],
    mediaUrls: [],
    feedTitle: '',
    feedCategory: '',
    viewLabel,
    viewBadgeColor: '',
    hasVideoMedia: false,
    isRead: false,
    isStarred: false,
  }
}

test('groupHomeEntriesByMode groups featured entries by home mode label', () => {
  const groups = groupHomeEntriesByMode([
    createEntry('1', '文章'),
    createEntry('2', '社交'),
    createEntry('3', '图片'),
    createEntry('4', '视频'),
    createEntry('5', '文章'),
  ])

  assert.deepEqual(
    groups.articles.map((entry) => entry.id),
    ['1', '5'],
  )
  assert.deepEqual(
    groups.social.map((entry) => entry.id),
    ['2'],
  )
  assert.deepEqual(
    groups.pictures.map((entry) => entry.id),
    ['3'],
  )
  assert.deepEqual(
    groups.videos.map((entry) => entry.id),
    ['4'],
  )
})

test('groupHomeEntriesByMode ignores entries with unknown labels', () => {
  const groups = groupHomeEntriesByMode([
    createEntry('1', '未知'),
    createEntry('2', '文章'),
  ])

  assert.deepEqual(
    groups.articles.map((entry) => entry.id),
    ['2'],
  )
  assert.deepEqual(groups.social, [])
  assert.deepEqual(groups.pictures, [])
  assert.deepEqual(groups.videos, [])
})
