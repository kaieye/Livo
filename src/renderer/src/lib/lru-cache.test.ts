import { describe, expect, it } from "vitest"

import { LRUCache } from "./lru-cache"

describe("LRUCache", () => {
  it("evicts the least recently used item", () => {
    const cache = new LRUCache<string, number>(2)

    cache.set("a", 1)
    cache.set("b", 2)
    cache.get("a")
    cache.set("c", 3)

    expect(cache.get("a")).toBe(1)
    expect(cache.get("b")).toBeUndefined()
    expect(cache.get("c")).toBe(3)
  })

  it("supports delete and clear", () => {
    const cache = new LRUCache<string, number>(2)

    cache.set("a", 1)
    cache.set("b", 2)
    cache.delete("a")
    expect(cache.has("a")).toBe(false)

    cache.clear()
    expect(cache.has("b")).toBe(false)
  })
})
