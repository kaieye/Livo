import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('settings entry routes data control slot to refresh log panel', () => {
  const source = read(
    '../entry/src/main/ets/common/components/SettingsContent.ets',
  )

  assert.match(source, /title: '刷新日志'/)
  assert.match(source, /subtitle: '查看每次刷新结果与失败订阅源'/)
  assert.match(source, /if \(item\.title === '刷新日志'\) \{/)
  assert.match(source, /this\.openSheet\('refresh-log'\)/)
  assert.match(source, /else if \(this\.activeSheet === 'refresh-log'\) \{/)
  assert.match(source, /RefreshLogSettingsPanel\(\{/)
})
