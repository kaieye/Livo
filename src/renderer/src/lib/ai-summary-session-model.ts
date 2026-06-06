import type { EntryAISummarySession } from '../../../shared/types'

export interface AISummarySessionViewState {
  summary: string | null
  error: string | null
  isLoading: boolean
}

export function buildAISummarySessionViewState(
  session: EntryAISummarySession | null,
  initialSummary: string | null = null,
): AISummarySessionViewState {
  if (!session) {
    return { summary: initialSummary, error: null, isLoading: false }
  }

  if (session.status === 'failed') {
    return {
      summary: session.draftText || session.finalText || null,
      error: session.errorMessage || 'Unknown error',
      isLoading: false,
    }
  }

  return {
    summary: session.finalText || session.draftText || initialSummary,
    error: null,
    isLoading: session.status === 'queued' || session.status === 'running',
  }
}
