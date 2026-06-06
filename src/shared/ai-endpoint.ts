const OPENAI_CHAT_COMPLETIONS_PATH = '/chat/completions'

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    url.pathname = url.pathname.replace(/\/+$/, '')
    return url.toString().replace(/\/$/, '')
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

function isChatCompletionsEndpoint(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return url.pathname
      .replace(/\/+$/, '')
      .toLowerCase()
      .endsWith(OPENAI_CHAT_COMPLETIONS_PATH)
  } catch {
    return rawUrl
      .replace(/\/+$/, '')
      .toLowerCase()
      .endsWith(OPENAI_CHAT_COMPLETIONS_PATH)
  }
}

/**
 * 将用户填写的 OpenAI 兼容地址解析成最终请求地址。
 * 用户可填写服务根地址，也可直接粘贴文档中的 /chat/completions 完整地址。
 */
export function resolveOpenAIChatCompletionsUrl(rawUrl: string): string {
  const normalized = normalizeUrl(rawUrl)
  if (!normalized) return ''
  if (isChatCompletionsEndpoint(normalized)) return normalized

  try {
    const url = new URL(normalized)
    url.search = ''
    url.hash = ''
    url.pathname = `${url.pathname.replace(/\/+$/, '')}${OPENAI_CHAT_COMPLETIONS_PATH}`
    return url.toString()
  } catch {
    return `${normalized}${OPENAI_CHAT_COMPLETIONS_PATH}`
  }
}

/**
 * OpenAI SDK 只接收 baseURL。若用户填了完整接口地址，转回 SDK 需要的根地址，
 * 避免 SDK 再拼出重复的 /chat/completions/chat/completions。
 */
export function resolveOpenAICompatibleBaseUrl(rawUrl: string): string {
  const normalized = normalizeUrl(rawUrl)
  if (!normalized) return ''
  if (!isChatCompletionsEndpoint(normalized)) return normalized

  try {
    const url = new URL(normalized)
    url.pathname =
      url.pathname
        .replace(/\/+$/, '')
        .slice(0, -OPENAI_CHAT_COMPLETIONS_PATH.length) || '/'
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return normalized.slice(0, -OPENAI_CHAT_COMPLETIONS_PATH.length)
  }
}
