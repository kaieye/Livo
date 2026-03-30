import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveBilibiliStoredState } from '../entry/src/main/ets/common/utils/BilibiliAccountStatus.ts'

test('resolveBilibiliStoredState treats sessdata-only storage as linked', () => {
  const result = resolveBilibiliStoredState({
    linked: false,
    displayName: '',
    sessdata: 'abcd1234',
  })

  assert.equal(result.shouldTreatAsLinked, true)
  assert.equal(result.displayName, 'Bilibili 已关联')
})

test('resolveBilibiliStoredState preserves display name when linked', () => {
  const result = resolveBilibiliStoredState({
    linked: true,
    displayName: '测试用户',
    sessdata: '',
  })

  assert.equal(result.shouldTreatAsLinked, true)
  assert.equal(result.displayName, '测试用户')
})
