import { createAppStore } from './helpers'

interface AppState {
  isReady: boolean
  setReady: (ready: boolean) => void
}

export const useAppStore = createAppStore<AppState>((set) => ({
  isReady: false,
  setReady: (ready) => set({ isReady: ready }),
}))

// Convenience hooks
export const useAppIsReady = () => useAppStore((state) => state.isReady)
export const setAppIsReady = (ready: boolean) =>
  useAppStore.getState().setReady(ready)
