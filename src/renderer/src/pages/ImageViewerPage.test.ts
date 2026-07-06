import { describe, expect, it } from 'vitest'
import {
  resolveViewerExternalUrl,
  resolveViewerImageSource,
} from './ImageViewerPage'

describe('ImageViewerPage media URL affordances', () => {
  it('uses a safe preview when the primary image URL is unsafe', () => {
    expect(
      resolveViewerImageSource({
        url: 'http://127.0.0.1/private.jpg',
        previewUrl: 'https://cdn.example.com/preview.jpg',
      }),
    ).toBe('https://cdn.example.com/preview.jpg')
  })

  it('blocks unsafe image fallback external URLs when no entry URL exists', () => {
    expect(
      resolveViewerExternalUrl('', {
        url: 'http://169.254.169.254/latest/meta-data',
      }),
    ).toBe('')
  })

  it('keeps article URLs as the preferred external target', () => {
    expect(
      resolveViewerExternalUrl(' https://example.com/post ', {
        url: 'https://cdn.example.com/image.jpg',
      }),
    ).toBe('https://example.com/post')
  })
})
