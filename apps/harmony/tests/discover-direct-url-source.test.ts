import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const discoverCatalogSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/DiscoverCatalog.ets',
    import.meta.url,
  ),
  'utf8',
)

const discoverContentSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/DiscoverContent.ets',
    import.meta.url,
  ),
  'utf8',
)

const discoverResultSectionsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/DiscoverResultSections.ets',
    import.meta.url,
  ),
  'utf8',
)

const discoverInteractionCoordinatorSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/discover/DiscoverInteractionCoordinator.ets',
    import.meta.url,
  ),
  'utf8',
)

test('discover direct url recognises feed subscription links and generic webpages separately', () => {
  assert.match(
    discoverCatalogSource,
    /function looksLikeFeedSubscriptionUrl\(url: string\): boolean/,
  )
  assert.match(
    discoverCatalogSource,
    /识别为订阅链接，点击后会校验内容并提供添加订阅选项。/,
  )
  assert.match(
    discoverCatalogSource,
    /识别为网页地址，点击后会尝试发现订阅源并进入预览。/,
  )
})

test('discover search mode renders direct url rows and routes them into preview flow', () => {
  assert.match(
    discoverContentSource,
    /private shouldShowDirectUrlLoadingRow\(\): boolean/,
  )
  assert.match(
    discoverContentSource,
    /DiscoverDirectUrlLoadingRow\(\{\s*theme: this\.theme,\s*\}\)/,
  )
  assert.match(
    discoverContentSource,
    /DiscoverDirectUrlRow\(\{[\s\S]*?result: this\.resolvedDirectUrlResult\(\)/,
  )
  assert.match(
    discoverContentSource,
    /private async preloadDirectUrlPreview\(query: string\): Promise<void>/,
  )
  assert.match(
    discoverContentSource,
    /const payload = await RssFeedService\.previewFeedUrl\(result\.targetUrl\)/,
  )
  assert.match(discoverContentSource, /this\.isDirectUrlPreviewLoading = true/)
  assert.match(discoverContentSource, /this\.isDirectUrlPreviewLoading = false/)
  assert.match(
    discoverContentSource,
    /title: cachedPayload\.feedTitle \|\| result\.title/,
  )
  assert.match(discoverContentSource, /onOpen: this\.onDirectUrlOpen/)
  assert.match(
    discoverInteractionCoordinatorSource,
    /openDirectUrlResult\(result: DirectUrlResult\): void \{ this\.overlay\.openDirectUrlResult\(result\) \}/,
  )
  assert.match(discoverResultSectionsSource, /Text\(this\.result\.targetUrl\)/)
  assert.match(discoverResultSectionsSource, /Text\('正在解析订阅源\.\.\.'\)/)
  assert.doesNotMatch(
    discoverResultSectionsSource,
    /discoverPlatformLabel\(this\.searchPlatform\)/,
  )
})
