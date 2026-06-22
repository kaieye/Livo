import type {
  AgentTool,
  AgentToolArgs,
  AgentToolResult,
} from '../../../shared/types'
import {
  webSearch,
  formatWebSearchResultsForAI,
  sanitizeWebSearchResult,
} from '../../services/ai/web-search'
import { LONG_TEXT_MAX_LENGTH, objectParams } from './schema'

export function buildWebSearchTool(): AgentTool {
  return {
    name: 'web_search',
    title: '网络搜索',
    description:
      '执行网络搜索获取实时信息。当用户的问题需要最新网络信息、新闻、天气、价格或订阅源中没有的内容时使用',
    inputSchema: objectParams(
      {
        query: {
          type: 'string',
          description: '搜索关键词或问题',
          minLength: 1,
          maxLength: LONG_TEXT_MAX_LENGTH,
        },
      },
      ['query'],
    ),
    capability: 'external',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const query = String(args['query']).trim()
      const results = await webSearch(query, { signal: context.signal })
      const safeResults = results.map(sanitizeWebSearchResult)
      return {
        status: 'success',
        message: formatWebSearchResultsForAI(safeResults, query),
        data: {
          count: safeResults.length,
          results: safeResults as unknown as object,
        },
      }
    },
  }
}
