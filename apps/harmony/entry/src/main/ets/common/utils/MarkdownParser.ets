export enum MdLineKind {
  H1 = 1,
  H2 = 2,
  H3 = 3,
  Bullet = 4,
  Ordered = 5,
  CodeBlock = 6,
  Paragraph = 7,
  Blank = 8,
}

export interface MdSpan {
  text: string
  bold: boolean
  italic: boolean
  code: boolean
  url?: string
}

interface LinkSegment {
  text: string
  url?: string
}

function extractBareUrls(text: string): LinkSegment[] {
  const urlRegex = /(https?:\/\/[^\s)]+)/g
  const segments: LinkSegment[] = []
  let lastIdx = 0
  let match: RegExpExecArray | null

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ text: text.slice(lastIdx, match.index) })
    }
    const url = match[1]
    segments.push({ text: url, url })
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < text.length) {
    segments.push({ text: text.slice(lastIdx) })
  }
  return segments
}

function extractLinkSegments(line: string): LinkSegment[] {
  const mdLinkRegex = /\[([^\]]*?)\]\(((?:https?:\/\/)[^) ]+)\)/g
  const segments: LinkSegment[] = []
  let lastIdx = 0
  let mdMatch: RegExpExecArray | null

  while ((mdMatch = mdLinkRegex.exec(line)) !== null) {
    if (mdMatch.index > lastIdx) {
      segments.push(...extractBareUrls(line.slice(lastIdx, mdMatch.index)))
    }
    segments.push({ text: mdMatch[1] || mdMatch[2], url: mdMatch[2] })
    lastIdx = mdMatch.index + mdMatch[0].length
  }
  if (lastIdx < line.length) {
    segments.push(...extractBareUrls(line.slice(lastIdx)))
  }
  if (segments.length === 0) {
    segments.push(...extractBareUrls(line))
  }
  return segments
}

export interface MdLine {
  kind: MdLineKind
  spans: MdSpan[]
  orderedIndex: number
}

function parseFormatting(line: string): MdSpan[] {
  if (!line) {
    return []
  }
  const spans: MdSpan[] = []
  let i = 0
  let current = ''
  while (i < line.length) {
    if (i + 1 < line.length && line[i] === '*' && line[i + 1] === '*') {
      if (current.length > 0) {
        spans.push({ text: current, bold: false, italic: false, code: false })
        current = ''
      }
      const end = line.indexOf('**', i + 2)
      if (end >= 0) {
        spans.push({ text: line.slice(i + 2, end), bold: true, italic: false, code: false })
        i = end + 2
        continue
      }
      spans.push({ text: line.slice(i + 2), bold: true, italic: false, code: false })
      i = line.length
      continue
    }
    if (line[i] === '*' && (i === 0 || line[i - 1] !== '*') && (i + 1 >= line.length || line[i + 1] !== '*')) {
      if (current.length > 0) {
        spans.push({ text: current, bold: false, italic: false, code: false })
        current = ''
      }
      const end = line.indexOf('*', i + 1)
      if (end >= 0) {
        spans.push({ text: line.slice(i + 1, end), bold: false, italic: true, code: false })
        i = end + 1
        continue
      }
      spans.push({ text: line.slice(i + 1), bold: false, italic: true, code: false })
      i = line.length
      continue
    }
    if (line[i] === '`') {
      if (current.length > 0) {
        spans.push({ text: current, bold: false, italic: false, code: false })
        current = ''
      }
      const end = line.indexOf('`', i + 1)
      if (end >= 0) {
        spans.push({ text: line.slice(i + 1, end), bold: false, italic: false, code: true })
        i = end + 1
        continue
      }
      spans.push({ text: line.slice(i + 1), bold: false, italic: false, code: true })
      i = line.length
      continue
    }
    current += line[i]
    i += 1
  }
  if (current.length > 0) {
    spans.push({ text: current, bold: false, italic: false, code: false })
  }
  return spans
}

function parseInlineSpans(line: string): MdSpan[] {
  if (!line) {
    return []
  }
  const segments = extractLinkSegments(line)
  const result: MdSpan[] = []
  for (const seg of segments) {
    if (seg.url) {
      result.push({
        text: seg.text,
        bold: false,
        italic: false,
        code: false,
        url: seg.url,
      })
    } else {
      result.push(...parseFormatting(seg.text))
    }
  }
  return result
}

function detectLineKind(line: string): MdLineKind {
  const trimmed = line.trim()
  if (!trimmed) {
    return MdLineKind.Blank
  }
  if (trimmed.startsWith('### ')) {
    return MdLineKind.H3
  }
  if (trimmed.startsWith('## ')) {
    return MdLineKind.H2
  }
  if (trimmed.startsWith('# ')) {
    return MdLineKind.H1
  }
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
    return MdLineKind.Bullet
  }
  if (/^\d+\.\s/.test(trimmed)) {
    return MdLineKind.Ordered
  }
  return MdLineKind.Paragraph
}

function stripHeader(line: string, kind: MdLineKind): string {
  if (kind === MdLineKind.H1) {
    return line.trim().slice(2)
  }
  if (kind === MdLineKind.H2) {
    return line.trim().slice(3)
  }
  if (kind === MdLineKind.H3) {
    return line.trim().slice(4)
  }
  return line
}

function stripBullet(line: string): string {
  const trimmed = line.trim()
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
    return trimmed.slice(2)
  }
  return line
}

function stripOrdered(line: string): string {
  const trimmed = line.trim()
  const match = trimmed.match(/^\d+\.\s(.*)/)
  return match ? match[1] : line
}

export function parseMarkdown(text: string): MdLine[] {
  if (!text) {
    return []
  }
  const rawLines = text.split(/\r?\n/)
  const result: MdLine[] = []
  let inCodeBlock = false
  let orderedIndex = 0

  for (const rawLine of rawLines) {
    const stripped = rawLine.trim()
    if (stripped.startsWith('```')) {
      if (inCodeBlock) {
        inCodeBlock = false
        result.push({ kind: MdLineKind.CodeBlock, spans: [], orderedIndex: 0 })
        continue
      }
      inCodeBlock = true
      continue
    }
    if (inCodeBlock) {
      result.push({
        kind: MdLineKind.CodeBlock,
        spans: [{ text: rawLine, bold: false, italic: false, code: true }],
        orderedIndex: 0,
      })
      continue
    }
    const kind = detectLineKind(rawLine)
    if (kind === MdLineKind.Blank) {
      result.push({ kind: MdLineKind.Blank, spans: [], orderedIndex: 0 })
      continue
    }
    let content = rawLine
    if (kind === MdLineKind.H1 || kind === MdLineKind.H2 || kind === MdLineKind.H3) {
      content = stripHeader(rawLine, kind)
    } else if (kind === MdLineKind.Bullet) {
      content = stripBullet(rawLine)
    } else if (kind === MdLineKind.Ordered) {
      orderedIndex += 1
      content = stripOrdered(rawLine)
    }
    const spans = parseInlineSpans(content)
    result.push({ kind, spans, orderedIndex })
  }
  return result
}
