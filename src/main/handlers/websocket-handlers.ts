import { IPC } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { getValidatedSession } from '../services/auth/session-validation'
import type { WebSocketService } from '../services/websocket'

export function registerWebSocketHandlers(ws: WebSocketService): void {
  registerChannel(IPC.WS_CONNECT, async () => {
    const session = await getValidatedSession()
    if (!session) {
      ws.disconnect()
      return { success: false, error: 'Authentication required' }
    }

    ws.connect(session.user.id)
    return { success: true }
  })

  registerChannel(IPC.WS_DISCONNECT, () => {
    ws.disconnect()
    return { success: true }
  })

  registerChannel(IPC.WS_STATUS, () => {
    return { connected: ws.isConnected() }
  })
}
