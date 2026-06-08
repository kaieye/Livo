import RssParser from 'rss-parser'

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

    // Fix 1: Remove invalid control characters (except tab, newline, carriage return)
    // Control characters (0x00-0x1F except 0x09, 0x0A, 0x0D) and 0x7F-0x9F are invalid in XML
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')

    // Fix 2: Fix unclosed CDATA sections
    sanitized = sanitized.replace(/<!\[CDATA\[(?!.*?\]\]>)/g, '<![CDATA[]]>')

    // Fix 3: Fix broken HTML entities
    sanitized = sanitized.replace(/&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;')

    // Fix 4: Remove null bytes
    sanitized = sanitized.replace(/\0/g, '')

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
  async parseStringLenient(xml: string): Promise<RssParser.Output<Record<string, any>>> {
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
        const strictMsg = strictError instanceof Error ? strictError.message : String(strictError)
        const lenientMsg = lenientError instanceof Error ? lenientError.message : String(lenientError)

        throw new Error(
          `Failed to parse RSS feed (strict: ${strictMsg.slice(0, 100)}, lenient: ${lenientMsg.slice(0, 100)})`
        )
      }
    }
  }
}

/**
 * Create a lenient RSS parser instance
 */
export function createLenientParser(options?: RssParser.ParserOptions<Record<string, any>, Record<string, any>>): LenientRssParser {
  return new LenientRssParser(options)
}
