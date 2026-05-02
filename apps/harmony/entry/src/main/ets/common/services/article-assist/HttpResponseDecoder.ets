/**
 * Plumbing helpers for HTTP response bodies.
 *
 * `@kit.NetworkKit` returns `result` as one of `string | ArrayBuffer | Uint8Array`
 * depending on the server / runtime — these helpers turn whatever shows up into
 * a plain string so callers can JSON.parse without branching.
 *
 * NOTE: The same helpers also live (duplicated) inside
 * `services/AIAssistantConnectionTestService.ets`. When that service is moved
 * onto the same provider-protocol seam, both copies should converge here.
 */

export function decodeByteArray(bytes: Uint8Array): string {
  let output = ''
  for (let index = 0; index < bytes.length; index += 1) {
    output += String.fromCharCode(bytes[index])
  }
  return output
}

export function stringifyHttpResult(
  result: Object | string | number | boolean | null | undefined,
): string {
  if (typeof result === 'string') {
    return result
  }
  if (result instanceof ArrayBuffer) {
    try {
      return decodeByteArray(new Uint8Array(result))
    } catch (_error) {
      return ''
    }
  }
  if (result instanceof Uint8Array) {
    try {
      return decodeByteArray(result)
    } catch (_error) {
      return ''
    }
  }
  try {
    return JSON.stringify(result ?? '')
  } catch (_error) {
    return String(result ?? '')
  }
}

export async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve: () => void) => {
    setTimeout(() => resolve(), milliseconds)
  })
}
