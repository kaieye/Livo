import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentExecutionContext } from '../../../shared/types'
import { AgentHarness } from '../harness'
import { AgentToolRegistry } from '../tool-registry'
import {
  buildForgetPreferenceTool,
  buildRecallPreferenceTool,
  buildRememberPreferenceTool,
} from './memory-tools'
import { AgentMemoryStore } from '../agent-memory'

const mocks = vi.hoisted(() => ({
  userData: '',
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => mocks.userData,
  },
}))

function context(): AgentExecutionContext {
  return {
    sessionId: 'memory-test',
    now: Date.now(),
    signal: new AbortController().signal,
    agentPermissions: {
      allowRead: true,
      allowNavigate: true,
      allowMutate: true,
      allowDestructive: true,
      allowExternal: true,
    },
  }
}

function harness(): AgentHarness {
  return new AgentHarness(
    new AgentToolRegistry([
      buildRememberPreferenceTool(),
      buildRecallPreferenceTool(),
      buildForgetPreferenceTool(),
    ]),
  )
}

describe('memory agent tools', () => {
  beforeEach(() => {
    mocks.userData = mkdtempSync(join(tmpdir(), 'livo-agent-memory-tools-'))
  })

  it('requires confirmation before saving a preference', async () => {
    const agentHarness = harness()
    const args = { topic: '阅读偏好', content: '优先科技文章' }

    const unconfirmed = await agentHarness.execute({
      toolName: 'remember_preference',
      args,
      context: context(),
    })
    expect(unconfirmed.result.status).toBe('confirmation_required')
    expect(AgentMemoryStore.loadAll()).toEqual([])

    const confirmed = await agentHarness.execute({
      toolName: 'remember_preference',
      args,
      context: context(),
      confirmed: true,
    })
    expect(confirmed.result.status).toBe('success')
    expect(AgentMemoryStore.loadAll()[0]).toMatchObject(args)
  })

  it('recalls and forgets saved preferences', async () => {
    const agentHarness = harness()
    AgentMemoryStore.upsert({
      topic: '外部搜索',
      content: '默认不要联网搜索',
    })

    const recalled = await agentHarness.execute({
      toolName: 'recall_preference',
      args: { query: '联网' },
      context: context(),
    })
    expect(recalled.result.status).toBe('success')
    expect(recalled.result.message).toContain('外部搜索')

    const forgotten = await agentHarness.execute({
      toolName: 'forget_preference',
      args: { topic: '外部搜索' },
      context: context(),
      confirmed: true,
    })
    expect(forgotten.result.status).toBe('success')
    expect(AgentMemoryStore.loadAll()).toEqual([])
  })
})
