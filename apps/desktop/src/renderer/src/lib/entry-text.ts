export function normalizeLooseText(value: string): string {
  return (value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^\p{L}\p{N}\p{Script=Han}#@]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function splitHtmlIntoParagraphs(html: string): string[] {
  const blocks = html
    .split(
      /(<\/(?:p|div|h[1-6]|li|blockquote|pre|table|tr|section|article|figure)>)/i,
    )
    .reduce<string[]>((acc, part, i, arr) => {
      if (i % 2 === 0 && i + 1 < arr.length) {
        acc.push(part + arr[i + 1])
      } else if (i % 2 === 0 && i === arr.length - 1 && part.trim()) {
        acc.push(part)
      }
      return acc
    }, [])
    .map((block) => block.trim())
    .filter(
      (block) =>
        block.length > 0 && block.replace(/<[^>]*>/g, '').trim().length > 0,
    )

  return blocks.length > 0 ? blocks : [html]
}

export function isRedundantRichText(
  primary: string,
  secondary: string,
): boolean {
  if (!primary || !secondary || primary === 'Untitled') return false

  const normalizedPrimary = normalizeLooseText(primary)
  const normalizedSecondary = normalizeLooseText(secondary)
  if (normalizedPrimary && normalizedSecondary) {
    return (
      normalizedSecondary === normalizedPrimary ||
      normalizedSecondary.startsWith(normalizedPrimary) ||
      normalizedPrimary.startsWith(normalizedSecondary)
    )
  }

  const rawPrimary = primary
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const rawSecondary = secondary
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!rawPrimary || !rawSecondary) return false

  return (
    rawSecondary === rawPrimary ||
    rawSecondary.startsWith(rawPrimary) ||
    rawPrimary.startsWith(rawSecondary)
  )
}
