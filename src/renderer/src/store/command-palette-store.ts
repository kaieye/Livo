import { create } from 'zustand'
import { useOverlayStackStore } from './overlay-stack-store'

interface CommandPaletteState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useCommandPaletteStore = create<CommandPaletteState>(
  (set, get) => ({
    isOpen: false,
    open: () => {
      useOverlayStackStore.getState().open('command-palette')
      set({ isOpen: true })
    },
    close: () => {
      useOverlayStackStore.getState().close('command-palette')
      set({ isOpen: false })
    },
    toggle: () => {
      const next = !get().isOpen
      if (next) {
        useOverlayStackStore.getState().open('command-palette')
      } else {
        useOverlayStackStore.getState().close('command-palette')
      }
      set({ isOpen: next })
    },
  }),
)
