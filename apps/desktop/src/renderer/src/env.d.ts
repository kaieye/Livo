import type { ElectronAPI } from '../../preload/index'
import type { DiscoverFeedPreviewResult } from '../../shared/types'

declare module '*.svg' {
  const content: string
  export default content
}

declare global {
  interface Window {
    api: ElectronAPI & {
      ai: {
        testConnection: () => Promise<{
          success: boolean
          message: string
          duration?: number
          modelInfo?: string
        }>
      }
      readability: {
        fetch: (url: string) => Promise<{
          success: boolean
          title?: string
          content?: string
          excerpt?: string
          siteName?: string
          length?: number
          error?: string
        }>
      }
      discover: {
        categories: () => Promise<
          Array<{
            id: string
            name: string
            nameEn: string
            icon: string
            description: string
          }>
        >
        popular: (category?: string) => Promise<
          Array<{
            title: string
            url: string
            siteUrl: string
            description: string
            category: string
            language: string
          }>
        >
        search: (
          query: string,
          platform?: 'all' | 'youtube' | 'bilibili' | 'x' | 'instagram',
        ) => Promise<
          Array<{
            title: string
            url: string
            siteUrl: string
            description: string
            source: 'curated' | 'url' | 'rsshub'
            image?: string
            followers?: string
          }>
        >
        rsshubRoutes: (category?: string) => Promise<
          Array<{
            name: string
            url: string
            description: string
            category: string
          }>
        >
        rsshubInstance: () => Promise<string>
        validateFeed: (url: string) => Promise<{
          valid: boolean
          title?: string
          description?: string
          image?: string
          itemCount?: number
          error?: string
        }>
        previewFeed: (url: string) => Promise<DiscoverFeedPreviewResult>
        resolveProfileUrl: (url: string) => Promise<{
          matched: boolean
          inputUrl: string
          normalizedUrl: string | null
          platform: 'youtube' | 'x' | 'instagram' | 'bilibili' | 'github' | null
          candidates: Array<{
            feedUrl: string
            title: string
            source: 'rss' | 'rsshub' | 'derived'
            siteUrl?: string
            description?: string
            view?: number
            requiresAccount?: Array<'youtube'>
          }>
          accountStates?: Array<{
            provider: 'youtube'
            linked: boolean
            displayName?: string | null
          }>
          reason: 'invalid_url' | 'no_supported_profile_pattern' | null
        }>
        probeTwitterUser: (username: string) => Promise<{
          valid: boolean
          username: string
          title?: string
          description?: string
          image?: string
          feedUrl?: string
        }>
        probeYouTubeChannel: (query: string) => Promise<{
          valid: boolean
          query: string
          title?: string
          description?: string
          image?: string
          feedUrl?: string
          feedRoute?: string
        }>
        probeVideoSources: (query: string) => Promise<{
          valid: boolean
          query: string
          candidates: Array<{
            platform: 'youtube' | 'bilibili'
            title: string
            description: string
            image: string
            feedUrl: string
          }>
        }>
        probeBilibiliUid: (uid: string) => Promise<{
          valid: boolean
          uid: string
          title?: string
          description?: string
          image?: string
          feedUrl?: string
        }>
        probeBilibiliUsers: (query: string) => Promise<{
          valid: boolean
          query: string
          candidates: Array<{
            uid: string
            title: string
            description: string
            image: string
            feedUrl: string
          }>
        }>
        probeInstagramUser: (username: string) => Promise<{
          valid: boolean
          username: string
          title?: string
          description?: string
          image?: string
          feedUrl?: string
        }>
      }
      data: {
        cleanup: (options?: {
          entriesPerFeed?: number
          maxEntryAgeDays?: number
        }) => Promise<{
          removed: number
          removedByCap: number
          removedByAge: number
          remaining: number
        }>
        stats: () => Promise<{
          totalFeeds: number
          totalEntries: number
          readEntries: number
          starredEntries: number
          dataSizeBytes: number
          cacheSizeBytes: number
        }>
      }
      app: {
        getVersion: () => Promise<string>
        openExternal: (url: string) => Promise<{ success: boolean }>
        reportError: (payload: {
          source: string
          message: string
          stack?: string
          componentStack?: string
        }) => Promise<{ success: boolean }>
        readRecentLogs: (
          maxLines?: number,
        ) => Promise<{ success: boolean; content: string }>
        openDataDirectory: () => Promise<{ success: boolean; error?: string }>
        openCacheDirectory: () => Promise<{ success: boolean; error?: string }>
        openLogsDirectory: () => Promise<{ success: boolean; error?: string }>
        clearCache: () => Promise<{
          success: boolean
          clearedBytes: number
          error?: string
        }>
        saveTextFile: (options: {
          content: string
          defaultFileName: string
          title?: string
          filters?: Array<{
            name: string
            extensions: string[]
          }>
        }) => Promise<{
          success: boolean
          canceled?: boolean
          filePath?: string
          error?: string
        }>
        downloadUrl: (options: {
          url: string
          suggestedFileName?: string
          title?: string
          filters?: Array<{
            name: string
            extensions: string[]
          }>
        }) => Promise<{
          success: boolean
          canceled?: boolean
          filePath?: string
          error?: string
        }>
        checkForUpdates: () => Promise<{
          hasUpdate: boolean
          currentVersion: string
          latestVersion?: string
          releaseUrl?: string
          publishedAt?: string
          notes?: string
          error?: string
        }>
      }
      accounts: {
        status: (
          provider: 'youtube' | 'x' | 'instagram' | 'bilibili',
        ) => Promise<{
          provider: 'youtube' | 'x' | 'instagram' | 'bilibili'
          linked: boolean
          displayName?: string | null
          error?: string
        }>
        link: (
          provider: 'youtube' | 'x' | 'instagram' | 'bilibili',
        ) => Promise<{ success: boolean; error?: string }>
        unlink: (
          provider: 'youtube' | 'x' | 'instagram' | 'bilibili',
        ) => Promise<{ success: boolean; error?: string }>
        setDisplayName: (
          provider: 'youtube' | 'x' | 'instagram' | 'bilibili',
          displayName: string,
        ) => Promise<{ success: boolean; error?: string }>
        bilibiliFollowings: () => Promise<{
          success: boolean
          creators?: Array<{ mid: number; uname: string }>
          error?: string
        }>
      }
    }
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: any
    }
  }
}
