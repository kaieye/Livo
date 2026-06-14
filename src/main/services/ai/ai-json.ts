/**
 * Shared JSON-salvage for model output.
 *
 * Models that are asked for strict JSON sometimes wrap it in prose or code
 * fences. This recovers the embedded value by first trying a straight parse,
 * then falling back to slicing the outermost `[...]` array or `{...}` object.
 *
 * Both AI Digest (rerank id selection) and AI Filter (decision objects) consume
 * this so the salvage rules live in exactly one place. Array recovery is tried
 * before object recovery to match the more permissive of the two original
 * implementations (digest's), which Filter callers tolerate because they reject
 * non-object payloads downstream.
 */
export function extractJsonValue(raw: string): unknown {
  const text = raw.trim()
  if (!text) throw new Error('AI 返回为空')

  try {
    return JSON.parse(text)
  } catch {
    const arrayStart = text.indexOf('[')
    const arrayEnd = text.lastIndexOf(']')
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      return JSON.parse(text.slice(arrayStart, arrayEnd + 1))
    }

    const objectStart = text.indexOf('{')
    const objectEnd = text.lastIndexOf('}')
    if (objectStart !== -1 && objectEnd > objectStart) {
      return JSON.parse(text.slice(objectStart, objectEnd + 1))
    }
  }

  throw new Error('AI 返回不是可解析的 JSON')
}
