import { useEffect } from "react"

import { registerCommand, type CommandHandler } from "../lib/command-registry"
import type { HotkeyScope } from "../lib/hotkey-scope"

export function useRegisterCommand({
  id,
  shortcutId,
  scopes,
  blockedScopes,
  isEnabled,
  handler,
}: {
  id: string
  shortcutId?: string
  scopes?: HotkeyScope[]
  blockedScopes?: HotkeyScope[]
  isEnabled?: () => boolean
  handler: CommandHandler
}) {
  useEffect(() => {
    return registerCommand({ id, shortcutId, scopes, blockedScopes, isEnabled, handler })
  }, [blockedScopes, handler, id, isEnabled, scopes, shortcutId])
}
