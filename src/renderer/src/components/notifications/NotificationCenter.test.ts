import { describe, expect, it } from 'vitest'
import { getNotificationCenterPanelLayout } from './NotificationCenter'

describe('getNotificationCenterPanelLayout', () => {
  it('uses a modal size smaller than the settings dialog on desktop', () => {
    const layout = getNotificationCenterPanelLayout({
      viewportWidth: 1200,
      viewportHeight: 800,
    })

    expect(layout).toMatchObject({
      width: 680,
      height: 520,
    })
  })

  it('keeps the centered modal within compact viewport constraints', () => {
    const layout = getNotificationCenterPanelLayout({
      viewportWidth: 500,
      viewportHeight: 420,
    })

    expect(layout).toMatchObject({
      width: 468,
      height: 372,
    })
  })
})
