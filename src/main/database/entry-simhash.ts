import { createHash } from 'crypto'
import type { Entry } from '../../shared/types'

const MIN_TOKEN_COUNT = 18
const HASH_BITS = 64
const MAX_DISTANCE_FOR_NEAR_DUPLICATE = 9
// 近重复检测用前缀文本就足够稳定（转载差异多在尾部 footer），
// 截断避免长文产生上万 token、把同步读路径拖到秒级。
const SIMHASH_TEXT_BUDGET = 1200

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ')
}

function normalizeForSimHash(value: string): string {
  return stripHtml(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{Script=Han}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function popcount64(value: bigint): number {
  let n = value
  let count = 0
  while (n > 0n) {
    count += Number(n & 1n)
    n >>= 1n
  }
  return count
}

export function hammingDistance64(a: bigint, b: bigint): number {
  return popcount64(a ^ b)
}

// SimHash 是读路径上最贵的 CPU 操作（每 token 多次 SHA-1），同一条目会在
// 启动、分页、切视图时反复出现，按内容签名缓存指纹避免重复计算。
const SIMHASH_CACHE_MAX = 8192
const simHashCache = new Map<
  string,
  { lengths: string; fingerprint: bigint | null }
>()

function makeSimHashLengthKey(entry: Entry): string {
  return `${(entry.title || '').length}:${(entry.summary || '').length}:${(entry.content || '').length}`
}

export function computeEntrySimHash(entry: Entry): bigint | null {
  const cacheKey = entry.id
  const lengths = makeSimHashLengthKey(entry)
  const cached = cacheKey ? simHashCache.get(cacheKey) : undefined
  if (cached && cached.lengths === lengths) {
    return cached.fingerprint
  }

  const fingerprint = computeEntrySimHashUncached(entry)
  if (cacheKey) {
    if (simHashCache.size >= SIMHASH_CACHE_MAX) {
      let toEvict = SIMHASH_CACHE_MAX / 2
      for (const key of simHashCache.keys()) {
        if (toEvict-- <= 0) break
        simHashCache.delete(key)
      }
    }
    simHashCache.set(cacheKey, { lengths, fingerprint })
  }
  return fingerprint
}

function computeEntrySimHashUncached(entry: Entry): bigint | null {
  const text = [
    entry.title || '',
    entry.summary || '',
    entry.content || '',
  ].join('\n')
  const normalized = normalizeForSimHash(text).slice(0, SIMHASH_TEXT_BUDGET)
  const tokens = normalized.match(/[\p{Script=Han}]|[\p{L}\p{N}]+/gu) ?? []
  if (tokens.length < MIN_TOKEN_COUNT) return null

  const weights = new Array<number>(HASH_BITS).fill(0)
  // 用两个 32 位整数展开 SHA-1 前 8 字节，普通位运算比 bigint 逐位快一个量级。
  const addFeature = (feature: string, weight: number): void => {
    const digest = createHash('sha1').update(feature).digest()
    const hi = digest.readUInt32BE(0)
    const lo = digest.readUInt32BE(4)
    for (let bit = 0; bit < 32; bit++) {
      weights[bit] += (lo >>> bit) & 1 ? weight : -weight
      weights[bit + 32] += (hi >>> bit) & 1 ? weight : -weight
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    addFeature(`1:${tokens[i]}`, 1)
    if (i <= tokens.length - 2) {
      addFeature(`2:${tokens[i]}\u0000${tokens[i + 1]}`, 2)
    }
    if (i <= tokens.length - 3) {
      addFeature(
        `3:${tokens[i]}\u0000${tokens[i + 1]}\u0000${tokens[i + 2]}`,
        3,
      )
    }
  }

  let fingerprint = 0n
  for (let bit = 0; bit < HASH_BITS; bit++) {
    if (weights[bit] > 0) fingerprint |= 1n << BigInt(bit)
  }
  return fingerprint
}

export function areEntrySimHashesNearDuplicate(a: bigint, b: bigint): boolean {
  return hammingDistance64(a, b) <= MAX_DISTANCE_FOR_NEAR_DUPLICATE
}
