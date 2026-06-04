import { IPC } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { toHandlerError } from '../ipc/handler-error'
import {
  fetchReadableContent,
  resolveRelativeUrls,
} from '../services/entry/readability'

export function registerReadabilityHandlers(): void {
  registerChannel(IPC.READABILITY_FETCH, async (_event, url: string) => {
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
      return toHandlerError(error, '无法获取原文')
    }
  })
}
