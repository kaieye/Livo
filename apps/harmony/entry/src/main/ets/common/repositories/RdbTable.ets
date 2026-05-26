import relationalStore from '@ohos.data.relationalStore'
import { AppDatabaseService } from '../services/AppDatabaseService'

export interface IDatabaseAccess {
  withRdb<T>(operationLabel: string, fn: (store: relationalStore.RdbStore) => Promise<T>): Promise<T>
  withRdbResult<T>(
    operationLabel: string,
    fn: (store: relationalStore.RdbStore) => Promise<relationalStore.ResultSet>,
    mapRow: (result: relationalStore.ResultSet) => T,
  ): Promise<T[]>
}

class AppDatabaseAccessor implements IDatabaseAccess {
  withRdb<T>(operationLabel: string, fn: (store: relationalStore.RdbStore) => Promise<T>): Promise<T> {
    return AppDatabaseService.withRdb(operationLabel, fn)
  }
  withRdbResult<T>(
    operationLabel: string,
    fn: (store: relationalStore.RdbStore) => Promise<relationalStore.ResultSet>,
    mapRow: (result: relationalStore.ResultSet) => T,
  ): Promise<T[]> {
    return AppDatabaseService.withRdbResult(operationLabel, fn, mapRow)
  }
}

export const defaultDatabaseAccess: IDatabaseAccess = new AppDatabaseAccessor()

export function boolToNumber(value: boolean): number {
  return value ? 1 : 0
}

export function numberToBool(value: number): boolean {
  return value === 1
}

export class RdbTable<T> {
  private readonly tableName: string
  private readonly mapRow: (result: relationalStore.ResultSet) => T
  private readonly db: IDatabaseAccess

  constructor(
    tableName: string,
    mapRow: (result: relationalStore.ResultSet) => T,
    db?: IDatabaseAccess,
  ) {
    this.tableName = tableName
    this.mapRow = mapRow
    this.db = db ?? defaultDatabaseAccess
  }

  async getOne(predicates: relationalStore.RdbPredicates): Promise<T | undefined> {
    return this.db.withRdb('查询', async (store) => {
      const result = await store.query(predicates)
      if (!result.goToNextRow()) {
        result.close()
        return undefined
      }
      const row = this.mapRow(result)
      result.close()
      return row
    })
  }

  async list(predicates: relationalStore.RdbPredicates): Promise<T[]> {
    return this.db.withRdbResult(
      '查询',
      (store) => store.query(predicates),
      this.mapRow,
    )
  }

  async count(predicates: relationalStore.RdbPredicates): Promise<number> {
    return this.db.withRdb('统计', async (store) => {
      const result = await store.query(predicates, ['id'])
      const total = result.rowCount
      result.close()
      return total
    })
  }

  async insert(row: relationalStore.ValuesBucket): Promise<number> {
    return this.db.withRdb('新增', (store): Promise<number> => store.insert(this.tableName, row))
  }

  async update(predicates: relationalStore.RdbPredicates, values: relationalStore.ValuesBucket): Promise<number> {
    return this.db.withRdb('更新', (store): Promise<number> => store.update(values, predicates))
  }

  async delete(predicates: relationalStore.RdbPredicates): Promise<void> {
    await this.db.withRdb('删除', (store) => store.delete(predicates))
  }

  async insertOrReplace(row: relationalStore.ValuesBucket): Promise<number> {
    return this.db.withRdb('新增或替换', (store): Promise<number> => store.insert(this.tableName, row, relationalStore.ConflictResolution.ON_CONFLICT_REPLACE))
  }

  async executeSql(sql: string, bindArgs?: Array<relationalStore.ValueType>): Promise<void> {
    await this.db.withRdb('执行SQL', (store) => store.executeSql(sql, bindArgs))
  }
}
