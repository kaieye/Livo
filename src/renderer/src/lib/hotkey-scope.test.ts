import { afterEach, describe, expect, it } from "vitest"

import {
  getHotkeyScopeState,
  registerOverlayHotkeyScope,
  resetHotkeyScopeState,
  setFocusedHotkeyScope,
  subscribeHotkeyScopeState,
} from "./hotkey-scope"

afterEach(() => {
  resetHotkeyScopeState()
})

describe("hotkey scope state", () => {
  it("tracks focused scope when no overlay is open", () => {
    setFocusedHotkeyScope("sidebar")

    const state = getHotkeyScopeState()

    expect(state.focused).toBe("sidebar")
    expect(state.top).toBe("sidebar")
    expect(state.active.has("sidebar")).toBe(true)
  })

  it("lets the latest overlay scope take priority", () => {
    setFocusedHotkeyScope("content")
    const disposeSearch = registerOverlayHotkeyScope("quick-search")
    const disposeSettings = registerOverlayHotkeyScope("settings")

    const state = getHotkeyScopeState()

    expect(state.focused).toBe("content")
    expect(state.top).toBe("settings")
    expect(state.active.has("content")).toBe(true)
    expect(state.active.has("quick-search")).toBe(true)
    expect(state.active.has("settings")).toBe(true)

    disposeSettings()
    expect(getHotkeyScopeState().top).toBe("quick-search")

    disposeSearch()
    expect(getHotkeyScopeState().top).toBe("content")
  })

  it("emits state changes to subscribers", () => {
    const tops: Array<string | null> = []
    const unsubscribe = subscribeHotkeyScopeState((state) => {
      tops.push(state.top)
    })

    setFocusedHotkeyScope("content")
    const disposeOverlay = registerOverlayHotkeyScope("context-menu")
    disposeOverlay()
    unsubscribe()

    expect(tops).toEqual(["content", "context-menu", "content"])
  })
})
