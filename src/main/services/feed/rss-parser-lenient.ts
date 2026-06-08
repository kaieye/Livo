import RssParser from 'rss-parser'

function isInvalidXmlControlCharacter(code: number): boolean {
  return (
    code <= 0x08 ||
    code === 0x0b ||
    code === 0x0c ||
    (code >= 0x0e && code <= 0x1f) ||
    (code >= 0x7f && code <= 0x9f)
  )
}

function stripInvalidXmlControlCharacters(input: string): string {
  let sanitized: string | null = null

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const code = char.charCodeAt(0)

    if (isInvalidXmlControlCharacter(code)) {
      sanitized ??= input.slice(0, index)
      continue
    }

    if (sanitized !== null) {
      sanitized += char
    }
  }

  return sanitized ?? input
}

/**
 * Lenient RSS parser that attempts to handle malformed XML.
 * Falls back to string manipulation when strict parsing fails.
 */
export class LenientRssParser extends RssParser {
  /**
   * Attempt to fix common XML issues before parsing
   */
  private sanitizeXml(xml: string): string {
    let sanitized = xml

    // XML 1.0 不允许这些控制字符，但正则写法会触发 no-control-regex。
    sanitized = stripInvalidXmlControlCharacters(sanitized)

    // Fix 2: Fix unclosed CDATA sections
    sanitized = sanitized.replace(/<!\[CDATA\[(?!.*?\]\]>)/g, '<![CDATA[]]>')

    // Fix 3: Fix broken HTML entities
    sanitized = sanitized.replace(
      /&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g,
      '&amp;',
    )

    // Fix 5: Fix mismatched tags (basic detection)
    // This is a simple heuristic - won't catch all cases but helps with common issues
    const tagStack: string[] = []
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g
    let match

    // First pass: detect obviously broken tags
    while ((match = tagRegex.exec(sanitized)) !== null) {
      const isClosing = match[0].startsWith('</')
      const tagName = match[1].toLowerCase()

      if (isClosing) {
        if (tagStack.length > 0 && tagStack[tagStack.length - 1] === tagName) {
          tagStack.pop()
        }
      } else if (!match[0].endsWith('/>')) {
        // Self-closing tags don't go on the stack
        tagStack.push(tagName)
      }
    }

    // Fix 6: Remove BOM (Byte Order Mark)
    if (sanitized.charCodeAt(0) === 0xfeff) {
      sanitized = sanitized.slice(1)
    }

    return sanitized
  }

  /**
   * Parse with lenient mode - tries to fix common XML issues
   */
  async parseStringLenient(
    xml: string,
  ): Promise<RssParser.Output<Record<string, any>>> {
    // Try strict parsing first
    try {
      return await this.parseString(xml)
    } catch (strictError) {
      // Strict parsing failed, try sanitizing and retry
      try {
        const sanitized = this.sanitizeXml(xml)
        return await this.parseString(sanitized)
      } catch (lenientError) {
        // If still fails, provide a more helpful error message
        const strictMsg =
          strictError instanceof Error
            ? strictError.message
            : String(strictError)
        const lenientMsg =
          lenientError instanceof Error
            ? lenientError.message
            : String(lenientError)

        throw new Error(
          `Failed to parse RSS feed (strict: ${strictMsg.slice(0, 100)}, lenient: ${lenientMsg.slice(0, 100)})`,
        )
      }
    }
  }
}

/**
 * Create a lenient RSS parser instance
 */
export function createLenientParser(
  options?: RssParser.ParserOptions<Record<string, any>, Record<string, any>>,
): LenientRssParser {
  return new LenientRssParser(options)
}
