import { create } from 'zustand'
import { describe, expect, it, vi } from 'vitest'
import {
  createImmerSetter,
  createIndexBy,
  createTransaction,
  denormalizeRecord,
  normalizeArray,
  updateIndex,
} from './store-helpers'
import type { IndexMap } from './store-types'

interface TestItem {
  id: string
  view: number
  category?: string
  title: string
}

describe('store-helpers', () => {
  it('updates Zustand state with Immer without mutating previous objects', () => {
    const useStore = create<{
      items: Record<string, { count: number }>
      ids: string[]
    }>()(() => ({
      items: { a: { count: 1 } },
      ids: ['a'],
    }))
    const beforeState = useStore.getState()
    const beforeItem = beforeState.items.a

    createImmerSetter(useStore)((draft) => {
      draft.items.a.count += 1
      draft.ids.push('b')
      draft.items.b = { count: 1 }
    })

    const afterState = useStore.getState()
    expect(afterState).not.toBe(beforeState)
    expect(afterState.items.a).not.toBe(beforeItem)
    expect(beforeItem.count).toBe(1)
    expect(afterState).toMatchObject({
      items: {
        a: { count: 2 },
        b: { count: 1 },
      },
      ids: ['a', 'b'],
    })
  })

  it('supports Set indexes inside Immer drafts', () => {
    const useStore = create<{ index: IndexMap }>()(() => ({
      index: { articles: new Set(['feed-1']) },
    }))
    const beforeBucket = useStore.getState().index.articles

    createImmerSetter(useStore)((draft) => {
      draft.index.articles.add('feed-2')
    })

    const afterBucket = useStore.getState().index.articles
    expect(afterBucket).not.toBe(beforeBucket)
    expect(Array.from(beforeBucket)).toEqual(['feed-1'])
    expect(Array.from(afterBucket)).toEqual(['feed-1', 'feed-2'])
  })

  it('normalizes and denormalizes records with explicit order', () => {
    const items: TestItem[] = [
      { id: 'feed-1', view: 0, category: 'tech', title: 'First' },
      { id: 'feed-2', view: 1, category: 'life', title: 'Second' },
    ]

    const record = normalizeArray(items, 'id')

    expect(record).toEqual({
      'feed-1': items[0],
      'feed-2': items[1],
    })
    expect(denormalizeRecord(record, ['feed-2', 'feed-1'])).toEqual([
      items[1],
      items[0],
    ])
  })

  it('fails fast when an order id is missing from a normalized record', () => {
    expect(() =>
      denormalizeRecord({ 'feed-1': { title: 'First' } }, [
        'feed-1',
        'feed-missing',
      ]),
    ).toThrow('feed-missing')
  })

  it('creates indexes from item ids and derived keys', () => {
    const items: TestItem[] = [
      { id: 'feed-1', view: 0, category: 'tech', title: 'First' },
      { id: 'feed-2', view: 0, category: 'tech', title: 'Second' },
      { id: 'feed-3', view: 1, title: 'Third' },
    ]

    const byView = createIndexBy(items, (item) => item.view)
    const byCategory = createIndexBy(items, (item) => item.category)

    expect(Array.from(byView['0'])).toEqual(['feed-1', 'feed-2'])
    expect(Array.from(byView['1'])).toEqual(['feed-3'])
    expect(Array.from(byCategory.tech)).toEqual(['feed-1', 'feed-2'])
    expect(byCategory.undefined).toBeUndefined()
  })

  it('updates indexes by removing old entries before adding new entries', () => {
    const index: IndexMap = {
      articles: new Set(['feed-1', 'feed-2']),
      videos: new Set(['feed-3']),
    }

    const result = updateIndex(
      index,
      [
        { key: 'videos', id: 'feed-2' },
        { key: 'pictures', id: 'feed-4' },
      ],
      [
        { key: 'articles', id: 'feed-2' },
        { key: 'videos', id: 'feed-3' },
      ],
    )

    expect(result).toBe(index)
    expect(Array.from(index.articles)).toEqual(['feed-1'])
    expect(Array.from(index.videos)).toEqual(['feed-2'])
    expect(Array.from(index.pictures)).toEqual(['feed-4'])

    updateIndex(index, [], [{ key: 'pictures', id: 'feed-4' }])
    expect(index.pictures).toBeUndefined()
  })

  it('runs transaction steps and passes request result to persistence', async () => {
    const optimistic = vi.fn()
    const request = vi.fn(async () => ({ id: 'feed-1' }))
    const persist = vi.fn(async (_result?: { id: string }) => undefined)

    await createTransaction<{ id: string }>()
      .store(optimistic)
      .request(request)
      .persist(persist)
      .run()

    expect(optimistic).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledTimes(1)
    expect(persist).toHaveBeenCalledWith({ id: 'feed-1' })
  })

  it('rolls back optimistic updates when the request fails', async () => {
    const rollback = vi.fn()
    const error = new Error('request failed')

    await expect(
      createTransaction()
        .store(() => undefined)
        .request(() => {
          throw error
        })
        .rollback(rollback)
        .run(),
    ).rejects.toThrow(error)

    expect(rollback).toHaveBeenCalledTimes(1)
  })
})
