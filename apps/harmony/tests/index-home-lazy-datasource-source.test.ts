import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const homeModeEntriesPageSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/HomeModeEntriesPage.ets',
    import.meta.url,
  ),
  'utf8',
)

const indexHomeRootContentSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/IndexHomeRootContent.ets',
    import.meta.url,
  ),
  'utf8',
)

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

test('home mode entries page binds article and picture lists to lazy data source', () => {
  assert.match(
    homeModeEntriesPageSource,
    /@Prop dataSource: ArrayLazyDataSource<EntryCardModel>/,
  )
  assert.match(
    homeModeEntriesPageSource,
    /LazyForEach\(this\.dataSource, \(entry: EntryCardModel, index: number\) => \{/,
  )
  assert.doesNotMatch(
    homeModeEntriesPageSource,
    /ForEach\(this\.entries, \(entry: EntryCardModel, index: number\) => \{/,
  )
  assert.match(
    homeModeEntriesPageSource,
    /\}, \(entry: EntryCardModel, index: number\) => homeEntryListRenderKey\(entry, index\)\)/,
  )
})

test('index home root content passes mode data source into each scene', () => {
  assert.match(
    indexHomeRootContentSource,
    /getDataSource: \(mode: SubscriptionMode\) => ArrayLazyDataSource<EntryCardModel>/,
  )
  assert.match(
    indexHomeRootContentSource,
    /dataSource: this\.callbacks\.getDataSource\(mode\)/,
  )
})

test('index page wires home mode lazy data sources from session state', () => {
  assert.match(
    indexSource,
    /private homeEntryDataSourceFor\(mode: SubscriptionMode\): ArrayLazyDataSource<EntryCardModel> \{/,
  )
  assert.match(
    indexSource,
    /getEntries: \(mode: SubscriptionMode\): EntryCardModel\[] => this\.filteredEntriesFor\(mode\)/,
  )
  assert.match(
    indexSource,
    /getDataSource: \(mode: SubscriptionMode\): ArrayLazyDataSource<EntryCardModel> => this\.homeEntryDataSourceFor\(mode\)/,
  )
})
