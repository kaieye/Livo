import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeStatusWithAccountLinkResult } from '../entry/src/main/ets/common/utils/AccountLinkResult.ts'

test('mergeStatusWithAccountLinkResult promotes provider to linked when storage link result is newer', () => {
  const merged = mergeStatusWithAccountLinkResult(
    'bilibili',
    {
      linked: false,
      displayName: '',
      error: '',
    },
    'Bilibili',
    {
      provider: 'bilibili',
      displayName: '测试账号',
      linked: true,
    },
  )

  assert.deepEqual(merged, {
    linked: true,
    displayName: '测试账号',
    error: '',
  })
})

test('mergeStatusWithAccountLinkResult keeps successful linked status but fills displayName from storage result', () => {
  const merged = mergeStatusWithAccountLinkResult(
    'bilibili',
    {
      linked: true,
      displayName: '',
      error: '',
    },
    'Bilibili',
    {
      provider: 'bilibili',
      displayName: 'Bilibili 已关联',
      linked: true,
    },
  )

  assert.equal(merged.linked, true)
  assert.equal(merged.displayName, 'Bilibili 已关联')
  assert.equal(merged.error, '')
})
