export interface ParsedToolFunction {
  name: string
  arguments: string
}

export interface ParsedToolCall {
  id: string
  type: string
  function: ParsedToolFunction
}

export interface ToolCallParseResult {
  cleanedContent: string
  toolCalls: ParsedToolCall[]
}

export function parseTextToolCalls(content: string): ToolCallParseResult {
  const toolCalls: ParsedToolCall[] = []
  let remaining = content
  remaining = tryParseToolCallTagJson(remaining, toolCalls)
  remaining = tryParseMinimaxTag(remaining, toolCalls)
  remaining = tryParseFunctionCallTag(remaining, toolCalls)
  remaining = tryParseToolCallBlock(remaining, toolCalls)
  return { cleanedContent: remaining.trim(), toolCalls }
}

function tryParseToolCallTagJson(
  content: string,
  calls: ParsedToolCall[],
): string {
  const regex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g
  let match = regex.exec(content)
  while (match) {
    try {
      const json = JSON.parse(match[1]) as Record<string, object>
      const toolName = pickStringField(json, 'name', 'tool')
      if (toolName) {
        const params = pickObjectField(json, 'parameters', 'tool_input')
        pushParsedCall(calls, toolName, params)
      }
    } catch (_error) {
      // 损坏 JSON 直接忽略，让 cleaned 文本保留下来交给后续流程。
    }
    match = regex.exec(content)
  }
  return content.replace(regex, '')
}

function tryParseMinimaxTag(content: string, calls: ParsedToolCall[]): string {
  const regex = /<minimax:tool_call>\s*([\s\S]*?)\s*<\/minimax:tool_call>/gi
  let match = regex.exec(content)
  while (match) {
    const body = match[1].trim()
    if (!tryParseMinimaxInvoke(body, calls)) {
      tryParseMinimaxFunctional(body, calls)
    }
    match = regex.exec(content)
  }
  return content.replace(regex, '')
}

function tryParseMinimaxInvoke(body: string, calls: ParsedToolCall[]): boolean {
  const invokeRegex = /<invoke\s+name\s*=\s*"([^"]+)"\s*>([\s\S]*?)<\/invoke>/g
  let invokeMatch = invokeRegex.exec(body)
  let matched = false
  while (invokeMatch) {
    matched = true
    const invokeName = invokeMatch[1]
    const invokeBody = invokeMatch[2]
    const params = extractInvokeParams(invokeBody)
    pushParsedCall(calls, invokeName, params)
    invokeMatch = invokeRegex.exec(body)
  }
  return matched
}

function tryParseMinimaxFunctional(
  body: string,
  calls: ParsedToolCall[],
): void {
  const parenIdx = body.indexOf('(')
  if (parenIdx < 0) {
    return
  }
  const funcName = body.slice(0, parenIdx).trim()
  if (!funcName) {
    return
  }
  const endIdx = body.lastIndexOf(')')
  const argsStr =
    endIdx >= 0
      ? body.slice(parenIdx + 1, endIdx).trim()
      : body.slice(parenIdx + 1).trim()
  const params: Record<string, string> = {}
  if (argsStr) {
    const argRegex = /(\w+)\s*=\s*"([^"]*)"/g
    let argMatch = argRegex.exec(argsStr)
    while (argMatch) {
      params[argMatch[1]] = argMatch[2]
      argMatch = argRegex.exec(argsStr)
    }
  }
  pushParsedCall(calls, funcName, params)
}

function tryParseFunctionCallTag(
  content: string,
  calls: ParsedToolCall[],
): string {
  const regex = /<function_call>\s*([\s\S]*?)\s*<\/function_call>/g
  let match = regex.exec(content)
  while (match) {
    const body = match[1].trim()
    if (!tryPushFunctionCallJson(body, calls)) {
      tryPushFunctionCallLines(body, calls)
    }
    match = regex.exec(content)
  }
  return content.replace(regex, '')
}

function tryPushFunctionCallJson(
  body: string,
  calls: ParsedToolCall[],
): boolean {
  try {
    const json = JSON.parse(body) as Record<string, object>
    const name = pickStringField(json, 'name')
    if (!name) {
      return false
    }
    const params = pickObjectField(json, 'parameters', 'arguments')
    pushParsedCall(calls, name, params)
    return true
  } catch (_error) {
    return false
  }
}

function tryPushFunctionCallLines(body: string, calls: ParsedToolCall[]): void {
  const lines = body
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
  if (lines.length === 0) {
    return
  }
  const headToken = lines[0].replace(/^["']|["']$/g, '').split(/\s+/)[0]
  if (!headToken || headToken.length <= 2) {
    return
  }
  const args: Record<string, string> = {}
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]
    const eqRegex = /(\w+)\s*=\s*"([^"]*)"/g
    let eqMatch = eqRegex.exec(line)
    while (eqMatch) {
      args[eqMatch[1]] = eqMatch[2]
      eqMatch = eqRegex.exec(line)
    }
    const colonRegex = /(\w+)\s*:\s*"([^"]*)"/g
    let colonMatch = colonRegex.exec(line)
    while (colonMatch) {
      args[colonMatch[1]] = colonMatch[2]
      colonMatch = colonRegex.exec(line)
    }
  }
  pushParsedCall(calls, headToken, args)
}

function tryParseToolCallBlock(
  content: string,
  calls: ParsedToolCall[],
): string {
  const regex = /\[TOOL_CALL\]\s*([\s\S]*?)\s*\[\/TOOL_CALL\]/gi
  let match = regex.exec(content)
  while (match) {
    const body = match[1].trim()
    const toolMatch = body.match(/tool\s*=>\s*"([^"]+)"/i)
    if (toolMatch) {
      const funcName = toolMatch[1]
      const params: Record<string, string> = {}
      collectToolCallBlockDashArgs(body, params)
      collectToolCallBlockEqArgs(body, params)
      collectToolCallBlockArgsObject(body, params)
      pushParsedCall(calls, funcName, params)
    }
    match = regex.exec(content)
  }
  return content.replace(regex, '')
}

function collectToolCallBlockDashArgs(
  body: string,
  params: Record<string, string>,
): void {
  const regex = /--(\w+)\s+"([^"]*)"/g
  let match = regex.exec(body)
  while (match) {
    params[match[1]] = match[2]
    match = regex.exec(body)
  }
}

function collectToolCallBlockEqArgs(
  body: string,
  params: Record<string, string>,
): void {
  const regex = /--(\w+)\s*=\s*"?([^"\s}]+)"?/g
  let match = regex.exec(body)
  while (match) {
    if (!params[match[1]]) {
      params[match[1]] = match[2]
    }
    match = regex.exec(body)
  }
}

function collectToolCallBlockArgsObject(
  body: string,
  params: Record<string, string>,
): void {
  const block = body.match(/args\s*=>\s*\{([\s\S]*?)\}/)
  if (!block) {
    return
  }
  const regex = /(\w+)\s*:\s*"([^"]*)"/g
  let match = regex.exec(block[1])
  while (match) {
    if (!params[match[1]]) {
      params[match[1]] = match[2]
    }
    match = regex.exec(block[1])
  }
}

function extractInvokeParams(invokeBody: string): Record<string, string> {
  const params: Record<string, string> = {}
  const regex = /<(\w+)[^>]*>([\s\S]*?)<\/\1>/g
  let match = regex.exec(invokeBody)
  while (match) {
    const tagName = match[1]
    const tagContent = match[2].trim()
    const nameAttrMatch = match[0].match(/name\s*=\s*"([^"]+)"/)
    const key = nameAttrMatch ? nameAttrMatch[1] : tagName
    params[key] = tagContent
    match = regex.exec(invokeBody)
  }
  return params
}

function pickStringField(
  json: Record<string, object>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = json[key]
    if (typeof value === 'string' && (value as string).length > 0) {
      return value
    }
  }
  return ''
}

function pickObjectField(
  json: Record<string, object>,
  ...keys: string[]
): object {
  for (const key of keys) {
    const value = json[key]
    if (value !== undefined && value !== null) {
      return value
    }
  }
  return {}
}

function pushParsedCall(
  calls: ParsedToolCall[],
  name: string,
  params: object,
): void {
  calls.push({
    id: `text_${calls.length}`,
    type: 'function',
    function: {
      name,
      arguments: JSON.stringify(params),
    },
  })
}
