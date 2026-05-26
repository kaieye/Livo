import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const defaultToolsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/agent/DefaultAgentTools.ets',
    import.meta.url,
  ),
  'utf8',
)

const feedToolsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/agent/tools/feed/FeedAgentTools.ets',
    import.meta.url,
  ),
  'utf8',
)

const settingsToolsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/agent/tools/settings/SettingsAgentTools.ets',
    import.meta.url,
  ),
  'utf8',
)

const accountToolsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/agent/tools/account/AccountAgentTools.ets',
    import.meta.url,
  ),
  'utf8',
)

const dataToolsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/agent/tools/data/DataAgentTools.ets',
    import.meta.url,
  ),
  'utf8',
)

const chatAgentSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/services/AIChatAgentService.ets',
    import.meta.url,
  ),
  'utf8',
)

const chatRunnerSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/services/article-assist/ChatCompletionRunner.ets',
    import.meta.url,
  ),
  'utf8',
)

test('P4 订阅刷新和删除工具接入默认注册表', () => {
  assert.match(feedToolsSource, /buildRemoveSubscriptionTool/)
  assert.match(feedToolsSource, /capability: 'destructive'/)
  assert.match(feedToolsSource, /FeedSubscribeAction\.unsubscribe/)
  assert.match(feedToolsSource, /buildRefreshSubscriptionTool/)
  assert.match(feedToolsSource, /buildRefreshAllSubscriptionsTool/)
  assert.match(defaultToolsSource, /buildRemoveSubscriptionTool\(\)/)
  assert.match(defaultToolsSource, /buildRefreshSubscriptionTool\(\)/)
  assert.match(defaultToolsSource, /buildRefreshAllSubscriptionsTool\(\)/)
})

test('P4 设置、账号和数据控制工具接入默认注册表', () => {
  assert.match(settingsToolsSource, /buildGetSettingsTool/)
  assert.match(settingsToolsSource, /buildUpdateGeneralSettingsTool/)
  assert.match(settingsToolsSource, /buildUpdateAIFeatureSettingsTool/)
  assert.match(settingsToolsSource, /buildUpdateAIRuntimeSettingsTool/)
  assert.match(settingsToolsSource, /API Key 未通过本次工具调用修改/)
  assert.match(accountToolsSource, /buildListAccountProvidersTool/)
  assert.match(accountToolsSource, /buildOpenAccountLoginTool/)
  assert.match(accountToolsSource, /buildUnlinkAccountTool/)
  assert.match(dataToolsSource, /buildExportOpmlTool/)
  assert.match(dataToolsSource, /buildImportOpmlTool/)
  assert.match(dataToolsSource, /buildClearLocalCacheTool/)
  assert.match(defaultToolsSource, /tools\/account\/AccountAgentTools/)
  assert.match(defaultToolsSource, /buildImportOpmlTool\(\)/)
  assert.match(defaultToolsSource, /buildUnlinkAccountTool\(\)/)
})

test('非原生 tool-calling provider 只走上下文回答，不解析文本伪工具调用', () => {
  assert.match(chatRunnerSource, /nativeToolCallingSupported/)
  assert.match(chatRunnerSource, /format !== 'minimax-text'/)
  assert.match(
    chatAgentSource,
    /nativeToolCallingSupported && effectiveToolCalls\.length === 0/,
  )
  assert.match(
    chatAgentSource,
    /ignored text tool calls because provider has no native tool-calling support/,
  )
})
