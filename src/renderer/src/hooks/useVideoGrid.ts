import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react'

import { FeedViewType, type Entry } from '../../../shared/types'

export function useVideoGrid({
  activeView,
  entries,
  videoColumnCount,
  videoPaginationEnabled,
  configuredVideosPerPage,
  inlineBilibiliOpen,
  containerRef,
  videoGridRef,
  pageScopeKey,
}: {
  activeView: FeedViewType | null
  entries: Entry[]
  videoColumnCount: number
  videoPaginationEnabled: boolean
  configuredVideosPerPage: number
  inlineBilibiliOpen: boolean
  containerRef: RefObject<HTMLDivElement | null>
  videoGridRef: RefObject<HTMLDivElement | null>
  pageScopeKey: string
}) {
  const [currentPage, setCurrentPage] = useState(0)
  const [adaptiveVideosPerPage, setAdaptiveVideosPerPage] = useState<
    number | null
  >(null)

  useEffect(() => {
    setCurrentPage(0)
  }, [pageScopeKey])

  useLayoutEffect(() => {
    if (
      activeView !== FeedViewType.Videos ||
      inlineBilibiliOpen ||
      !videoPaginationEnabled
    ) {
      setAdaptiveVideosPerPage(null)
      return
    }

    const containerEl = containerRef.current
    if (!containerEl) return

    const measure = () => {
      const horizontalPadding = 48
      const verticalPadding = 48
      const paginationReserve = 64
      const gridGap = 16
      const availableWidth = Math.max(
        0,
        containerEl.clientWidth - horizontalPadding,
      )
      const columnCount = Math.max(1, videoColumnCount)
      const estimatedCardWidth = Math.max(
        120,
        (availableWidth - gridGap * (columnCount - 1)) / columnCount,
      )
      const estimatedCardHeight = estimatedCardWidth * 0.75 + 64
      const firstCard = videoGridRef.current?.querySelector('button')
      const measuredCardHeight =
        firstCard?.getBoundingClientRect().height || estimatedCardHeight
      const availableHeight = Math.max(
        0,
        containerEl.clientHeight - verticalPadding - paginationReserve,
      )
      const rows = Math.max(
        1,
        Math.ceil(availableHeight / Math.max(1, measuredCardHeight + gridGap)),
      )
      const configuredPerPage = Math.max(1, configuredVideosPerPage)
      const nextPerPage = Math.max(
        columnCount,
        Math.min(configuredPerPage, rows * columnCount),
      )
      setAdaptiveVideosPerPage((prev) =>
        prev === nextPerPage ? prev : nextPerPage,
      )
    }

    const frame = window.requestAnimationFrame(measure)
    return () => window.cancelAnimationFrame(frame)
  }, [
    activeView,
    configuredVideosPerPage,
    containerRef,
    inlineBilibiliOpen,
    videoColumnCount,
    videoGridRef,
    videoPaginationEnabled,
    entries.length,
  ])

  const viewModel = useMemo(() => {
    const perPage =
      adaptiveVideosPerPage ?? Math.max(1, configuredVideosPerPage)
    const totalItems = entries.length
    const totalPages = videoPaginationEnabled
      ? Math.max(1, Math.ceil(totalItems / perPage))
      : 1
    const safePage = videoPaginationEnabled
      ? Math.min(currentPage, Math.max(0, totalPages - 1))
      : 0
    const displayEntries = videoPaginationEnabled
      ? entries.slice(safePage * perPage, (safePage + 1) * perPage)
      : entries

    return {
      videoPagination: videoPaginationEnabled,
      perPage,
      totalItems,
      totalPages,
      currentPage: safePage,
      displayEntries,
    }
  }, [
    adaptiveVideosPerPage,
    configuredVideosPerPage,
    currentPage,
    entries,
    videoPaginationEnabled,
  ])

  useEffect(() => {
    if (!viewModel.videoPagination) return
    if (currentPage <= viewModel.totalPages - 1) return
    setCurrentPage(Math.max(0, viewModel.totalPages - 1))
  }, [currentPage, viewModel.totalPages, viewModel.videoPagination])

  const goPrevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(0, prev - 1))
  }, [])

  const goNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(viewModel.totalPages - 1, prev + 1))
  }, [viewModel.totalPages])

  return {
    viewModel,
    goPrevPage,
    goNextPage,
  }
}
