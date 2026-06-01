import { createHash } from 'crypto'
import type { Entry } from '../../shared/types'

const MIN_TOKEN_COUNT = 18
const HASH_BITS = 64
const MAX_DISTANCE_FOR_NEAR_DUPLICATE = 9

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

function tokenize(value: string): string[] {
  return (
    normalizeForSimHash(value).match(/[\p{Script=Han}]|[\p{L}\p{N}]+/gu) ?? []
  )
}

function hash64(value: string): bigint {
  const digest = createHash('sha1').update(value).digest()
  return digest.readBigUInt64BE(0)
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

export function computeEntrySimHash(entry: Entry): bigint | null {
  const text = [
    entry.title || '',
    entry.summary || '',
    entry.content || '',
  ].join('\n')
  const tokens = tokenize(text)
  if (tokens.length < MIN_TOKEN_COUNT) return null

  const weights = new Array<number>(HASH_BITS).fill(0)
  const addFeature = (feature: string, weight: number): void => {
    const hash = hash64(feature)
    for (let bit = 0; bit < HASH_BITS; bit++) {
      const mask = 1n << BigInt(bit)
      weights[bit] += hash & mask ? weight : -weight
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
