import type {
  AgentExecutionContext,
  AgentTool,
  AgentToolArgs,
  AgentToolInputSchema,
  AgentToolParamSchema,
  AgentToolRun,
  AgentToolValue,
} from '../../shared/types'
import { AgentPolicyGuard } from './policy-guard'
import { AgentToolRegistry } from './tool-registry'

export interface AgentHarnessExecuteRequest {
  toolName: string
  args: AgentToolArgs
  context: AgentExecutionContext
  confirmed?: boolean
}

/**
 * Runs a single tool call end to end: resolve tool, validate args, evaluate the
 * policy (permission + confirmation), then execute. Never throws — every
 * failure mode is folded into an AgentToolRun result.
 */
export class AgentHarness {
  private readonly registry: AgentToolRegistry
  private readonly policyGuard: AgentPolicyGuard

  constructor(
    registry: AgentToolRegistry,
    policyGuard: AgentPolicyGuard = new AgentPolicyGuard(),
  ) {
    this.registry = registry
    this.policyGuard = policyGuard
  }

  async execute(request: AgentHarnessExecuteRequest): Promise<AgentToolRun> {
    const startedAt = Date.now()
    let tool: AgentTool
    try {
      tool = this.registry.require(request.toolName)
    } catch (error) {
      return {
        toolName: request.toolName,
        args: request.args,
        elapsedMs: Date.now() - startedAt,
        result: {
          status: 'failed',
          message: error instanceof Error ? error.message : String(error),
        },
      }
    }

    const validationError = validateToolArgs(tool.inputSchema, request.args)
    if (validationError) {
      return {
        toolName: tool.name,
        args: request.args,
        elapsedMs: Date.now() - startedAt,
        result: {
          status: 'failed',
          message: validationError,
        },
      }
    }

    const decision = this.policyGuard.evaluate(
      tool,
      request.args,
      request.context,
    )
    if (!decision.allowed) {
      return {
        toolName: tool.name,
        args: request.args,
        elapsedMs: Date.now() - startedAt,
        result: {
          status: 'failed',
          message: decision.reason,
        },
      }
    }

    if (decision.requiresConfirmation && !request.confirmed) {
      return {
        toolName: tool.name,
        args: request.args,
        elapsedMs: Date.now() - startedAt,
        result: {
          status: 'confirmation_required',
          message: decision.reason,
          confirmation: this.policyGuard.createConfirmation(
            tool,
            request.args,
            decision,
          ),
        },
      }
    }

    try {
      const result = await tool.execute(request.context, request.args)
      return {
        toolName: tool.name,
        args: request.args,
        elapsedMs: Date.now() - startedAt,
        result,
      }
    } catch (error) {
      return {
        toolName: tool.name,
        args: request.args,
        elapsedMs: Date.now() - startedAt,
        result: {
          status: 'failed',
          message: error instanceof Error ? error.message : String(error),
        },
      }
    }
  }
}

export function validateToolArgs(
  schema: AgentToolInputSchema,
  args: AgentToolArgs,
): string {
  for (const key of schema.required) {
    if (!Object.prototype.hasOwnProperty.call(args, key)) {
      return `缺少必填参数: ${key}`
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(args)) {
      if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) {
        return `不支持的参数: ${key}`
      }
    }
  }

  for (const key of Object.keys(schema.properties)) {
    if (!Object.prototype.hasOwnProperty.call(args, key)) {
      continue
    }
    const prop = schema.properties[key]
    const value = args[key]
    const typeError = validateType(key, prop, value)
    if (typeError) {
      return typeError
    }
    if (
      prop.enum &&
      prop.enum.length > 0 &&
      !prop.enum.includes(String(value))
    ) {
      return `参数 ${key} 不在允许范围内`
    }
  }

  return ''
}

function validateType(
  key: string,
  prop: AgentToolParamSchema,
  value: AgentToolValue,
): string {
  if (prop.type === 'string' && typeof value !== 'string') {
    return `参数 ${key} 必须是 string`
  }
  if (prop.type === 'number' && typeof value !== 'number') {
    return `参数 ${key} 必须是 number`
  }
  if (prop.type === 'boolean' && typeof value !== 'boolean') {
    return `参数 ${key} 必须是 boolean`
  }
  if (
    prop.type === 'object' &&
    (typeof value !== 'object' || value === null || Array.isArray(value))
  ) {
    return `参数 ${key} 必须是 object`
  }
  if (prop.type === 'array' && !Array.isArray(value)) {
    return `参数 ${key} 必须是 array`
  }
  return ''
}
