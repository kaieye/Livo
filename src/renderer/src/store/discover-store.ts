import { create } from "zustand"
import type { DiscoverCategory, DiscoverFeed, RSSHubRoute } from "../../../shared/discover-data"

export type DiscoverSearchPlatform = "all" | "youtube" | "bilibili" | "x" | "instagram"

interface DiscoverSearchResult {
  title: string
  url: string
  siteUrl: string
  description: string
  source: "curated" | "url" | "rsshub"
  image?: string
  followers?: string
}

function extractXUsernameFromFeedUrl(url: string): string | null {
  const matched = url.match(/\/(?:x|twitter)\/user\/([^/?#]+)/i)
  if (!matched?.[1]) return null
  try {
    return decodeURIComponent(matched[1]).replace(/^@+/, "").trim().toLowerCase() || null
  } catch {
    return matched[1].replace(/^@+/, "").trim().toLowerCase() || null
  }
}

function parseFollowersFromMirrorText(raw: string): string | undefined {
  const text = raw.replace(/\s+/g, " ").trim()
  if (!text) return undefined
  const numberFirst = text.match(/([\d][\d.,]*\s*[KMB]?)\s*followers?/i)
  if (numberFirst?.[1]) return `${numberFirst[1].trim()} followers`
  const wordFirst = text.match(/followers?\s*[:：]?\s*([\d][\d.,]*\s*[KMB]?)/i)
  if (wordFirst?.[1]) return `${wordFirst[1].trim()} followers`
  return undefined
}

async function fetchXFollowersFromMirror(username: string): Promise<string | undefined> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`https://r.jina.ai/http://x.com/${encodeURIComponent(username)}`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Accept": "text/plain,text/html;q=0.9,*/*;q=0.8",
      },
    })
    if (!res.ok) return undefined
    const text = await res.text()
    return parseFollowersFromMirrorText(text)
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
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
      let results = (await window.api.discover.search(trimmed, searchPlatform)) as DiscoverSearchResult[]
      if (searchPlatform === "x") {
        const indexes = results
          .map((result: DiscoverSearchResult, index: number) => ({ result, index }))
          .filter(({ result }) => !result.followers && extractXUsernameFromFeedUrl(result.url))
          .slice(0, 6)
        if (indexes.length > 0) {
          const enriched = [...results]
          await Promise.all(
            indexes.map(async ({ result, index }: { result: DiscoverSearchResult; index: number }) => {
              const username = extractXUsernameFromFeedUrl(result.url)
              if (!username) return
              const followers = await fetchXFollowersFromMirror(username)
              if (!followers) return
              enriched[index] = {
                ...result,
                followers,
                description:
                  !result.description || /x user|rsshub x\/twitter user route/i.test(result.description)
                    ? followers
                    : result.description,
              }
            })
          )
          results = enriched
        }
      }
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
