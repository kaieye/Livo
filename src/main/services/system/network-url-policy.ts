import { lookup } from 'dns/promises'
import { isIP } from 'net'
import { classifyExternalUrl } from '../../../shared/url-policy'

export type NetworkUrlBlockedReason =
  | 'malformed'
  | 'unsupported-protocol'
  | 'credentials'
  | 'loopback'
  | 'private-network'

export interface NetworkUrlPolicyOptions {
  allowLoopback?: boolean
  allowPrivateNetwork?: boolean
}

export interface NetworkUrlPolicyResult {
  url: string
  hostname: string
  allowed: boolean
  blockedReason: NetworkUrlBlockedReason | null
  resolvedAddresses: string[]
}

const PRIVATE_IPV4_RANGES = [
  { base: '0.0.0.0', mask: 8 },
  { base: '10.0.0.0', mask: 8 },
  { base: '127.0.0.0', mask: 8 },
  { base: '169.254.0.0', mask: 16 },
  { base: '172.16.0.0', mask: 12 },
  { base: '192.168.0.0', mask: 16 },
]

function ipv4ToInt(address: string): number {
  return address
    .split('.')
    .map((part) => Number(part))
    .reduce((acc, part) => ((acc << 8) | part) >>> 0, 0)
}

function isIpv4InRange(address: string, base: string, mask: number): boolean {
  const shift = 32 - mask
  return ipv4ToInt(address) >>> shift === ipv4ToInt(base) >>> shift
}

function ipv4FromMappedIpv6(address: string): string | null {
  const normalized = address.toLowerCase()
  const dottedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (dottedMatch && isIP(dottedMatch[1]) === 4) {
    return dottedMatch[1]
  }

  const hexMatch = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (!hexMatch) return null

  const high = Number.parseInt(hexMatch[1], 16)
  const low = Number.parseInt(hexMatch[2], 16)
  if (
    !Number.isInteger(high) ||
    !Number.isInteger(low) ||
    high < 0 ||
    high > 0xffff ||
    low < 0 ||
    low > 0xffff
  ) {
    return null
  }

  return [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff].join(
    '.',
  )
}

function isLoopbackAddress(address: string): boolean {
  const normalized = address.toLowerCase()
  const mappedIpv4 = ipv4FromMappedIpv6(normalized)
  if (mappedIpv4) return isLoopbackAddress(mappedIpv4)

  return (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    normalized.startsWith('127.')
  )
}

function isPrivateNetworkAddress(address: string): boolean {
  const normalized = address.toLowerCase()
  const mappedIpv4 = ipv4FromMappedIpv6(normalized)
  if (mappedIpv4) return isPrivateNetworkAddress(mappedIpv4)

  if (isLoopbackAddress(normalized)) return true
  if (isIP(normalized) === 4) {
    return PRIVATE_IPV4_RANGES.some((range) =>
      isIpv4InRange(normalized, range.base, range.mask),
    )
  }
  if (isIP(normalized) === 6) {
    return (
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    )
  }
  return false
}

function normalizeHostnameForNetworkPolicy(hostname: string): string {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1)
  }
  return hostname
}

async function resolveHostname(hostname: string): Promise<string[]> {
  const normalizedHostname = normalizeHostnameForNetworkPolicy(hostname)
  if (normalizedHostname === 'localhost' || isIP(normalizedHostname)) {
    return [normalizedHostname]
  }
  const records = await lookup(normalizedHostname, {
    all: true,
    verbatim: true,
  })
  return records.map((record) => record.address)
}

export async function classifyNetworkFetchUrl(
  rawUrl: string,
  options: NetworkUrlPolicyOptions = {},
): Promise<NetworkUrlPolicyResult> {
  const base = classifyExternalUrl(rawUrl)
  if (!base.allowed) {
    return {
      url: base.url,
      hostname: base.hostname,
      allowed: false,
      blockedReason: base.blockedReason,
      resolvedAddresses: [],
    }
  }

  const hostname = normalizeHostnameForNetworkPolicy(base.hostname)
  const resolvedAddresses = await resolveHostname(hostname)
  const hasLoopback = resolvedAddresses.some(isLoopbackAddress)
  const hasPrivateNetwork = resolvedAddresses.some(isPrivateNetworkAddress)

  if (hasLoopback && !options.allowLoopback) {
    return {
      url: base.url,
      hostname,
      allowed: false,
      blockedReason: 'loopback',
      resolvedAddresses,
    }
  }
  if (hasPrivateNetwork && !options.allowPrivateNetwork) {
    return {
      url: base.url,
      hostname,
      allowed: false,
      blockedReason: 'private-network',
      resolvedAddresses,
    }
  }

  return {
    url: base.url,
    hostname,
    allowed: true,
    blockedReason: null,
    resolvedAddresses,
  }
}

export async function assertNetworkFetchUrl(
  rawUrl: string,
  options: NetworkUrlPolicyOptions = {},
): Promise<string> {
  const result = await classifyNetworkFetchUrl(rawUrl, options)
  if (!result.allowed) {
    throw new Error(`URL 已被安全策略阻止：${result.blockedReason}`)
  }
  return result.url
}
