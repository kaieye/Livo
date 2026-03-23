import { registerCommand } from "./command-registry"
import { HOTKEY_OVERLAY_SCOPES } from "./hotkey-scope"
import { requestLayoutFocus } from "./layout-focus"

export type LayoutCommandId = "focus-sidebar" | "focus-content"

const layoutCommandHandlers: Record<LayoutCommandId, () => void> = {
  "focus-sidebar": () => requestLayoutFocus("sidebar"),
  "focus-content": () => requestLayoutFocus("content"),
}

export function runLayoutCommand(commandId: LayoutCommandId) {
  layoutCommandHandlers[commandId]?.()
}

export function registerLayoutCommands() {
  const cleanups = ([
    "focus-sidebar",
    "focus-content",
  ] as LayoutCommandId[]).map((id) =>
    registerCommand({
      id: `layout:${id}`,
      shortcutId: id,
      blockedScopes: HOTKEY_OVERLAY_SCOPES,
      handler: (event) => {
        event.preventDefault()
        runLayoutCommand(id)
      },
    }),
  )
  return () => {
    cleanups.forEach((cleanup) => cleanup())
  }
}
