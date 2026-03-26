import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, type PropsWithChildren } from "react"
import { queryKeys } from "../lib/query-keys"
import {
  QUERY_VISIBILITY_INVALIDATE_AFTER_MS,
  shouldInvalidateQueriesAfterRestore,
} from "../lib/query-visibility"

export function QueryVisibilityRefreshProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const lastHiddenAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return

    const invalidateIfNeeded = () => {
      if (document.visibilityState !== "visible") return
      const now = Date.now()
      if (!shouldInvalidateQueriesAfterRestore(lastHiddenAtRef.current, now, QUERY_VISIBILITY_INVALIDATE_AFTER_MS)) {
        return
      }

      lastHiddenAtRef.current = null
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.discover.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all() }),
      ])
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        lastHiddenAtRef.current = Date.now()
        return
      }
      invalidateIfNeeded()
    }

    const handleWindowFocus = () => {
      invalidateIfNeeded()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleWindowFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleWindowFocus)
    }
  }, [queryClient])

  return children
}
