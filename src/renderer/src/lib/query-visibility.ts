export const QUERY_VISIBILITY_INVALIDATE_AFTER_MS = 60_000

export function shouldInvalidateQueriesAfterRestore(
  lastHiddenAt: number | null,
  now: number,
  minHiddenMs = QUERY_VISIBILITY_INVALIDATE_AFTER_MS,
): boolean {
  return lastHiddenAt !== null && now - lastHiddenAt >= minHiddenMs
}
