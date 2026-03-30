import test from 'node:test'
import assert from 'node:assert/strict'

import { detectYouTubeLoginState } from '../entry/src/main/ets/common/utils/YouTubeLoginDetection.ts'

test('detectYouTubeLoginState keeps Google sign-in pages in-progress', () => {
  const result = detectYouTubeLoginState({
    currentUrl:
      'https://accounts.google.com/v3/signin/identifier?service=youtube',
    title: 'Sign in - Google Accounts',
    documentCookies: '',
    pageHtml: '<html><body>Google sign in</body></html>',
  })

  assert.equal(result.inLoginFlow, true)
  assert.equal(result.loggedIn, false)
  assert.equal(result.displayName, '')
})

test('detectYouTubeLoginState recognizes logged-in YouTube page with account menu markers', () => {
  const result = detectYouTubeLoginState({
    currentUrl: 'https://m.youtube.com/',
    title: 'YouTube',
    documentCookies: 'SAPISID=abc; SID=def',
    pageHtml: JSON.stringify({
      topbar: {
        desktopTopbarRenderer: { avatar: { thumbnails: [{ url: 'x' }] } },
      },
      accountName: 'Ch0s1nz',
    }),
  })

  assert.equal(result.inLoginFlow, false)
  assert.equal(result.loggedIn, true)
  assert.equal(result.displayName, 'Ch0s1nz')
  assert.equal(result.hasSessionCookie, true)
})

test('detectYouTubeLoginState does not treat avatar text alone as logged-in evidence', () => {
  const result = detectYouTubeLoginState({
    currentUrl: 'https://m.youtube.com/',
    title: 'YouTube',
    documentCookies: '',
    pageHtml: '<html><body>avatar</body></html>',
  })

  assert.equal(result.inLoginFlow, false)
  assert.equal(result.loggedIn, false)
  assert.equal(result.displayName, '')
  assert.equal(result.hasSessionCookie, false)
})

test('detectYouTubeLoginState extracts escaped accountName text', () => {
  const result = detectYouTubeLoginState({
    currentUrl: 'https://m.youtube.com/',
    title: 'YouTube',
    documentCookies: '',
    pageHtml:
      '<script>window.__DATA__={\\"accountName\\":\\"Foo Bar\\"}</script>',
  })

  assert.equal(result.loggedIn, true)
  assert.equal(result.displayName, 'Foo Bar')
})

test('detectYouTubeLoginState prefers channelHandle markers from YouTube pages', () => {
  const result = detectYouTubeLoginState({
    currentUrl: 'https://www.youtube.com/',
    title: 'YouTube',
    documentCookies: 'SAPISID=abc',
    pageHtml: JSON.stringify({
      metadata: {
        channelMetadataRenderer: {
          channelHandleText: '@livo-dev',
        },
      },
      channelHandle: '@livo-dev',
      accountName: 'Livo Dev',
    }),
  })

  assert.equal(result.loggedIn, true)
  assert.equal(result.displayName, '@livo-dev')
})

test('detectYouTubeLoginState extracts Google account display name from myaccount pages', () => {
  const result = detectYouTubeLoginState({
    currentUrl: 'https://myaccount.google.com/',
    title: 'Google Account',
    documentCookies: 'SID=abc',
    pageHtml:
      '<script>window.__INIT_DATA__={"displayName":"Livo Tester"}</script>',
  })

  assert.equal(result.inLoginFlow, false)
  assert.equal(result.loggedIn, true)
  assert.equal(result.displayName, 'Livo Tester')
})

test('detectYouTubeLoginState treats post-login Google account pages as linked when session and profile are present', () => {
  const result = detectYouTubeLoginState({
    currentUrl: 'https://accounts.google.com/v3/signin/challenge/pwd',
    title: 'Google Account',
    documentCookies: 'SID=abc; SAPISID=def',
    pageHtml:
      '<script>window.__ACCOUNT__={"displayName":"Livo Signed In"}</script>',
  })

  assert.equal(result.inLoginFlow, false)
  assert.equal(result.loggedIn, true)
  assert.equal(result.displayName, 'Livo Signed In')
})
