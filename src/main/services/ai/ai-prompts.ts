const DEFAULT_SUMMARY_PROMPT =
  'You are a helpful assistant that summarizes articles. Provide a concise summary in {{lang}}. Keep it under 200 words. Focus on key points and main ideas.'

const DEFAULT_TRANSLATE_PROMPT = `You are a professional translator. Translate the following content to {{targetLanguage}}.
Rules:
- Preserve original HTML formatting and tags
- Only output the translation, no explanations or commentary
- Keep proper nouns, code, URLs, and technical terms as-is
- Translate naturally, not word-by-word
- If the content is already in the target language, output it unchanged`

function fillPlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = values[key]
    return value === undefined ? match : value
  })
}

export function buildSummaryPrompt(lang: string, userPrompt?: string): string {
  const template = userPrompt?.trim() || DEFAULT_SUMMARY_PROMPT
  return fillPlaceholders(template, { lang, language: lang })
}

export function buildTranslatePrompt(
  targetLanguage: string,
  userPrompt?: string,
): string {
  const template = userPrompt?.trim() || DEFAULT_TRANSLATE_PROMPT
  return fillPlaceholders(template, { targetLanguage, lang: targetLanguage })
}

/**
 * Trim content to a character budget without slicing mid-paragraph: when the
 * budget falls inside the text, back off to the nearest paragraph/line/sentence
 * break so the model never receives a sentence cut in half.
 */
export function clampContentToBudget(
  content: string,
  maxChars: number,
): string {
  if (maxChars <= 0 || content.length <= maxChars) return content

  const hardSlice = content.slice(0, maxChars)
  const boundaries = [
    hardSlice.lastIndexOf('\n\n'),
    hardSlice.lastIndexOf('\n'),
    hardSlice.lastIndexOf('. '),
    hardSlice.lastIndexOf('。'),
  ]
  const cut = Math.max(...boundaries)
  // Only honour a boundary that keeps a reasonable amount of the budget,
  // otherwise a single very long paragraph would be trimmed too aggressively.
  if (cut >= maxChars * 0.6) return hardSlice.slice(0, cut + 1)
  return hardSlice
}
