import { IPC } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { toHandlerError } from '../ipc/handler-error'
import { getDb } from '../database'
import {
  fetchReadableContent,
  resolveRelativeUrls,
} from '../services/entry/readability'
import { ENTRY_FULLTEXT_FETCH_TASK } from '../services/system/task-contracts'
import { getLocalTaskRunner } from '../services/system/task-runner-service'

async function fetchAndPersistReadableContent(input: {
  url: string
  entryId?: string
}) {
  const result = await fetchReadableContent(input.url)
  const content = resolveRelativeUrls(result.content, input.url)

  if (input.entryId) {
    getDb().entries.updateEntry(input.entryId, {
      readabilityContent: content,
      readabilityTitle: result.title,
      readabilityExcerpt: result.excerpt,
      readabilitySiteName: result.siteName,
      readabilityLength: result.length,
      readabilityFetchedAt: Date.now(),
      readabilityError: undefined,
    })
  }

  return {
    success: true,
    title: result.title,
    content,
    excerpt: result.excerpt,
    siteName: result.siteName,
    length: result.length,
  }
}

export function registerReadabilityHandlers(): void {
  registerChannel(IPC.READABILITY_FETCH, async (_event, url, entryId) => {
    const task = getLocalTaskRunner().enqueue(
      ENTRY_FULLTEXT_FETCH_TASK,
      { url, entryId },
      fetchAndPersistReadableContent,
      {
        metadata: {
          entryId,
          entryTaskKind: entryId ? 'fulltext' : undefined,
          url,
        },
      },
    )
    try {
      return { ...(await task.promise), runId: task.runId }
    } catch (error) {
      if (entryId) {
        getDb().entries.updateEntry(entryId, {
          readabilityError:
            error instanceof Error ? error.message : String(error),
        })
      }
      return toHandlerError(error, '无法获取原文')
    }
  })
}
