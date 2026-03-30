import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveFirstNonEmpty } from '../entry/src/main/ets/common/utils/AsyncResolution.ts'

test('resolveFirstNonEmpty returns the earliest non-empty result', async () => {
  const result = await resolveFirstNonEmpty([
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return ''
    },
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return 'https://media.example.com/video.mp4'
    },
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
      return 'https://media.example.com/video-2.mp4'
    },
  ])

  assert.equal(result, 'https://media.example.com/video.mp4')
})

test('resolveFirstNonEmpty returns empty string when every task is empty', async () => {
  const result = await resolveFirstNonEmpty([async () => '', async () => ''])

  assert.equal(result, '')
})
