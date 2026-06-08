export type EntityId = string

export type EntityRecord<TItem, TId extends EntityId = EntityId> = Record<
  TId,
  TItem
>

/**
 * 通用归一化状态片段。
 * byId 负责 O(1) 访问，ids 负责保留稳定遍历顺序。
 */
export interface NormalizedState<TItem, TId extends EntityId = EntityId> {
  byId: EntityRecord<TItem, TId>
  ids: TId[]
}

export type IndexKey = string | number

/**
 * 索引统一使用对象承载，key 会按 JavaScript 对象属性规则转成字符串。
 */
export type IndexMap<TId extends EntityId = EntityId> = Record<string, Set<TId>>

export interface IndexMutation<TId extends EntityId = EntityId> {
  key: IndexKey
  id: TId
}

export type Selector<TState, TResult> = (state: TState) => TResult
