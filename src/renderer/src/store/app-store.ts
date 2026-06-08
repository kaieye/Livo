import { createAppStore } from './helpers'

interface AppState {
  isReady: boolean
  isHydrated: boolean
  setReady: (ready: boolean) => void
  setHydrated: (ready: boolean) => void
}

export const useAppStore = createAppStore<AppState>((set) => ({
  isReady: false,
  isHydrated: false,
  setReady: (ready) => set({ isReady: ready }),
  setHydrated: (ready) => set({ isHydrated: ready }),
}))

// Convenience hooks
export const useAppIsReady = () => useAppStore((state) => state.isReady)
export const useAppIsHydrated = () => useAppStore((state) => state.isHydrated)
export const setAppIsReady = (ready: boolean) =>
  useAppStore.getState().setReady(ready)
export const setAppIsHydrated = (ready: boolean) =>
  useAppStore.getState().setHydrated(ready)
