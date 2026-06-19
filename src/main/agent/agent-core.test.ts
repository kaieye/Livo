import { describe, it, expect, vi } from 'vitest'
import type {
  AgentExecutionContext,
  AgentTool,
  AgentToolResult,
} from '../../shared/types'
import { AgentToolRegistry } from './tool-registry'
import { AgentPolicyGuard } from './policy-guard'
import { AgentHarness, validateToolArgs } from './harness'
import { agentToolResultToText } from './tool-result-text'

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

const ctx = (
  permissions?: AgentExecutionContext['agentPermissions'],
): AgentExecutionContext => ({
  sessionId: 'test',
  now: Date.now(),
  agentPermissions: permissions,
})

describe('AgentToolRegistry', () => {
  it('registers and looks up tools', () => {
    const registry = new AgentToolRegistry([makeTool()])
    expect(registry.get('read_thing')?.title).toBe('读取')
    expect(registry.list()).toHaveLength(1)
  })

  it('rejects duplicate registration', () => {
    const registry = new AgentToolRegistry([makeTool()])
    expect(() => registry.register(makeTool())).toThrow(/重复注册/)
  })

  it('rejects illegal tool names', () => {
    expect(
      () => new AgentToolRegistry([makeTool({ name: 'bad name!' })]),
    ).toThrow(/工具名不合法/)
  })

  it('produces OpenAI-compatible tool definitions', () => {
    const registry = new AgentToolRegistry([makeTool()])
    const [def] = registry.toModelToolDefinitions()
    expect(def.type).toBe('function')
    expect(def.function.name).toBe('read_thing')
    expect(def.function.parameters.required).toContain('id')
  })
})

describe('validateToolArgs', () => {
  const schema = makeTool().inputSchema

  it('flags missing required args', () => {
    expect(validateToolArgs(schema, {})).toMatch(/缺少必填参数/)
  })

  it('flags wrong types', () => {
    expect(validateToolArgs(schema, { id: 123 })).toMatch(/必须是 string/)
  })

  it('flags unsupported args when additionalProperties is false', () => {
    expect(validateToolArgs(schema, { id: 'a', extra: 'x' })).toMatch(
      /不支持的参数/,
    )
  })

  it('rejects values outside an enum', () => {
    const enumSchema = makeTool({
      inputSchema: {
        type: 'object',
        properties: { mode: { type: 'string', enum: ['a', 'b'] } },
        required: ['mode'],
        additionalProperties: false,
      },
    }).inputSchema
    expect(validateToolArgs(enumSchema, { mode: 'c' })).toMatch(/不在允许范围/)
    expect(validateToolArgs(enumSchema, { mode: 'a' })).toBe('')
  })

  it('rejects non-object root args', () => {
    expect(
      validateToolArgs(schema, [] as unknown as Record<string, never>),
    ).toMatch(/必须是 object/)
  })

  it('validates string length and URL schemes', () => {
    const urlSchema = makeTool({
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            minLength: 3,
            maxLength: 20,
            format: 'uri',
            allowedSchemes: ['https'],
          },
        },
        required: ['url'],
        additionalProperties: false,
      },
    }).inputSchema
    expect(validateToolArgs(urlSchema, { url: 'x' })).toMatch(/长度不能小于/)
    expect(validateToolArgs(urlSchema, { url: 'not-a-url' })).toMatch(
      /合法 URL/,
    )
    expect(validateToolArgs(urlSchema, { url: 'http://example.com' })).toMatch(
      /scheme 不在允许范围/,
    )
    expect(validateToolArgs(urlSchema, { url: 'https://example.com' })).toBe('')
  })

  it('validates finite number bounds', () => {
    const numberSchema = makeTool({
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 10 },
        },
        required: ['limit'],
        additionalProperties: false,
      },
    }).inputSchema
    expect(validateToolArgs(numberSchema, { limit: Number.NaN })).toMatch(
      /必须是 number/,
    )
    expect(validateToolArgs(numberSchema, { limit: 0 })).toMatch(/不能小于/)
    expect(validateToolArgs(numberSchema, { limit: 11 })).toMatch(/不能大于/)
    expect(validateToolArgs(numberSchema, { limit: 10 })).toBe('')
  })

  it('validates nested object fields and unsupported nested args', () => {
    const nestedSchema = makeTool({
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'object',
            properties: {
              query: { type: 'string', minLength: 1 },
            },
            required: ['query'],
            additionalProperties: false,
          },
        },
        required: ['filter'],
        additionalProperties: false,
      },
    }).inputSchema
    expect(validateToolArgs(nestedSchema, { filter: {} })).toMatch(
      /缺少必填参数: filter.query/,
    )
    expect(
      validateToolArgs(nestedSchema, {
        filter: { query: 'rss', injected: true },
      }),
    ).toMatch(/不支持的参数: filter.injected/)
    expect(validateToolArgs(nestedSchema, { filter: { query: 'rss' } })).toBe(
      '',
    )
  })

  it('validates array item schemas', () => {
    const arraySchema = makeTool({
      inputSchema: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
          },
        },
        required: ['ids'],
        additionalProperties: false,
      },
    }).inputSchema
    expect(validateToolArgs(arraySchema, { ids: ['a', ''] })).toMatch(
      /ids\[1\] 长度不能小于/,
    )
    expect(validateToolArgs(arraySchema, { ids: ['a', 'b'] })).toBe('')
  })
})

describe('AgentPolicyGuard', () => {
  const guard = new AgentPolicyGuard()

  it('auto-allows read tools', () => {
    const decision = guard.evaluate(makeTool(), {}, ctx())
    expect(decision.allowed).toBe(true)
    expect(decision.requiresConfirmation).toBe(false)
  })

  it('requires confirmation for mutate tools', () => {
    const decision = guard.evaluate(
      makeTool({ capability: 'mutate', risk: 'medium' }),
      {},
      ctx(),
    )
    expect(decision.requiresConfirmation).toBe(true)
  })

  it('blocks tools when the capability permission is disabled', () => {
    const decision = guard.evaluate(
      makeTool({ capability: 'destructive' }),
      {},
      ctx({
        allowRead: true,
        allowNavigate: true,
        allowMutate: true,
        allowDestructive: false,
        allowExternal: true,
      }),
    )
    expect(decision.allowed).toBe(false)
  })
})

describe('AgentHarness', () => {
  it('executes an allowed read tool', async () => {
    const execute = vi.fn(
      async (): Promise<AgentToolResult> => ({
        status: 'success',
        message: 'done',
      }),
    )
    const registry = new AgentToolRegistry([makeTool({ execute })])
    const harness = new AgentHarness(registry)
    const run = await harness.execute({
      toolName: 'read_thing',
      args: { id: 'x' },
      context: ctx(),
    })
    expect(run.result.status).toBe('success')
    expect(execute).toHaveBeenCalledOnce()
  })

  it('returns confirmation_required for unconfirmed mutate tools', async () => {
    const execute = vi.fn(
      async (): Promise<AgentToolResult> => ({
        status: 'success',
        message: 'mutated',
      }),
    )
    const registry = new AgentToolRegistry([
      makeTool({
        name: 'do_mutate',
        capability: 'mutate',
        risk: 'medium',
        execute,
      }),
    ])
    const harness = new AgentHarness(registry)
    const run = await harness.execute({
      toolName: 'do_mutate',
      args: { id: 'x' },
      context: ctx(),
    })
    expect(run.result.status).toBe('confirmation_required')
    expect(run.result.confirmation).toBeDefined()
    expect(execute).not.toHaveBeenCalled()
  })

  it('executes a confirmed mutate tool', async () => {
    const registry = new AgentToolRegistry([
      makeTool({ name: 'do_mutate', capability: 'mutate', risk: 'medium' }),
    ])
    const harness = new AgentHarness(registry)
    const run = await harness.execute({
      toolName: 'do_mutate',
      args: { id: 'x' },
      context: ctx(),
      confirmed: true,
    })
    expect(run.result.status).toBe('success')
  })

  it('fails gracefully for unknown tools', async () => {
    const registry = new AgentToolRegistry([makeTool()])
    const harness = new AgentHarness(registry)
    const run = await harness.execute({
      toolName: 'missing',
      args: {},
      context: ctx(),
    })
    expect(run.result.status).toBe('failed')
    expect(run.result.message).toMatch(/未知 Agent 工具/)
  })

  it('fails when a permission is disabled instead of executing', async () => {
    const execute = vi.fn()
    const registry = new AgentToolRegistry([
      makeTool({
        name: 'do_destroy',
        capability: 'destructive',
        risk: 'high',
        execute,
      }),
    ])
    const harness = new AgentHarness(registry)
    const run = await harness.execute({
      toolName: 'do_destroy',
      args: { id: 'x' },
      context: ctx({
        allowRead: true,
        allowNavigate: true,
        allowMutate: true,
        allowDestructive: false,
        allowExternal: true,
      }),
      confirmed: true,
    })
    expect(run.result.status).toBe('failed')
    expect(execute).not.toHaveBeenCalled()
  })

  it('fails invalid args before entering the tool implementation', async () => {
    const execute = vi.fn(
      async (): Promise<AgentToolResult> => ({
        status: 'success',
        message: 'done',
      }),
    )
    const registry = new AgentToolRegistry([
      makeTool({
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              allowedSchemes: ['https'],
            },
          },
          required: ['url'],
          additionalProperties: false,
        },
        execute,
      }),
    ])
    const harness = new AgentHarness(registry)
    const run = await harness.execute({
      toolName: 'read_thing',
      args: { url: 'javascript:alert(1)' },
      context: ctx(),
    })
    expect(run.result.status).toBe('failed')
    expect(run.result.message).toMatch(/scheme 不在允许范围/)
    expect(execute).not.toHaveBeenCalled()
  })
})

describe('agentToolResultToText', () => {
  it('prefixes failure messages', () => {
    expect(
      agentToolResultToText({ status: 'failed', message: '出错了' }),
    ).toMatch(/^错误：/)
  })

  it('renders confirmation details', () => {
    const text = agentToolResultToText({
      status: 'confirmation_required',
      message: 'need',
      confirmation: {
        toolName: 't',
        title: '确认',
        message: '请确认',
        risk: 'high',
        argsPreview: 'id: x',
      },
    })
    expect(text).toContain('确认')
    expect(text).toContain('风险等级: high')
  })
})
