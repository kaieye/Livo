import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home page defines inline search state and keyboard controller', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /@State searchQuery: string = ''/)
  assert.match(source, /@State showSearch: boolean = false/)
  assert.match(source, /@State searchOverlayVisible: boolean = false/)
  assert.match(
    source,
    /private searchInputController: TextInputController = new TextInputController\(\)/,
  )
  assert.match(source, /private openHomeInlineSearch\(\): void/)
  assert.match(source, /private closeHomeInlineSearch\([^)]*\): void/)
  assert.match(source, /private focusHomeInlineSearch\(\): void/)
  assert.match(source, /private finalizeHomeInlineSearchClose\(\): void/)
  assert.match(
    source,
    /const HOME_INLINE_SEARCH_INPUT_ID: string = 'home-inline-search-input'/,
  )
})

test('home inline search highlight uses theme accent and current mode entries', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /theme\.accent/)
  assert.match(source, /private currentSearchEntries\(\): EntryCardModel\[\]/)
  assert.match(source, /private hasSearchMatches\(\): boolean/)
  assert.match(source, /private searchResultEntries\(\): EntryCardModel\[\]/)
  assert.match(source, /private hasSearchResultEmptyState\(\): boolean/)
  assert.match(
    source,
    /private searchResultSummaryText\(entry: EntryCardModel\): string/,
  )
  assert.match(source, /private searchResultSnippet\(text: string\): string/)
  assert.match(source, /this\.rootSettings\.searchAllHomeCategories/)
})

test('home inline search uses overlay dismissal and center-expand motion', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /private HomeSearchDismissLayer\(\)/)
  assert.match(source, /private HomeSearchFieldLayer\(\)/)
  assert.match(
    source,
    /private HomeSearchDismissLayer\(\) \{[\s\S]*\.onClick\(\(\) => \{\s*this\.closeHomeInlineSearch\(true\)\s*\}\)/s,
  )
  assert.match(source, /private homeInlineSearchVerticalOffset\(\): number/)
  assert.match(
    source,
    /private HomeInlineSearchField\(\) \{[\s\S]*\.scale\(\{[\s\S]*x: this\.showSearch \? 1 :/s,
  )
  assert.match(
    source,
    /private HomeInlineSearchField\(\) \{[\s\S]*\.translate\(\{[\s\S]*x: 0,[\s\S]*y: this\.homeInlineSearchVerticalOffset\(\)/s,
  )
  assert.match(
    source,
    /TextInput\(\{ text: this\.searchQuery, placeholder: this\.rootSettings\.searchAllHomeCategories \? '搜索全部内容' : `搜索「\$\{this\.getModeTitle\(this\.mode\)\}」`, controller: this\.searchInputController \}\)[\s\S]*\.defaultFocus\(this\.searchOverlayVisible\)/s,
  )
  assert.match(
    source,
    /TextInput\(\{ text: this\.searchQuery, placeholder: this\.rootSettings\.searchAllHomeCategories \? '搜索全部内容' : `搜索「\$\{this\.getModeTitle\(this\.mode\)\}」`, controller: this\.searchInputController \}\)[\s\S]*\.id\(HOME_INLINE_SEARCH_INPUT_ID\)[\s\S]*\.focusable\(true\)/s,
  )
  assert.match(
    source,
    /private focusHomeInlineSearch\(\): void \{[\s\S]*focusControl\.requestFocus\(HOME_INLINE_SEARCH_INPUT_ID\)/s,
  )
  assert.match(
    source,
    /private HomeInlineSearchField\(\) \{[\s\S]*\.width\('100%'\)[\s\S]*\.constraintSize\(\{ maxWidth: HOME_INLINE_SEARCH_MAX_WIDTH \}\)/s,
  )
  assert.match(
    source,
    /private HomeInlineSearchActionRow\(\) \{[\s\S]*\.opacity\(this\.showSearch \? 0 : 1\)/s,
  )
  assert.match(
    source,
    /private HomeSearchFieldLayer\(\) \{[\s\S]*\.align\(Alignment\.Top\)[\s\S]*\.justifyContent\(FlexAlign\.Center\)/s,
  )
})

test('home inline search renders a dedicated result panel with summary snippets and empty state', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /private HomeInlineSearchResults\(\)/)
  assert.match(
    source,
    /private HomeSearchFieldLayer\(\) \{[\s\S]*this\.HomeInlineSearchField\(\)[\s\S]*if \(this\.normalizedSearchQuery\(\)\) \{[\s\S]*this\.HomeInlineSearchResults\(\)/s,
  )
  assert.match(
    source,
    /private HomeInlineSearchResults\(\) \{[\s\S]*ForEach\(this\.searchResultEntries\(\), \(entry: EntryCardModel, index: number\) => \{/s,
  )
  assert.match(
    source,
    /private HomeInlineSearchResults\(\) \{[\s\S]*List\(\{ space: 0 \}\)/s,
  )
  assert.match(
    source,
    /private HomeInlineSearchResults\(\) \{[\s\S]*HighlightedInlineText\(\{[\s\S]*text: this\.searchResultSummaryText\(entry\)/s,
  )
  assert.match(
    source,
    /private HomeInlineSearchResults\(\) \{[\s\S]*\.padding\(\{ left: 8, right: 8, top: 8, bottom: 8 \}\)[\s\S]*\.scrollBar\(BarState\.Off\)[\s\S]*\.clip\(true\)/s,
  )
  assert.match(
    source,
    /private HomeInlineSearchResults\(\) \{[\s\S]*if \(index < this\.searchResultEntries\(\)\.length - 1\) \{[\s\S]*\.height\(0\.5\)/s,
  )
  assert.match(
    source,
    /private HomeInlineSearchResults\(\) \{[\s\S]*Text\('当前分段没有匹配内容'\)/s,
  )
  assert.match(
    source,
    /private HomeInlineSearchResults\(\) \{[\s\S]*\.onClick\(\(\) => \{[\s\S]*this\.openEntry\(entry\)[\s\S]*this\.closeHomeInlineSearch\(true\)/s,
  )
})

test('home inline search utility exposes normalized matching helpers', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/utils/HomeInlineSearch.ts',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(source, /export interface InlineHighlightSegment/)
  assert.match(
    source,
    /export function normalizeInlineSearchQuery\(query: string\): string/,
  )
  assert.match(
    source,
    /export function buildInlineHighlightSegments\([\s\S]*text: string,[\s\S]*query: string,[\s\S]*\): InlineHighlightSegment\[\]/,
  )
  assert.match(source, /toLocaleLowerCase\(\)/)
})

test('highlighted inline text component renders matched segments with theme accent styling', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/HighlightedInlineText.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(source, /@Component\s+export struct HighlightedInlineText/)
  assert.match(source, /@Prop query: string = ''/)
  assert.match(source, /buildInlineHighlightSegments/)
  assert.match(source, /this\.theme\.accent/)
  assert.match(source, /ForEach\(this\.segments\(\)/)
})

test('tweet picture and video home content accept inline highlight query plumbing', () => {
  const tweetSource = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/TweetEntryCard.ets',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(tweetSource, /@Prop highlightQuery: string = ''/)
  assert.match(tweetSource, /HighlightedInlineText/)

  const pictureSource = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/PictureEntryCard.ets',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(pictureSource, /@Prop highlightQuery: string = ''/)
  assert.match(pictureSource, /HighlightedInlineText/)

  const videoSource = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/HomeVideoGrid.ets',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(videoSource, /@Prop highlightQuery: string = ''/)
  assert.match(videoSource, /HighlightedInlineText/)

  const indexSource = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )
  assert.match(indexSource, /highlightQuery: this\.searchQuery/)
})
