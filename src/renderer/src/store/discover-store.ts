import type { DiscoverSearchPlatform } from "../lib/discover-search"
import { createAppStore } from "./helpers"

interface DiscoverState {
  isOpen: boolean
  searchQuery: string
  submittedSearchQuery: string
  searchPlatform: DiscoverSearchPlatform
  subscribingUrls: Set<string>

  setOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  submitSearch: (query?: string) => void
  clearSearch: () => void
  setSearchPlatform: (platform: DiscoverSearchPlatform) => void
  setSubscribing: (url: string, subscribing: boolean) => void
}

export const useDiscoverStore = createAppStore<DiscoverState>((set, get) => ({
  isOpen: false,
  searchQuery: "",
  submittedSearchQuery: "",
  searchPlatform: "all",
  subscribingUrls: new Set(),

  setOpen: (open) => {
    set({ isOpen: open })
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  submitSearch: (query) => {
    const source = typeof query === "string" ? query : get().searchQuery
    set({ submittedSearchQuery: source.trim() })
  },

  clearSearch: () => set({ submittedSearchQuery: "" }),

  setSearchPlatform: (platform) => set({ searchPlatform: platform }),

  setSubscribing: (url, subscribing) => {
    const urls = new Set(get().subscribingUrls)
    if (subscribing) urls.add(url)
    else urls.delete(url)
    set({ subscribingUrls: urls })
  },
}))
