import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home article cards no longer use click press feedback', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  const entryCardStart = source.indexOf(
    'private EntryCard(entry: EntryCardModel) {',
  )
  const socialEntryCardStart = source.indexOf(
    'private SocialEntryCard(entry: EntryCardModel) {',
  )

  assert.notEqual(entryCardStart, -1)
  assert.notEqual(socialEntryCardStart, -1)

  const entryCard = source.slice(entryCardStart, socialEntryCardStart)
  assert.doesNotMatch(entryCard, /\.clickEffect\(/)
})

test('tweet cards no longer use click press feedback', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/TweetEntryCard.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.doesNotMatch(source, /\.clickEffect\(/)
})
