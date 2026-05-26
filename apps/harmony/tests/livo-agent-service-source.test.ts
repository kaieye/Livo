import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const agentUiSourcePaths = [
  '../entry/src/main/ets/common/components/AIChatPanel.ets',
  '../entry/src/main/ets/common/components/AIChatPanelLayout.ets',
  '../entry/src/main/ets/common/components/AIChatConversationList.ets',
  '../entry/src/main/ets/common/components/AIChatConfirmationCard.ets',
  '../entry/src/main/ets/common/components/AIChatInputComposer.ets',
  '../entry/src/main/ets/common/components/AIChatEmptyState.ets',
  '../entry/src/main/ets/common/components/AIChatRunStatusBar.ets',
  '../entry/src/main/ets/common/components/AIChatMarkdownText.ets',
  '../entry/src/main/ets/common/components/AIChatPanelTypes.ts',
  '../entry/src/main/ets/common/components/AIChatToolLabels.ts',
  '../entry/src/main/ets/common/components/AIChatNavigationMenus.ets',
  '../entry/src/main/ets/common/components/AIChatSheets.ets',
  '../entry/src/main/ets/common/components/AIChatTracePanel.ets',
  '../entry/src/main/ets/common/components/AIChatTraceRecorder.ts',
  '../entry/src/main/ets/common/agent/LivoAgentService.ets',
  '../entry/src/main/ets/common/agent/AgentTraceStore.ets',
]

const livoAgentServiceSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/agent/LivoAgentService.ets',
    import.meta.url,
  ),
  'utf8',
)

const aiChatPanelSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/AIChatPanel.ets',
    import.meta.url,
  ),
  'utf8',
)

test('LivoAgentService 作为统一 agent 入口组装默认工具和旧模型循环', () => {
  assert.match(livoAgentServiceSource, /export async function runLivoAgent/)
  assert.match(livoAgentServiceSource, /export async function resumeLivoAgent/)
  assert.match(
    livoAgentServiceSource,
    /buildDefaultTools\(request\.aiSettings\.agentPermissions\)/,
  )
  assert.match(livoAgentServiceSource, /runChatAgent\(/)
  assert.match(livoAgentServiceSource, /resumeChatAgent\(/)
  assert.match(livoAgentServiceSource, /LivoAgentEventType = 'tool_started'/)
  assert.match(livoAgentServiceSource, /confirmation_required/)
})

test('AIChatPanel 通过 LivoAgentService 消费 agent 事件', () => {
  assert.match(aiChatPanelSource, /from '\.\.\/agent\/LivoAgentService'/)
  assert.match(aiChatPanelSource, /await runLivoAgent\(\{/)
  assert.match(aiChatPanelSource, /await resumeLivoAgent\(\{/)
  assert.match(aiChatPanelSource, /AIChatTraceRecorder/)
  assert.match(aiChatPanelSource, /onEvent: \(event\) =>/)
  assert.match(aiChatPanelSource, /this\.handleAgentEvent\(event\)/)
  assert.match(aiChatPanelSource, /pendingConfirmation/)
  assert.match(aiChatPanelSource, /pendingContinuation/)
  assert.doesNotMatch(aiChatPanelSource, /runChatAgent\(text/)
})

test('agent 对话入口相关代码文件不超过 500 行', () => {
  for (const path of agentUiSourcePaths) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    const lineCount = source.split(/\r?\n/).length
    assert.ok(lineCount <= 500, `${path} 当前 ${lineCount} 行，超过 500 行限制`)
  }
})
