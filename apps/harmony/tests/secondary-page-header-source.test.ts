import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('secondary page header shell centralizes the safe-area baseline for detail pages', () => {
  const shellSource = read(
    '../entry/src/main/ets/common/components/SecondaryPageHeaderShell.ets',
  )

  assert.match(
    shellSource,
    /export const SECONDARY_PAGE_HEADER_TOP_GAP: number = 24/,
  )
  assert.match(
    shellSource,
    /export const SECONDARY_PAGE_HEADER_BOTTOM_GAP: number = 8/,
  )
  assert.match(
    shellSource,
    /export const SECONDARY_PAGE_HEADER_FALLBACK_TOP_AVOID_AREA: number = 14/,
  )
  assert.match(shellSource, /export struct SecondaryPageHeaderShell/)
  assert.match(shellSource, /private resolvedTopAvoidArea\(\): number/)
  assert.match(
    shellSource,
    /private resolvedTopAvoidArea\(\): number \{\s*return SECONDARY_PAGE_HEADER_FALLBACK_TOP_AVOID_AREA\s*\}/s,
  )
  assert.match(
    shellSource,
    /\.padding\(\{\s*left: PAGE_HORIZONTAL_PADDING,\s*right: PAGE_HORIZONTAL_PADDING,\s*top: this\.resolvedTopAvoidArea\(\) \+ SECONDARY_PAGE_HEADER_TOP_GAP,\s*bottom: SECONDARY_PAGE_HEADER_BOTTOM_GAP,\s*\}\)/s,
  )
  assert.doesNotMatch(shellSource, /backdropBlur\(/)
})

test('secondary detail pages all use the shared secondary page header shell', () => {
  const feedDetailSource = read(
    '../entry/src/main/ets/common/components/FeedDetailView.ets',
  )
  const subscribeConfigSource = read(
    '../entry/src/main/ets/common/components/FeedSubscribeConfigView.ets',
  )
  const discoverPreviewSource = read(
    '../entry/src/main/ets/pages/DiscoverPreview.ets',
  )
  const articleDetailSource = read(
    '../entry/src/main/ets/pages/ArticleDetail.ets',
  )
  const discoverContentSource = read(
    '../entry/src/main/ets/common/components/DiscoverContent.ets',
  )
  const accountLoginSource = read(
    '../entry/src/main/ets/pages/AccountLogin.ets',
  )

  ;[
    feedDetailSource,
    subscribeConfigSource,
    discoverPreviewSource,
    articleDetailSource,
    discoverContentSource,
    accountLoginSource,
  ].forEach((source) => {
    assert.match(source, /SecondaryPageHeaderShell\(/)
    assert.doesNotMatch(
      source,
      /SecondaryPageHeaderShell\(\{\s*topAvoidArea:\s*this\.topAvoidArea\s*\}\)/,
    )
  })

  assert.doesNotMatch(
    feedDetailSource,
    /topPadding:\s*this\.detailHeaderTopPadding\(\)/,
  )
  assert.doesNotMatch(subscribeConfigSource, /topPadding:\s*[1-9]\d*/)
  assert.doesNotMatch(discoverPreviewSource, /topPadding:\s*[1-9]\d*/)
  assert.doesNotMatch(articleDetailSource, /topPadding:\s*[1-9]\d*/)
  assert.doesNotMatch(
    discoverContentSource,
    /padding\(\{ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 12, bottom: 10 \}\)/,
  )
  assert.doesNotMatch(
    accountLoginSource,
    /\.padding\(\{ top: this\.topAvoidArea \}\)/,
  )
})
