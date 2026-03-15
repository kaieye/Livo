import { create } from "zustand"
import type { DiscoverCategory, DiscoverFeed, RSSHubRoute } from "../../../shared/discover-data"

interface DiscoverSearchResult {
  title: string
  url: string
  siteUrl: string
  description: string
  source: "curated" | "url" | "rsshub"
}

interface DiscoverState {
  isOpen: boolean
  categories: DiscoverCategory[]
  selectedCategory: string | null
  feeds: DiscoverFeed[]
  rsshubRoutes: RSSHubRoute[]
  searchQuery: string
  searchResults: DiscoverSearchResult[]
  isSearching: boolean
  isLoading: boolean
  subscribingUrls: Set<string>

  setOpen: (open: boolean) => void
  loadCategories: () => Promise<void>
  selectCategory: (categoryId: string | null) => Promise<void>
  search: (query: string) => Promise<void>
  setSearchQuery: (query: string) => void
  loadRSSHubRoutes: (category?: string) => Promise<void>
  setSubscribing: (url: string, subscribing: boolean) => void
}

export const useDiscoverStore = create<DiscoverState>((set, get) => ({
  isOpen: false,
  categories: [],
  selectedCategory: null,
  feeds: [],
  rsshubRoutes: [],
  searchQuery: "",
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

  search: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false })
      return
    }
    set({ isSearching: true })
    try {
      const results = await window.api.discover.search(query)
      set({ searchResults: results, isSearching: false })
    } catch {
      set({ isSearching: false })
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

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
