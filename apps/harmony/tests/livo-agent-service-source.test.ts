import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'

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
  '../entry/src/main/ets/common/components/AIChatTraceRecorder.ets',
  '../entry/src/main/ets/common/agent/LivoAgentService.ets',
  '../entry/src/main/ets/common/agent/AgentTraceStore.ets',
]

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

const livoAgentServiceSource = readSource(
  '../entry/src/main/ets/common/agent/LivoAgentService.ets',
)

const livoAgentLoopSource = readSource(
  '../entry/src/main/ets/common/agent/LivoAgentLoop.ets',
)

const aiChatPanelSource = readSource(
  '../entry/src/main/ets/common/components/AIChatPanel.ets',
)

test('LivoAgentService 作为入口组装默认工具并调用 LivoAgentLoop', () => {
  assert.match(livoAgentServiceSource, /export async function runLivoAgent/)
  assert.match(livoAgentServiceSource, /export async function resumeLivoAgent/)
  assert.match(
    livoAgentServiceSource,
    /buildDefaultTools\(request\.aiSettings\.agentPermissions\)/,
  )
  assert.match(livoAgentServiceSource, /from '\.\/LivoAgentLoop'/)
  assert.match(livoAgentServiceSource, /runAgentCore\(/)
  assert.match(livoAgentServiceSource, /resumeAgentCore\(/)
  assert.match(livoAgentServiceSource, /LivoAgentEventType = 'tool_started'/)
  assert.match(livoAgentServiceSource, /confirmation_required/)
})

test('LivoAgentService 不再依赖已下线的 AIChatAgentService', () => {
  assert.doesNotMatch(livoAgentServiceSource, /AIChatAgentService/)
  assert.equal(
    existsSync(
      new URL(
        '../entry/src/main/ets/common/services/AIChatAgentService.ets',
        import.meta.url,
      ),
    ),
    false,
    '旧 AIChatAgentService.ets 应已删除',
  )
})

test('LivoAgentLoop 承载 agent 编排核心：上下文构造、循环、确认、工具执行', () => {
  assert.match(livoAgentLoopSource, /export async function runAgentCore/)
  assert.match(livoAgentLoopSource, /export async function resumeAgentCore/)
  assert.match(livoAgentLoopSource, /async function runAgentLoop/)
  assert.match(livoAgentLoopSource, /async function executeAgentToolCall/)
  assert.match(livoAgentLoopSource, /function buildConfirmationRequiredResult/)
  assert.match(livoAgentLoopSource, /async function buildContextFallback/)
  assert.match(livoAgentLoopSource, /AGENT_SYSTEM_PROMPT/)
  assert.match(livoAgentLoopSource, /MAX_AGENT_ROUNDS = 5/)
  assert.match(livoAgentLoopSource, /parseTextToolCalls/)
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
  assert.doesNotMatch(aiChatPanelSource, /from '.*AIChatAgentService'/)
})

test('agent 对话入口相关代码文件不超过 500 行', () => {
  for (const path of agentUiSourcePaths) {
    const source = readSource(path)
    const lineCount = source.split(/\r?\n/).length
    assert.ok(lineCount <= 500, `${path} 当前 ${lineCount} 行，超过 500 行限制`)
  }
})
