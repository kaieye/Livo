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
    '../entry/src/main/ets/common/services/AIChatAgentService.ets',
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

test('AI 对话提示词和状态栏标签包含导航工具', () => {
  assert.match(
    aiChatAgentSource,
    /open_root_tab：打开首页、订阅、发现或设置根标签/,
  )
  assert.match(
    aiChatAgentSource,
    /open_settings_panel：打开设置首页或具体设置面板/,
  )
  assert.match(toolLabelsSource, /case 'open_root_tab':/)
  assert.match(toolLabelsSource, /case 'open_entry_detail':/)
  assert.match(toolLabelsSource, /case 'open_image_viewer':/)
})
