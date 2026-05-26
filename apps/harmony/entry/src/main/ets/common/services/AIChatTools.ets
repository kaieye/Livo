import {
  buildDefaultAgentToolRegistry,
  executeDefaultAgentToolRun,
} from '../agent/DefaultAgentTools'
import type { AgentToolRun } from '../agent/AgentTypes.ts'
import { agentToolResultToText } from '../agent/AgentToolResultText.ts'

export interface ToolFunctionParams {
  type: string
  properties: Record<string, ToolParamProp>
  required: string[]
  additionalProperties?: boolean
}

export interface ToolParamProp {
  type: string
  description?: string
  enum?: string[]
}

export interface ToolFunction {
  name: string
  description: string
  parameters: ToolFunctionParams
}

export interface ChatToolDefinition {
  type: string
  function: ToolFunction
}

export interface ChatToolCall {
  id: string
  type: string
  function: ToolCallFunction
}

export interface ToolCallFunction {
  name: string
  arguments: string
}

export function buildDefaultTools(): ChatToolDefinition[] {
  const agentDefinitions = buildDefaultAgentToolRegistry().toModelToolDefinitions()
  const tools: ChatToolDefinition[] = []
  for (const definition of agentDefinitions) {
    const parameters: ToolFunctionParams = {
      type: definition.function.parameters.type,
      properties: definition.function.parameters.properties,
      required: definition.function.parameters.required,
      additionalProperties: definition.function.parameters.additionalProperties,
    }
    const func: ToolFunction = {
      name: definition.function.name,
      description: definition.function.description,
      parameters,
    }
    tools.push({ type: definition.type, function: func })
  }
  return tools
}

export async function executeToolCall(name: string, args: string): Promise<string> {
  const run = await executeToolCallRun(name, args)
  return agentToolResultToText(run.result)
}

export async function executeToolCallRun(
  name: string,
  args: string,
  confirmed: boolean = false,
): Promise<AgentToolRun> {
  let parsedArgs: Record<string, Object> = {}
  try {
    const raw = JSON.parse(args || '{}') as object
    parsedArgs = raw as Record<string, Object>
  } catch (_error) {
    // 参数解析失败时交给工具 schema 返回明确错误。
  }

  return executeDefaultAgentToolRun(name, parsedArgs, confirmed)
}
