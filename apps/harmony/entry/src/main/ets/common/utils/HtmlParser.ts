/**
 * Centralized HTML/XML parsing utilities
 * Consolidates HTML decoding, entity parsing, and tag extraction
 */

// Numeric entity decoding (&#123; or &#x1A2B;)
export function decodeNumericEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (matched: string, hex: string) => {
      const code = parseInt(hex, 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : matched
    })
    .replace(/&#([0-9]+);/g, (matched: string, digits: string) => {
      const code = parseInt(digits, 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : matched
    })
}

// Full HTML entity decoding (handles &lt;, &gt;, &amp;, etc.)
export function decodeHtml(value: string): string {
  return decodeNumericEntities(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

// Basic entity decoding (handles escaped characters and common entities)
export function decodeBasicEntities(value: string): string {
  return decodeNumericEntities(value)
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/g, '=')
    .replace(/\\u002F/gi, '/')
    .replace(/&#0*64;/gi, '@')
    .replace(/\\"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}

// Escape HTML special characters
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Strip all HTML tags and normalize whitespace
export function stripHtml(value: string): string {
  return decodeHtml(value)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Strip CDATA markers
export function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '')
}

// Extract content from a specific XML/HTML tag
export function pickTag(block: string, tagName: string): string {
  const regex = new RegExp(
    `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`,
    'i',
  )
  const matched = block.match(regex)
  return matched && matched[1] ? stripCdata(matched[1]).trim() : ''
}

// Extract content from first matching tag
export function pickFirst(block: string, tagNames: string[]): string {
  for (const tagName of tagNames) {
    const value = pickTag(block, tagName)
    if (value) {
      return value
    }
  }
  return ''
}

// Extract tag content from within a container tag
export function pickTagFromContainer(
  xml: string,
  containerName: string,
  tagName: string,
): string {
  const containerRegex = new RegExp(
    `<${containerName}(?:\\s[^>]*)?>([\\s\\S]*?)</${containerName}>`,
    'i',
  )
  const container = xml.match(containerRegex)
  if (!container?.[1]) {
    return ''
  }
  return pickTag(container[1], tagName)
}

function extractMetaAttributeContent(
  html: string,
  attributeName: string,
  attributeValue: string,
): string {
  const pattern = /<meta\b[^>]*>/gi
  let matched: RegExpExecArray | null = pattern.exec(html)

  while (matched) {
    const tag = matched[0] ?? ''
    if (
      !new RegExp(`\\b${attributeName}=(["'])${attributeValue}\\1`, 'i').test(
        tag,
      )
    ) {
      matched = pattern.exec(html)
      continue
    }

    const content = tag.match(/\bcontent=(["'])([\s\S]*?)\1/i)
    if (content?.[2]) {
      return decodeBasicEntities(content[2]).trim()
    }

    matched = pattern.exec(html)
  }

  return ''
}

// Extract meta tag content by property name
export function extractMetaContent(html: string, propertyName: string): string {
  return extractMetaAttributeContent(html, 'property', propertyName)
}

// Extract meta tag content by name attribute
export function extractMetaNameContent(html: string, name: string): string {
  return extractMetaAttributeContent(html, 'name', name)
}

// Check if content looks like an HTML document
export function looksLikeHtmlDocument(value: string): boolean {
  const sample = value.slice(0, 2000)
  return (
    /<html[\s>]/i.test(sample) ||
    /<head[\s>]/i.test(sample) ||
    /<body[\s>]/i.test(sample)
  )
}

// Normalize rich content (decode HTML and use fallback if empty)
export function normalizeRichContent(value: string, fallback: string): string {
  const raw = stripCdata(value).trim()
  if (!raw) {
    return fallback
  }

  const decoded = decodeHtml(raw).trim()
  return decoded || fallback
}
