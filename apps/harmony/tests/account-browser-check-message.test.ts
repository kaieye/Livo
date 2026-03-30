import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveExternalBrowserCheckMessage } from '../entry/src/main/ets/common/utils/AccountBrowserCheckMessage.ts'

test('resolveExternalBrowserCheckMessage returns actionable youtube guidance when still unlinked', () => {
  assert.equal(
    resolveExternalBrowserCheckMessage('youtube', false, ''),
    '未检测到可自动确认的 YouTube 登录状态，请在浏览器完成登录后手动保存账号名',
  )
})

test('resolveExternalBrowserCheckMessage prefers linked display name when available', () => {
  assert.equal(
    resolveExternalBrowserCheckMessage('youtube', true, 'Ch0s1nz'),
    '检查完成：已关联 Ch0s1nz',
  )
})
