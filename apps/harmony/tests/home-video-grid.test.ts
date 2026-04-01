import test from 'node:test'
import assert from 'node:assert/strict'

import {
  chunkHomeVideoEntries,
  resolveHomeVideoCardTokens,
  resolveHomeVideoCardSubtitle,
  resolveHomeVideoGridColumns,
  resolveHomeVideoSceneKind,
} from '../entry/src/main/ets/common/utils/HomeVideoGrid.ts'

test('resolveHomeVideoGridColumns keeps the home video feed in two columns', () => {
  assert.equal(resolveHomeVideoGridColumns(), 2)
})

test('resolveHomeVideoCardSubtitle prefers feed title for home video cards', () => {
  assert.equal(
    resolveHomeVideoCardSubtitle({
      feedTitle: '小Lin说 - YouTube',
      author: '小Lin说',
      publishedLabel: '6天前',
    }),
    '小Lin说 - YouTube',
  )
})

test('resolveHomeVideoCardSubtitle falls back to author when feed title is absent', () => {
  assert.equal(
    resolveHomeVideoCardSubtitle({
      feedTitle: '',
      author: '',
      publishedLabel: '6天前',
    }),
    '6天前',
  )
})

test('resolveHomeVideoCardSubtitle returns empty string when all subtitle fields are absent', () => {
  assert.equal(
    resolveHomeVideoCardSubtitle({
      feedTitle: '',
      author: '',
      publishedLabel: '',
    }),
    '',
  )
})

test('resolveHomeVideoSceneKind uses grid scene for videos mode', () => {
  assert.equal(resolveHomeVideoSceneKind('videos'), 'grid')
})

test('resolveHomeVideoSceneKind keeps list scene for articles mode', () => {
  assert.equal(resolveHomeVideoSceneKind('articles'), 'list')
})

test('chunkHomeVideoEntries groups entries into two-column rows', () => {
  const rows = chunkHomeVideoEntries([
    { id: '1' } as never,
    { id: '2' } as never,
    { id: '3' } as never,
  ])

  assert.deepEqual(
    rows.map((row) => row.map((entry) => entry.id)),
    [['1', '2'], ['3']],
  )
})

test('resolveHomeVideoCardTokens uses lighter chrome in light mode', () => {
  const tokens = resolveHomeVideoCardTokens({
    isDark: false,
    elevated: '#EDF1F5',
    textPrimary: '#111111',
    textSecondary: '#4B5563',
  })

  assert.deepEqual(tokens, {
    placeholderBackground: '#EDF1F5',
    titleColor: '#111111',
    metaColor: '#4B5563',
  })
})

test('resolveHomeVideoCardTokens keeps strong contrast in dark mode', () => {
  const tokens = resolveHomeVideoCardTokens({
    isDark: true,
    elevated: '#242A33',
    textPrimary: '#FFFFFF',
    textSecondary: '#D3D8E1',
  })

  assert.deepEqual(tokens, {
    placeholderBackground: '#242A33',
    titleColor: '#FFFFFF',
    metaColor: '#D3D8E1',
  })
})
