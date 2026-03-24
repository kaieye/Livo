import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import type { PluginOption, UserConfig } from 'vite'
import { compareLocaleCompleteness } from '../../src/shared/i18n-completeness'
import { en } from '../../src/renderer/src/locales/en'
import { zhCN } from '../../src/renderer/src/locales/zh-CN'
import { getBuildTimestamp, getGitCommitHash } from './metadata.mjs'

export const LIVO_DEV_SERVER = {
  host: '127.0.0.1',
  port: 5431,
  strictPort: true,
} as const

function createI18nCompletenessPlugin(): PluginOption {
  return {
    name: 'livo:i18n-completeness',
    configResolved() {
      const zhReport = compareLocaleCompleteness(en, zhCN)
      const enReport = compareLocaleCompleteness(zhCN, en)

      if (zhReport.missingKeys.length > 0 || enReport.missingKeys.length > 0) {
        const parts = [
          zhReport.missingKeys.length > 0
            ? `zh-CN missing ${zhReport.missingKeys.length} keys`
            : '',
          enReport.missingKeys.length > 0
            ? `en missing ${enReport.missingKeys.length} keys`
            : '',
        ]
          .filter(Boolean)
          .join('; ')

        console.warn(`[livo:i18n] Locale completeness warning: ${parts}`)
      }
    },
  }
}

export function createSharedDefines(): Record<string, string> {
  return {
    __LIVO_BUILD_COMMIT__: JSON.stringify(getGitCommitHash()),
    __LIVO_BUILD_TIME__: JSON.stringify(getBuildTimestamp()),
  }
}

type WebHtmlOptions = {
  title: string
  description: string
}

export function createWebIndexHtmlPlugin(
  options: WebHtmlOptions,
): PluginOption {
  return {
    name: 'livo:web-index-html',
    transformIndexHtml(html) {
      return html
        .replace(/%LIVO_APP_TITLE%/g, options.title)
        .replace(/%LIVO_APP_DESCRIPTION%/g, options.description)
        .replace(/%LIVO_BUILD_COMMIT%/g, getGitCommitHash())
        .replace(/%LIVO_BUILD_TIME%/g, getBuildTimestamp())
    },
  }
}

export function createRendererSharedConfig(
  projectRoot = process.cwd(),
): UserConfig {
  return {
    resolve: {
      alias: {
        '@renderer': resolve(projectRoot, 'src/renderer/src'),
        '@shared': resolve(projectRoot, 'src/shared'),
      },
    },
    define: createSharedDefines(),
    plugins: [react(), createI18nCompletenessPlugin()],
    server: LIVO_DEV_SERVER,
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/')
            if (!normalizedId.includes('node_modules')) {
              if (
                normalizedId.includes(
                  '/src/renderer/src/components/settings/SettingsDialog.tsx',
                )
              )
                return 'app-settings-shell'
              if (
                normalizedId.includes(
                  '/src/renderer/src/components/settings/DataSettings.tsx',
                )
              )
                return 'app-settings-data'
              if (
                normalizedId.includes(
                  '/src/renderer/src/components/settings/AccountsSettings.tsx',
                )
              )
                return 'app-settings-accounts'
              if (
                normalizedId.includes(
                  '/src/renderer/src/components/settings/AISettings.tsx',
                ) ||
                normalizedId.includes(
                  '/src/renderer/src/components/settings/TranslationSettings.tsx',
                )
              ) {
                return 'app-settings-ai'
              }
              if (
                normalizedId.includes(
                  '/src/renderer/src/components/settings/FeedsSettings.tsx',
                ) ||
                normalizedId.includes(
                  '/src/renderer/src/components/settings/GeneralSettings.tsx',
                ) ||
                normalizedId.includes(
                  '/src/renderer/src/components/settings/ReadingSettings.tsx',
                ) ||
                normalizedId.includes(
                  '/src/renderer/src/components/settings/ActionsSettings.tsx',
                ) ||
                normalizedId.includes(
                  '/src/renderer/src/components/settings/AboutSettings.tsx',
                )
              ) {
                return 'app-settings-core'
              }
              if (
                normalizedId.includes(
                  '/src/renderer/src/components/ui/CachedImage.tsx',
                ) ||
                normalizedId.includes('/src/renderer/src/lib/image-metadata.ts')
              ) {
                return 'app-entry'
              }
              if (
                normalizedId.includes(
                  '/src/renderer/src/components/entry/PictureMasonry.tsx',
                ) ||
                normalizedId.includes(
                  '/src/renderer/src/components/entry/TimelineSection.tsx',
                ) ||
                normalizedId.includes(
                  '/src/renderer/src/components/entry/VideoGridSection.tsx',
                ) ||
                normalizedId.includes(
                  '/src/renderer/src/components/entry/SocialOverlayView.tsx',
                )
              ) {
                return 'app-entry-wide-views'
              }
              if (
                normalizedId.includes(
                  '/src/renderer/src/components/entry/EntryViewCards.tsx',
                )
              ) {
                return 'app-entry-list'
              }
              if (normalizedId.includes('/src/renderer/src/components/ai/'))
                return 'app-ai'
              if (
                normalizedId.includes('/src/renderer/src/components/discover/')
              )
                return 'app-discover'
              if (normalizedId.includes('/src/renderer/src/components/media/'))
                return 'app-media'
              if (normalizedId.includes('/src/renderer/src/components/search/'))
                return 'app-search'
              if (
                normalizedId.includes(
                  '/src/renderer/src/components/entry/EntryContent.tsx',
                )
              )
                return 'app-entry-reader'
              if (
                normalizedId.includes(
                  '/src/renderer/src/components/entry/WideViewContent.tsx',
                )
              )
                return 'app-entry-wide'
              if (
                normalizedId.includes(
                  '/src/renderer/src/components/entry/EntryList.tsx',
                )
              )
                return 'app-entry-list'
              if (normalizedId.includes('/src/renderer/src/components/entry/'))
                return 'app-entry'
              if (normalizedId.includes('/src/renderer/src/store/'))
                return 'app-state'
              return undefined
            }
            if (normalizedId.includes('/react-dom')) {
              return 'vendor-react'
            }
            if (normalizedId.includes('/react-router')) return 'vendor-router'
            if (normalizedId.includes('@tanstack')) return 'vendor-query'
            if (
              normalizedId.includes('i18next') ||
              normalizedId.includes('react-i18next')
            )
              return 'vendor-i18n'
            if (normalizedId.includes('react-markdown'))
              return 'vendor-markdown'
            if (normalizedId.includes('zustand')) return 'vendor-state'
            if (normalizedId.includes('lucide-react')) return 'vendor-icons'
            return 'vendor'
          },
        },
      },
    },
  }
}
