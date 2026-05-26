import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const traceStoreSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/agent/AgentTraceStore.ets',
    import.meta.url,
  ),
  'utf8',
)

const tracePanelSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/AIChatTracePanel.ets',
    import.meta.url,
  ),
  'utf8',
)

const traceRecorderSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/AIChatTraceRecorder.ts',
    import.meta.url,
  ),
  'utf8',
)

const navigationMenusSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/AIChatNavigationMenus.ets',
    import.meta.url,
  ),
  'utf8',
)

const panelLayoutSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/AIChatPanelLayout.ets',
    import.meta.url,
  ),
  'utf8',
)

test('AgentTraceStore 持久化最近 agent 执行轨迹', () => {
  assert.match(traceStoreSource, /AGENT_TRACES_KEY = 'agentTraces'/)
  assert.match(traceStoreSource, /MAX_AGENT_TRACES = 50/)
  assert.match(traceStoreSource, /export interface AgentTraceRecord/)
  assert.match(traceStoreSource, /toolCalls: AgentTraceToolCall\[\]/)
  assert.match(traceStoreSource, /static async save/)
  assert.match(traceStoreSource, /traceId === trace\.traceId/)
})

test('AIChatTraceRecorder 从 agent run 结果写入 trace', () => {
  assert.match(traceRecorderSource, /saveResult\(result: LivoAgentRunResult\)/)
  assert.match(traceRecorderSource, /result\.toolRounds/)
  assert.match(traceRecorderSource, /confirmation_required/)
  assert.match(traceRecorderSource, /saveCancelled/)
  assert.match(traceRecorderSource, /AgentTraceStore\.save/)
})

test('AI 对话页提供执行轨迹查看入口', () => {
  assert.match(navigationMenusSource, /label: '执行轨迹'/)
  assert.match(navigationMenusSource, /onOpenTrace/)
  assert.match(panelLayoutSource, /AIChatTraceSheet/)
  assert.match(panelLayoutSource, /showTrace/)
  assert.match(tracePanelSource, /AgentTraceStore\.loadAll/)
  assert.match(tracePanelSource, /AgentTraceStore\.clearAll/)
})
