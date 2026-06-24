import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'ai-chat-panel-ratio'

export interface PanelRatio {
  rx: number
  ry: number
  rw: number
  rh: number
}

export interface PanelPixels {
  x: number
  y: number
  width: number
  height: number
}

export interface PanelViewport {
  width: number
  height: number
}

const MIN_WIDTH = 360
const MIN_HEIGHT = 400
const MAX_WIDTH = 800
const MAX_HEIGHT = 900
const MARGIN = 20

function viewportFromWindow(): PanelViewport {
  return { width: window.innerWidth, height: window.innerHeight }
}

export function loadPanelRatio(): PanelRatio | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as PanelRatio
  } catch {
    /* ignore */
  }
  return null
}

export function savePanelRatio(ratio: PanelRatio): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ratio))
}

export function getDefaultPanelRatio(viewport: PanelViewport): PanelRatio {
  const pw = Math.min(Math.max(480, viewport.width * 0.3), MAX_WIDTH)
  const ph = Math.min(Math.max(640, viewport.height * 0.7), MAX_HEIGHT)
  return {
    rx: (viewport.width - pw - MARGIN) / viewport.width,
    ry: (viewport.height - ph - MARGIN) / viewport.height,
    rw: pw / viewport.width,
    rh: ph / viewport.height,
  }
}

export function ratioToPanelPixels(
  ratio: PanelRatio,
  viewport: PanelViewport,
): PanelPixels {
  const width = Math.round(
    Math.min(
      Math.max(ratio.rw * viewport.width, MIN_WIDTH),
      Math.min(MAX_WIDTH, viewport.width - MARGIN * 2),
    ),
  )
  const height = Math.round(
    Math.min(
      Math.max(ratio.rh * viewport.height, MIN_HEIGHT),
      Math.min(MAX_HEIGHT, viewport.height - MARGIN * 2),
    ),
  )
  const x = Math.round(
    Math.max(0, Math.min(ratio.rx * viewport.width, viewport.width - width)),
  )
  const y = Math.round(
    Math.max(0, Math.min(ratio.ry * viewport.height, viewport.height - height)),
  )
  return { x, y, width, height }
}

export function panelPixelsToRatio(
  pixels: PanelPixels,
  viewport: PanelViewport,
): PanelRatio {
  return {
    rx: pixels.x / viewport.width,
    ry: pixels.y / viewport.height,
    rw: pixels.width / viewport.width,
    rh: pixels.height / viewport.height,
  }
}

function getInitialRatio(): PanelRatio {
  return loadPanelRatio() || getDefaultPanelRatio(viewportFromWindow())
}

export function useAIChatPanelGeometry() {
  const panelRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState<PanelRatio>(getInitialRatio)
  const ratioRef = useRef(ratio)

  useEffect(() => {
    ratioRef.current = ratio
  }, [ratio])

  const [, setTick] = useState(0)
  useEffect(() => {
    const onResize = () => setTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const pixels = ratioToPanelPixels(ratio, viewportFromWindow())

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    const panel = panelRef.current
    if (!panel) return

    const viewport = viewportFromWindow()
    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startPixels = ratioToPanelPixels(ratioRef.current, viewport)
    const startLeft = startPixels.x
    const startTop = startPixels.y

    panel.style.transition = 'none'
    panel.style.animation = 'none'
    panel.style.willChange = 'transform'

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startMouseX
      const dy = ev.clientY - startMouseY
      const newX = Math.max(
        0,
        Math.min(startLeft + dx, window.innerWidth - startPixels.width),
      )
      const newY = Math.max(
        0,
        Math.min(startTop + dy, window.innerHeight - startPixels.height),
      )
      panel.style.transform = `translate(${newX - startLeft}px, ${newY - startTop}px)`
    }

    const onUp = (ev: MouseEvent) => {
      const dx = ev.clientX - startMouseX
      const dy = ev.clientY - startMouseY
      const nextPixels = {
        ...startPixels,
        x: Math.max(
          0,
          Math.min(startLeft + dx, window.innerWidth - startPixels.width),
        ),
        y: Math.max(
          0,
          Math.min(startTop + dy, window.innerHeight - startPixels.height),
        ),
      }

      panel.style.left = `${nextPixels.x}px`
      panel.style.top = `${nextPixels.y}px`
      panel.style.transform = 'none'
      panel.style.willChange = ''

      const newRatio = panelPixelsToRatio(nextPixels, viewportFromWindow())
      ratioRef.current = newRatio
      setRatio(newRatio)
      savePanelRatio(newRatio)

      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
  }, [])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    const panel = panelRef.current
    if (!panel) return

    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startPixels = ratioToPanelPixels(
      ratioRef.current,
      viewportFromWindow(),
    )

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startMouseX
      const dy = ev.clientY - startMouseY
      const maxW = Math.min(MAX_WIDTH, window.innerWidth - startPixels.x)
      const maxH = Math.min(MAX_HEIGHT, window.innerHeight - startPixels.y)
      const newW = Math.min(Math.max(startPixels.width + dx, MIN_WIDTH), maxW)
      const newH = Math.min(Math.max(startPixels.height + dy, MIN_HEIGHT), maxH)
      panel.style.width = `${newW}px`
      panel.style.height = `${newH}px`
    }

    const onUp = () => {
      const finalW = parseInt(panel.style.width) || startPixels.width
      const finalH = parseInt(panel.style.height) || startPixels.height
      const newRatio = panelPixelsToRatio(
        { ...startPixels, width: finalW, height: finalH },
        viewportFromWindow(),
      )
      ratioRef.current = newRatio
      setRatio(newRatio)
      savePanelRatio(newRatio)

      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
    e.stopPropagation()
  }, [])

  return {
    panelRef,
    pixels,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  }
}
