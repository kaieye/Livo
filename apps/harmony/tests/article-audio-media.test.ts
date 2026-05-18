import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  extractFeedMediaUrls,
  isDirectAudioMimeType,
  isDirectAudioUrl,
  isDirectVideoMimeType,
  isDirectVideoUrl,
} from '../entry/src/main/ets/common/utils/FeedMediaUrl.ts'
import { selectArticleVideoUrls } from '../entry/src/main/ets/common/utils/article/ArticleVideoSource.ts'

const articleContentBuilderSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/models/ArticleContentBuilder.ets',
    import.meta.url,
  ),
  'utf8',
)

const livoModelsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/models/LivoModels.ets',
    import.meta.url,
  ),
  'utf8',
)

const contentBlockBuilderSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/ContentBlockItemBuilder.ets',
    import.meta.url,
  ),
  'utf8',
)

const audioServiceSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/services/AudioPlaybackService.ets',
    import.meta.url,
  ),
  'utf8',
)

test('rss audio enclosures are media urls but not video urls', () => {
  const audioUrl = 'https://cdn.example.com/episode.mp3'
  assert.equal(isDirectAudioMimeType('audio/mpeg'), true)
  assert.equal(isDirectVideoMimeType('audio/mpeg'), false)
  assert.equal(isDirectAudioUrl(audioUrl), true)
  assert.equal(isDirectVideoUrl(audioUrl), false)
  assert.deepEqual(
    extractFeedMediaUrls(
      `<item><enclosure url="${audioUrl}" type="audio/mpeg" /></item>`,
      'https://example.com/feed.xml',
    ),
    [audioUrl],
  )
  assert.deepEqual(selectArticleVideoUrls('', [audioUrl], []), [])
})

test('article detail maps audio media to audio blocks and renders with audio player', () => {
  // ArticleContentBuilder still creates audio blocks
  assert.match(articleContentBuilderSource, /function createAudioContentBlock/)
  assert.match(articleContentBuilderSource, /type: 'audio'/)
  assert.match(articleContentBuilderSource, /audioTitle: string = ''/)
  assert.match(
    articleContentBuilderSource,
    /createAudioContentBlock\(`audio-\$\{blockIndex\}`, audioUrl, audioTitle\)/,
  )
  assert.doesNotMatch(articleContentBuilderSource, /播客音频/)
  assert.match(
    livoModelsSource,
    /buildArticleContentBlocks\(entry\.content, entry\.url \|\| feedSiteUrl\(feed\), entry\.url, entry\.mediaUrls \?\? \[\], entry\.title\)/,
  )
  assert.match(articleContentBuilderSource, /audioUrls\.forEach/)
  assert.match(articleContentBuilderSource, /isStandaloneMediaParagraph/)

  // ContentBlockItemBuilder delegates to AudioPlaybackService
  assert.match(
    contentBlockBuilderSource,
    /import \{ AudioPlaybackService \} from '\.\.\/services\/AudioPlaybackService'/,
  )
  assert.match(
    contentBlockBuilderSource,
    /@StorageProp\('audioServicePlaying'\)/,
  )
  assert.match(contentBlockBuilderSource, /private AudioBlock\(\)/)
  assert.match(
    contentBlockBuilderSource,
    /block\.type === 'audio' && this\.block\.audioUrl/,
  )
  assert.match(contentBlockBuilderSource, /this\.AudioBlock\(\)/)
  assert.match(contentBlockBuilderSource, /this\.audioService\.togglePlayback/)

  // AudioPlaybackService owns the AVPlayer and preparation logic
  assert.match(audioServiceSource, /import \{ audio \} from '@kit\.AudioKit'/)
  assert.match(audioServiceSource, /import \{ media \} from '@kit\.MediaKit'/)
  assert.match(audioServiceSource, /private async prepareWithDirectUrl/)
  assert.match(audioServiceSource, /private async prepareWithMediaSource/)
  assert.match(audioServiceSource, /audioRendererInfo = \{/)
  assert.match(audioServiceSource, /audio\.StreamUsage\.STREAM_USAGE_MUSIC/)
  assert.match(audioServiceSource, /player\.url = sourceUrl/)
  assert.match(
    audioServiceSource,
    /media\.createMediaSourceWithUrl\(sourceUrl, audioRequestHeaders\(\)\)/,
  )
  assert.match(
    audioServiceSource,
    /await player\.setMediaSource\(mediaSource\)/,
  )
  assert.match(audioServiceSource, /async start\(url: string, title: string\)/)
  assert.match(audioServiceSource, /async pause\(\)/)
  assert.match(audioServiceSource, /async resume\(\)/)
  assert.match(
    audioServiceSource,
    /togglePlayback\(url: string, title: string\)/,
  )
})
