import { session } from 'electron'
import { IPC } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { toHandlerError } from '../ipc/handler-error'
import { getBackendBaseUrl } from '../services/backend/backend-config'
import { sessionStore } from '../services/auth/session-store'

async function requestBackend<T>(
  path: string,
  options: { method?: string } = {},
): Promise<T> {
  const token = sessionStore.getValidToken()
  if (!token) {
    throw new Error('Please sign in before loading notifications')
  }

  const response = await session.defaultSession.fetch(
    `${getBackendBaseUrl()}${path}`,
    {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `Notification request failed: ${response.status}${text ? ` ${text}` : ''}`,
    )
  }

  return (await response.json()) as T
}

export function registerNotificationHandlers(): void {
  registerChannel(IPC.ADMIN_GET_NOTIFICATIONS, async (_event, options) => {
    try {
      const params = new URLSearchParams()
      if (options?.unread !== undefined) {
        params.set('read', String(!options.unread))
      }
      if (options?.limit) params.set('limit', String(options.limit))
      if (options?.offset) params.set('offset', String(options.offset))

      const query = params.toString()
      return await requestBackend(
        `/api/notifications${query ? `?${query}` : ''}`,
      )
    } catch (error) {
      return toHandlerError(error)
    }
  })

  registerChannel(IPC.ADMIN_GET_UNREAD_COUNT, async () => {
    try {
      return await requestBackend('/api/notifications/unread-count')
    } catch (error) {
      return toHandlerError(error)
    }
  })

  registerChannel(IPC.ADMIN_MARK_NOTIFICATION_READ, async (_event, id) => {
    try {
      return await requestBackend(
        `/api/notifications/${encodeURIComponent(id)}/read`,
        { method: 'PATCH' },
      )
    } catch (error) {
      return toHandlerError(error)
    }
  })

  registerChannel(IPC.ADMIN_MARK_NOTIFICATION_UNREAD, async (_event, id) => {
    try {
      return await requestBackend(
        `/api/notifications/${encodeURIComponent(id)}/unread`,
        { method: 'PATCH' },
      )
    } catch (error) {
      return toHandlerError(error)
    }
  })

  registerChannel(IPC.ADMIN_MARK_ALL_NOTIFICATIONS_READ, async () => {
    try {
      return await requestBackend('/api/notifications/mark-all-read', {
        method: 'POST',
      })
    } catch (error) {
      return toHandlerError(error)
    }
  })
}
