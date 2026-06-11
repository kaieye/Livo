import { io, Socket } from 'socket.io-client'
import type { BrowserWindow } from 'electron'

export class WebSocketService {
  private socket: Socket | null = null
  private window: BrowserWindow | null = null
  private serverUrl: string

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl
  }

  setWindow(window: BrowserWindow) {
    this.window = window
  }

  connect(userId?: string) {
    if (this.socket?.connected) return

    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      query: userId ? { userId } : {},
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    this.socket.on('connect', () => {
      this.window?.webContents.send('ws:connected')
    })

    this.socket.on('disconnect', () => {
      this.window?.webContents.send('ws:disconnected')
    })

    this.socket.on('notification', (data) => {
      this.window?.webContents.send('ws:notification', data)
    })

    this.socket.on('connect_error', (error) => {
      this.window?.webContents.send('ws:error', error.message)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false
  }
}
