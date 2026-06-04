import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'
import type {
  EntryAISummarySession,
  EntryAISummarySessionStatus,
} from '../../../shared/types'
import { entryAISummarySessionFromRow } from '../row-mappers'

export interface EntryAISummarySessionCreateInput {
  entryId: string
  status: EntryAISummarySessionStatus
  draftText?: string
  finalText?: string
  errorCode?: string
  errorMessage?: string
  rawErrorMessage?: string
  model?: string
  sourceHash?: string
  runId?: string
}

export interface EntryAISummarySessionUpdateInput {
  status?: EntryAISummarySessionStatus
  draftText?: string
  finalText?: string
  errorCode?: string
  errorMessage?: string
  rawErrorMessage?: string
  model?: string
  sourceHash?: string
  runId?: string
  finishedAt?: number | null
}

export interface IEntryAISummarySessionRepository {
  createSession(input: EntryAISummarySessionCreateInput): EntryAISummarySession
  updateSession(
    id: string,
    updates: EntryAISummarySessionUpdateInput,
  ): EntryAISummarySession | null
  getSessionById(id: string): EntryAISummarySession | null
  getLatestSessionByEntryId(entryId: string): EntryAISummarySession | null
}

export class EntryAISummarySessionRepository implements IEntryAISummarySessionRepository {
  constructor(private readonly db: Database.Database) {}

  createSession(
    input: EntryAISummarySessionCreateInput,
  ): EntryAISummarySession {
    const now = Date.now()
    const id = randomUUID()
    this.db
      .prepare(
        `
        INSERT INTO entry_ai_summary_sessions
          (id, entry_id, status, draft_text, final_text, error_code,
           error_message, raw_error_message, model, source_hash, run_id,
           created_at, updated_at, finished_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        id,
        input.entryId,
        input.status,
        input.draftText ?? '',
        input.finalText ?? null,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.rawErrorMessage ?? null,
        input.model ?? null,
        input.sourceHash ?? null,
        input.runId ?? null,
        now,
        now,
        null,
      )
    const session = this.getSessionById(id)
    if (!session) throw new Error('AI summary session create failed')
    return session
  }

  updateSession(
    id: string,
    updates: EntryAISummarySessionUpdateInput,
  ): EntryAISummarySession | null {
    const current = this.getSessionById(id)
    if (!current) return null
    const next = { ...current, ...updates, updatedAt: Date.now() }
    this.db
      .prepare(
        `
        UPDATE entry_ai_summary_sessions SET
          status = ?, draft_text = ?, final_text = ?, error_code = ?,
          error_message = ?, raw_error_message = ?, model = ?,
          source_hash = ?, run_id = ?, updated_at = ?, finished_at = ?
        WHERE id = ?
      `,
      )
      .run(
        next.status,
        next.draftText,
        next.finalText ?? null,
        next.errorCode ?? null,
        next.errorMessage ?? null,
        next.rawErrorMessage ?? null,
        next.model ?? null,
        next.sourceHash ?? null,
        next.runId ?? null,
        next.updatedAt,
        next.finishedAt ?? null,
        id,
      )
    return this.getSessionById(id)
  }

  getSessionById(id: string): EntryAISummarySession | null {
    const row = this.db
      .prepare('SELECT * FROM entry_ai_summary_sessions WHERE id = ?')
      .get(id)
    return row ? entryAISummarySessionFromRow(row) : null
  }

  getLatestSessionByEntryId(entryId: string): EntryAISummarySession | null {
    const row = this.db
      .prepare(
        `
        SELECT * FROM entry_ai_summary_sessions
        WHERE entry_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
      )
      .get(entryId)
    return row ? entryAISummarySessionFromRow(row) : null
  }
}
