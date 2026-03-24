import { create } from 'zustand'

interface ShortcutHelpState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useShortcutHelpStore = create<ShortcutHelpState>((set, get) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen }),
}))
