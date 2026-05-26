import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseTextToolCalls,
  ParsedToolCall,
} from '../entry/src/main/ets/common/agent/parsers/ToolCallParser.ts'

function expectOneCall(
  calls: ParsedToolCall[],
  name: string,
  args: Record<string, unknown>,
): void {
  assert.equal(calls.length, 1)
  assert.equal(calls[0].function.name, name)
  assert.deepEqual(JSON.parse(calls[0].function.arguments), args)
}

test('空内容返回零工具调用', () => {
  const result = parseTextToolCalls('')
  assert.equal(result.toolCalls.length, 0)
  assert.equal(result.cleanedContent, '')
})

test('没有任何标签的内容原样保留', () => {
  const result = parseTextToolCalls('请帮我查看今天的更新')
  assert.equal(result.toolCalls.length, 0)
  assert.equal(result.cleanedContent, '请帮我查看今天的更新')
})

test('<tool_call> 标签 JSON 形态', () => {
  const result = parseTextToolCalls(
    '好的<tool_call>{"name":"list_subscribed_feeds","parameters":{"view":1}}</tool_call>',
  )
  expectOneCall(result.toolCalls, 'list_subscribed_feeds', { view: 1 })
  assert.equal(result.cleanedContent, '好的')
})

test('<tool_call> 接受 tool_input 别名', () => {
  const result = parseTextToolCalls(
    '<tool_call>{"tool":"get_unread_count","tool_input":{}}</tool_call>',
  )
  expectOneCall(result.toolCalls, 'get_unread_count', {})
})

test('<tool_call> 内容是合法 JSON 但缺少 name 字段时仅清理标签', () => {
  const result = parseTextToolCalls('<tool_call>{"foo":"bar"}</tool_call>')
  assert.equal(result.toolCalls.length, 0)
  assert.equal(result.cleanedContent, '')
})

test('<tool_call> 大括号配对但 JSON 损坏时仅清理标签', () => {
  const result = parseTextToolCalls('<tool_call>{not valid json}</tool_call>')
  assert.equal(result.toolCalls.length, 0)
  assert.equal(result.cleanedContent, '')
})

test('<minimax:tool_call> invoke 风格', () => {
  const result = parseTextToolCalls(
    '<minimax:tool_call><invoke name="add_feed"><parameter name="url">https://example.com/feed</parameter></invoke></minimax:tool_call>',
  )
  expectOneCall(result.toolCalls, 'add_feed', {
    url: 'https://example.com/feed',
  })
})

test('<minimax:tool_call> invoke 多参数', () => {
  const result = parseTextToolCalls(
    '<minimax:tool_call><invoke name="change_accent_color"><parameter name="color">#FF6600</parameter><parameter name="mode">dark</parameter></invoke></minimax:tool_call>',
  )
  expectOneCall(result.toolCalls, 'change_accent_color', {
    color: '#FF6600',
    mode: 'dark',
  })
})

test('<minimax:tool_call> 函数式语法', () => {
  const result = parseTextToolCalls(
    '<minimax:tool_call>get_feed_entries(feedId="abc123", limit="20")</minimax:tool_call>',
  )
  expectOneCall(result.toolCalls, 'get_feed_entries', {
    feedId: 'abc123',
    limit: '20',
  })
})

test('<minimax:tool_call> 函数式空参数', () => {
  const result = parseTextToolCalls(
    '<minimax:tool_call>get_today_updates()</minimax:tool_call>',
  )
  expectOneCall(result.toolCalls, 'get_today_updates', {})
})

test('<function_call> JSON 体', () => {
  const result = parseTextToolCalls(
    '<function_call>{"name":"toggle_theme_mode","parameters":{"mode":"dark"}}</function_call>',
  )
  expectOneCall(result.toolCalls, 'toggle_theme_mode', { mode: 'dark' })
})

test('<function_call> 接受 arguments 别名', () => {
  const result = parseTextToolCalls(
    '<function_call>{"name":"web_search","arguments":{"query":"livo"}}</function_call>',
  )
  expectOneCall(result.toolCalls, 'web_search', { query: 'livo' })
})

test('<function_call> 多行 fallback', () => {
  const result = parseTextToolCalls(
    '<function_call>refresh_subscription\nfeedId="abc"\n</function_call>',
  )
  expectOneCall(result.toolCalls, 'refresh_subscription', { feedId: 'abc' })
})

test('<function_call> 多行 fallback 接受 key: "value" 写法', () => {
  const result = parseTextToolCalls(
    '<function_call>mark_all_read\nview: "articles"\n</function_call>',
  )
  expectOneCall(result.toolCalls, 'mark_all_read', { view: 'articles' })
})

test('[TOOL_CALL] dash 风格参数', () => {
  const result = parseTextToolCalls(
    '[TOOL_CALL]{tool => "add_feed", --url "https://example.com" --category "tech"}[/TOOL_CALL]',
  )
  expectOneCall(result.toolCalls, 'add_feed', {
    url: 'https://example.com',
    category: 'tech',
  })
})

test('[TOOL_CALL] args => 嵌套对象', () => {
  const result = parseTextToolCalls(
    '[TOOL_CALL]{tool => "open_entry_detail", args => { entryId: "e123", from: "home" }}[/TOOL_CALL]',
  )
  expectOneCall(result.toolCalls, 'open_entry_detail', {
    entryId: 'e123',
    from: 'home',
  })
})

test('[TOOL_CALL] 缺少 tool 字段不产出调用', () => {
  const result = parseTextToolCalls(
    '[TOOL_CALL]{args => { x: "y" }}[/TOOL_CALL]',
  )
  assert.equal(result.toolCalls.length, 0)
})

test('多种格式混合按顺序累积', () => {
  const result = parseTextToolCalls(
    '正文前<tool_call>{"name":"a","parameters":{}}</tool_call>中间<function_call>{"name":"b","parameters":{}}</function_call>正文后',
  )
  assert.equal(result.toolCalls.length, 2)
  assert.equal(result.toolCalls[0].function.name, 'a')
  assert.equal(result.toolCalls[0].id, 'text_0')
  assert.equal(result.toolCalls[1].function.name, 'b')
  assert.equal(result.toolCalls[1].id, 'text_1')
  assert.equal(result.cleanedContent, '正文前中间正文后')
})

test('清理后的文本去除所有工具调用标签', () => {
  const result = parseTextToolCalls(
    [
      '<tool_call>{"name":"a","parameters":{}}</tool_call>',
      '<minimax:tool_call>b()</minimax:tool_call>',
      '<function_call>{"name":"c","parameters":{}}</function_call>',
      '[TOOL_CALL]{tool => "d"}[/TOOL_CALL]',
      '最终回复',
    ].join('\n'),
  )
  assert.equal(result.toolCalls.length, 4)
  assert.ok(!result.cleanedContent.includes('<tool_call>'))
  assert.ok(!result.cleanedContent.includes('<minimax:tool_call>'))
  assert.ok(!result.cleanedContent.includes('<function_call>'))
  assert.ok(!result.cleanedContent.includes('[TOOL_CALL]'))
  assert.ok(result.cleanedContent.includes('最终回复'))
})

test('解析结果保留稳定的 text_N id 序号', () => {
  const result = parseTextToolCalls(
    '<tool_call>{"name":"x","parameters":{}}</tool_call><tool_call>{"name":"y","parameters":{}}</tool_call>',
  )
  assert.equal(result.toolCalls[0].id, 'text_0')
  assert.equal(result.toolCalls[1].id, 'text_1')
})
