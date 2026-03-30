import test from 'node:test'
import assert from 'node:assert/strict'

import { buildExternalUrlWant } from '../entry/src/main/ets/common/utils/ExternalUrlWant.ts'

test('buildExternalUrlWant uses Harmony viewData action for browser links', () => {
  const want = buildExternalUrlWant('https://accounts.google.com/ServiceLogin')

  assert.deepEqual(want, {
    action: 'ohos.want.action.viewData',
    uri: 'https://accounts.google.com/ServiceLogin',
  })
})
