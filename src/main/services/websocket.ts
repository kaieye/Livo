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

  // 退出流程中窗口可能已被销毁，socket.io 的 disconnect 事件会同步触发，
  // 直接 send 会抛 "Object has been destroyed" 并打崩主进程。
  private sendToWindow(channel: string, ...args: unknown[]) {
    if (!this.window || this.window.isDestroyed()) return
    this.window.webContents.send(channel, ...args)
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
      this.sendToWindow('ws:connected')
    })

    this.socket.on('disconnect', () => {
      this.sendToWindow('ws:disconnected')
    })

    this.socket.on('notification', (data) => {
      this.sendToWindow('ws:notification', data)
    })

    this.socket.on('connect_error', (error) => {
      this.sendToWindow('ws:error', error.message)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false
  }
}
