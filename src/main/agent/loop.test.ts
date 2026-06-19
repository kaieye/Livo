import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  AgentPermissionSettings,
  AIConfig,
  AgentTool,
  AgentToolExecutionEvent,
  AgentToolResult,
} from '../../shared/types'
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
    toModelToolDefinitions: () => [
      {
        type: 'function',
        function: {
          name: 'default_fallback_tool',
          description: 'Should not be exposed by permission fallback',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
    ],
  }),
  buildAllowedAgentToolRegistry: () => ({
    toModelToolDefinitions: () => [],
  }),
}))

import { resumeAgentCore, runAgentCore } from './loop'
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
        create: vi.fn(async (..._args: unknown[]) => {
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

const malformedToolCallResponse = {
  choices: [
    {
      message: {
        content: '',
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: { name: 'read_thing', arguments: '{"id":' },
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

const mutateThenReadCallResponse = {
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
          {
            id: 'call-2',
            type: 'function',
            function: { name: 'read_one', arguments: '{"id":"a"}' },
          },
          {
            id: 'call-3',
            type: 'function',
            function: { name: 'read_two', arguments: '{"id":"b"}' },
          },
        ],
      },
    },
  ],
}

const noAgentPermissions: AgentPermissionSettings = {
  allowRead: false,
  allowNavigate: false,
  allowMutate: false,
  allowDestructive: false,
  allowExternal: false,
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

  it('feeds malformed tool JSON back as a failed tool result', async () => {
    agentToolRegistryProvider.setBuilder(() => [makeTool()])
    const client = makeClient([malformedToolCallResponse, textOnlyResponse])
    vi.mocked(createOpenAIClient).mockReturnValue(client as never)

    const events: AgentToolExecutionEvent[] = []
    const result = await runAgentCore({
      prompt: 'lookup a',
      aiConfig: fakeConfig,
      onToolEvent: (event) => events.push(event),
    })

    expect(result.status).toBe('completed')
    expect(result.toolRounds).toHaveLength(1)
    expect(result.toolRounds[0].status).toBe('failed')
    expect(result.toolRounds[0].resultSummary).toMatch(/工具参数不是合法 JSON/)
    expect(events.some((event) => event.type === 'tool_failed')).toBe(true)

    expect(client.chat.completions.create).toHaveBeenCalledTimes(2)
    const secondCallOptions = client.chat.completions.create.mock
      .calls[1]?.[0] as {
      messages: Array<{
        role: string
        content?: string
      }>
    }
    const messages = secondCallOptions.messages
    expect(
      messages.some(
        (m) =>
          m.role === 'tool' && m.content?.includes('工具参数不是合法 JSON'),
      ),
    ).toBe(true)
  })

  it('does not expose tools when all agent permissions are disabled', async () => {
    agentToolRegistryProvider.setBuilder(() => [makeTool()])
    const client = makeClient([textOnlyResponse])
    vi.mocked(createOpenAIClient).mockReturnValue(client as never)

    await runAgentCore({
      prompt: 'lookup a',
      aiConfig: fakeConfig,
      permissions: noAgentPermissions,
    })

    expect(client.chat.completions.create).toHaveBeenCalledTimes(1)
    const firstCallOptions = client.chat.completions.create.mock
      .calls[0]?.[0] as {
      tools?: unknown
      tool_choice?: unknown
    }
    expect(firstCallOptions.tools).toBeUndefined()
    expect(firstCallOptions.tool_choice).toBeUndefined()
  })

  it('executes consecutive low-risk read tools in the same round concurrently', async () => {
    const release: Array<() => void> = []
    const started: string[] = []
    const makeBlockingTool = (name: string): AgentTool =>
      makeTool({
        name,
        execute: async (): Promise<AgentToolResult> => {
          started.push(name)
          await new Promise<void>((resolve) => release.push(resolve))
          return { status: 'success', message: `${name} ok` }
        },
      })

    agentToolRegistryProvider.setBuilder(() => [
      makeBlockingTool('read_one'),
      makeBlockingTool('read_two'),
    ])

    const twoToolCallResponse = {
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              {
                id: 'call-1',
                type: 'function',
                function: { name: 'read_one', arguments: '{"id":"a"}' },
              },
              {
                id: 'call-2',
                type: 'function',
                function: { name: 'read_two', arguments: '{"id":"b"}' },
              },
            ],
          },
        },
      ],
    }

    vi.mocked(createOpenAIClient).mockReturnValue(
      makeClient([twoToolCallResponse, textOnlyResponse]) as never,
    )

    const runPromise = runAgentCore({
      prompt: 'lookup two things',
      aiConfig: fakeConfig,
    })

    await vi.waitFor(() => {
      expect(started).toEqual(['read_one', 'read_two'])
    })
    release.forEach((resolve) => resolve())

    const result = await runPromise
    expect(result.status).toBe('completed')
    expect(result.toolRounds.map((round) => round.name)).toEqual([
      'read_one',
      'read_two',
    ])
  })

  it('resumes a confirmed tool then batches remaining low-risk read tools', async () => {
    const release: Array<() => void> = []
    const started: string[] = []
    const makeBlockingReadTool = (name: string): AgentTool =>
      makeTool({
        name,
        execute: async (): Promise<AgentToolResult> => {
          started.push(name)
          await new Promise<void>((resolve) => release.push(resolve))
          return { status: 'success', message: `${name} ok` }
        },
      })

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
        execute: async (): Promise<AgentToolResult> => ({
          status: 'success',
          message: 'mutated',
        }),
      }),
      makeBlockingReadTool('read_one'),
      makeBlockingReadTool('read_two'),
    ])

    vi.mocked(createOpenAIClient)
      .mockReturnValueOnce(makeClient([mutateThenReadCallResponse]) as never)
      .mockReturnValueOnce(makeClient([textOnlyResponse]) as never)

    const firstResult = await runAgentCore({
      prompt: 'mutate then read',
      aiConfig: fakeConfig,
    })

    expect(firstResult.status).toBe('confirmation_required')
    expect(
      firstResult.continuation?.remainingToolCalls.map((call) => call.id),
    ).toEqual(['call-2', 'call-3'])

    const continuation = firstResult.continuation
    expect(continuation).toBeDefined()
    const resumePromise = resumeAgentCore({
      continuation: continuation!,
      aiConfig: fakeConfig,
    })

    await vi.waitFor(() => {
      expect(started).toEqual(['read_one', 'read_two'])
    })
    release.forEach((resolve) => resolve())

    const resumed = await resumePromise
    expect(resumed.status).toBe('completed')
    expect(resumed.text).toBe('hello back')
    expect(resumed.toolRounds.map((round) => round.name)).toEqual([
      'do_mutate',
      'do_mutate',
      'read_one',
      'read_two',
    ])
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
