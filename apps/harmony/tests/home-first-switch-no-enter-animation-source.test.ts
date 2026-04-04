import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home scenes disable enter animations for first-time mode switches', () => {
  const indexSource = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )
  const railSource = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/ContentModeRail.ets',
      import.meta.url,
    ),
    'utf8',
  )
  const pictureSource = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/PictureEntryCard.ets',
      import.meta.url,
    ),
    'utf8',
  )
  const tweetSource = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/TweetEntryCard.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(railSource, /@Prop enableEnterTransition: boolean = true/)
  assert.match(pictureSource, /@Prop enableEnterTransition: boolean = true/)
  assert.match(tweetSource, /@Prop enableEnterTransition: boolean = true/)

  assert.match(
    indexSource,
    /ContentModeRail\(\{[\s\S]*enableEnterTransition: false/,
  )
  assert.match(
    indexSource,
    /PictureEntryCard\(\{[\s\S]*enableEnterTransition: false/,
  )
  assert.match(
    indexSource,
    /TweetEntryCard\(\{[\s\S]*enableEnterTransition: false/,
  )
})
