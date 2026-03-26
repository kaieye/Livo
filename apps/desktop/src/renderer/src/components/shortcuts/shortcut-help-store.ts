import { create } from 'zustand'
import { useOverlayStackStore } from '../../store/overlay-stack-store'

interface ShortcutHelpState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useShortcutHelpStore = create<ShortcutHelpState>((set, get) => ({
  isOpen: false,
  open: () => {
    useOverlayStackStore.getState().open('shortcut-help')
    set({ isOpen: true })
  },
  close: () => {
    useOverlayStackStore.getState().close('shortcut-help')
    set({ isOpen: false })
  },
  toggle: () => {
    const next = !get().isOpen
    if (next) {
      useOverlayStackStore.getState().open('shortcut-help')
    } else {
      useOverlayStackStore.getState().close('shortcut-help')
    }
    set({ isOpen: next })
  },
}))
