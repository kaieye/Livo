import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectBilibiliLogin,
  detectBilibiliPageLoggedIn,
  hasBilibiliLoginMarker,
} from '../entry/src/main/ets/common/utils/BilibiliLoginDetection.ts'

test('hasBilibiliLoginMarker tolerates whitespace around isLogin', () => {
  assert.equal(hasBilibiliLoginMarker('{"isLogin": true}'), true)
  assert.equal(hasBilibiliLoginMarker('{"isLogin" : true}'), true)
  assert.equal(hasBilibiliLoginMarker('{"isLogin":false}'), false)
})

test('detectBilibiliPageLoggedIn treats serialized state with spaces as logged in', () => {
  assert.equal(
    detectBilibiliPageLoggedIn(
      '<html></html>',
      '{"user":{"isLogin": true}}',
      '',
    ),
    true,
  )
})

test('detectBilibiliLogin falls back to bilibili session cookies on bilibili domains', () => {
  const result = detectBilibiliLogin({
    currentUrl: 'https://account.bilibili.com/account/home',
    pageState: {
      currentUrl: 'https://account.bilibili.com/account/home',
      displayName: '',
      loggedIn: false,
    },
    cookieGroups: ['DedeUserID=12345; bili_jct=token;'],
  })

  assert.equal(result.loggedIn, true)
  assert.equal(result.hasSessionCookie, true)
  assert.equal(result.pageLoggedIn, true)
})
