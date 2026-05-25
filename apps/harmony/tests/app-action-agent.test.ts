import { describe, it, expect } from 'node:test'
import {
  runAppActionAgent,
  executeAppActionTool,
  buildAppActionTools,
} from '../entry/src/main/ets/common/services/AppActionAgentService'

describe('AppActionAgentService', () => {
  describe('buildAppActionTools', () => {
    it('应该返回所有定义的工具', () => {
      const tools = buildAppActionTools()
      expect(tools.length).toBeGreaterThan(0)

      const toolNames = tools.map((t) => t.name)
      expect(toolNames).toContain('list_subscriptions')
      expect(toolNames).toContain('add_subscription')
      expect(toolNames).toContain('toggle_theme_mode')
      expect(toolNames).toContain('change_accent_color')
      expect(toolNames).toContain('view_starred_entries')
      expect(toolNames).toContain('view_chat_history')
      expect(toolNames).toContain('view_refresh_log')
      expect(toolNames).toContain('get_unread_stats')
      expect(toolNames).toContain('mark_all_read')
    })

    it('每个工具都应该有完整的定义', () => {
      const tools = buildAppActionTools()
      for (const tool of tools) {
        expect(tool.name).toBeDefined()
        expect(tool.description).toBeDefined()
        expect(tool.parameters).toBeDefined()
        expect(tool.parameters.type).toBe('object')
        expect(tool.parameters.properties).toBeDefined()
        expect(tool.parameters.required).toBeDefined()
      }
    })
  })

  describe('executeAppActionTool', () => {
    it('应该能处理未知工具名称', async () => {
      const result = await executeAppActionTool('unknown_tool', '{}')
      expect(result.success).toBe(false)
      expect(result.message).toContain('未知工具')
    })
  })

  describe('runAppActionAgent - 订阅相关', () => {
    it('应该识别查看订阅的意图', async () => {
      const result = await runAppActionAgent('我订阅了哪些源？')
      expect(result.executedActions).toContain('list_subscriptions')
      expect(result.text).toBeDefined()
    })

    it('应该识别查看推荐订阅源的意图', async () => {
      const result = await runAppActionAgent('查看推荐订阅源')
      expect(result.executedActions).toContain('list_builtin_feeds')
    })

    it('应该识别查看文章分类推荐订阅源', async () => {
      const result = await runAppActionAgent('查看文章类的推荐订阅源')
      expect(result.executedActions).toContain('list_builtin_feeds')
    })

    it('应该识别查看视频分类推荐订阅源', async () => {
      const result = await runAppActionAgent('查看视频类的推荐订阅')
      expect(result.executedActions).toContain('list_builtin_feeds')
    })

    it('应该识别添加推荐订阅的意图', async () => {
      const result = await runAppActionAgent('添加推荐订阅 阮一峰')
      expect(result.executedActions).toContain('add_builtin_subscription')
    })

    it('应该识别添加订阅的意图（带URL）', async () => {
      const result = await runAppActionAgent(
        '添加订阅 https://example.com/feed.xml',
      )
      expect(result.executedActions).toContain('add_subscription')
    })

    it('应该识别删除订阅的意图', async () => {
      const result = await runAppActionAgent('删除某个订阅源')
      expect(result.text).toContain('请提供')
    })
  })

  describe('runAppActionAgent - 主题相关', () => {
    it('应该识别切换到深色模式', async () => {
      const result = await runAppActionAgent('切换到深色模式')
      expect(result.executedActions).toContain('toggle_theme_mode')
    })

    it('应该识别切换到浅色模式', async () => {
      const result = await runAppActionAgent('使用浅色模式')
      expect(result.executedActions).toContain('toggle_theme_mode')
    })

    it('应该识别更改主题色为蓝色', async () => {
      const result = await runAppActionAgent('调整主题色为蓝色')
      expect(result.executedActions).toContain('change_accent_color')
    })

    it('应该识别更改主题色为红色', async () => {
      const result = await runAppActionAgent('改成红色主题')
      expect(result.executedActions).toContain('change_accent_color')
    })
  })

  describe('runAppActionAgent - 内容查看', () => {
    it('应该识别查看收藏', async () => {
      const result = await runAppActionAgent('查看我的收藏')
      expect(result.executedActions).toContain('view_starred_entries')
    })

    it('应该识别查看历史对话', async () => {
      const result = await runAppActionAgent('查看历史对话')
      expect(result.executedActions).toContain('view_chat_history')
    })

    it('应该识别查看刷新日志', async () => {
      const result = await runAppActionAgent('查看刷新日志')
      expect(result.executedActions).toContain('view_refresh_log')
    })

    it('应该识别查看未读统计', async () => {
      const result = await runAppActionAgent('查看未读统计')
      expect(result.executedActions).toContain('get_unread_stats')
    })
  })

  describe('runAppActionAgent - 批量操作', () => {
    it('应该识别全部标记已读', async () => {
      const result = await runAppActionAgent('全部标记为已读')
      expect(result.executedActions).toContain('mark_all_read')
    })
  })

  describe('runAppActionAgent - 未知意图', () => {
    it('应该返回友好提示当无法识别意图', async () => {
      const result = await runAppActionAgent('今天天气怎么样？')
      expect(result.text).toContain('抱歉')
      expect(result.executedActions.length).toBe(0)
    })
  })

  describe('runAppActionAgent - 多轮对话', () => {
    it('应该支持带历史对话的交互', async () => {
      const history = [
        { role: 'user', content: '我订阅了哪些源？' },
        { role: 'assistant', content: '您共订阅了5个源...' },
      ]
      const result = await runAppActionAgent('切换到深色模式', history)
      expect(result.executedActions).toContain('toggle_theme_mode')
    })
  })
})

describe('AppActionAgentService - 工具参数验证', () => {
  describe('add_subscription', () => {
    it('应该要求URL参数', async () => {
      const result = await executeAppActionTool('add_subscription', '{}')
      expect(result.success).toBe(false)
      expect(result.message).toContain('URL')
    })
  })

  describe('toggle_theme_mode', () => {
    it('应该验证主题模式参数', async () => {
      const result = await executeAppActionTool(
        'toggle_theme_mode',
        JSON.stringify({ mode: 'invalid' }),
      )
      expect(result.success).toBe(false)
    })

    it('应该接受dark模式', async () => {
      const result = await executeAppActionTool(
        'toggle_theme_mode',
        JSON.stringify({ mode: 'dark' }),
      )
      expect(result).toBeDefined()
    })
  })

  describe('change_accent_color', () => {
    it('应该验证主题色参数', async () => {
      const result = await executeAppActionTool(
        'change_accent_color',
        JSON.stringify({ color: 'invalid' }),
      )
      expect(result.success).toBe(false)
    })

    it('应该接受blue颜色', async () => {
      const result = await executeAppActionTool(
        'change_accent_color',
        JSON.stringify({ color: 'blue' }),
      )
      expect(result).toBeDefined()
    })
  })
})
