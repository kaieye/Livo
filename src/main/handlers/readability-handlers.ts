import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import {
  fetchReadableContent,
  resolveRelativeUrls,
} from '../services/readability'

export function registerReadabilityHandlers(): void {
  ipcMain.handle(IPC.READABILITY_FETCH, async (_event, url: string) => {
    try {
      const result = await fetchReadableContent(url)
      const content = resolveRelativeUrls(result.content, url)

      return {
        success: true,
        title: result.title,
        content,
        excerpt: result.excerpt,
        siteName: result.siteName,
        length: result.length,
      }
    } catch (error) {
      return {
        success: false,
        error: `无法获取原文: ${String(error)}`,
      }
    }
  })
}
