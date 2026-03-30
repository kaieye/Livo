import test from 'node:test'
import assert from 'node:assert/strict'
import { accountCardRenderKey } from '../entry/src/main/ets/common/utils/AccountCardRenderKey.ts'

test('accountCardRenderKey changes when linked status changes', () => {
  const before = accountCardRenderKey('bilibili', false, '', '')
  const after = accountCardRenderKey('bilibili', true, 'Ch0s1nz', '')

  assert.notEqual(before, after)
})

test('accountCardRenderKey changes when displayName changes', () => {
  const before = accountCardRenderKey('bilibili', true, 'Bilibili 已关联', '')
  const after = accountCardRenderKey('bilibili', true, 'Ch0s1nz', '')

  assert.notEqual(before, after)
})
