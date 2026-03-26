import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react"

import type { Entry } from "../../../shared/types"
import {
  buildMasonryColumns,
  loadPersistedMasonrySizes,
  probeMasonryCardDimensions,
  rememberedMasonrySizeByUrl,
  schedulePersistedMasonrySizes,
  seedRememberedMasonrySizesFromEntries,
  type MasonryCardData,
} from "../lib/picture-masonry"

const MASONRY_INITIAL_RENDER = 30
const MASONRY_FIRST_SCREEN_COUNT = 18
const MASONRY_FIRST_SCREEN_READY_TIMEOUT = 180

export function usePictureMasonry({
  enabled,
  cards,
  entries,
  columnCount,
  containerWidth,
  scopeKey,
  decodeMediaUrl,
  onCacheUpdated,
}: {
  enabled: boolean
  cards: MasonryCardData[]
  entries: Entry[]
  columnCount: number
  containerWidth: number
  scopeKey: string
  decodeMediaUrl: (raw: string) => string
  onCacheUpdated?: () => void
}) {
  loadPersistedMasonrySizes()

  const [renderLimit, setRenderLimit] = useState(MASONRY_INITIAL_RENDER)
  const [isFirstScreenReady, setIsFirstScreenReady] = useState(false)
  const [isContentVisible, setIsContentVisible] = useState(false)

  useEffect(() => {
    if (!enabled) return
    setRenderLimit(MASONRY_INITIAL_RENDER)
  }, [enabled, scopeKey])

  const visibleCards = useMemo(
    () => enabled ? cards.slice(0, renderLimit) : [],
    [cards, enabled, renderLimit],
  )

  useEffect(() => {
    if (!enabled) return
    if (!seedRememberedMasonrySizesFromEntries(entries, decodeMediaUrl)) return
    schedulePersistedMasonrySizes()
    onCacheUpdated?.()
  }, [decodeMediaUrl, enabled, entries, onCacheUpdated])

  useEffect(() => {
    if (!enabled) return
    const cardsToProbe = visibleCards.filter((card) => !card.width || !card.height)
    if (cardsToProbe.length === 0) return
    return probeMasonryCardDimensions(cardsToProbe, () => {
      onCacheUpdated?.()
    })
  }, [enabled, onCacheUpdated, visibleCards])

  const deferredVisibleCards = useDeferredValue(visibleCards)
  const columns = useMemo(
    () => buildMasonryColumns(deferredVisibleCards, columnCount),
    [columnCount, deferredVisibleCards],
  )
  const firstScreenCards = useMemo(
    () => visibleCards.slice(0, Math.max(columnCount * 3, MASONRY_FIRST_SCREEN_COUNT)),
    [columnCount, visibleCards],
  )

  useEffect(() => {
    if (!enabled) {
      setIsFirstScreenReady(false)
      setIsContentVisible(false)
      return
    }
    if (containerWidth <= 0) {
      setIsFirstScreenReady(false)
      setIsContentVisible(false)
      return
    }
    if (firstScreenCards.length === 0) {
      setIsFirstScreenReady(true)
      return
    }

    const ready = firstScreenCards.every((card) => (card.width && card.height) || rememberedMasonrySizeByUrl.has(card.firstImage))
    if (ready) {
      setIsFirstScreenReady(true)
      return
    }

    setIsFirstScreenReady(false)
    const timer = window.setTimeout(() => {
      setIsFirstScreenReady(true)
    }, MASONRY_FIRST_SCREEN_READY_TIMEOUT)
    return () => {
      window.clearTimeout(timer)
    }
  }, [containerWidth, enabled, firstScreenCards, scopeKey])

  useEffect(() => {
    if (!enabled || !isFirstScreenReady) {
      setIsContentVisible(false)
      return
    }
    const frame = window.requestAnimationFrame(() => {
      startTransition(() => {
        setIsContentVisible(true)
      })
    })
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [enabled, isFirstScreenReady])

  return {
    renderLimit,
    setRenderLimit,
    visibleCards,
    columns,
    isFirstScreenReady,
    isContentVisible,
  }
}
