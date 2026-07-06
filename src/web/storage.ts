/**
 * IndexedDB-based storage layer for the Web platform.
 * Replaces the JSON file storage used in the Electron main process.
 */

import type { Feed, Entry } from '../shared/types'
import { FeedViewType, type AppSettings } from '../shared/types'
import { cloneDefaultSettings, normalizeSettings } from '../shared/settings'

const DB_NAME = 'livo-web'
const DB_VERSION = 1

let db: IDBDatabase | null = null

/** Initialize the IndexedDB database */
export async function initWebDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Feeds store
      if (!database.objectStoreNames.contains('feeds')) {
        const feedStore = database.createObjectStore('feeds', { keyPath: 'id' })
        feedStore.createIndex('url', 'url', { unique: true })
        feedStore.createIndex('category', 'category', { unique: false })
      }

      // Entries store
      if (!database.objectStoreNames.contains('entries')) {
        const entryStore = database.createObjectStore('entries', {
          keyPath: 'id',
        })
        entryStore.createIndex('feedId', 'feedId', { unique: false })
        entryStore.createIndex('url', 'url', { unique: false })
        entryStore.createIndex('publishedAt', 'publishedAt', { unique: false })
        entryStore.createIndex('isStarred', 'isStarred', { unique: false })
      }

      // Settings store
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' })
      }
    }

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result
      resolve()
    }

    request.onerror = () => reject(request.error)
  })
}

function getDB(): IDBDatabase {
  if (!db) throw new Error('Database not initialized')
  return db
}

// ====== Feed Operations ======

export async function getAllFeeds(): Promise<Feed[]> {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('feeds', 'readonly')
    const store = tx.objectStore('feeds')
    const request = store.getAll()
    request.onsuccess = () => {
      const feeds = request.result as Feed[]
      // Migrate old feeds without view field
      for (const f of feeds) {
        if ((f as unknown as Record<string, unknown>).view === undefined) {
          ;(f as unknown as Record<string, unknown>).view =
            FeedViewType.Articles
        }
        if ((f as unknown as Record<string, unknown>).showInAll === undefined) {
          ;(f as unknown as Record<string, unknown>).showInAll = true
        }
        if (
          (f as unknown as Record<string, unknown>).upstreamUrl === undefined
        ) {
          ;(f as unknown as Record<string, unknown>).upstreamUrl = f.url
        }
      }
      resolve(feeds)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getFeedByUrl(url: string): Promise<Feed | undefined> {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('feeds', 'readonly')
    const store = tx.objectStore('feeds')
    const index = store.index('url')
    const request = index.get(url)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function insertFeed(feed: Feed): Promise<void> {
  const existing = await getFeedByUrl(feed.url)
  if (existing) return
  const normalizedFeed: Feed = {
    ...feed,
    showInAll: feed.showInAll ?? true,
  }

  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('feeds', 'readwrite')
    const store = tx.objectStore('feeds')
    const request = store.add(normalizedFeed)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function updateFeed(
  id: string,
  updates: Partial<Feed>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('feeds', 'readwrite')
    const store = tx.objectStore('feeds')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      if (!getReq.result) {
        resolve()
        return
      }
      const updated = { ...getReq.result, ...updates }
      const putReq = store.put(updated)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function deleteFeed(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(['feeds', 'entries'], 'readwrite')
    const feedStore = tx.objectStore('feeds')
    const entryStore = tx.objectStore('entries')

    // Delete feed
    feedStore.delete(id)

    // Delete all entries for this feed
    const index = entryStore.index('feedId')
    const cursorReq = index.openCursor(IDBKeyRange.only(id))
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ====== Entry Operations ======

export async function getEntries(options: {
  feedId?: string
  feedIds?: string[]
  starred?: boolean
  unreadOnly?: boolean
  limit?: number
  offset?: number
}): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('entries', 'readonly')
    const store = tx.objectStore('entries')

    let request: IDBRequest

    if (options.feedId) {
      const index = store.index('feedId')
      request = index.getAll(IDBKeyRange.only(options.feedId))
    } else {
      request = store.getAll()
    }

    request.onsuccess = () => {
      let entries = request.result as Entry[]

      if (!options.feedId && options.feedIds && options.feedIds.length > 0) {
        const idSet = new Set(options.feedIds)
        entries = entries.filter((e) => idSet.has(e.feedId))
      }
      if (options.starred) entries = entries.filter((e) => e.isStarred)
      if (options.unreadOnly) entries = entries.filter((e) => !e.isRead)

      // Sort by publishedAt desc
      entries.sort((a, b) => b.publishedAt - a.publishedAt)

      const offset = options.offset || 0
      const limit = options.limit || 1000
      resolve(entries.slice(offset, offset + limit))
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getEntryById(id: string): Promise<Entry | undefined> {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('entries', 'readonly')
    const store = tx.objectStore('entries')
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function insertEntry(entry: Entry): Promise<boolean> {
  // Check for duplicates by URL
  if (entry.url) {
    const existing = await new Promise<Entry | undefined>((resolve, reject) => {
      const tx = getDB().transaction('entries', 'readonly')
      const index = tx.objectStore('entries').index('url')
      const req = index.get(entry.url)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    if (existing) return false
  }

  return new Promise((resolve, _reject) => {
    const tx = getDB().transaction('entries', 'readwrite')
    const store = tx.objectStore('entries')
    const request = store.add(entry)
    request.onsuccess = () => resolve(true)
    request.onerror = () => resolve(false) // Duplicate key, etc.
  })
}

export async function updateEntry(
  id: string,
  updates: Partial<Entry>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('entries', 'readwrite')
    const store = tx.objectStore('entries')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      if (!getReq.result) {
        resolve()
        return
      }
      const updated = { ...getReq.result, ...updates }
      const putReq = store.put(updated)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function markAllRead(feedId?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('entries', 'readwrite')
    const store = tx.objectStore('entries')

    let request: IDBRequest

    if (feedId) {
      const index = store.index('feedId')
      request = index.openCursor(IDBKeyRange.only(feedId))
    } else {
      request = store.openCursor()
    }

    request.onsuccess = () => {
      const cursor = request.result as IDBCursorWithValue | null
      if (cursor) {
        const entry = cursor.value
        if (!entry.isRead) {
          entry.isRead = true
          cursor.update(entry)
        }
        cursor.continue()
      }
    }

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function searchEntries(
  query: string,
  limit = 50,
): Promise<Entry[]> {
  const q = query.toLowerCase()
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('entries', 'readonly')
    const store = tx.objectStore('entries')
    const request = store.getAll()
    request.onsuccess = () => {
      const entries = (request.result as Entry[])
        .filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            (e.content && e.content.toLowerCase().includes(q)) ||
            (e.summary && e.summary.toLowerCase().includes(q)),
        )
        .sort((a, b) => b.publishedAt - a.publishedAt)
        .slice(0, limit)
      resolve(entries)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getUnreadCount(feedId: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('entries', 'readonly')
    const index = tx.objectStore('entries').index('feedId')
    const request = index.getAll(IDBKeyRange.only(feedId))
    request.onsuccess = () => {
      const count = (request.result as Entry[]).filter((e) => !e.isRead).length
      resolve(count)
    }
    request.onerror = () => reject(request.error)
  })
}

// ====== Settings Operations ======

export async function getSettings(): Promise<AppSettings> {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('settings', 'readonly')
    const store = tx.objectStore('settings')
    const request = store.get('app-settings')
    request.onsuccess = () => {
      if (request.result) {
        resolve(normalizeSettings(request.result.value))
      } else {
        resolve(cloneDefaultSettings())
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('settings', 'readwrite')
    const store = tx.objectStore('settings')
    const request = store.put({ key: 'app-settings', value: settings })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
