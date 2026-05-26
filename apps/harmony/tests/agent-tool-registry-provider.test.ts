import test from 'node:test'
import assert from 'node:assert/strict'

import { agentToolRegistryProvider } from '../entry/src/main/ets/common/agent/AgentToolRegistryProvider.ts'
import type {
  AgentExecutionContext,
  AgentPermissionSettings,
  AgentTool,
  AgentToolInputSchema,
} from '../entry/src/main/ets/common/agent/AgentTypes.ts'

const emptySchema: AgentToolInputSchema = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
}

function makeTool(
  name: string,
  capability: AgentTool['capability'],
): AgentTool {
  return {
    name,
    title: name,
    description: `测试工具 ${name}`,
    inputSchema: emptySchema,
    capability,
    risk: 'low',
    requiresConfirmation: false,
    execute: async () => ({ status: 'success', message: 'ok' }),
  }
}

function setupFixtureRegistry(): void {
  agentToolRegistryProvider.setBuilder(() => [
    makeTool('read_one', 'read'),
    makeTool('read_two', 'read'),
    makeTool('nav_one', 'navigate'),
    makeTool('mutate_one', 'mutate'),
    makeTool('destroy_one', 'destructive'),
    makeTool('extern_one', 'external'),
  ])
}

test('Provider 在没注册 builder 时 require 全量会抛错', () => {
  agentToolRegistryProvider.setBuilder(() => [])
  agentToolRegistryProvider.resetForTests()
  // 故意清掉 builder：模拟未初始化场景
  // @ts-expect-error 测试用：访问私有字段
  agentToolRegistryProvider.builder = undefined
  assert.throws(() => agentToolRegistryProvider.full(), /未注册工具构建器/)
})

test('Provider full 缓存单例：相同 build 不重复创建', () => {
  let buildCount = 0
  agentToolRegistryProvider.setBuilder(() => {
    buildCount += 1
    return [makeTool('read_one', 'read')]
  })

  const first = agentToolRegistryProvider.full()
  const second = agentToolRegistryProvider.full()
  assert.equal(first, second, '同一 Provider full() 应该返回同一实例')
  assert.equal(buildCount, 1, 'builder 只应执行一次')
})

test('Provider.forPermissions 按 capability 过滤', () => {
  setupFixtureRegistry()
  agentToolRegistryProvider.resetForTests()

  const readOnly: AgentPermissionSettings = {
    allowRead: true,
    allowNavigate: false,
    allowMutate: false,
    allowDestructive: false,
    allowExternal: false,
  }
  const registry = agentToolRegistryProvider.forPermissions(readOnly)
  const names = registry
    .list()
    .map((tool: AgentTool) => tool.name)
    .sort()
  assert.deepEqual(names, ['read_one', 'read_two'])
})

test('Provider.forPermissions 同 permissions 复用同一过滤视图', () => {
  setupFixtureRegistry()
  agentToolRegistryProvider.resetForTests()

  const permissions: AgentPermissionSettings = {
    allowRead: true,
    allowNavigate: true,
    allowMutate: false,
    allowDestructive: false,
    allowExternal: false,
  }
  const first = agentToolRegistryProvider.forPermissions(permissions)
  const second = agentToolRegistryProvider.forPermissions(permissions)
  assert.equal(first, second, '相同 permissions 应命中 viewCache')
})

test('Provider.forPermissions 不同 permissions 返回不同视图且工具数量不同', () => {
  setupFixtureRegistry()
  agentToolRegistryProvider.resetForTests()

  const allowAll: AgentPermissionSettings = {
    allowRead: true,
    allowNavigate: true,
    allowMutate: true,
    allowDestructive: true,
    allowExternal: true,
  }
  const noWrite: AgentPermissionSettings = {
    allowRead: true,
    allowNavigate: true,
    allowMutate: false,
    allowDestructive: false,
    allowExternal: true,
  }
  const full = agentToolRegistryProvider.forPermissions(allowAll)
  const safe = agentToolRegistryProvider.forPermissions(noWrite)
  assert.notEqual(full, safe)
  assert.equal(full.list().length, 6)
  assert.equal(safe.list().length, 4)
})

test('Provider.forContext 按 permissions + activeRoute key 分桶缓存', () => {
  setupFixtureRegistry()
  agentToolRegistryProvider.resetForTests()

  const baseCtx: AgentExecutionContext = {
    sessionId: 's1',
    now: 1,
    activeRoute: '/home',
    activeRootTab: 'home',
    agentPermissions: {
      allowRead: true,
      allowNavigate: true,
      allowMutate: true,
      allowDestructive: true,
      allowExternal: true,
    },
  }
  const otherRouteCtx: AgentExecutionContext = {
    sessionId: 's1',
    now: 2,
    activeRoute: '/article',
    activeRootTab: 'home',
    agentPermissions: baseCtx.agentPermissions,
  }
  const a1 = agentToolRegistryProvider.forContext(baseCtx)
  const a2 = agentToolRegistryProvider.forContext(baseCtx)
  const b = agentToolRegistryProvider.forContext(otherRouteCtx)
  assert.equal(a1, a2, '相同 context key 命中缓存')
  assert.notEqual(a1, b, '不同 activeRoute 应该走不同缓存桶')
})

test('Provider.executeToolRun 通过 Harness 拦截被禁用 capability', async () => {
  agentToolRegistryProvider.setBuilder(() => [makeTool('nav_one', 'navigate')])
  agentToolRegistryProvider.resetForTests()

  const noNav: AgentPermissionSettings = {
    allowRead: true,
    allowNavigate: false,
    allowMutate: true,
    allowDestructive: true,
    allowExternal: true,
  }
  const run = await agentToolRegistryProvider.executeToolRun(
    'nav_one',
    {},
    false,
    noNav,
  )
  assert.equal(run.result.status, 'failed')
  assert.match(run.result.message, /未知 Agent 工具|未允许/)
})
