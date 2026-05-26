import {
  buildAllowedAgentToolRegistry,
  buildDefaultAgentToolRegistry,
  executeDefaultAgentToolRun,
} from '../agent/DefaultAgentTools'
import type {
  AgentPermissionSettings,
  AgentToolArgs,
  AgentToolDefinition,
  AgentToolRun,
} from '../agent/AgentTypes.ts'
import { agentToolResultToText } from '../agent/AgentToolResultText.ts'

export function buildDefaultTools(
  permissions?: AgentPermissionSettings,
): AgentToolDefinition[] {
  const registry = permissions
    ? buildAllowedAgentToolRegistry(permissions)
    : buildDefaultAgentToolRegistry()
  return registry.toModelToolDefinitions()
}

export async function executeToolCall(name: string, args: string): Promise<string> {
  const run = await executeToolCallRun(name, args)
  return agentToolResultToText(run.result)
}

export async function executeToolCallRun(
  name: string,
  args: string,
  confirmed: boolean = false,
  permissions?: AgentPermissionSettings,
): Promise<AgentToolRun> {
  let parsedArgs: AgentToolArgs = {}
  try {
    const raw = JSON.parse(args || '{}') as object
    parsedArgs = raw as AgentToolArgs
  } catch (_error) {
    // 参数解析失败时交给工具 schema 返回明确错误。
  }

  return executeDefaultAgentToolRun(name, parsedArgs, confirmed, permissions)
}
