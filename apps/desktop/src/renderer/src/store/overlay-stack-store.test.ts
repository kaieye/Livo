import { beforeEach, describe, expect, it } from 'vitest'
import {
  getOverlayZIndex,
  useOverlayStackStore,
} from './overlay-stack-store'

describe('overlay-stack-store', () => {
  beforeEach(() => {
    useOverlayStackStore.setState({ stack: [] })
  })

  it('moves reopened overlay to top of stack', () => {
    const store = useOverlayStackStore.getState()
    store.open('settings')
    store.open('quick-search')
    store.open('settings')

    expect(useOverlayStackStore.getState().stack).toEqual([
      'quick-search',
      'settings',
    ])
  })

  it('removes overlay from stack when closed', () => {
    const store = useOverlayStackStore.getState()
    store.open('settings')
    store.open('shortcut-help')
    store.close('settings')

    expect(useOverlayStackStore.getState().stack).toEqual(['shortcut-help'])
  })

  it('computes increasing z-index by stack order', () => {
    const stack = ['settings', 'quick-search', 'ai-chat'] as const
    expect(getOverlayZIndex([...stack], 'settings')).toBe(50)
    expect(getOverlayZIndex([...stack], 'quick-search')).toBe(51)
    expect(getOverlayZIndex([...stack], 'ai-chat')).toBe(52)
  })
})
