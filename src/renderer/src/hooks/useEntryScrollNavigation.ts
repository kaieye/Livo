import { useEffect, useState, type RefObject } from "react"

import { HOTKEY_OVERLAY_SCOPES } from "../lib/hotkey-scope"
import { useRegisterCommand } from "./useRegisterCommand"

export function useEntryScrollNavigation({
  enabled,
  scrollRef,
  onNextEntry,
}: {
  enabled: boolean
  scrollRef: RefObject<HTMLDivElement | null>
  onNextEntry: () => void
}) {
  const [showKeepScrollingHint, setShowKeepScrollingHint] = useState(false)

  const scrollByDelta = (delta: number) => {
    const el = scrollRef.current
    if (!el) return
    const viewportHeight = el.clientHeight ?? 0
    const scrollStep = Math.min(Math.max(160, viewportHeight * 0.35), 320)
    const actualDelta = delta > 0 ? scrollStep : -scrollStep
    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight)
    const nextTop = Math.max(0, Math.min(maxTop, el.scrollTop + actualDelta))
    const isAlreadyAtBottom = maxTop > 0 && Math.abs(el.scrollTop - maxTop) < 2
    if (actualDelta > 0 && isAlreadyAtBottom) {
      setShowKeepScrollingHint(true)
      onNextEntry()
      return
    }
    el.scrollTo({ top: nextTop, behavior: "smooth" })
    setShowKeepScrollingHint(actualDelta > 0 && nextTop >= maxTop - 2)
  }

  useEffect(() => {
    if (!enabled) return
    setShowKeepScrollingHint(false)
  }, [enabled, onNextEntry])

  useEffect(() => {
    if (!enabled) return
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight)
      if (el.scrollTop < maxTop - 16) {
        setShowKeepScrollingHint(false)
      }
    }

    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      el.removeEventListener("scroll", handleScroll)
    }
  }, [enabled, scrollRef])

  useRegisterCommand({
    id: "reading:scroll-top",
    shortcutId: "scroll-top",
    scopes: ["content"],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (event) => {
      if (!enabled) return false
      event.preventDefault()
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
      setShowKeepScrollingHint(false)
    },
  })

  useRegisterCommand({
    id: "reading:scroll-down",
    shortcutId: "scroll-down-reading",
    scopes: ["content"],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (event) => {
      if (!enabled) return false
      event.preventDefault()
      scrollByDelta(1)
    },
  })

  useRegisterCommand({
    id: "reading:scroll-up",
    shortcutId: "scroll-up-reading",
    scopes: ["content"],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (event) => {
      if (!enabled) return false
      event.preventDefault()
      scrollByDelta(-1)
    },
  })

  return {
    showKeepScrollingHint,
    dismissKeepScrollingHint: () => setShowKeepScrollingHint(false),
  }
}
