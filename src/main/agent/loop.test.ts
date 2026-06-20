import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  AgentPermissionSettings,
  AIConfig,
  AgentTool,
  AgentToolArgs,
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

import { MAX_AGENT_ROUNDS, resumeAgentCore, runAgentCore } from './loop'
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

function toolCallResponseFor(
  id: string,
  name: string,
  args: AgentToolArgs,
): unknown {
  return {
    choices: [
      {
        message: {
          content: '',
          tool_calls: [
            {
              id,
              type: 'function',
              function: { name, arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
  }
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

  it('keeps only recent bounded history and truncates oversized prompt input', async () => {
    const client = makeClient([textOnlyResponse])
    vi.mocked(createOpenAIClient).mockReturnValue(client as never)

    await runAgentCore({
      prompt: 'p'.repeat(13000),
      aiConfig: fakeConfig,
      history: Array.from({ length: 20 }, (_, index) => ({
        role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `${index}:${'h'.repeat(5000)}`,
      })),
    })

    const firstCallOptions = client.chat.completions.create.mock
      .calls[0]?.[0] as {
      messages: Array<{
        role: string
        content?: string
      }>
    }
    expect(firstCallOptions.messages).toHaveLength(18)
    expect(firstCallOptions.messages[1]?.content).toMatch(/^4:/)
    expect(firstCallOptions.messages[1]?.content).toContain('内容已截断')
    expect(firstCallOptions.messages.at(-1)?.content).toContain('内容已截断')
    expect(firstCallOptions.messages.at(-1)?.content?.length).toBeLessThan(
      12200,
    )
  })

  it('uses a tool-free final summary call when tool rounds reach the limit', async () => {
    agentToolRegistryProvider.setBuilder(() => [makeTool()])
    const client = makeClient([
      ...Array.from({ length: MAX_AGENT_ROUNDS }, () => toolCallResponse),
      textOnlyResponse,
    ])
    vi.mocked(createOpenAIClient).mockReturnValue(client as never)

    const result = await runAgentCore({
      prompt: 'keep looking',
      aiConfig: fakeConfig,
    })

    expect(result.status).toBe('completed')
    expect(result.text).toBe('hello back')
    expect(result.toolRounds).toHaveLength(MAX_AGENT_ROUNDS)
    expect(client.chat.completions.create).toHaveBeenCalledTimes(
      MAX_AGENT_ROUNDS + 1,
    )
    const finalCallOptions = client.chat.completions.create.mock.calls.at(
      -1,
    )?.[0] as {
      messages: Array<{
        role: string
        content?: string
      }>
      tools?: unknown
      tool_choice?: unknown
    }
    expect(finalCallOptions.tools).toBeUndefined()
    expect(finalCallOptions.tool_choice).toBeUndefined()
    expect(finalCallOptions.messages.at(-1)).toMatchObject({
      role: 'system',
    })
    expect(finalCallOptions.messages.at(-1)?.content).toContain(
      '工具调用轮次上限',
    )
  })

  it('handles a natural-language search-and-open request through search_and_open_entry', async () => {
    const executedArgs: AgentToolArgs[] = []
    const prompt = '搜索并打开最相关文章：Rust async'
    const client = makeClient([
      toolCallResponseFor('call-open', 'search_and_open_entry', {
        query: 'Rust async',
        limit: 1,
      }),
      {
        choices: [
          { message: { content: '已打开最匹配文章', tool_calls: null } },
        ],
      },
    ])
    agentToolRegistryProvider.setBuilder(() => [
      makeTool({
        name: 'search_and_open_entry',
        title: '搜索并打开文章',
        capability: 'navigate',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词' },
            limit: { type: 'number', description: '返回文章数量' },
          },
          required: ['query'],
          additionalProperties: false,
        },
        execute: async (_context, args): Promise<AgentToolResult> => {
          executedArgs.push(args)
          return {
            status: 'success',
            message: '已打开最匹配的文章：Rust async in practice',
          }
        },
      }),
    ])
    vi.mocked(createOpenAIClient).mockReturnValue(client as never)

    const events: AgentToolExecutionEvent[] = []
    const result = await runAgentCore({
      prompt,
      aiConfig: fakeConfig,
      onToolEvent: (event) => events.push(event),
    })

    expect(result.status).toBe('completed')
    expect(result.text).toBe('已打开最匹配文章')
    expect(executedArgs).toEqual([{ query: 'Rust async', limit: 1 }])
    expect(result.toolRounds).toHaveLength(1)
    expect(result.toolRounds[0]).toMatchObject({
      name: 'search_and_open_entry',
      status: 'success',
    })
    expect(events.map((event) => event.type)).toEqual([
      'tool_started',
      'tool_completed',
    ])
    const firstCallOptions = client.chat.completions.create.mock
      .calls[0]?.[0] as {
      messages: Array<{ role: string; content?: string }>
    }
    expect(
      firstCallOptions.messages.some(
        (message) => message.role === 'user' && message.content === prompt,
      ),
    ).toBe(true)
  })

  it('parks and resumes a natural-language favorite request through set_entry_starred_state', async () => {
    const executedArgs: AgentToolArgs[] = []
    agentToolRegistryProvider.setBuilder(() => [
      makeTool({
        name: 'set_entry_starred_state',
        title: '标记文章收藏状态',
        capability: 'mutate',
        risk: 'medium',
        requiresConfirmation: true,
        inputSchema: {
          type: 'object',
          properties: {
            entryId: { type: 'string', description: '文章 ID' },
            isStarred: { type: 'boolean', description: '是否收藏' },
          },
          required: ['entryId', 'isStarred'],
          additionalProperties: false,
        },
        execute: async (_context, args): Promise<AgentToolResult> => {
          executedArgs.push(args)
          return { status: 'success', message: '已收藏文章' }
        },
      }),
    ])
    vi.mocked(createOpenAIClient)
      .mockReturnValueOnce(
        makeClient([
          toolCallResponseFor('call-star', 'set_entry_starred_state', {
            entryId: 'entry-1',
            isStarred: true,
          }),
        ]) as never,
      )
      .mockReturnValueOnce(
        makeClient([
          {
            choices: [
              { message: { content: '已收藏这篇文章', tool_calls: null } },
            ],
          },
        ]) as never,
      )

    const firstResult = await runAgentCore({
      prompt: '收藏这篇文章',
      aiConfig: fakeConfig,
    })

    expect(firstResult.status).toBe('confirmation_required')
    expect(firstResult.confirmation).toMatchObject({
      toolName: 'set_entry_starred_state',
      args: JSON.stringify({ entryId: 'entry-1', isStarred: true }),
    })
    expect(executedArgs).toEqual([])

    const continuation = firstResult.continuation
    expect(continuation).toBeDefined()
    const resumed = await resumeAgentCore({
      continuation: continuation!,
      aiConfig: fakeConfig,
    })

    expect(resumed.status).toBe('completed')
    expect(resumed.text).toBe('已收藏这篇文章')
    expect(executedArgs).toEqual([{ entryId: 'entry-1', isStarred: true }])
    expect(resumed.toolRounds.map((round) => round.name)).toEqual([
      'set_entry_starred_state',
      'set_entry_starred_state',
    ])
    expect(resumed.toolRounds.map((round) => round.status)).toEqual([
      'confirmation_required',
      'success',
    ])
  })

  it.each([
    { prompt: '把这篇文章标为已读', isRead: true, finalText: '已标为已读' },
    { prompt: '把这篇文章标为未读', isRead: false, finalText: '已标为未读' },
  ])(
    'parks and resumes a natural-language read-state request: $prompt',
    async ({ prompt, isRead, finalText }) => {
      const executedArgs: AgentToolArgs[] = []
      agentToolRegistryProvider.setBuilder(() => [
        makeTool({
          name: 'set_entry_read_state',
          title: '标记文章已读状态',
          capability: 'mutate',
          risk: 'medium',
          requiresConfirmation: true,
          inputSchema: {
            type: 'object',
            properties: {
              entryId: { type: 'string', description: '文章 ID' },
              isRead: { type: 'boolean', description: '是否已读' },
            },
            required: ['entryId', 'isRead'],
            additionalProperties: false,
          },
          execute: async (_context, args): Promise<AgentToolResult> => {
            executedArgs.push(args)
            return { status: 'success', message: finalText }
          },
        }),
      ])
      vi.mocked(createOpenAIClient)
        .mockReturnValueOnce(
          makeClient([
            toolCallResponseFor('call-read', 'set_entry_read_state', {
              entryId: 'entry-1',
              isRead,
            }),
          ]) as never,
        )
        .mockReturnValueOnce(
          makeClient([
            {
              choices: [{ message: { content: finalText, tool_calls: null } }],
            },
          ]) as never,
        )

      const firstResult = await runAgentCore({
        prompt,
        aiConfig: fakeConfig,
      })

      expect(firstResult.status).toBe('confirmation_required')
      expect(firstResult.confirmation?.toolName).toBe('set_entry_read_state')
      expect(executedArgs).toEqual([])

      const continuation = firstResult.continuation
      expect(continuation).toBeDefined()
      const resumed = await resumeAgentCore({
        continuation: continuation!,
        aiConfig: fakeConfig,
      })

      expect(resumed.status).toBe('completed')
      expect(resumed.text).toBe(finalText)
      expect(executedArgs).toEqual([{ entryId: 'entry-1', isRead }])
      expect(resumed.toolRounds.map((round) => round.status)).toEqual([
        'confirmation_required',
        'success',
      ])
    },
  )

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

  it('reports tool_failed and skips later tools when a tool is cancelled', async () => {
    const controller = new AbortController()
    const started: string[] = []
    const events: AgentToolExecutionEvent[] = []
    const readOne = makeTool({
      name: 'read_one',
      risk: 'medium',
      execute: async (_context): Promise<AgentToolResult> => {
        started.push('read_one')
        controller.abort()
        await new Promise<void>((resolve) => setTimeout(resolve, 500))
        return { status: 'success', message: 'late' }
      },
    })
    const readTwo = makeTool({
      name: 'read_two',
      execute: async (): Promise<AgentToolResult> => {
        started.push('read_two')
        return { status: 'success', message: 'should not run' }
      },
    })

    agentToolRegistryProvider.setBuilder(() => [readOne, readTwo])

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

    const client = makeClient([twoToolCallResponse, textOnlyResponse])
    vi.mocked(createOpenAIClient).mockReturnValue(client as never)

    const result = await runAgentCore({
      prompt: 'lookup two things',
      aiConfig: fakeConfig,
      signal: controller.signal,
      onToolEvent: (event) => events.push(event),
    })

    expect(result.status).toBe('completed')
    expect(started).toEqual(['read_one'])
    expect(result.toolRounds.map((round) => round.name)).toEqual([
      'read_one',
      'read_two',
    ])
    expect(result.toolRounds.map((round) => round.status)).toEqual([
      'failed',
      'failed',
    ])
    expect(events.filter((event) => event.type === 'tool_failed')).toHaveLength(
      2,
    )
    expect(
      events.some(
        (event) =>
          event.type === 'tool_failed' &&
          event.toolName === 'read_two' &&
          (event.message ?? '').includes('已跳过后续工具'),
      ),
    ).toBe(true)
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1)
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

  it('skips remaining resumed tools when the confirmed tool is cancelled', async () => {
    const controller = new AbortController()
    const started: string[] = []
    const events: AgentToolExecutionEvent[] = []

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
        execute: async (): Promise<AgentToolResult> => {
          started.push('do_mutate')
          controller.abort()
          await new Promise<void>((resolve) => setTimeout(resolve, 500))
          return { status: 'success', message: 'late' }
        },
      }),
      makeTool({
        name: 'read_one',
        execute: async (): Promise<AgentToolResult> => {
          started.push('read_one')
          return { status: 'success', message: 'should not run' }
        },
      }),
    ])

    vi.mocked(createOpenAIClient).mockReturnValue(
      makeClient([textOnlyResponse]) as never,
    )

    const resumed = await resumeAgentCore({
      continuation: {
        messages: [],
        pendingToolCall: {
          id: 'call-1',
          name: 'do_mutate',
          arguments: '{}',
        },
        remainingToolCalls: [
          {
            id: 'call-2',
            name: 'read_one',
            arguments: '{"id":"a"}',
          },
        ],
        toolRounds: [],
        nextRound: 1,
      },
      aiConfig: fakeConfig,
      signal: controller.signal,
      onToolEvent: (event) => events.push(event),
    })

    expect(resumed.status).toBe('completed')
    expect(started).toEqual(['do_mutate'])
    expect(resumed.toolRounds.map((round) => round.name)).toEqual([
      'do_mutate',
      'read_one',
    ])
    expect(resumed.toolRounds.map((round) => round.status)).toEqual([
      'failed',
      'failed',
    ])
    expect(events.filter((event) => event.type === 'tool_failed')).toHaveLength(
      2,
    )
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

  it('aborts a hanging model call at the agent run timeout', async () => {
    vi.useFakeTimers()
    const client = {
      chat: {
        completions: {
          create: vi.fn(
            (_options: unknown, requestOptions?: { signal?: AbortSignal }) =>
              new Promise((_resolve, reject) => {
                requestOptions?.signal?.addEventListener(
                  'abort',
                  () => reject(requestOptions.signal?.reason),
                  { once: true },
                )
              }),
          ),
        },
      },
    }
    vi.mocked(createOpenAIClient).mockReturnValue(client as never)

    const runPromise = runAgentCore({
      prompt: 'hi',
      aiConfig: fakeConfig,
      timeoutMs: 25,
    })
    const assertion = expect(runPromise).rejects.toMatchObject({
      name: 'TimeoutError',
    })
    await vi.advanceTimersByTimeAsync(25)

    await assertion
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('passes the agent deadline to tool execution', async () => {
    let observedDeadline: number | undefined
    agentToolRegistryProvider.setBuilder(() => [
      makeTool({
        execute: async (context): Promise<AgentToolResult> => {
          observedDeadline = context.deadlineMs
          return { status: 'success', message: 'ok' }
        },
      }),
    ])
    vi.mocked(createOpenAIClient).mockReturnValue(
      makeClient([toolCallResponse, textOnlyResponse]) as never,
    )

    const before = Date.now()
    const result = await runAgentCore({
      prompt: 'lookup a',
      aiConfig: fakeConfig,
      timeoutMs: 5000,
    })

    expect(result.status).toBe('completed')
    expect(observedDeadline).toBeGreaterThanOrEqual(before + 4900)
    expect(observedDeadline).toBeLessThanOrEqual(Date.now() + 5000)
  })
})
