import test from 'node:test'
import assert from 'node:assert/strict'
import { accountCardHeadlineStatus } from '../entry/src/main/ets/common/utils/AccountCardHeadline.ts'

test('accountCardHeadlineStatus shows username when linked', () => {
  assert.equal(accountCardHeadlineStatus(true, 'Ch0s1nz', ''), 'Ch0s1nz')
})

test('accountCardHeadlineStatus shows unlinked label when not linked', () => {
  assert.equal(accountCardHeadlineStatus(false, '', ''), '未关联')
})

test('accountCardHeadlineStatus shows action-needed label when error exists', () => {
  assert.equal(
    accountCardHeadlineStatus(false, '', '打开账号关联页面失败'),
    '需处理',
  )
})
