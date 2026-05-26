import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const navigationToolsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/agent/tools/navigation/NavigationAgentTools.ets',
    import.meta.url,
  ),
  'utf8',
)

const defaultToolsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/agent/DefaultAgentTools.ets',
    import.meta.url,
  ),
  'utf8',
)

const aiChatAgentSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/agent/LivoAgentLoop.ets',
    import.meta.url,
  ),
  'utf8',
)

const toolLabelsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/AIChatToolLabels.ts',
    import.meta.url,
  ),
  'utf8',
)

test('NavigationAgentTools 封装 AppRouter 导航能力', () => {
  assert.match(
    navigationToolsSource,
    /from '\.\.\/\.\.\/\.\.\/navigation\/AppRouter'/,
  )
  assert.match(navigationToolsSource, /buildOpenRootTabTool/)
  assert.match(navigationToolsSource, /buildGoBackTool/)
  assert.match(navigationToolsSource, /buildOpenEntryDetailTool/)
  assert.match(navigationToolsSource, /buildOpenFeedDetailTool/)
  assert.match(navigationToolsSource, /buildOpenSettingsPanelTool/)
  assert.match(navigationToolsSource, /buildOpenVideoPlayerTool/)
  assert.match(navigationToolsSource, /buildOpenImageViewerTool/)
  assert.match(navigationToolsSource, /capability: 'navigate'/)
  assert.match(navigationToolsSource, /requiresConfirmation: false/)
})

test('默认 Agent 工具注册表包含导航工具', () => {
  assert.match(defaultToolsSource, /tools\/navigation\/NavigationAgentTools/)
  assert.match(defaultToolsSource, /buildOpenRootTabTool\(\)/)
  assert.match(defaultToolsSource, /buildGoBackTool\(\)/)
  assert.match(defaultToolsSource, /buildOpenEntryDetailTool\(\)/)
  assert.match(defaultToolsSource, /buildOpenFeedDetailTool\(\)/)
  assert.match(defaultToolsSource, /buildOpenSettingsPanelTool\(\)/)
  assert.match(defaultToolsSource, /buildOpenVideoPlayerTool\(\)/)
  assert.match(defaultToolsSource, /buildOpenImageViewerTool\(\)/)
})

test('导航工具描述足够具体且状态栏标签覆盖到位', () => {
  assert.match(
    navigationToolsSource,
    /打开应用底部导航中的首页、订阅、发现或设置标签/,
  )
  assert.match(
    navigationToolsSource,
    /打开设置首页或通用、外观、数据控制、隐私、关于等设置面板/,
  )
  assert.match(toolLabelsSource, /case 'open_root_tab':/)
  assert.match(toolLabelsSource, /case 'open_entry_detail':/)
  assert.match(toolLabelsSource, /case 'open_image_viewer':/)
})

test('系统 prompt 不再硬编码具体工具名', () => {
  assert.doesNotMatch(aiChatAgentSource, /open_root_tab：/)
  assert.doesNotMatch(aiChatAgentSource, /open_settings_panel：/)
  assert.doesNotMatch(aiChatAgentSource, /list_subscribed_feeds：/)
  assert.doesNotMatch(aiChatAgentSource, /add_feed：/)
})
