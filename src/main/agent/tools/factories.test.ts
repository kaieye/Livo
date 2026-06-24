import { describe, it, expect } from 'vitest'
import { defineMutateTool, defineReadTool } from './factories'
import { emptyParams, objectParams } from './schema'

describe('defineReadTool', () => {
  it('defaults capability to read, risk to low, and no confirmation', () => {
    const tool = defineReadTool({
      name: 'list_things',
      title: '查询',
      description: '查询一些东西',
      inputSchema: emptyParams(),
      execute: async () => ({ status: 'success', message: 'ok' }),
    })
    expect(tool.capability).toBe('read')
    expect(tool.risk).toBe('low')
    expect(tool.requiresConfirmation).toBe(false)
    expect(tool.confirmationTitle).toBeUndefined()
    expect(tool.confirmationMessage).toBeUndefined()
  })

  it('allows overriding risk and requiresConfirmation for sensitive reads', () => {
    const tool = defineReadTool({
      name: 'read_secrets',
      title: '读取密钥',
      description: '读取敏感字段',
      inputSchema: objectParams({}, []),
      risk: 'medium',
      requiresConfirmation: true,
      confirmationTitle: '确认读取密钥',
      confirmationMessage: '将把本地保存的 API Key 暴露给模型',
      execute: async () => ({ status: 'success', message: 'shh' }),
    })
    expect(tool.risk).toBe('medium')
    expect(tool.requiresConfirmation).toBe(true)
    expect(tool.confirmationTitle).toBe('确认读取密钥')
    expect(tool.confirmationMessage).toBe('将把本地保存的 API Key 暴露给模型')
  })
})

describe('defineMutateTool', () => {
  it('defaults capability to mutate, risk to medium, and requires confirmation', () => {
    const tool = defineMutateTool({
      name: 'do_thing',
      title: '执行',
      description: '做一些事情',
      inputSchema: emptyParams(),
      execute: async () => ({ status: 'success', message: 'done' }),
    })
    expect(tool.capability).toBe('mutate')
    expect(tool.risk).toBe('medium')
    expect(tool.requiresConfirmation).toBe(true)
  })

  it('forwards confirmationTitle and confirmationMessage when provided', () => {
    const preview = async () => ({ message: 'preview' })
    const tool = defineMutateTool({
      name: 'refresh',
      title: '刷新',
      description: '刷新所有订阅',
      inputSchema: emptyParams(),
      confirmationTitle: '确认刷新',
      confirmationMessage: '将访问所有订阅源',
      preview,
      execute: async () => ({ status: 'success', message: 'refreshed' }),
    })
    expect(tool.confirmationTitle).toBe('确认刷新')
    expect(tool.confirmationMessage).toBe('将访问所有订阅源')
    expect(tool.preview).toBe(preview)
  })

  it('omits confirmation fields when not provided (empty object stays off the wire)', () => {
    const tool = defineMutateTool({
      name: 'auto_mark',
      title: '自动标记',
      description: '后台标记',
      inputSchema: emptyParams(),
      requiresConfirmation: false,
      execute: async () => ({ status: 'success', message: 'marked' }),
    })
    expect('confirmationTitle' in tool).toBe(false)
    expect('confirmationMessage' in tool).toBe(false)
  })
})
