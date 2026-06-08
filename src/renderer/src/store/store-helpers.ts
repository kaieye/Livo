import { enableMapSet, produce } from 'immer'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { IndexKey, IndexMap, IndexMutation } from './store-types'

enableMapSet()

/**
 * 为 Zustand store 创建基于 Immer 的 setter。
 * 调用方可以用 draft 写法表达不可变更新，避免手动展开深层对象。
 *
 * @example
 * const immerSet = createImmerSetter(useStore)
 *
 * // 之前：手动不可变更新
 * set((state) => ({
 *   feeds: state.feeds.map(f => f.id === id ? { ...f, ...update } : f)
 * }))
 *
 * // 之后：Immer draft 更新
 * immerSet((draft) => {
 *   const feed = draft.feeds[id]
 *   if (feed) Object.assign(feed, update)
 * })
 */
export function createImmerSetter<T>(useStore: UseBoundStore<StoreApi<T>>) {
  return (updater: (draft: T) => void) =>
    useStore.setState((state) =>
      produce(state, (draft) => {
        try {
          return updater(draft as T)
        } catch (error) {
          console.error('[Immer Setter Error]', error)
          throw error
        }
      }),
    )
}

/**
 * 支持乐观更新和回滚的事务模式。
 * 用于把本地 store 更新与持久化请求拆开，避免 action 内部混杂多段错误处理。
 *
 * @example
 * const tx = createTransaction()
 *
 * // 乐观更新：立即反馈 UI
 * tx.store(() => {
 *   immerSet(draft => { draft.feeds[id].title = newTitle })
 * })
 *
 * // 持久化到后端
 * tx.persist(async () => {
 *   await api.feeds.update(id, { title: newTitle })
 * })
 *
 * // 失败时回滚
 * tx.rollback(() => {
 *   immerSet(draft => { draft.feeds[id].title = oldTitle })
 * })
 *
 * await tx.run()
 */
type SyncOrAsync<T> = T | Promise<T>
type ExecutorFn<Result = void> = () => SyncOrAsync<Result>
type PersisterFn<Result = void> = (result?: Result) => SyncOrAsync<void>

class Transaction<Result = void> {
  private _result?: Result
  private onRollback?: ExecutorFn
  private executorFn?: ExecutorFn<Result>
  private optimisticExecutor?: ExecutorFn
  private onPersist?: PersisterFn<Result>

  rollback(fn: ExecutorFn): this {
    this.onRollback = fn
    return this
  }

  request(executor: ExecutorFn<Result>): this {
    this.executorFn = executor
    return this
  }

  store(executor: ExecutorFn): this {
    this.optimisticExecutor = executor
    return this
  }

  persist(fn: PersisterFn<Result>): this {
    this.onPersist = fn
    return this
  }

  async run(): Promise<void> {
    let isOptimisticFailed = false

    // 1. 乐观更新：让 UI 先响应。
    if (this.optimisticExecutor) {
      try {
        await Promise.resolve(this.optimisticExecutor())
      } catch (error) {
        isOptimisticFailed = true
        console.error('[Transaction] Optimistic update failed:', error)
      }
    }

    // 2. 执行主请求，失败时回滚已完成的乐观更新。
    if (this.executorFn) {
      try {
        this._result = await Promise.resolve(this.executorFn())
      } catch (err) {
        if (this.onRollback && !isOptimisticFailed) {
          await Promise.resolve(this.onRollback())
        }
        throw err
      }
    }

    // 3. 持久化附加副作用，保留异常向上抛出。
    if (this.onPersist) {
      await Promise.resolve(this.onPersist(this._result)).catch((err) => {
        console.error('[Transaction] Persist failed:', err)
        throw err
      })
    }
  }
}

export const createTransaction = <Result = void>(): Transaction<Result> => {
  return new Transaction()
}

export function normalizeArray<T extends Record<K, string>, K extends keyof T>(
  array: readonly T[],
  idKey: K,
): Record<string, T> {
  return array.reduce<Record<string, T>>((record, item) => {
    record[item[idKey]] = item
    return record
  }, {})
}

export function denormalizeRecord<T>(
  record: Record<string, T>,
  ids?: readonly string[],
): T[] {
  if (!ids) return Object.values(record)

  return ids.map((id) => {
    if (!Object.prototype.hasOwnProperty.call(record, id)) {
      throw new Error(`[denormalizeRecord] 索引引用了不存在的 id: ${id}`)
    }
    return record[id]
  })
}

export function createIndexBy<T extends { id: string }>(
  items: readonly T[],
  keyFn: (item: T) => IndexKey | null | undefined,
): IndexMap {
  const index: IndexMap = {}
  for (const item of items) {
    const key = keyFn(item)
    if (key === null || key === undefined) continue
    addIndexEntry(index, { key, id: item.id })
  }
  return index
}

export function updateIndex<TId extends string = string>(
  index: IndexMap<TId>,
  add: readonly IndexMutation<TId>[] = [],
  remove: readonly IndexMutation<TId>[] = [],
): IndexMap<TId> {
  // 同一 id 迁移索引时，先删旧位置再加新位置，保证最终状态以 add 为准。
  for (const mutation of remove) {
    removeIndexEntry(index, mutation)
  }
  for (const mutation of add) {
    addIndexEntry(index, mutation)
  }
  return index
}

function addIndexEntry<TId extends string>(
  index: IndexMap<TId>,
  mutation: IndexMutation<TId>,
): void {
  const key = normalizeIndexKey(mutation.key)
  const bucket = index[key] ?? new Set<TId>()
  bucket.add(mutation.id)
  index[key] = bucket
}

function removeIndexEntry<TId extends string>(
  index: IndexMap<TId>,
  mutation: IndexMutation<TId>,
): void {
  const key = normalizeIndexKey(mutation.key)
  const bucket = index[key]
  if (!bucket) return
  bucket.delete(mutation.id)
  if (bucket.size === 0) {
    delete index[key]
  }
}

function normalizeIndexKey(key: IndexKey): string {
  return String(key)
}
