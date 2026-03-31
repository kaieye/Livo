import test from 'node:test'
import assert from 'node:assert/strict'

import {
  selectInvidiousPlayableUrl,
  selectPipedPlayableUrl,
} from '../entry/src/main/ets/common/utils/VideoPlayableSelection.ts'

test('selectInvidiousPlayableUrl prefers the highest-quality mp4 stream', () => {
  const result = selectInvidiousPlayableUrl([
    {
      url: 'https://cdn.example.com/360.mp4',
      container: 'mp4',
      quality: '360p',
    },
    {
      url: 'https://cdn.example.com/720.webm',
      container: 'webm',
      quality: '720p',
    },
    {
      url: 'https://cdn.example.com/1080.mp4',
      type: 'video/mp4; codecs="avc1"',
      quality: '1080p',
    },
  ])

  assert.equal(result, 'https://cdn.example.com/1080.mp4')
})

test('selectPipedPlayableUrl prefers hls when available', () => {
  const result = selectPipedPlayableUrl(
    'https://manifest.example.com/master.m3u8',
    [
      {
        url: 'https://cdn.example.com/720.mp4',
        mimeType: 'video/mp4',
        quality: '720p',
        videoOnly: false,
      },
    ],
  )

  assert.equal(result, 'https://manifest.example.com/master.m3u8')
})

test('selectPipedPlayableUrl falls back to the best combined mp4 stream', () => {
  const result = selectPipedPlayableUrl('', [
    {
      url: 'https://cdn.example.com/video-only.mp4',
      mimeType: 'video/mp4',
      quality: '1080p',
      videoOnly: true,
    },
    {
      url: 'https://cdn.example.com/360.mp4',
      mimeType: 'video/mp4',
      quality: '360p',
      videoOnly: false,
    },
    {
      url: 'https://cdn.example.com/720.mp4',
      mimeType: 'video/mp4',
      quality: '720p',
      videoOnly: false,
    },
  ])

  assert.equal(result, 'https://cdn.example.com/720.mp4')
})

test('selectPipedPlayableUrl returns empty string when no playable stream exists', () => {
  const result = selectPipedPlayableUrl('', [
    {
      url: 'https://cdn.example.com/video-only.webm',
      mimeType: 'video/webm',
      quality: '1080p',
      videoOnly: true,
    },
  ])

  assert.equal(result, '')
})
