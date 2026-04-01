import test from 'node:test'
import assert from 'node:assert/strict'

import {
  appendFeedMediaUrlsToContent,
  extractFeedMediaUrls,
} from '../entry/src/main/ets/common/utils/FeedMediaUrl.ts'

test('extractFeedMediaUrls keeps direct media files and supported video page urls from rss item markup', () => {
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
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
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

test('extractFeedMediaUrls keeps image media urls from rss metadata for picture feeds', () => {
  const itemBlock = `
    <item>
      <title>Picture item</title>
      <enclosure url="https://cdninstagram.com/photo/main" type="image/jpeg" />
      <media:content url="https://scontent.cdninstagram.com/v/t51.2885-15/123456789_n.jpg?stp=dst-jpg_e35" medium="image" />
      <media:thumbnail url="/thumbs/photo.webp" />
    </item>
  `

  assert.deepEqual(
    extractFeedMediaUrls(itemBlock, 'https://feeds.example.com/social.xml'),
    [
      'https://cdninstagram.com/photo/main',
      'https://scontent.cdninstagram.com/v/t51.2885-15/123456789_n.jpg?stp=dst-jpg_e35',
      'https://feeds.example.com/thumbs/photo.webp',
    ],
  )
})
