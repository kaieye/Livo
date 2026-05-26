export type ToolTraceStatus =
  | 'running'
  | 'success'
  | 'failed'
  | 'confirmation_required'
  | 'cancelled'

export interface ToolStatusItem {
  key: string
  label: string
  name: string
  opacity: number
  dots: string
  status: ToolTraceStatus
  message?: string
  argsPreview?: string
  elapsedMs?: number
}

export interface PendingAgentConfirmationView {
  toolCallId: string
  toolName: string
  title: string
  message: string
  risk: string
  argsPreview: string
}
