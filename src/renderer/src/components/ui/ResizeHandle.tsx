/**
 * ResizeHandle — Draggable panel resize handle.
 * Zero-width element with an invisible 6px hit area and a visible line on hover/drag.
 */
export function ResizeHandle({
  onMouseDown,
}: {
  onMouseDown: (e: React.MouseEvent) => void
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="group relative z-10 w-0 flex-shrink-0"
    >
      {/* Invisible wider hit area */}
      <div className="absolute inset-y-0 -left-[3px] w-[6px] cursor-col-resize">
        {/* Visible line on hover / drag */}
        <div className="absolute inset-y-0 left-[2px] w-[2px] bg-transparent transition-colors group-hover:bg-accent/40 group-active:bg-accent" />
      </div>
    </div>
  )
}

/** Drag-state helper shared across resizable panel layouts. */
export function useResizeDrag(
  setWidth: (w: number) => void,
  minWidth: number,
  maxWidth: number,
  getWidth: () => number,
) {
  const dragging = { current: false }
  let startX = 0
  let startWidth = 0

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    dragging.current = true
    startX = e.clientX
    startWidth = getWidth()
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMouseMove(ev: MouseEvent) {
      if (!dragging.current) return
      const delta = ev.clientX - startX
      setWidth(Math.max(minWidth, Math.min(maxWidth, startWidth + delta)))
    }

    function onMouseUp() {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return onMouseDown
}
