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
import {
  agentToolInterruptionResult,
  createAgentToolContext,
  runAgentToolWithSignal,
  throwIfAgentToolAborted,
} from './tool-runtime'

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

    const scoped = createAgentToolContext(tool.name, request.context)
    try {
      throwIfAgentToolAborted(scoped.context.signal)
      const result = await runAgentToolWithSignal(
        tool.execute(scoped.context, request.args),
        scoped.context.signal,
      )
      return {
        toolName: tool.name,
        args: request.args,
        elapsedMs: Date.now() - startedAt,
        result,
      }
    } catch (error) {
      const interruption = agentToolInterruptionResult(error)
      return {
        toolName: tool.name,
        args: request.args,
        elapsedMs: Date.now() - startedAt,
        result: interruption ?? {
          status: 'failed',
          message: error instanceof Error ? error.message : String(error),
        },
      }
    } finally {
      scoped.dispose()
    }
  }
}

export function validateToolArgs(
  schema: AgentToolInputSchema,
  args: AgentToolArgs,
): string {
  return validateObjectSchema('参数', schema, args)
}

function validateObjectSchema(
  path: string,
  schema: Pick<
    AgentToolInputSchema,
    'properties' | 'required' | 'additionalProperties'
  >,
  value: unknown,
): string {
  if (!isPlainObject(value)) {
    return `${path} 必须是 object`
  }

  const required = schema.required ?? []
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      return `缺少必填参数: ${joinPath(path, key)}`
    }
  }

  const properties = schema.properties ?? {}
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) {
        return `不支持的参数: ${joinPath(path, key)}`
      }
    }
  }

  for (const key of Object.keys(properties)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      continue
    }
    const error = validateParamSchema(
      joinPath(path, key),
      properties[key],
      value[key],
    )
    if (error) return error
  }

  return ''
}

function validateParamSchema(
  path: string,
  prop: AgentToolParamSchema,
  value: AgentToolValue,
): string {
  const typeError = validateType(path, prop, value)
  if (typeError) return typeError

  if (
    prop.enum &&
    prop.enum.length > 0 &&
    (typeof value !== 'string' || !prop.enum.includes(value))
  ) {
    return `${path} 不在允许范围内`
  }

  if (prop.type === 'string') {
    return validateStringBounds(path, prop, value as string)
  }

  if (prop.type === 'number') {
    return validateNumberBounds(path, prop, value as number)
  }

  if (prop.type === 'object') {
    return validateObjectSchema(
      path,
      {
        properties: prop.properties ?? {},
        required: prop.required ?? [],
        additionalProperties: prop.additionalProperties,
      },
      value,
    )
  }

  if (prop.type === 'array') {
    return validateArrayItems(path, prop, value as unknown[])
  }

  return ''
}

function validateType(
  path: string,
  prop: AgentToolParamSchema,
  value: AgentToolValue,
): string {
  if (prop.type === 'string' && typeof value !== 'string') {
    return `${path} 必须是 string`
  }
  if (
    prop.type === 'number' &&
    (typeof value !== 'number' || !Number.isFinite(value))
  ) {
    return `${path} 必须是 number`
  }
  if (prop.type === 'boolean' && typeof value !== 'boolean') {
    return `${path} 必须是 boolean`
  }
  if (prop.type === 'object' && !isPlainObject(value)) {
    return `${path} 必须是 object`
  }
  if (prop.type === 'array' && !Array.isArray(value)) {
    return `${path} 必须是 array`
  }
  return ''
}

function validateStringBounds(
  path: string,
  prop: AgentToolParamSchema,
  value: string,
): string {
  if (prop.minLength !== undefined && value.trim().length < prop.minLength) {
    return `${path} 长度不能小于 ${prop.minLength}`
  }
  if (prop.maxLength !== undefined && value.length > prop.maxLength) {
    return `${path} 长度不能大于 ${prop.maxLength}`
  }
  if (prop.format === 'uri' || prop.allowedSchemes) {
    return validateUri(path, prop, value)
  }
  return ''
}

function validateUri(
  path: string,
  prop: AgentToolParamSchema,
  value: string,
): string {
  let parsed: URL
  try {
    parsed = new URL(value.trim())
  } catch (_error) {
    return `${path} 必须是合法 URL`
  }

  const allowedSchemes = prop.allowedSchemes
  if (!allowedSchemes || allowedSchemes.length === 0) {
    return ''
  }

  const protocol = parsed.protocol.replace(/:$/, '').toLowerCase()
  if (
    !allowedSchemes.map((scheme) => scheme.toLowerCase()).includes(protocol)
  ) {
    return `${path} URL scheme 不在允许范围内`
  }

  return ''
}

function validateNumberBounds(
  path: string,
  prop: AgentToolParamSchema,
  value: number,
): string {
  if (prop.minimum !== undefined && value < prop.minimum) {
    return `${path} 不能小于 ${prop.minimum}`
  }
  if (prop.maximum !== undefined && value > prop.maximum) {
    return `${path} 不能大于 ${prop.maximum}`
  }
  return ''
}

function validateArrayItems(
  path: string,
  prop: AgentToolParamSchema,
  value: unknown[],
): string {
  if (!prop.items) {
    return ''
  }
  for (let index = 0; index < value.length; index += 1) {
    const error = validateParamSchema(
      `${path}[${index}]`,
      prop.items,
      value[index] as AgentToolValue,
    )
    if (error) return error
  }
  return ''
}

function isPlainObject(
  value: unknown,
): value is Record<string, AgentToolValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function joinPath(parent: string, key: string): string {
  return parent === '参数' ? key : `${parent}.${key}`
}
