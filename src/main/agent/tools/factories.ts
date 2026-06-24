import type {
  AgentExecutionContext,
  AgentTool,
  AgentToolArgs,
  AgentToolInputSchema,
  AgentToolPreview,
  AgentToolResult,
  AgentRiskLevel,
} from '../../../shared/types'

/** Execute callback used by tool factories (matches AgentTool.execute). */
export type AgentToolExecute<TArgs extends AgentToolArgs = AgentToolArgs> = (
  context: AgentExecutionContext,
  args: TArgs,
) => Promise<AgentToolResult>

export type AgentToolPreviewFn<TArgs extends AgentToolArgs = AgentToolArgs> = (
  context: AgentExecutionContext,
  args: TArgs,
) => Promise<AgentToolPreview>

/** Fields shared by every read / mutate factory config. */
interface BaseToolConfig<TArgs extends AgentToolArgs> {
  name: string
  title: string
  description: string
  inputSchema: AgentToolInputSchema
  execute: AgentToolExecute<TArgs>
  risk?: AgentRiskLevel
  requiresConfirmation?: boolean
  confirmationTitle?: string
  confirmationMessage?: string
  preview?: AgentToolPreviewFn<TArgs>
}

export type ReadToolConfig<TArgs extends AgentToolArgs = AgentToolArgs> =
  BaseToolConfig<TArgs>

export type MutateToolConfig<TArgs extends AgentToolArgs = AgentToolArgs> =
  BaseToolConfig<TArgs>

/**
 * Build a read-only agent tool. Read tools default to `risk: 'low'` and
 * `requiresConfirmation: false`; both can be overridden when a read tool
 * needs user sign-off (e.g. exposing secret-adjacent config).
 */
export function defineReadTool<TArgs extends AgentToolArgs = AgentToolArgs>(
  config: ReadToolConfig<TArgs>,
): AgentTool {
  return {
    name: config.name,
    title: config.title,
    description: config.description,
    inputSchema: config.inputSchema,
    capability: 'read',
    risk: config.risk ?? 'low',
    requiresConfirmation: config.requiresConfirmation ?? false,
    ...(config.confirmationTitle && {
      confirmationTitle: config.confirmationTitle,
    }),
    ...(config.confirmationMessage && {
      confirmationMessage: config.confirmationMessage,
    }),
    ...(config.preview && {
      preview: config.preview as AgentTool['preview'],
    }),
    execute: config.execute as AgentTool['execute'],
  }
}

/**
 * Build a write-side agent tool. Mutate tools default to `risk: 'medium'`
 * and `requiresConfirmation: true`; pass a `risk` to escalate / de-escalate
 * and `requiresConfirmation: false` for auto-execute cases.
 */
export function defineMutateTool<TArgs extends AgentToolArgs = AgentToolArgs>(
  config: MutateToolConfig<TArgs>,
): AgentTool {
  return {
    name: config.name,
    title: config.title,
    description: config.description,
    inputSchema: config.inputSchema,
    capability: 'mutate',
    risk: config.risk ?? 'medium',
    requiresConfirmation: config.requiresConfirmation ?? true,
    ...(config.confirmationTitle && {
      confirmationTitle: config.confirmationTitle,
    }),
    ...(config.confirmationMessage && {
      confirmationMessage: config.confirmationMessage,
    }),
    ...(config.preview && {
      preview: config.preview as AgentTool['preview'],
    }),
    execute: config.execute as AgentTool['execute'],
  }
}
