// View-model types shared by the AI chat panel sub-components
// (status bar, confirmation card). Mirrors Harmony's AIChatPanelTypes.ts.

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
  preview?: string
}
