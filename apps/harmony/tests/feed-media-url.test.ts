import test from 'node:test'
import assert from 'node:assert/strict'

import {
  appendFeedMediaUrlsToContent,
  extractFeedMediaUrls,
} from '../entry/src/main/ets/common/utils/FeedMediaUrl.ts'

test('extractFeedMediaUrls returns direct media files from rss item markup', () => {
  const itemBlock = `
    <item>
      <title>Video item</title>
      <enclosure url="https://cdn.example.com/video.mp4" type="video/mp4" />
      <media:content url="/streams/live.m3u8" type="application/x-mpegURL" />
      <media:content url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" type="text/html" />
    </item>
  `

  assert.deepEqual(
    extractFeedMediaUrls(itemBlock, 'https://feeds.example.com/news.xml'),
    [
      'https://cdn.example.com/video.mp4',
      'https://feeds.example.com/streams/live.m3u8',
    ],
  )
})

test('appendFeedMediaUrlsToContent appends media urls once and keeps existing content intact', () => {
  assert.equal(
    appendFeedMediaUrlsToContent('<p>Hello</p>', [
      'https://cdn.example.com/video.mp4',
      'https://cdn.example.com/video.mp4',
    ]),
    '<p>Hello</p>\n\nhttps://cdn.example.com/video.mp4',
  )
})
