import { DEFAULT_SHORTCUTS, matchesShortcut } from "../../../shared/shortcuts"

export type CommandHandler = (event: KeyboardEvent) => boolean | void

type CommandEntry = {
  id: string
  shortcutId?: string
  handler: CommandHandler
}

const commandRegistry = new Map<string, CommandEntry>()

export function registerCommand(entry: CommandEntry) {
  commandRegistry.set(entry.id, entry)
  return () => {
    commandRegistry.delete(entry.id)
  }
}

export function runCommand(id: string, event: KeyboardEvent) {
  return commandRegistry.get(id)?.handler(event)
}

export function handleRegisteredShortcutEvent(event: KeyboardEvent): boolean {
  for (const entry of commandRegistry.values()) {
    if (!entry.shortcutId) continue
    const shortcut = DEFAULT_SHORTCUTS.find((item) => item.id === entry.shortcutId)
    if (!shortcut) continue
    if (!matchesShortcut(event, shortcut)) continue
    const handled = entry.handler(event)
    if (handled === false) continue
    return true
  }
  return false
}
