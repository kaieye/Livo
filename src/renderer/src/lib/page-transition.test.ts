import { describe, expect, it } from 'vitest'
import { getTransitionKey } from './page-transition'

describe('getTransitionKey', () => {
  it('maps all home-family routes to a stable "home" key', () => {
    expect(getTransitionKey('/')).toBe('home')
    expect(getTransitionKey('/starred')).toBe('home')
    expect(getTransitionKey('/settings')).toBe('home')
    expect(getTransitionKey('/discover')).toBe('home')
    expect(getTransitionKey('/feed/123')).toBe('home')
    expect(getTransitionKey('/articles')).toBe('home')
    expect(getTransitionKey('/videos/feed/42')).toBe('home')
  })

  it('gives distinct pages their own group key', () => {
    expect(getTransitionKey('/entry/abc')).toBe('entry')
    expect(getTransitionKey('/video/abc')).toBe('video')
    expect(getTransitionKey('/image/abc/2')).toBe('image')
    expect(getTransitionKey('/login/bilibili')).toBe('login')
  })

  it('separates the multi-step discover flow', () => {
    expect(getTransitionKey('/discover/preview')).toBe('discover-preview')
    expect(getTransitionKey('/discover/subscribe')).toBe('discover-subscribe')
  })

  it('tolerates trailing slashes and missing leading slash', () => {
    expect(getTransitionKey('entry/abc')).toBe('entry')
  })
})
