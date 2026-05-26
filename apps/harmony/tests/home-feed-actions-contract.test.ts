import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ownerSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/coordinators/home/HomeFeedSessionOwner.ets',
    import.meta.url,
  ),
  'utf8',
)

const fakeSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/coordinators/home/FakeHomeFeedActions.ets',
    import.meta.url,
  ),
  'utf8',
)

function extractInterfaceMethods(
  source: string,
  interfaceName: string,
): string[] {
  const start = source.indexOf(`export interface ${interfaceName} {`)
  if (start < 0) {
    throw new Error(`未找到接口 ${interfaceName}`)
  }
  const rest = source.slice(start)
  const end = rest.indexOf('\n}')
  if (end < 0) {
    throw new Error(`未找到接口 ${interfaceName} 的闭合括号`)
  }
  const body = rest.slice(0, end)
  const methodRegex = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:<[^>]*>)?\s*\(/gm
  const methods: string[] = []
  let match = methodRegex.exec(body)
  while (match) {
    const name = match[1]
    if (!methods.includes(name)) {
      methods.push(name)
    }
    match = methodRegex.exec(body)
  }
  return methods
}

test('HomeFeedActions 与 HomeFeedState 接口仍然拆分，testability seam 未退化', () => {
  assert.match(ownerSource, /export interface HomeFeedState\s*\{/)
  assert.match(ownerSource, /export interface HomeFeedActions\s*\{/)
  assert.match(
    ownerSource,
    /export interface HomeFeedSessionOwner extends HomeFeedState, HomeFeedActions/,
  )
})

test('FakeHomeFeedActions 实现 HomeFeedActions 全部方法（接口契约 = 测试 surface）', () => {
  const actionMethods = extractInterfaceMethods(ownerSource, 'HomeFeedActions')
  assert.ok(
    actionMethods.length >= 20,
    `HomeFeedActions 应至少包含 20 个方法，当前 ${actionMethods.length}`,
  )

  for (const method of actionMethods) {
    const definedInFake = new RegExp(
      `\\b${method}\\s*(?:<[^>]*>)?\\s*\\(`,
    ).test(fakeSource)
    assert.ok(
      definedInFake,
      `FakeHomeFeedActions 缺少方法 ${method}，coordinator 行为测试将无法覆盖它`,
    )
  }
})

test('FakeHomeFeedActions 声明它实现了 HomeFeedActions', () => {
  assert.match(
    fakeSource,
    /class FakeHomeFeedActions implements HomeFeedActions/,
  )
})

test('FakeHomeFeedActions 暴露 callLog 用于行为断言', () => {
  assert.match(fakeSource, /readonly callLog: string\[\]/)
  assert.match(fakeSource, /this\.callLog\.push\(/)
})
