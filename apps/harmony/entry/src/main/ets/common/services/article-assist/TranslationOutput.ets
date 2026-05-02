/**
 * Output cleanup for chat-completion responses, plus the one prompt-shaping
 * helper that is specific to translation (RT/retweet formatting hint).
 *
 * Models in scope often emit reasoning markers (<think>...</think>),
 * "Final Answer:" preambles, or stray "标题：/摘要：/正文：" labels left over
 * from the prompt — these helpers strip those out without touching legitimate
 * content.
 */

export interface TranslationFormattingHint {
  tweetKind?: 'tweet' | 'retweet' | 'quote'
  sourceUserName?: string
  retweetedUserName?: string
}

const REASONING_TAG_PATTERNS: RegExp[] = [
  /<think>[\s\S]*?<\/think>/g,
  /<thinking>[\s\S]*?<\/thinking>/g,
]

const FINAL_ANSWER_MARKERS: string[] = [
  'Final Answer:',
  'Final answer:',
  '最终答案：',
  '最终回答：',
  '答案：',
]

const TRANSLATION_LABEL_PATTERN = /^(标题|摘要|正文|正文片段|翻译)\s*[：:]\s*/

export function sanitizeModelOutput(content: string): string {
  let normalized = stripReasoningTags(content || '').trim()

  for (const marker of FINAL_ANSWER_MARKERS) {
    const markerIndex = normalized.lastIndexOf(marker)
    if (markerIndex >= 0) {
      const candidate = normalized.slice(markerIndex + marker.length).trim()
      if (candidate) {
        normalized = candidate
        break
      }
    }
  }
  return normalized
}

export function normalizeTranslationOutput(content: string): string {
  const lines = stripReasoningTags(content || '').split(/\r?\n/)
  const normalizedLines: string[] = []
  lines.forEach((line: string) => {
    const cleanedLine = line.replace(TRANSLATION_LABEL_PATTERN, '').trim()
    if (!cleanedLine) {
      if (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1] !== '') {
        normalizedLines.push('')
      }
      return
    }
    normalizedLines.push(cleanedLine)
  })
  while (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1] === '') {
    normalizedLines.pop()
  }
  return normalizedLines.join('\n')
}

export function enhanceTranslationPromptForRetweet(
  basePrompt: string,
  formattingHint?: TranslationFormattingHint,
): string {
  if (!formattingHint || formattingHint.tweetKind !== 'retweet') {
    return basePrompt
  }
  const sourceUser = (formattingHint.sourceUserName || '').trim() || '用户'
  const retweetedUser = (formattingHint.retweetedUserName || '').trim() || '转发用户'
  return `${basePrompt}\n` +
    '5. 当内容为 RT 转发时，必须严格按以下格式输出（保持换行，不要添加其他行）：\n' +
    `{${sourceUser}}: 翻译内容\n` +
    '转发了：\n' +
    `{${retweetedUser}}：转发文字`
}

function stripReasoningTags(text: string): string {
  let cleaned = text
  for (const pattern of REASONING_TAG_PATTERNS) {
    cleaned = cleaned.replace(pattern, '')
  }
  return cleaned
}
