import { BrowserWindow } from 'electron'

export interface EventBus {
  send(channel: string, ...args: unknown[]): void
}

/** Sends events to all open BrowserWindows. No-op if no windows exist. */
export function createBrowserWindowEventBus(): EventBus {
  return {
    send(channel: string, ...args: unknown[]) {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, ...args)
        }
      }
    },
  }
}

/** Singleton instance for use across main process services. */
let _instance: EventBus | null = null

export function getEventBus(): EventBus {
  if (!_instance) _instance = createBrowserWindowEventBus()
  return _instance
}

/** Override the default event bus (useful for testing). */
export function setEventBus(bus: EventBus): void {
  _instance = bus
}
