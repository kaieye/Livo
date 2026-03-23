import { useEffect } from "react"

import { registerCommand, type CommandHandler } from "../lib/command-registry"

export function useRegisterCommand({
  id,
  shortcutId,
  handler,
}: {
  id: string
  shortcutId?: string
  handler: CommandHandler
}) {
  useEffect(() => {
    return registerCommand({ id, shortcutId, handler })
  }, [handler, id, shortcutId])
}
