import { DEFAULT_SHORTCUTS, matchesShortcut } from '../../../shared/shortcuts'
import { getHotkeyScopeState, type HotkeyScope } from './hotkey-scope'

export type CommandHandler = (event: KeyboardEvent) => boolean | void

type CommandEntry = {
  id: string
  order: number
  shortcutId?: string
  scopes?: HotkeyScope[]
  blockedScopes?: HotkeyScope[]
  isEnabled?: () => boolean
  handler: CommandHandler
}

const commandRegistry = new Map<string, CommandEntry>()
let registrationOrder = 0

export function registerCommand(entry: Omit<CommandEntry, 'order'>) {
  commandRegistry.set(entry.id, { ...entry, order: ++registrationOrder })
  return () => {
    commandRegistry.delete(entry.id)
  }
}

export function runCommand(id: string, event: KeyboardEvent) {
  return commandRegistry.get(id)?.handler(event)
}

export function resetCommandRegistry() {
  commandRegistry.clear()
  registrationOrder = 0
}

function getCommandScopeScore(entry: CommandEntry): number {
  const state = getHotkeyScopeState()

  if (entry.blockedScopes?.some((scope) => state.active.has(scope))) {
    return -1
  }

  if (entry.isEnabled && !entry.isEnabled()) {
    return -1
  }

  if (!entry.scopes || entry.scopes.length === 0) {
    return 100
  }

  if (state.top && entry.scopes.includes(state.top)) {
    return 300
  }

  if (entry.scopes.some((scope) => state.active.has(scope))) {
    return 200
  }

  return -1
}

export function handleRegisteredShortcutEvent(event: KeyboardEvent): boolean {
  const matchedEntries = Array.from(commandRegistry.values())
    .filter((entry) => {
      if (!entry.shortcutId) return false
      const shortcut = DEFAULT_SHORTCUTS.find(
        (item) => item.id === entry.shortcutId,
      )
      if (!shortcut) return false
      return matchesShortcut(event, shortcut)
    })
    .map((entry) => ({
      entry,
      score: getCommandScopeScore(entry),
    }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return right.entry.order - left.entry.order
    })

  for (const { entry } of matchedEntries) {
    const handled = entry.handler(event)
    if (handled === false) continue
    return true
  }
  return false
}
