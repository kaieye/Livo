import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { sanitizeHTML } from './sanitize'

describe('sanitizeHTML', () => {
  beforeEach(() => {
    const { document, window } = parseHTML('<html><body></body></html>')
    class TestDOMParser {
      parseFromString(html: string, type: string) {
        if (type === 'text/html') {
          return parseHTML(`<html><body>${html}</body></html>`).document
        }
        return parseHTML(html).document
      }
    }
    vi.stubGlobal('DOMParser', TestDOMParser)
    vi.stubGlobal('document', document)
    vi.stubGlobal('Node', window.Node)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('removes private and loopback media src attributes', () => {
    const html = sanitizeHTML(`
      <p>
        <img src="http://127.0.0.1/image.jpg" alt="local">
        <video src="http://10.0.0.1/movie.mp4" controls></video>
        <audio src="http://169.254.169.254/audio.mp3" controls></audio>
        <source src="http://[::1]/clip.mp4" type="video/mp4">
      </p>
    `)

    expect(html).not.toContain('http://127.0.0.1/image.jpg')
    expect(html).not.toContain('http://10.0.0.1/movie.mp4')
    expect(html).not.toContain('http://169.254.169.254/audio.mp3')
    expect(html).not.toContain('http://[::1]/clip.mp4')
    expect(html).toContain('controls')
  })

  it('removes private media srcset and poster attributes', () => {
    const html = sanitizeHTML(`
      <picture>
        <source srcset="https://cdn.example.com/a.jpg 1x, http://192.168.0.2/a.jpg 2x">
        <img src="https://cdn.example.com/a.jpg" srcset="http://localhost/a.jpg 1x">
      </picture>
      <video src="https://cdn.example.com/movie.mp4" poster="http://127.0.0.1/poster.jpg"></video>
    `)

    expect(html).toContain('src="https://cdn.example.com/a.jpg"')
    expect(html).toContain('src="https://cdn.example.com/movie.mp4"')
    expect(html).not.toContain('srcset=')
    expect(html).not.toContain('poster=')
  })

  it('keeps public media URLs', () => {
    const html = sanitizeHTML(`
      <img src="https://cdn.example.com/image.jpg" srcset="https://cdn.example.com/image@2x.jpg 2x">
      <video src="https://cdn.example.com/movie.mp4" poster="https://cdn.example.com/poster.jpg"></video>
    `)

    expect(html).toContain('src="https://cdn.example.com/image.jpg"')
    expect(html).toContain('srcset="https://cdn.example.com/image@2x.jpg 2x"')
    expect(html).toContain('src="https://cdn.example.com/movie.mp4"')
    expect(html).toContain('poster="https://cdn.example.com/poster.jpg"')
  })
})
