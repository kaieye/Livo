import { create } from 'zustand'
import { useOverlayStackStore } from './overlay-stack-store'

interface QuickSearchState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useQuickSearchStore = create<QuickSearchState>((set, get) => ({
  isOpen: false,
  open: () => {
    useOverlayStackStore.getState().open('quick-search')
    set({ isOpen: true })
  },
  close: () => {
    useOverlayStackStore.getState().close('quick-search')
    set({ isOpen: false })
  },
  toggle: () => {
    const next = !get().isOpen
    if (next) {
      useOverlayStackStore.getState().open('quick-search')
    } else {
      useOverlayStackStore.getState().close('quick-search')
    }
    set({ isOpen: next })
  },
}))
