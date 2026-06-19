/**
 * Shared data operations used by both IPC handlers and Agent tools.
 */
import { dialog } from 'electron'
import { writeFileSync } from 'fs'
import { getDb } from '../database'
import { generateOPML } from '../services/feed/opml-parser'
import { throwIfAborted } from '../utils/abort-signal'

export interface ExportOPMLResult {
  success: boolean
  feedCount: number
  filePath?: string
  cancelled?: boolean
  error?: string
}

export interface ExportOPMLOptions {
  signal?: AbortSignal
}

/** Export all subscribed feeds to an OPML file. */
export async function exportOPML(
  options: ExportOPMLOptions = {},
): Promise<ExportOPMLResult> {
  throwIfAborted(options.signal)
  const feeds = getDb().feeds.getAllFeeds()
  if (feeds.length === 0) {
    return { success: false, feedCount: 0, error: 'no_feeds' }
  }

  throwIfAborted(options.signal)
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
    throwIfAborted(options.signal)
    writeFileSync(result.filePath, generateOPML(feeds), 'utf-8')
    throwIfAborted(options.signal)
  } catch (error) {
    return {
      success: false,
      feedCount: feeds.length,
      error: String(error),
    }
  }

  return { success: true, feedCount: feeds.length, filePath: result.filePath }
}
