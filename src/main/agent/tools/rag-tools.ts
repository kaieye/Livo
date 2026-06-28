import type {
  AgentTool,
  AgentToolArgs,
  AgentToolResult,
} from '../../../shared/types'
import {
  getServerKnowledgeStatus,
  searchServerKnowledgeResponse,
  type RagIndexStatus,
  type RagSearchTrace,
  type RagSearchInput,
  type RagSearchResult,
} from '../../services/rag/rag-client'
import {
  LONG_TEXT_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  clampLimit,
  objectParams,
} from './schema'
import { defineReadTool } from './factories'

function formatPublishedAt(value: string | null | undefined): string {
  if (!value) return '未知时间'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value
}

function formatEmptyResultsForAI(
  query: string,
  trace?: RagSearchTrace,
  status?: RagIndexStatus | null,
): string {
  const traceSuffix = trace?.traceId
    ? ` 本次检索 traceId：${trace.traceId}。`
    : ''
  switch (trace?.emptyReason) {
    case 'no_session':
      return `无法检索服务端知识库：当前未登录、会话已失效或没有权限。${traceSuffix}`
    case 'no_subscribed_sources':
      return `没有在服务端知识库中找到与「${query}」相关的资料，因为当前账号没有订阅源。${traceSuffix}`
    case 'no_indexed_chunks':
      return `没有在服务端知识库中找到与「${query}」相关的资料，因为服务端还没有可检索的索引片段。${traceSuffix}`
    case 'filtered_out':
      return `没有在服务端知识库中找到与「${query}」相关的资料，因为当前分类、来源或时间过滤条件排除了所有已索引内容。${traceSuffix}`
    case 'retriever_error':
      return `没有在服务端知识库中找到与「${query}」相关的资料，因为本次检索器执行失败。${traceSuffix}`
    case 'no_retrieval_hits':
      return `没有在服务端知识库中找到与「${query}」足够相关的资料；当前索引存在，但本次查询没有命中。${traceSuffix}`
    default:
      break
  }

  if (!status) {
    return `没有在服务端知识库中找到与「${query}」足够相关的资料。若尚未登录、无权限或服务端索引尚未完成，也可能返回空结果。${traceSuffix}`
  }

  const activeJobs = status.jobs.pending + status.jobs.running
  if (status.chunks === 0 && activeJobs > 0) {
    return `没有在服务端知识库中找到与「${query}」足够相关的资料。服务端知识库还没有可检索片段，当前仍有 ${activeJobs} 个索引任务待处理或运行中。${traceSuffix}`
  }
  if (status.chunks === 0) {
    return `没有在服务端知识库中找到与「${query}」足够相关的资料。服务端知识库目前没有已索引片段。${traceSuffix}`
  }
  if (status.jobs.failed > 0) {
    const detail = status.latestFailedError
      ? `最近失败原因：${status.latestFailedError}`
      : '存在索引失败任务。'
    return `没有在服务端知识库中找到与「${query}」足够相关的资料。当前已有 ${status.chunks} 个可检索片段，但本次查询没有命中；${detail}${traceSuffix}`
  }
  return `没有在服务端知识库中找到与「${query}」足够相关的资料。当前服务端知识库已有 ${status.chunks} 个可检索片段，但本次查询没有足够相关的命中。${traceSuffix}`
}

function formatResultsForAI(
  query: string,
  results: RagSearchResult[],
  trace?: RagSearchTrace,
  status?: RagIndexStatus | null,
): string {
  if (results.length === 0) {
    return formatEmptyResultsForAI(query, trace, status)
  }

  const traceLine = trace?.traceId ? `\n\ntraceId: ${trace.traceId}` : ''
  const lines = results
    .map((item, index) => {
      const source = item.sourceTitle ? `｜来源: ${item.sourceTitle}` : ''
      const category = item.category ? `｜分类: ${item.category}` : ''
      const url = item.url ? `\n   链接: ${item.url}` : ''
      const evidence =
        item.evidence && item.evidence.length > 0
          ? item.evidence
              .map((entry, evidenceIndex) => {
                const quote = entry.quote || entry.snippet
                return `   证据 ${evidenceIndex + 1} (${entry.score.toFixed(2)}): ${quote}`
              })
              .join('\n')
          : `   片段: ${item.snippet}`
      const whyMatched =
        item.whyMatched && item.whyMatched.length > 0
          ? `\n   匹配原因: ${item.whyMatched.join('、')}`
          : ''
      return `[${index + 1}] ${item.title}${source}${category}
   发布时间: ${formatPublishedAt(item.publishedAt)}｜相关度: ${item.score.toFixed(2)}
${evidence}${whyMatched}${url}`
    })
    .join('\n\n')

  return `服务端知识库检索「${query}」返回 ${results.length} 条相关片段：\n\n${lines}${traceLine}`
}

function optionalStringArg(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function buildSearchLivoKnowledgeTool(): AgentTool {
  return defineReadTool({
    name: 'search_livo_knowledge',
    title: '检索知识库',
    description:
      '检索 Livo-Server 中已索引的资讯知识库。用户询问跨文章主题、行业趋势、历史资讯、资讯内容或需要从服务端资讯库查证时使用。返回相关片段、来源标题、链接和发布时间。',
    inputSchema: objectParams(
      {
        query: {
          type: 'string',
          description: '检索问题或关键词',
          minLength: 1,
          maxLength: LONG_TEXT_MAX_LENGTH,
        },
        limit: {
          type: 'number',
          description: '返回片段数量，默认 8，最大 20',
          minimum: 1,
          maximum: 20,
        },
        scope: {
          type: 'string',
          description: '检索范围，默认 subscribed',
          enum: ['subscribed', 'all'],
        },
        category: {
          type: 'string',
          description: '限定单个服务端资讯分类，可选',
          minLength: 1,
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
        publishedAfter: {
          type: 'string',
          description: '限定发布日期不早于该时间，可传 ISO 日期字符串',
          minLength: 1,
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
        publishedBefore: {
          type: 'string',
          description: '限定发布日期不晚于该时间，可传 ISO 日期字符串',
          minLength: 1,
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
      },
      ['query'],
    ),
    execute: async (context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const query = String(args['query']).trim()
      const limit = clampLimit(args['limit'], 8, 20)
      const scope = args['scope'] === 'all' ? 'all' : 'subscribed'
      const category = optionalStringArg(args['category'])
      const publishedAfter = optionalStringArg(args['publishedAfter'])
      const publishedBefore = optionalStringArg(args['publishedBefore'])

      try {
        const input: RagSearchInput = {
          query,
          limit,
          scope,
        }
        if (category) input.categories = [category]
        if (publishedAfter) input.publishedAfter = publishedAfter
        if (publishedBefore) input.publishedBefore = publishedBefore

        const response = await searchServerKnowledgeResponse(input, {
          signal: context.signal,
        })
        const { results, trace } = response
        const status =
          results.length === 0
            ? await getServerKnowledgeStatus({ signal: context.signal }).catch(
                () => null,
              )
            : null
        return {
          status: 'success',
          message: formatResultsForAI(query, results, trace, status),
          data: {
            count: results.length,
            results: results as unknown[],
            ...(trace && { trace: trace as unknown as object }),
            ...(trace?.traceId && { traceId: trace.traceId }),
            ...(status && { status: status as unknown as object }),
          },
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        return {
          status: 'failed',
          message: `服务端知识库暂不可用：${detail}`,
        }
      }
    },
  })
}
