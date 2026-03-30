import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAccountLoginRenderExitMessage,
  resolveAccountLoginWebPolicy,
} from '../entry/src/main/ets/common/utils/AccountLoginWebPolicy.ts'

test('resolveAccountLoginWebPolicy enables window.open support for youtube login', () => {
  const youtubePolicy = resolveAccountLoginWebPolicy('youtube')
  const bilibiliPolicy = resolveAccountLoginWebPolicy('bilibili')

  assert.equal(youtubePolicy.allowWindowOpenMethod, true)
  assert.equal(youtubePolicy.usesExternalBrowser, false)
  assert.equal(bilibiliPolicy.allowWindowOpenMethod, false)
  assert.equal(bilibiliPolicy.usesExternalBrowser, false)
})

test('buildAccountLoginRenderExitMessage surfaces youtube-specific guidance', () => {
  assert.equal(
    buildAccountLoginRenderExitMessage('youtube', 2),
    'Google 登录页渲染进程异常退出，请重试',
  )
  assert.equal(
    buildAccountLoginRenderExitMessage('bilibili', 3),
    '登录页渲染进程异常退出，请重试',
  )
})
