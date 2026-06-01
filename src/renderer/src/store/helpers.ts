import {
  create,
  type StateCreator,
  type StoreApi,
  type UseBoundStore,
} from 'zustand'
import { useShallow } from 'zustand/react/shallow'

export const createAppStore = <T>(initializer: StateCreator<T, [], []>) =>
  create<T>()(initializer)

export function useStoreShallow<TState, TSlice>(
  store: UseBoundStore<StoreApi<TState>>,
  selector: (state: TState) => TSlice,
) {
  return store(useShallow(selector))
}

export function mergeState<TState extends object>(
  set: (
    partial: Partial<TState> | ((state: TState) => Partial<TState>),
  ) => void,
) {
  return (patch: Partial<TState> | ((state: TState) => Partial<TState>)) => {
    set((state) => (typeof patch === 'function' ? patch(state) : patch))
  }
}
