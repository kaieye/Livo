import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentTool } from '../../../shared/types'
import { buildAllAgentTools } from '../default-tools'
import { validateToolArgs } from '../harness'

vi.mock('electron', () => ({
  app: {
    getPath: () => join(tmpdir(), 'livo-agent-tools-test'),
  },
  session: {
    defaultSession: {
      fetch: vi.fn(),
    },
  },
}))

vi.mock('electron-store', () => ({
  default: class MockStore {
    private readonly values = new Map<string, unknown>()

    get(key: string): unknown {
      return this.values.get(key)
    }

    set(key: string, value: unknown): void {
      this.values.set(key, value)
    }

    delete(key: string): void {
      this.values.delete(key)
    }

    clear(): void {
      this.values.clear()
    }
  },
}))

function toolByName(name: string): AgentTool {
  const tool = buildAllAgentTools().find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Missing test tool: ${name}`)
  return tool
}

describe('agent tool schema boundaries', () => {
  it.each([
    ['web_search', { query: '' }, /长度不能小于/],
    ['web_search', { query: 'x'.repeat(2049) }, /长度不能大于/],
    ['add_feed', { url: 'javascript:alert(1)' }, /scheme 不在允许范围/],
    ['add_feed', { url: 'notaurl' }, /合法 URL/],
    ['get_feed_entries', { feedId: 'feed-1', limit: 31 }, /不能大于/],
    ['get_today_updates', { limit: 0 }, /不能小于/],
    ['view_refresh_log', { limit: 51 }, /不能大于/],
    [
      'cleanup_old_entries',
      { entriesPerFeed: 0, maxEntryAgeDays: 90 },
      /不能小于/,
    ],
    [
      'cleanup_old_entries',
      { entriesPerFeed: 128, maxEntryAgeDays: 3651 },
      /不能大于/,
    ],
    ['open_video_player', { videoUrl: 'file:///tmp/movie.mp4' }, /scheme/],
    ['open_image_viewer', { imageUrl: 'data:image/png;base64,abc' }, /scheme/],
    ['open_entry_detail', { entryId: '' }, /长度不能小于/],
    ['add_builtin_subscription', { feedTitle: '' }, /长度不能小于/],
    ['update_general_settings', { refreshInterval: 1441 }, /不能大于/],
    ['update_ai_runtime_settings', { model: '' }, /长度不能小于/],
    [
      'update_ai_runtime_settings',
      { systemPromptTemplate: 'x'.repeat(2049) },
      /长度不能大于/,
    ],
  ])('rejects invalid %s args before execution', (toolName, args, expected) => {
    const tool = toolByName(toolName)
    expect(validateToolArgs(tool.inputSchema, args)).toMatch(expected)
  })

  it.each([
    ['web_search', { query: 'OpenAI news' }],
    ['add_feed', { url: 'https://example.com/feed.xml' }],
    ['add_feed', { url: 'rsshub://twitter/user/openai' }],
    ['get_feed_entries', { feedId: 'feed-1', limit: 30 }],
    ['cleanup_old_entries', { entriesPerFeed: 128, maxEntryAgeDays: 90 }],
    ['open_video_player', { videoUrl: 'https://example.com/movie.mp4' }],
    ['open_image_viewer', { imageUrl: 'https://example.com/image.png' }],
    ['update_general_settings', { refreshInterval: 60 }],
    ['update_ai_runtime_settings', { model: 'gpt-4o-mini' }],
  ])('accepts boundary-valid %s args', (toolName, args) => {
    const tool = toolByName(toolName)
    expect(validateToolArgs(tool.inputSchema, args)).toBe('')
  })
})
