import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  handleRegisteredShortcutEvent,
  registerCommand,
  resetCommandRegistry,
} from './command-registry'
import {
  registerOverlayHotkeyScope,
  resetHotkeyScopeState,
  setFocusedHotkeyScope,
} from './hotkey-scope'

function createKeyboardEvent(
  key: string,
  options: {
    ctrlKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
    metaKey?: boolean
    code?: string
  } = {},
): KeyboardEvent {
  return {
    key,
    code: options.code ?? `Key${key.toUpperCase()}`,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
    metaKey: options.metaKey ?? false,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent
}

afterEach(() => {
  resetCommandRegistry()
  resetHotkeyScopeState()
})

describe('command registry', () => {
  it('prefers the command registered for the active top scope', () => {
    const calls: string[] = []

    registerCommand({
      id: 'global-next-entry',
      shortcutId: 'next-entry',
      handler: () => {
        calls.push('global')
      },
    })
    registerCommand({
      id: 'content-next-entry',
      shortcutId: 'next-entry',
      scopes: ['content'],
      handler: () => {
        calls.push('content')
      },
    })

    setFocusedHotkeyScope('content')
    const handled = handleRegisteredShortcutEvent(createKeyboardEvent('j'))

    expect(handled).toBe(true)
    expect(calls).toEqual(['content'])
  })

  it('blocks commands when a blocked overlay scope is active', () => {
    const handler = vi.fn()

    registerCommand({
      id: 'global-refresh',
      shortcutId: 'refresh-all',
      blockedScopes: ['quick-search'],
      handler,
    })

    const disposeOverlay = registerOverlayHotkeyScope('quick-search')
    const handled = handleRegisteredShortcutEvent(
      createKeyboardEvent('r', { ctrlKey: true }),
    )
    disposeOverlay()

    expect(handled).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  it('falls back when a higher-priority command declines handling', () => {
    const calls: string[] = []

    registerCommand({
      id: 'content-copy-link',
      shortcutId: 'copy-link',
      scopes: ['content'],
      handler: () => {
        calls.push('content')
        return false
      },
    })
    registerCommand({
      id: 'global-copy-link',
      shortcutId: 'copy-link',
      handler: () => {
        calls.push('global')
      },
    })

    setFocusedHotkeyScope('content')
    const handled = handleRegisteredShortcutEvent(
      createKeyboardEvent('c', { ctrlKey: true, shiftKey: true }),
    )

    expect(handled).toBe(true)
    expect(calls).toEqual(['content', 'global'])
  })
})
