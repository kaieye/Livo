import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('aggregate refresh records refresh logs and exposes refresh log APIs', () => {
  const repositorySource = read(
    '../entry/src/main/ets/common/data/AppRepository.ets',
  )
  const panelSource = read(
    '../entry/src/main/ets/common/components/SettingsSecondaryPanels.ets',
  )

  assert.match(
    repositorySource,
    /static async refreshLogs\(\): Promise<RefreshLogEntry\[]>/,
  )
  assert.match(
    repositorySource,
    /static async clearRefreshLogs\(\): Promise<void>/,
  )
  assert.match(repositorySource, /private static async recordRefreshLog\(/)
  assert.match(
    repositorySource,
    /await AppRepository\.recordRefreshLog\(0, 0, \[\]\)/,
  )
  assert.match(
    repositorySource,
    /await AppRepository\.recordRefreshLog\(refreshedCount, failedCount, failedFeedLabels\)/,
  )

  assert.match(panelSource, /export struct RefreshLogSettingsPanel/)
  assert.match(panelSource, /SettingsPanelHeader\('刷新日志', this\.theme\)/)
  assert.match(
    panelSource,
    /Text\(`成功刷新 \$\{log\.successFeedCount\} 个订阅源 · 失败 \$\{log\.failedFeedCount\} 个`\)/,
  )
  assert.match(
    panelSource,
    /Text\(`失败订阅源：\$\{this\.failedFeedsLabel\(log\)\}`\)/,
  )
})
