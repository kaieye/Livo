export interface FeedRefreshErrorContext {
  knownInstagramFailure?: boolean
}

export interface FeedRefreshErrorInfo {
  userMessage: string
  rawMessage: string
}

export function isKnownInstagramUpstreamFailure(error: unknown): boolean {
  const message = String(error || '').toLowerCase()
  if (!message) return false
  return (
    message.includes('feed not recognized as rss') ||
    message.includes('challenge_required') ||
    message.includes('[refresh] timeout after') ||
    message.includes('err_connection_closed') ||
    message.includes('http 403') ||
    message.includes('http 429') ||
    message.includes('http 503')
  )
}

function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export function mapFeedRefreshError(
  error: unknown,
  context: FeedRefreshErrorContext = {},
): FeedRefreshErrorInfo {
  const rawMessage = getRawErrorMessage(error) || 'Unknown refresh error'
  const lower = rawMessage.toLowerCase()

  if (context.knownInstagramFailure) {
    return {
      userMessage: 'Instagram/RSSHub 上游暂时不可用，请稍后重试',
      rawMessage,
    }
  }

  if (lower.includes('[refresh] timeout after') || lower.includes('timeout')) {
    return {
      userMessage: '刷新超时，请稍后重试',
      rawMessage,
    }
  }

  const httpStatus = rawMessage.match(/\bHTTP\s+(\d{3})\b/i)?.[1]
  if (httpStatus) {
    return {
      userMessage: `源站返回 HTTP ${httpStatus}`,
      rawMessage,
    }
  }

  return {
    userMessage: rawMessage,
    rawMessage,
  }
}
