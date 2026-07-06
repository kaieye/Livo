import { describe, expect, it } from 'vitest'
import { resolveOverlaySaveImageUrl } from './OverlayMediaGallery'

describe('OverlayMediaGallery save URL affordance', () => {
  it('prefers a safe full-size photo URL', () => {
    expect(
      resolveOverlaySaveImageUrl({
        url: ' https://cdn.example.com/photo.jpg ',
        previewUrl: 'https://cdn.example.com/preview.jpg',
      }),
    ).toBe('https://cdn.example.com/photo.jpg')
  })

  it('uses a safe preview when the full-size photo URL is unsafe', () => {
    expect(
      resolveOverlaySaveImageUrl({
        url: 'http://127.0.0.1/private.jpg',
        previewUrl: 'https://cdn.example.com/preview.jpg',
      }),
    ).toBe('https://cdn.example.com/preview.jpg')
  })

  it('blocks unsafe photo save URLs', () => {
    expect(
      resolveOverlaySaveImageUrl({
        url: 'file:///tmp/private.jpg',
        previewUrl: 'http://169.254.169.254/latest/meta-data',
      }),
    ).toBe('')
  })
})
