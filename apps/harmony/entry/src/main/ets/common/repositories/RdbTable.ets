import relationalStore from '@ohos.data.relationalStore'
import { AppDatabaseService } from '../services/AppDatabaseService'

export class RdbTable<T> {
  private readonly tableName: string
  private readonly mapRow: (result: relationalStore.ResultSet) => T

  constructor(tableName: string, mapRow: (result: relationalStore.ResultSet) => T) {
    this.tableName = tableName
    this.mapRow = mapRow
  }

  async getOne(predicates: relationalStore.RdbPredicates): Promise<T | undefined> {
    return AppDatabaseService.withRdb('查询', async (store) => {
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
    return AppDatabaseService.withRdbResult(
      '查询',
      (store) => store.query(predicates),
      this.mapRow,
    )
  }

  async count(predicates: relationalStore.RdbPredicates): Promise<number> {
    return AppDatabaseService.withRdb('统计', async (store) => {
      const result = await store.query(predicates, ['id'])
      const total = result.rowCount
      result.close()
      return total
    })
  }

  async insert(row: relationalStore.ValuesBucket): Promise<number> {
    return AppDatabaseService.withRdb('新增', (store): Promise<number> => store.insert(this.tableName, row))
  }

  async update(predicates: relationalStore.RdbPredicates, values: relationalStore.ValuesBucket): Promise<number> {
    return AppDatabaseService.withRdb('更新', (store): Promise<number> => store.update(values, predicates))
  }

  async delete(predicates: relationalStore.RdbPredicates): Promise<void> {
    await AppDatabaseService.withRdb('删除', (store) => store.delete(predicates))
  }
}
