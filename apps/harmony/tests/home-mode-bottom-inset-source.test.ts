import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entriesSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/HomeModeEntriesPage.ets',
    import.meta.url,
  ),
  'utf8',
)

const configSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/HomeRootConfig.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home mode scroll containers reserve bottom space for the floating root tab bar', () => {
  assert.match(
    configSource,
    /export const HOME_MODE_BOTTOM_TAB_SPACER: number =\s*BOTTOM_TAB_BAR_HEIGHT \+ resolveHdsBottomTabBarBottomMargin\(BOTTOM_TAB_FLOAT_GAP\) \+ HOME_MODE_CONTENT_GAP/,
  )
  assert.match(
    entriesSource,
    /@Builder\s+private BottomTabSpacer\(\) \{\s*Blank\(\)\.height\(HOME_MODE_BOTTOM_TAB_SPACER\)\s*\}/s,
  )
  assert.equal(
    (
      entriesSource.match(
        /ListItem\(\) \{\s*this\.BottomTabSpacer\(\)\s*\}\s*\.width\('100%'\)/g,
      ) ?? []
    ).length,
    2,
  )
  assert.equal(
    (entriesSource.match(/this\.BottomTabSpacer\(\)/g) ?? []).length,
    3,
  )
})
