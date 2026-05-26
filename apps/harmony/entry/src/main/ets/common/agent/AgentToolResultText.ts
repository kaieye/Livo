import type { AgentToolResult } from './AgentTypes.ts'

export function agentToolResultToText(result: AgentToolResult): string {
  if (result.status === 'confirmation_required') {
    const confirmation = result.confirmation
    if (!confirmation) {
      return result.message
    }
    return [
      confirmation.title,
      confirmation.message,
      `风险等级: ${confirmation.risk}`,
      `参数: ${confirmation.argsPreview}`,
    ].join('\n')
  }

  if (result.status === 'failed') {
    return result.message.startsWith('错误')
      ? result.message
      : `错误：${result.message}`
  }

  return result.message
}
