import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'
import type {
  EntryAITranslationSegment,
  EntryAITranslationSession,
  EntryAITranslationSessionStatus,
} from '../../../shared/types'
import { entryAITranslationSessionFromRow } from '../row-mappers'

export interface EntryAITranslationSessionCreateInput {
  entryId: string
  targetLanguage: string
  status: EntryAITranslationSessionStatus
  segments?: EntryAITranslationSegment[]
  errorCode?: string
  errorMessage?: string
  model?: string
  configFingerprint?: string
  runId?: string
}

export interface EntryAITranslationSessionUpdateInput {
  targetLanguage?: string
  status?: EntryAITranslationSessionStatus
  segments?: EntryAITranslationSegment[]
  errorCode?: string
  errorMessage?: string
  model?: string
  configFingerprint?: string
  runId?: string
  finishedAt?: number | null
}

export interface IEntryAITranslationSessionRepository {
  createSession(
    input: EntryAITranslationSessionCreateInput,
  ): EntryAITranslationSession
  updateSession(
    id: string,
    updates: EntryAITranslationSessionUpdateInput,
  ): EntryAITranslationSession | null
  getSessionById(id: string): EntryAITranslationSession | null
  getLatestSessionByEntryId(entryId: string): EntryAITranslationSession | null
}

export class EntryAITranslationSessionRepository implements IEntryAITranslationSessionRepository {
  constructor(private readonly db: Database.Database) {}

  createSession(
    input: EntryAITranslationSessionCreateInput,
  ): EntryAITranslationSession {
    const now = Date.now()
    const id = randomUUID()
    this.db
      .prepare(
        `
        INSERT INTO entry_ai_translation_sessions
          (id, entry_id, target_language, status, segments_json, error_code,
           error_message, model, config_fingerprint, run_id,
           created_at, updated_at, finished_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        id,
        input.entryId,
        input.targetLanguage,
        input.status,
        JSON.stringify(input.segments ?? []),
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.model ?? null,
        input.configFingerprint ?? null,
        input.runId ?? null,
        now,
        now,
        null,
      )
    const session = this.getSessionById(id)
    if (!session) throw new Error('AI translation session create failed')
    return session
  }

  updateSession(
    id: string,
    updates: EntryAITranslationSessionUpdateInput,
  ): EntryAITranslationSession | null {
    const current = this.getSessionById(id)
    if (!current) return null
    const next = { ...current, ...updates, updatedAt: Date.now() }
    this.db
      .prepare(
        `
        UPDATE entry_ai_translation_sessions SET
          target_language = ?, status = ?, segments_json = ?, error_code = ?,
          error_message = ?, model = ?, config_fingerprint = ?, run_id = ?,
          updated_at = ?, finished_at = ?
        WHERE id = ?
      `,
      )
      .run(
        next.targetLanguage,
        next.status,
        JSON.stringify(next.segments),
        next.errorCode ?? null,
        next.errorMessage ?? null,
        next.model ?? null,
        next.configFingerprint ?? null,
        next.runId ?? null,
        next.updatedAt,
        next.finishedAt ?? null,
        id,
      )
    return this.getSessionById(id)
  }

  getSessionById(id: string): EntryAITranslationSession | null {
    const row = this.db
      .prepare('SELECT * FROM entry_ai_translation_sessions WHERE id = ?')
      .get(id)
    return row ? entryAITranslationSessionFromRow(row) : null
  }

  getLatestSessionByEntryId(entryId: string): EntryAITranslationSession | null {
    const row = this.db
      .prepare(
        `
        SELECT * FROM entry_ai_translation_sessions
        WHERE entry_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
      )
      .get(entryId)
    return row ? entryAITranslationSessionFromRow(row) : null
  }
}
