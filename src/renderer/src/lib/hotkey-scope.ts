export type HotkeyScope =
  | "sidebar"
  | "content"
  | "quick-search"
  | "shortcut-help"
  | "settings"
  | "ai-chat"
  | "context-menu"

type ScopeState = {
  active: Set<HotkeyScope>
  top: HotkeyScope | null
  focused: HotkeyScope | null
}

type ScopeListener = (state: ScopeState) => void

const overlayScopes = new Map<number, HotkeyScope>()
const listeners = new Set<ScopeListener>()

let overlayToken = 0
let focusedScope: HotkeyScope | null = null

function buildScopeState(): ScopeState {
  const active = new Set<HotkeyScope>()

  if (focusedScope) {
    active.add(focusedScope)
  }

  for (const scope of overlayScopes.values()) {
    active.add(scope)
  }

  let top: HotkeyScope | null = null
  const overlayValues = Array.from(overlayScopes.values())
  if (overlayValues.length > 0) {
    top = overlayValues[overlayValues.length - 1] ?? null
  } else {
    top = focusedScope
  }

  return {
    active,
    top,
    focused: focusedScope,
  }
}

function emitScopeState() {
  const state = buildScopeState()
  for (const listener of listeners) {
    listener(state)
  }
}

export function getHotkeyScopeState(): ScopeState {
  return buildScopeState()
}

export function getFocusedHotkeyScope(): HotkeyScope | null {
  return focusedScope
}

export function setFocusedHotkeyScope(scope: HotkeyScope | null) {
  if (focusedScope === scope) return
  focusedScope = scope
  emitScopeState()
}

export function registerOverlayHotkeyScope(scope: HotkeyScope) {
  const token = ++overlayToken
  overlayScopes.set(token, scope)
  emitScopeState()

  return () => {
    if (!overlayScopes.delete(token)) return
    emitScopeState()
  }
}

export function subscribeHotkeyScopeState(listener: ScopeListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetHotkeyScopeState() {
  overlayScopes.clear()
  overlayToken = 0
  focusedScope = null
  emitScopeState()
}

export const HOTKEY_OVERLAY_SCOPES: HotkeyScope[] = [
  "quick-search",
  "shortcut-help",
  "settings",
  "ai-chat",
  "context-menu",
]
