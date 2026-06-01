import { useEffect } from 'react'
import { create } from 'zustand'

export type OverlayStackId =
  | 'settings'
  | 'quick-search'
  | 'command-palette'
  | 'shortcut-help'
  | 'ai-chat'

const OVERLAY_BASE_Z_INDEX = 50

interface OverlayStackState {
  stack: OverlayStackId[]
  open: (id: OverlayStackId) => void
  close: (id: OverlayStackId) => void
  toggle: (id: OverlayStackId) => void
}

export const useOverlayStackStore = create<OverlayStackState>((set, get) => ({
  stack: [],
  open: (id) =>
    set((state) => ({
      stack: [...state.stack.filter((item) => item !== id), id],
    })),
  close: (id) =>
    set((state) => ({
      stack: state.stack.filter((item) => item !== id),
    })),
  toggle: (id) => {
    if (get().stack.includes(id)) {
      get().close(id)
    } else {
      get().open(id)
    }
  },
}))

export function getOverlayZIndex(
  stack: OverlayStackId[],
  id: OverlayStackId,
): number {
  const index = stack.indexOf(id)
  return OVERLAY_BASE_Z_INDEX + (index >= 0 ? index : 0)
}

export function useOverlayStackItem(id: OverlayStackId, active: boolean) {
  const stack = useOverlayStackStore((state) => state.stack)

  useEffect(() => {
    const store = useOverlayStackStore.getState()
    if (active) {
      store.open(id)
      return () => {
        useOverlayStackStore.getState().close(id)
      }
    }
    store.close(id)
    return
  }, [active, id])

  const currentStack = active
    ? stack.includes(id)
      ? stack
      : [...stack, id]
    : stack
  const zIndex = getOverlayZIndex(currentStack, id)
  const isTop = currentStack[currentStack.length - 1] === id

  return {
    zIndex,
    isTop,
    hasOpenOverlays: currentStack.length > 0,
  }
}
