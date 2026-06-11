import { IPC } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import type { WebSocketService } from '../services/websocket'

export function registerWebSocketHandlers(ws: WebSocketService): void {
  registerChannel(IPC.WS_CONNECT, (_event, userId) => {
    ws.connect(userId as string | undefined)
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
