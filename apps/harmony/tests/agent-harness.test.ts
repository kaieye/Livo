import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AgentHarness,
  validateToolArgs,
} from '../entry/src/main/ets/common/agent/AgentHarness.ts'
import type {
  AgentPermissionSettings,
  AgentTool,
  AgentToolInputSchema,
} from '../entry/src/main/ets/common/agent/AgentTypes.ts'
import {
  isAgentCapabilityAllowed,
  normalizeAgentPermissionSettings,
} from '../entry/src/main/ets/common/agent/AgentTypes.ts'
import { AgentToolRegistry } from '../entry/src/main/ets/common/agent/ToolRegistry.ts'

const emptySchema: AgentToolInputSchema = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
}

function createTool(partial: Partial<AgentTool>): AgentTool {
  return {
    name: partial.name ?? 'list_items',
    title: partial.title ?? '查看条目',
    description: partial.description ?? '查看测试条目',
    inputSchema: partial.inputSchema ?? emptySchema,
    capability: partial.capability ?? 'read',
    risk: partial.risk ?? 'low',
    requiresConfirmation: partial.requiresConfirmation ?? false,
    execute:
      partial.execute ??
      (async () => ({
        status: 'success',
        message: '执行成功',
      })),
  }
}

test('AgentToolRegistry 注册工具并输出模型工具定义', () => {
  const registry = new AgentToolRegistry([createTool({ name: 'list_items' })])

  assert.equal(registry.list().length, 1)
  assert.equal(registry.require('list_items').name, 'list_items')
  assert.deepEqual(registry.toModelToolDefinitions()[0], {
    type: 'function',
    function: {
      name: 'list_items',
      description: '查看测试条目',
      parameters: emptySchema,
    },
  })
})

test('AgentToolRegistry 拒绝重复工具名', () => {
  const registry = new AgentToolRegistry()
  registry.register(createTool({ name: 'same_tool' }))

  assert.throws(() => {
    registry.register(createTool({ name: 'same_tool' }))
  }, /重复注册/)
})

test('validateToolArgs 校验必填、类型、枚举和额外参数', () => {
  const schema: AgentToolInputSchema = {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['dark', 'light'] },
      count: { type: 'number' },
    },
    required: ['mode'],
    additionalProperties: false,
  }

  assert.equal(validateToolArgs(schema, {}), '缺少必填参数: mode')
  assert.equal(
    validateToolArgs(schema, { mode: 'dark', count: '1' }),
    '参数 count 必须是 number',
  )
  assert.equal(
    validateToolArgs(schema, { mode: 'system' }),
    '参数 mode 不在允许范围内',
  )
  assert.equal(
    validateToolArgs(schema, { mode: 'dark', extra: true }),
    '不支持的参数: extra',
  )
  assert.equal(validateToolArgs(schema, { mode: 'dark', count: 1 }), '')
})

test('AgentHarness 自动执行低风险只读工具', async () => {
  const registry = new AgentToolRegistry([
    createTool({
      name: 'read_tool',
      capability: 'read',
      risk: 'low',
    }),
  ])
  const harness = new AgentHarness(registry)

  const run = await harness.execute({
    toolName: 'read_tool',
    args: {},
    context: { sessionId: 's1', now: Date.now() },
  })

  assert.equal(run.result.status, 'success')
  assert.equal(run.result.message, '执行成功')
})

test('AgentHarness 拦截未确认的写入工具', async () => {
  const registry = new AgentToolRegistry([
    createTool({
      name: 'write_tool',
      title: '修改设置',
      capability: 'mutate',
      risk: 'medium',
    }),
  ])
  const harness = new AgentHarness(registry)

  const run = await harness.execute({
    toolName: 'write_tool',
    args: {},
    context: { sessionId: 's1', now: Date.now() },
  })

  assert.equal(run.result.status, 'confirmation_required')
  assert.equal(run.result.confirmation?.toolName, 'write_tool')
  assert.match(run.result.message, /确认/)
})

test('AgentHarness 自动执行中低风险导航工具', async () => {
  let executed = false
  const registry = new AgentToolRegistry([
    createTool({
      name: 'open_page',
      capability: 'navigate',
      risk: 'medium',
      execute: async () => {
        executed = true
        return { status: 'success', message: '已打开页面' }
      },
    }),
  ])
  const harness = new AgentHarness(registry)

  const run = await harness.execute({
    toolName: 'open_page',
    args: {},
    context: { sessionId: 's1', now: Date.now() },
  })

  assert.equal(executed, true)
  assert.equal(run.result.status, 'success')
  assert.equal(run.result.message, '已打开页面')
})

test('AgentHarness 确认后执行写入工具', async () => {
  let executed = false
  const registry = new AgentToolRegistry([
    createTool({
      name: 'write_tool',
      capability: 'mutate',
      risk: 'medium',
      execute: async () => {
        executed = true
        return { status: 'success', message: '已修改' }
      },
    }),
  ])
  const harness = new AgentHarness(registry)

  const run = await harness.execute({
    toolName: 'write_tool',
    args: {},
    context: { sessionId: 's1', now: Date.now() },
    confirmed: true,
  })

  assert.equal(executed, true)
  assert.equal(run.result.status, 'success')
  assert.equal(run.result.message, '已修改')
})

test('AgentHarness 按用户权限阻止被关闭的工具能力', async () => {
  let executed = false
  const registry = new AgentToolRegistry([
    createTool({
      name: 'open_page',
      title: '打开页面',
      capability: 'navigate',
      risk: 'low',
      execute: async () => {
        executed = true
        return { status: 'success', message: '已打开页面' }
      },
    }),
  ])
  const harness = new AgentHarness(registry)
  const permissions: AgentPermissionSettings = {
    allowRead: true,
    allowNavigate: false,
    allowMutate: true,
    allowDestructive: true,
    allowExternal: true,
  }

  const run = await harness.execute({
    toolName: 'open_page',
    args: {},
    context: {
      sessionId: 's1',
      now: Date.now(),
      agentPermissions: permissions,
    },
    confirmed: true,
  })

  assert.equal(executed, false)
  assert.equal(run.result.status, 'failed')
  assert.match(run.result.message, /未允许打开页面/)
})

test('Agent 权限默认值补齐并按能力判断', () => {
  const normalized = normalizeAgentPermissionSettings({ allowMutate: false })

  assert.equal(normalized.allowRead, true)
  assert.equal(normalized.allowMutate, false)
  assert.equal(isAgentCapabilityAllowed('read', normalized), true)
  assert.equal(isAgentCapabilityAllowed('mutate', normalized), false)
})

test('AgentHarness 将工具异常转为失败结果', async () => {
  const registry = new AgentToolRegistry([
    createTool({
      name: 'bad_tool',
      execute: async () => {
        throw new Error('工具爆炸')
      },
    }),
  ])
  const harness = new AgentHarness(registry)

  const run = await harness.execute({
    toolName: 'bad_tool',
    args: {},
    context: { sessionId: 's1', now: Date.now() },
  })

  assert.equal(run.result.status, 'failed')
  assert.equal(run.result.message, '工具爆炸')
})
