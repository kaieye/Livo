import { create } from "zustand"
import type { DiscoverCategory, DiscoverFeed, RSSHubRoute } from "../../../shared/discover-data"

export type DiscoverSearchPlatform = "all" | "youtube" | "bilibili" | "x"

interface DiscoverSearchResult {
  title: string
  url: string
  siteUrl: string
  description: string
  source: "curated" | "url" | "rsshub"
  image?: string
}

interface DiscoverState {
  isOpen: boolean
  categories: DiscoverCategory[]
  selectedCategory: string | null
  feeds: DiscoverFeed[]
  rsshubRoutes: RSSHubRoute[]
  searchQuery: string
  searchPlatform: DiscoverSearchPlatform
  searchResults: DiscoverSearchResult[]
  isSearching: boolean
  isLoading: boolean
  subscribingUrls: Set<string>

  setOpen: (open: boolean) => void
  loadCategories: () => Promise<void>
  selectCategory: (categoryId: string | null) => Promise<void>
  search: (query: string, platform?: DiscoverSearchPlatform) => Promise<void>
  setSearchQuery: (query: string) => void
  setSearchPlatform: (platform: DiscoverSearchPlatform) => void
  loadRSSHubRoutes: (category?: string) => Promise<void>
  setSubscribing: (url: string, subscribing: boolean) => void
}

let latestSearchRequestSeq = 0

export const useDiscoverStore = create<DiscoverState>((set, get) => ({
  isOpen: false,
  categories: [],
  selectedCategory: null,
  feeds: [],
  rsshubRoutes: [],
  searchQuery: "",
  searchPlatform: "all",
  searchResults: [],
  isSearching: false,
  isLoading: false,
  subscribingUrls: new Set(),

  setOpen: (open) => {
    set({ isOpen: open })
    if (open && get().categories.length === 0) {
      get().loadCategories()
    }
  },

  loadCategories: async () => {
    try {
      const categories = await window.api.discover.categories()
      set({ categories })
    } catch {
      // fallback
    }
  },

  selectCategory: async (categoryId) => {
    set({ selectedCategory: categoryId, isLoading: true, searchQuery: "", searchResults: [] })
    try {
      const feeds = await window.api.discover.popular(categoryId || undefined)
      const routes = await window.api.discover.rsshubRoutes(categoryId || undefined)
      set({ feeds, rsshubRoutes: routes, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  search: async (query, platform) => {
    const trimmed = query.trim()
    if (!trimmed) {
      set({ searchResults: [], isSearching: false })
      return
    }

    const searchPlatform = platform || get().searchPlatform
    const searchSeq = ++latestSearchRequestSeq
    set({ isSearching: true })
    try {
      const results = await window.api.discover.search(trimmed, searchPlatform)
      if (searchSeq !== latestSearchRequestSeq) return
      if (useDiscoverStore.getState().searchQuery.trim() !== trimmed) return
      set({ searchResults: results, isSearching: false })
    } catch {
      if (searchSeq !== latestSearchRequestSeq) return
      set({ isSearching: false })
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSearchPlatform: (platform) => {
    set({ searchPlatform: platform })
    // Re-search with new platform if there's a query
    const query = get().searchQuery.trim()
    if (query) {
      get().search(query, platform)
    }
  },

  loadRSSHubRoutes: async (category) => {
    try {
      const routes = await window.api.discover.rsshubRoutes(category)
      set({ rsshubRoutes: routes })
    } catch {
      // ignore
    }
  },

  setSubscribing: (url, subscribing) => {
    const urls = new Set(get().subscribingUrls)
    if (subscribing) urls.add(url)
    else urls.delete(url)
    set({ subscribingUrls: urls })
  },
}))
