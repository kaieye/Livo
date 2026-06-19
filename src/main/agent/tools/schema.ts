import type {
  AgentToolInputSchema,
  AgentToolParamSchema,
} from '../../../shared/types'

export const SHORT_TEXT_MAX_LENGTH = 128
export const LONG_TEXT_MAX_LENGTH = 2048
export const URL_MAX_LENGTH = 4096
export const HTTP_URL_SCHEMES = ['http', 'https']
export const FEED_URL_SCHEMES = ['http', 'https', 'rsshub']

/** Schema with no parameters. */
export function emptyParams(): AgentToolInputSchema {
  return {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  }
}

/** Build an object schema from a property map and a required-key list. */
export function objectParams(
  properties: Record<string, AgentToolParamSchema>,
  required: string[] = [],
): AgentToolInputSchema {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

/** Single optional `limit` number param. */
export function limitParams(description: string): AgentToolInputSchema {
  return objectParams(
    { limit: { type: 'number', description, minimum: 1, maximum: 50 } },
    [],
  )
}

export function clampLimit(
  value: unknown,
  fallback: number,
  max: number,
): number {
  const num = typeof value === 'number' ? value : fallback
  return Math.min(Math.max(1, Math.floor(num)), max)
}
