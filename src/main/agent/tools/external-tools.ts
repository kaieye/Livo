import type {
  AgentTool,
  AgentToolArgs,
  AgentToolResult,
} from '../../../shared/types'
import {
  webSearch,
  formatWebSearchResultsForAI,
} from '../../services/ai/web-search'
import { objectParams } from './schema'

export function buildWebSearchTool(): AgentTool {
  return {
    name: 'web_search',
    title: '网络搜索',
    description:
      '执行网络搜索获取实时信息。当用户的问题需要最新网络信息、新闻、天气、价格或订阅源中没有的内容时使用',
    inputSchema: objectParams(
      { query: { type: 'string', description: '搜索关键词或问题' } },
      ['query'],
    ),
    capability: 'external',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const query = String(args['query']).trim()
      const results = await webSearch(query)
      return {
        status: 'success',
        message: formatWebSearchResultsForAI(results, query),
        data: { count: results.length, results: results as unknown as object },
      }
    },
  }
}
