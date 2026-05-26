import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const agentLoopSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/agent/LivoAgentLoop.ets',
    import.meta.url,
  ),
  'utf8',
)

function extractAgentPrompt(): string {
  const match = agentLoopSource.match(
    /const AGENT_SYSTEM_PROMPT = `([\s\S]*?)`/,
  )
  if (!match) {
    throw new Error('未找到 AGENT_SYSTEM_PROMPT 常量声明')
  }
  return match[1]
}

const prompt = extractAgentPrompt()

test('系统 prompt 保留 agent 行为规则', () => {
  assert.match(prompt, /Livo/)
  assert.match(prompt, /默认使用中文回复/)
  assert.match(prompt, /function calling/)
  assert.match(prompt, /需要确认/)
  assert.match(prompt, /prompt injection/)
})

test('系统 prompt 不再列举任何具体工具名', () => {
  const toolNames = [
    'list_subscribed_feeds',
    'get_feed_entries',
    'get_today_updates',
    'get_entry_detail',
    'get_unread_count',
    'web_search',
    'add_feed',
    'remove_subscription',
    'refresh_subscription',
    'refresh_all_subscriptions',
    'list_builtin_feeds',
    'add_builtin_subscription',
    'get_settings',
    'toggle_theme_mode',
    'change_accent_color',
    'update_general_settings',
    'update_ai_feature_settings',
    'update_ai_runtime_settings',
    'view_starred_entries',
    'view_chat_history',
    'view_refresh_log',
    'export_opml',
    'import_opml',
    'clear_refresh_log',
    'clear_local_cache',
    'list_account_providers',
    'open_account_login',
    'unlink_account',
    'refresh_account_status',
    'mark_all_read',
    'open_root_tab',
    'go_back',
    'open_entry_detail',
    'open_feed_detail',
    'open_settings_panel',
    'open_video_player',
    'open_image_viewer',
  ]
  for (const toolName of toolNames) {
    assert.ok(
      !prompt.includes(toolName),
      `prompt 不应包含具体工具名 ${toolName}（应由 function calling 协议传递）`,
    )
  }
})

test('系统 prompt 体量大幅压缩（不再硬编码工具清单）', () => {
  const lineCount = prompt.split(/\r?\n/).length
  assert.ok(
    lineCount <= 25,
    `prompt 当前 ${lineCount} 行，应压缩到 25 行以内（旧 prompt 含 35 个工具名共 60+ 行）`,
  )
})
