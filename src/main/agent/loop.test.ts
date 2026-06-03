import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AIConfig, AgentTool, AgentToolResult } from '../../shared/types'
import { agentToolRegistryProvider } from './registry-provider'

vi.mock('../services/ai/ai-client', () => ({
  createOpenAIClient: vi.fn(),
}))

vi.mock('./context-builder', () => ({
  buildContextFallback: vi.fn(() => ''),
}))

// `default-tools.ts` registers a real builder at import time that pulls in
// all nine tool files, several of which touch Electron-only APIs at module
// load. Stub it out so the test owns the registry through `setBuilder`.
vi.mock('./default-tools', () => ({
  buildDefaultAgentToolRegistry: () => ({
    toModelToolDefinitions: () => [],
  }),
  buildAllowedAgentToolRegistry: () => ({
    toModelToolDefinitions: () => [],
  }),
}))

import { runAgentCore } from './loop'
import { createOpenAIClient } from '../services/ai/ai-client'

const fakeConfig: AIConfig = {
  provider: 'openai',
  apiKey: 'test-key',
  baseUrl: 'https://api.example.com/v1',
  model: 'gpt-test',
}

function makeClient(responses: unknown[]) {
  let index = 0
  return {
    chat: {
      completions: {
        create: vi.fn(async () => {
          const value = responses[Math.min(index, responses.length - 1)]
          index += 1
          return value
        }),
      },
    },
  }
}

function makeTool(overrides: Partial<AgentTool> = {}): AgentTool {
  return {
    name: 'read_thing',
    title: '读取',
    description: '读取一个东西',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'id' } },
      required: ['id'],
      additionalProperties: false,
    },
    capability: 'read',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (): Promise<AgentToolResult> => ({
      status: 'success',
      message: 'ok',
    }),
    ...overrides,
  }
}

const textOnlyResponse = {
  choices: [{ message: { content: 'hello back', tool_calls: null } }],
}

const toolCallResponse = {
  choices: [
    {
      message: {
        content: '',
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: { name: 'read_thing', arguments: '{"id":"a"}' },
          },
        ],
      },
    },
  ],
}

const mutateCallResponse = {
  choices: [
    {
      message: {
        content: '',
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: { name: 'do_mutate', arguments: '{}' },
          },
        ],
      },
    },
  ],
}

beforeEach(() => {
  agentToolRegistryProvider.resetForTests()
  vi.mocked(createOpenAIClient).mockReset()
})

describe('runAgentCore', () => {
  it('returns completed status with text and empty tool rounds for a text-only reply', async () => {
    vi.mocked(createOpenAIClient).mockReturnValue(
      makeClient([textOnlyResponse]) as never,
    )

    const result = await runAgentCore({
      prompt: 'hi',
      aiConfig: fakeConfig,
    })

    expect(result.status).toBe('completed')
    expect(result.text).toBe('hello back')
    expect(result.toolRounds).toEqual([])
    expect(result.metrics.llmMs).toBeGreaterThanOrEqual(0)
    expect(result.metrics.rounds).toHaveLength(1)
  })

  it('executes a tool then completes when the tool needs no confirmation', async () => {
    agentToolRegistryProvider.setBuilder(() => [makeTool()])
    vi.mocked(createOpenAIClient).mockReturnValue(
      makeClient([toolCallResponse, textOnlyResponse]) as never,
    )

    const result = await runAgentCore({
      prompt: 'lookup a',
      aiConfig: fakeConfig,
    })

    expect(result.status).toBe('completed')
    expect(result.text).toBe('hello back')
    expect(result.toolRounds).toHaveLength(1)
    expect(result.toolRounds[0].name).toBe('read_thing')
    expect(result.metrics.rounds.length).toBeGreaterThanOrEqual(2)
  })

  it('returns confirmation_required with continuation state when a mutate tool needs confirmation', async () => {
    agentToolRegistryProvider.setBuilder(() => [
      makeTool({
        name: 'do_mutate',
        capability: 'mutate',
        risk: 'medium',
        requiresConfirmation: true,
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
      }),
    ])
    vi.mocked(createOpenAIClient).mockReturnValue(
      makeClient([mutateCallResponse]) as never,
    )

    const result = await runAgentCore({
      prompt: 'do it',
      aiConfig: fakeConfig,
    })

    expect(result.status).toBe('confirmation_required')
    expect(result.confirmation).toBeDefined()
    expect(result.continuation).toBeDefined()
    expect(result.continuation?.pendingToolCall.id).toBe('call-1')
    expect(result.continuation?.nextRound).toBe(1)
  })

  it('honors an already-aborted signal by rejecting before any LLM call', async () => {
    const client = makeClient([textOnlyResponse])
    vi.mocked(createOpenAIClient).mockReturnValue(client as never)

    const controller = new AbortController()
    controller.abort()
    await expect(
      runAgentCore({
        prompt: 'hi',
        aiConfig: fakeConfig,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(client.chat.completions.create).not.toHaveBeenCalled()
  })
})
