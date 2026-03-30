import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLinkNavigationFailureStatus } from '../entry/src/main/ets/common/utils/AccountNavigationError.ts'

test('buildLinkNavigationFailureStatus preserves current account state while surfacing route failure', () => {
  const status = buildLinkNavigationFailureStatus(
    'bilibili',
    false,
    '',
    '打开账号关联页面失败：路由实例不可用',
  )

  assert.deepEqual(status, {
    provider: 'bilibili',
    linked: false,
    displayName: '',
    error: '打开账号关联页面失败：路由实例不可用',
  })
})
