import { describe, expect, it } from 'vitest'
import {
  normalizeFeverAccountBaseUrl,
  normalizeFeverBaseUrl,
} from './fever-endpoint'

describe('normalizeFeverBaseUrl', () => {
  it('accepts a FreshRSS root URL', () => {
    expect(normalizeFeverBaseUrl('https://rss.example.com')).toBe(
      'https://rss.example.com/api/fever.php',
    )
  })

  it('accepts a FreshRSS install under a subdirectory', () => {
    expect(normalizeFeverBaseUrl('https://rss.example.com/FreshRSS/')).toBe(
      'https://rss.example.com/FreshRSS/api/fever.php',
    )
  })

  it('accepts an API directory URL', () => {
    expect(normalizeFeverBaseUrl('https://rss.example.com/FreshRSS/api')).toBe(
      'https://rss.example.com/FreshRSS/api/fever.php',
    )
  })

  it('leaves an explicit Fever endpoint in place', () => {
    expect(
      normalizeFeverBaseUrl(
        'https://rss.example.com/FreshRSS/api/fever.php?api#setup',
      ),
    ).toBe('https://rss.example.com/FreshRSS/api/fever.php')
  })

  it('converts common FreshRSS UI URLs to the API endpoint', () => {
    expect(normalizeFeverBaseUrl('https://rss.example.com/FreshRSS/i/')).toBe(
      'https://rss.example.com/FreshRSS/api/fever.php',
    )
    expect(normalizeFeverBaseUrl('https://rss.example.com/FreshRSS/p/i/')).toBe(
      'https://rss.example.com/FreshRSS/api/fever.php',
    )
  })

  it('converts a FreshRSS Google Reader endpoint to the Fever endpoint', () => {
    expect(
      normalizeFeverBaseUrl('https://rss.example.com/FreshRSS/api/greader.php'),
    ).toBe('https://rss.example.com/FreshRSS/api/fever.php')
  })

  it('keeps account display URLs close to what the user entered', () => {
    expect(
      normalizeFeverAccountBaseUrl(
        'https://rss.example.com/FreshRSS/api/greader.php?output=json#setup',
      ),
    ).toBe('https://rss.example.com/FreshRSS/api/greader.php')
  })
})
