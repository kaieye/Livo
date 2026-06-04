/**
 * Shared data operations used by both IPC handlers and Agent tools.
 */
import { dialog } from 'electron'
import { writeFileSync } from 'fs'
import { getDb } from '../database'
import { generateOPML } from '../services/feed/opml-parser'

export interface ExportOPMLResult {
  success: boolean
  feedCount: number
  filePath?: string
  cancelled?: boolean
  error?: string
}

/** Export all subscribed feeds to an OPML file. */
export async function exportOPML(): Promise<ExportOPMLResult> {
  const feeds = getDb().feeds.getAllFeeds()
  if (feeds.length === 0) {
    return { success: false, feedCount: 0, error: 'no_feeds' }
  }

  const result = await dialog.showSaveDialog({
    title: '导出 OPML',
    defaultPath: 'subscriptions.opml',
    filters: [
      { name: 'OPML Files', extensions: ['opml'] },
      { name: 'XML Files', extensions: ['xml'] },
    ],
  })

  if (result.canceled || !result.filePath) {
    return { success: false, feedCount: feeds.length, cancelled: true }
  }

  try {
    writeFileSync(result.filePath, generateOPML(feeds), 'utf-8')
  } catch (error) {
    return {
      success: false,
      feedCount: feeds.length,
      error: String(error),
    }
  }

  return { success: true, feedCount: feeds.length, filePath: result.filePath }
}
