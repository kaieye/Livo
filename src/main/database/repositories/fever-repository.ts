import type Database from 'better-sqlite3'
import type {
  FeverAccount,
  FeverFeedMapping,
  FeverItemMapping,
  FeverSyncState,
} from '../../../shared/types'
import {
  feverAccountFromRow,
  feverFeedMappingFromRow,
  feverItemMappingFromRow,
  feverSyncStateFromRow,
} from '../row-mappers'

export class FeverRepository {
  constructor(private readonly db: Database.Database) {}

  getFeverAccounts(): FeverAccount[] {
    return this.db
      .prepare('SELECT * FROM fever_accounts ORDER BY created_at')
      .all()
      .map(feverAccountFromRow)
  }

  getFeverAccountById(id: string): FeverAccount | undefined {
    const row = this.db
      .prepare('SELECT * FROM fever_accounts WHERE id = ?')
      .get(id)
    return row ? feverAccountFromRow(row) : undefined
  }

  insertFeverAccount(account: FeverAccount): void {
    this.db
      .prepare(
        `
      INSERT INTO fever_accounts
        (id, base_url, username, api_key, enabled, auto_sync,
         sync_interval_min, last_sync_at, last_error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        account.id,
        account.baseUrl,
        account.username,
        account.apiKey,
        account.enabled ? 1 : 0,
        account.autoSync ? 1 : 0,
        account.syncIntervalMin,
        account.lastSyncAt ?? null,
        account.lastError ?? null,
        account.createdAt,
      )
  }

  updateFeverAccount(id: string, updates: Partial<FeverAccount>): void {
    const existing = this.getFeverAccountById(id)
    if (!existing) return
    const merged = { ...existing, ...updates }
    this.db
      .prepare(
        `
      UPDATE fever_accounts SET
        base_url = ?, username = ?, api_key = ?, enabled = ?,
        auto_sync = ?, sync_interval_min = ?, last_sync_at = ?,
        last_error = ?
      WHERE id = ?
    `,
      )
      .run(
        merged.baseUrl,
        merged.username,
        merged.apiKey,
        merged.enabled ? 1 : 0,
        merged.autoSync ? 1 : 0,
        merged.syncIntervalMin,
        merged.lastSyncAt ?? null,
        merged.lastError ?? null,
        id,
      )
  }

  deleteFeverAccount(id: string): void {
    this.db.prepare('DELETE FROM fever_accounts WHERE id = ?').run(id)
  }

  getFeverFeedMappings(accountId: string): FeverFeedMapping[] {
    return this.db
      .prepare('SELECT * FROM fever_feed_mappings WHERE account_id = ?')
      .all(accountId)
      .map(feverFeedMappingFromRow)
  }

  getFeverFeedMappingByRemoteId(
    accountId: string,
    feverFeedId: number,
  ): FeverFeedMapping | undefined {
    const row = this.db
      .prepare(
        'SELECT * FROM fever_feed_mappings WHERE account_id = ? AND fever_feed_id = ?',
      )
      .get(accountId, feverFeedId)
    return row ? feverFeedMappingFromRow(row) : undefined
  }

  upsertFeverFeedMapping(mapping: FeverFeedMapping): void {
    this.db
      .prepare(
        `
      INSERT INTO fever_feed_mappings
        (account_id, fever_feed_id, local_feed_id, remote_group,
         remote_title, remote_url, is_active, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, fever_feed_id) DO UPDATE SET
        local_feed_id = excluded.local_feed_id,
        remote_group = excluded.remote_group,
        remote_title = excluded.remote_title,
        remote_url = excluded.remote_url,
        is_active = excluded.is_active,
        last_seen_at = excluded.last_seen_at
    `,
      )
      .run(
        mapping.accountId,
        mapping.feverFeedId,
        mapping.localFeedId,
        mapping.remoteGroup ?? null,
        mapping.remoteTitle ?? null,
        mapping.remoteUrl ?? null,
        mapping.isActive ? 1 : 0,
        mapping.lastSeenAt,
      )
  }

  deleteFeverFeedMappings(accountId: string): void {
    this.db
      .prepare('DELETE FROM fever_feed_mappings WHERE account_id = ?')
      .run(accountId)
  }

  markFeverFeedMappingsInactive(
    accountId: string,
    activeRemoteIds: number[],
  ): void {
    if (activeRemoteIds.length === 0) {
      this.db
        .prepare(
          'UPDATE fever_feed_mappings SET is_active = 0 WHERE account_id = ?',
        )
        .run(accountId)
      return
    }
    const placeholders = activeRemoteIds.map(() => '?').join(',')
    this.db
      .prepare(
        `UPDATE fever_feed_mappings SET is_active = 0
         WHERE account_id = ? AND fever_feed_id NOT IN (${placeholders})`,
      )
      .run(accountId, ...activeRemoteIds)
  }

  getFeverItemMapping(
    accountId: string,
    feverItemId: number,
  ): FeverItemMapping | undefined {
    const row = this.db
      .prepare(
        'SELECT * FROM fever_item_mappings WHERE account_id = ? AND fever_item_id = ?',
      )
      .get(accountId, feverItemId)
    return row ? feverItemMappingFromRow(row) : undefined
  }

  upsertFeverItemMapping(mapping: FeverItemMapping): void {
    this.db
      .prepare(
        `
      INSERT INTO fever_item_mappings
        (account_id, fever_item_id, fever_feed_id, local_feed_id,
         local_entry_id, remote_is_read, remote_is_starred, is_active, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, fever_item_id) DO UPDATE SET
        local_feed_id = excluded.local_feed_id,
        local_entry_id = excluded.local_entry_id,
        remote_is_read = excluded.remote_is_read,
        remote_is_starred = excluded.remote_is_starred,
        is_active = excluded.is_active,
        last_seen_at = excluded.last_seen_at
    `,
      )
      .run(
        mapping.accountId,
        mapping.feverItemId,
        mapping.feverFeedId,
        mapping.localFeedId,
        mapping.localEntryId,
        mapping.remoteIsRead ? 1 : 0,
        mapping.remoteIsStarred ? 1 : 0,
        mapping.isActive ? 1 : 0,
        mapping.lastSeenAt,
      )
  }

  getFeverItemMappingsByLocalEntry(localEntryId: string): FeverItemMapping[] {
    return this.db
      .prepare('SELECT * FROM fever_item_mappings WHERE local_entry_id = ?')
      .all(localEntryId)
      .map(feverItemMappingFromRow)
  }

  markFeverItemMappingsInactive(accountId: string, feverFeedId: number): void {
    this.db
      .prepare(
        'UPDATE fever_item_mappings SET is_active = 0 WHERE account_id = ? AND fever_feed_id = ?',
      )
      .run(accountId, feverFeedId)
  }

  getFeverSyncState(accountId: string): FeverSyncState | undefined {
    const row = this.db
      .prepare('SELECT * FROM fever_sync_states WHERE account_id = ?')
      .get(accountId)
    return row ? feverSyncStateFromRow(row) : undefined
  }

  upsertFeverSyncState(state: FeverSyncState): void {
    this.db
      .prepare(
        `
      INSERT INTO fever_sync_states
        (account_id, last_item_id, last_sync_at, last_full_sync_at, last_error)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        last_item_id = excluded.last_item_id,
        last_sync_at = excluded.last_sync_at,
        last_full_sync_at = excluded.last_full_sync_at,
        last_error = excluded.last_error
    `,
      )
      .run(
        state.accountId,
        state.lastItemId,
        state.lastSyncAt ?? null,
        state.lastFullSyncAt ?? null,
        state.lastError ?? null,
      )
  }
}
