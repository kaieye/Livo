import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('root tab pages disable first-enter transitions when mounted under the shared bottom tabs shell', () => {
  const subscriptionsSource = read(
    '../entry/src/main/ets/common/components/SubscriptionsContent.ets',
  )
  const discoverSource = read(
    '../entry/src/main/ets/common/components/DiscoverContent.ets',
  )
  const settingsSource = read(
    '../entry/src/main/ets/common/components/SettingsContent.ets',
  )
  const settingRowSource = read(
    '../entry/src/main/ets/common/components/SettingListRow.ets',
  )

  assert.match(
    subscriptionsSource,
    /private rootEnterTransition\(delay: number\): TransitionEffect/,
  )
  assert.match(
    subscriptionsSource,
    /return this\.showBottomTabs \? livoMotion\.enterScale/,
  )
  assert.match(
    discoverSource,
    /private rootEnterTransition\(delay: number\): TransitionEffect/,
  )
  assert.match(
    discoverSource,
    /return this\.showBottomTabs \? livoMotion\.enterSoft/,
  )
  assert.match(
    settingsSource,
    /private rootEnterTransition\(delay: number = 0\): TransitionEffect/,
  )
  assert.match(
    settingsSource,
    /return this\.showBottomTabs \? livoMotion\.enterScale\(delay\) : TransitionEffect\.IDENTITY/,
  )
  assert.match(settingRowSource, /@Prop enableEnterTransition: boolean = true/)
  assert.match(
    settingRowSource,
    /\.transition\(this\.enableEnterTransition \? livoMotion\.enterScale\(\) : TransitionEffect\.IDENTITY\)/,
  )
  assert.match(settingsSource, /enableEnterTransition: this\.showBottomTabs/)
})
