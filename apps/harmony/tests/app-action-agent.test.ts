import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const serviceSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/services/AppActionAgentService.ets',
    import.meta.url,
  ),
  'utf8',
)

test('AppActionAgentService 只保留 Agent Harness 兼容适配层', () => {
  assert.match(serviceSource, /import \{ AgentHarness \}/)
  assert.match(serviceSource, /buildDefaultAgentToolRegistry/)
  assert.match(serviceSource, /normalizeDefaultAgentToolArgs/)
  assert.match(serviceSource, /agentToolResultToText/)
})

test('AppActionAgentService 不再保留旧自然语言规则引擎', () => {
  assert.doesNotMatch(serviceSource, /executeAppActionByRules/)
  assert.doesNotMatch(
    serviceSource,
    /const lowerPrompt = prompt\.toLowerCase\(\)/,
  )
  assert.doesNotMatch(serviceSource, /if \(lowerPrompt\.includes/)
  assert.match(serviceSource, /自然语言规则入口已废弃/)
})

test('AppActionAgentService 保留旧工具名到统一工具注册表的映射', () => {
  assert.match(
    serviceSource,
    /legacyName: 'list_subscriptions'[\s\S]*?agentName: 'list_subscribed_feeds'/,
  )
  assert.match(
    serviceSource,
    /legacyName: 'add_subscription'[\s\S]*?agentName: 'add_feed'/,
  )
  assert.match(
    serviceSource,
    /legacyName: 'get_unread_stats'[\s\S]*?agentName: 'get_unread_count'/,
  )
  assert.match(
    serviceSource,
    /legacyName: 'mark_all_read'[\s\S]*?agentName: 'mark_all_read'/,
  )
})

test('AppActionAgentService 对写入工具仍通过 Harness 确认门禁', () => {
  assert.match(serviceSource, /confirmed: boolean = false/)
  assert.match(serviceSource, /confirmed,\s*\n\s*\}\)/)
  assert.match(serviceSource, /result\.status === 'success'/)
  assert.match(serviceSource, /result\.confirmation/)
})

test('AppActionAgentService 将删除订阅旧工具迁入 Harness 确认门禁', () => {
  assert.match(
    serviceSource,
    /legacyName: 'remove_subscription'[\s\S]*?agentName: 'remove_subscription'/,
  )
  assert.doesNotMatch(serviceSource, /尚未迁入 Agent 工具注册表/)
  assert.doesNotMatch(serviceSource, /已停止从规则入口执行删除操作/)
})

test('runAppActionAgent 仅接受 JSON 形式的显式工具调用', () => {
  assert.match(serviceSource, /function parseCompatToolCall\(prompt: string\)/)
  assert.match(serviceSource, /JSON\.parse\(prompt\.trim\(\)\)/)
  assert.match(
    serviceSource,
    /raw\['name'\] \|\| raw\['tool'\] \|\| raw\['toolName'\]/,
  )
  assert.match(
    serviceSource,
    /raw\['arguments'\] \|\| raw\['args'\] \|\| raw\['parameters'\]/,
  )
})
