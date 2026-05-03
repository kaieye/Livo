/**
 * Turns a raw HTTP response body from a connection-test probe into a single
 * Chinese-language message we can show the user.
 *
 * The probe runs against the full provider matrix (OpenAI-style chat,
 * Anthropic /messages, MiniMax v2, custom proxies), and many proxies stream
 * SSE chunks or wrap the payload in a JSON array even from non-streaming
 * endpoints, so we lean on `parseProviderResponseLoose` to normalise the body
 * before extracting content. `<think>` reasoning markers — emitted by some
 * providers without an explicit thinking block — are stripped so they don't
 * leak into the success message.
 *
 * Three classes of result:
 *   - `analyzeContent`        — model reply we can echo back verbatim
 *   - `analyzeError`          — soft (HTTP 200) and hard error envelopes
 *   - `successHint` / `debugHint` — fallbacks when the body parsed fine but
 *     contained no usable text, so the test can still confirm the round trip
 */

import {
  AnthropicResponse,
  ChatCompletionResponse,
  extractAnthropicResponseContent,
  extractErrorDetailFromParsed,
  extractResponseContent,
  extractSoftProviderError,
  parseProviderResponseLoose,
  stripThinkBlocks,
} from '../article-assist/ProviderResponseParser'

export function analyzeConnectionTestContent(raw: string, useAnthropicFormat: boolean): string {
  const parsed = parseProviderResponseLoose(raw)
  if (!parsed) {
    return ''
  }
  if (useAnthropicFormat) {
    const anthropic = stripThinkBlocks(
      extractAnthropicResponseContent(parsed as AnthropicResponse, true),
    )
    if (anthropic) {
      return anthropic
    }
  }
  return stripThinkBlocks(extractResponseContent(parsed, true))
}

export function analyzeConnectionTestError(raw: string): string {
  const parsed = parseProviderResponseLoose(raw)
  if (!parsed) {
    return ''
  }
  const softError = extractSoftProviderError(parsed)
  if (softError) {
    return softError
  }
  return extractErrorDetailFromParsed(parsed)
}

export function analyzeConnectionTestSuccessHint(raw: string): string {
  const parsed = parseProviderResponseLoose(raw)
  if (!parsed) {
    return ''
  }
  const model = (parsed.model || '').trim()
  const objectType = (parsed.object || '').trim()
  if (model && objectType) {
    return `连接成功（${model} / ${objectType}）`
  }
  if (model) {
    return `连接成功（${model}）`
  }
  if (objectType) {
    return `连接成功（${objectType}）`
  }
  if ((parsed.id || '').trim()) {
    return '连接成功（已返回请求ID）'
  }
  return ''
}

export function analyzeConnectionTestDebugHint(raw: string): string {
  const normalized = (raw || '').trim()
  if (!normalized) {
    return ''
  }
  const parsed = parseProviderResponseLoose(normalized)
  if (!parsed) {
    return normalized.slice(0, 80)
  }
  const keys = Object.keys(parsed as ChatCompletionResponse as Object)
  if (keys.length > 0) {
    return `响应字段: ${keys.join(', ').slice(0, 80)}`
  }
  return normalized.slice(0, 80)
}
