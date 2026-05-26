import type {
  AgentTool,
  AgentToolArgs,
  AgentToolInputSchema,
  AgentToolParamSchema,
  AgentToolResult,
} from '../../AgentTypes.ts'
import { WebSearchService } from '../../../services/WebSearchService'

function searchParams(): AgentToolInputSchema {
  const queryParam: AgentToolParamSchema = { type: 'string', description: '搜索关键词或问题' }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['query'] = queryParam
  const required: string[] = ['query']
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

export function buildWebSearchTool(): AgentTool {
  return {
    name: 'web_search',
    title: '网络搜索',
    description: '执行网络搜索，获取实时信息。当用户的问题需要最新网络信息、新闻、天气、股票价格或其他订阅源中没有的内容时使用此工具',
    inputSchema: searchParams(),
    capability: 'external',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const query = (args['query'] as string).trim()
      const results = await WebSearchService.search(query)
      return {
        status: 'success',
        message: WebSearchService.formatResultsForAI(results, query),
        data: { count: results.length, results },
      }
    },
  }
}
