/**
 * HTML sanitizer — cleans potentially dangerous HTML content.
 * Prevents XSS attacks from RSS feed content.
 *
 * Uses a whitelist approach:
 * - Only allows safe HTML tags (formatting, links, images, etc.)
 * - Strips event handlers (onclick, onerror, onload, etc.)
 * - Removes javascript: URLs
 * - Strips data: URLs except for images
 * - Removes dangerous CSS properties
 */
import {
  createExternalUrlWarning,
  isAllowedHtmlUrl,
  isExternalHttpUrl,
} from '../../../shared/url-policy'
import {
  isAllowedPlaybackMediaSrcset,
  isAllowedPlaybackMediaUrl,
} from '../lib/media-source-policy'

/** Tags allowed in sanitized output */
const ALLOWED_TAGS = new Set([
  // Block elements
  'p',
  'div',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'code',
  'article',
  'section',
  'main',
  'figure',
  'figcaption',
  'details',
  'summary',
  // Lists
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  // Tables
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
  // Inline elements
  'a',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'del',
  'ins',
  'mark',
  'span',
  'small',
  'sub',
  'sup',
  'abbr',
  'cite',
  'q',
  'time',
  'ruby',
  'rt',
  'rp',
  'bdi',
  'bdo',
  'wbr',
  // Media
  'img',
  'picture',
  'source',
  'video',
  'audio',
  // Other
  'iframe',
])

/** Attributes allowed per tag (in addition to global safe attrs) */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'rel', 'target']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading', 'srcset']),
  video: new Set([
    'src',
    'poster',
    'controls',
    'width',
    'height',
    'preload',
    'muted',
    'loop',
  ]),
  audio: new Set(['src', 'controls', 'preload', 'loop']),
  source: new Set(['src', 'type', 'srcset', 'media']),
  iframe: new Set([
    'src',
    'width',
    'height',
    'allowfullscreen',
    'allow',
    'sandbox',
  ]),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  ol: new Set(['start', 'type', 'reversed']),
  time: new Set(['datetime']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
}

/** Global attributes allowed on all elements */
const GLOBAL_ATTRS = new Set([
  'class',
  'id',
  'style',
  'lang',
  'dir',
  'title',
  'role',
])

/** Dangerous CSS properties */
const DANGEROUS_CSS =
  /expression\s*\(|url\s*\(\s*["']?javascript:|behavior\s*:|binding\s*:/i

const MEDIA_TAGS = new Set(['img', 'video', 'audio', 'source'])

/**
 * Sanitize HTML string — remove dangerous content, keep safe formatting.
 * Also adds lazy loading to all images to reduce bandwidth.
 */
export function sanitizeHTML(html: string): string {
  // Use DOMParser for proper HTML parsing
  const doc = new DOMParser().parseFromString(html, 'text/html')
  sanitizeNode(doc.body)

  // Add lazy loading and bandwidth optimization to all images
  for (const img of Array.from(doc.body.querySelectorAll('img'))) {
    img.setAttribute('loading', 'lazy')
    img.setAttribute('decoding', 'async')
  }

  return doc.body.innerHTML
}

function sanitizeNode(node: Node): void {
  const toRemove: Node[] = []

  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i]

    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      const tagName = el.tagName.toLowerCase()

      // Remove disallowed tags entirely
      if (!ALLOWED_TAGS.has(tagName)) {
        // For script/style/iframe(if not allowed), remove entirely
        if (
          tagName === 'script' ||
          tagName === 'style' ||
          tagName === 'noscript' ||
          tagName === 'object' ||
          tagName === 'embed' ||
          tagName === 'applet' ||
          tagName === 'form'
        ) {
          toRemove.push(child)
          continue
        }
        // For other disallowed tags, keep their text content (unwrap)
        const fragment = document.createDocumentFragment()
        while (el.firstChild) fragment.appendChild(el.firstChild)
        node.replaceChild(fragment, child)
        i-- // Re-check from same position
        continue
      }

      // Sanitize iframe — only allow YouTube, Vimeo
      if (tagName === 'iframe') {
        const src = el.getAttribute('src') || ''
        if (!isAllowedIframeSrc(src)) {
          toRemove.push(child)
          continue
        }
        // Force sandbox
        el.setAttribute(
          'sandbox',
          'allow-scripts allow-same-origin allow-popups',
        )
      }

      // Remove disallowed attributes
      const allowedForTag = ALLOWED_ATTRS[tagName] || new Set()
      const attrsToRemove: string[] = []
      for (const attr of Array.from(el.attributes)) {
        const attrName = attr.name.toLowerCase()

        // Remove event handlers
        if (attrName.startsWith('on')) {
          attrsToRemove.push(attr.name)
          continue
        }

        // Check if attribute is allowed
        if (!GLOBAL_ATTRS.has(attrName) && !allowedForTag.has(attrName)) {
          attrsToRemove.push(attr.name)
          continue
        }

        // 检查 URL 属性，避免不同入口各自维护危险协议判断。
        if (attrName === 'src' && MEDIA_TAGS.has(tagName)) {
          if (!isAllowedPlaybackMediaUrl(attr.value)) {
            attrsToRemove.push(attr.name)
            continue
          }
        } else if (
          attrName === 'href' ||
          attrName === 'src' ||
          attrName === 'action'
        ) {
          if (!isAllowedHtmlUrl(attr.value)) {
            attrsToRemove.push(attr.name)
            continue
          }
        }

        if (
          attrName === 'poster' &&
          tagName === 'video' &&
          !isAllowedPlaybackMediaUrl(attr.value)
        ) {
          attrsToRemove.push(attr.name)
          continue
        }

        if (
          attrName === 'srcset' &&
          MEDIA_TAGS.has(tagName) &&
          !isAllowedPlaybackMediaSrcset(attr.value)
        ) {
          attrsToRemove.push(attr.name)
          continue
        }

        // Sanitize style attribute
        if (attrName === 'style') {
          if (DANGEROUS_CSS.test(attr.value)) {
            attrsToRemove.push(attr.name)
            continue
          }
        }
      }

      for (const attr of attrsToRemove) {
        el.removeAttribute(attr)
      }

      // Force links to open in new tab with security attrs
      if (tagName === 'a') {
        el.setAttribute('target', '_blank')
        el.setAttribute('rel', 'noopener noreferrer')
      }

      // Recurse into children
      sanitizeNode(child)
    } else if (child.nodeType === Node.COMMENT_NODE) {
      toRemove.push(child)
    }
  }

  // Remove marked nodes
  for (const n of toRemove) {
    node.removeChild(n)
  }
}

/** Check if an iframe src is from an allowed domain */
function isAllowedIframeSrc(src: string): boolean {
  try {
    const url = new URL(src)
    const host = url.hostname.toLowerCase()
    return (
      host.endsWith('youtube.com') ||
      host.endsWith('youtube-nocookie.com') ||
      host.endsWith('youtu.be') ||
      host.endsWith('vimeo.com') ||
      host.endsWith('player.vimeo.com') ||
      host.endsWith('bilibili.com') ||
      host.endsWith('player.bilibili.com') ||
      host.endsWith('codepen.io') ||
      host.endsWith('codesandbox.io')
    )
  } catch {
    return false
  }
}

/**
 * Check if a URL appears to be external (different domain).
 * Used for external link warnings.
 */
export function isExternalUrl(url: string): boolean {
  return isExternalHttpUrl(url)
}

/**
 * Show an external link warning before navigating.
 * Returns the URL if user confirms, null if cancelled.
 */
export function createExternalLinkWarning(url: string): {
  url: string
  hostname: string
  isSuspicious: boolean
} {
  return createExternalUrlWarning(url)
}
