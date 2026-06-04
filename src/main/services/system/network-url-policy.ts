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

function isLoopbackAddress(address: string): boolean {
  const normalized = address.toLowerCase()
  return (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    normalized.startsWith('127.')
  )
}

function isPrivateNetworkAddress(address: string): boolean {
  const normalized = address.toLowerCase()
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

async function resolveHostname(hostname: string): Promise<string[]> {
  if (hostname === 'localhost' || isIP(hostname)) return [hostname]
  const records = await lookup(hostname, { all: true, verbatim: true })
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

  const resolvedAddresses = await resolveHostname(base.hostname)
  const hasLoopback = resolvedAddresses.some(isLoopbackAddress)
  const hasPrivateNetwork = resolvedAddresses.some(isPrivateNetworkAddress)

  if (hasLoopback && !options.allowLoopback) {
    return {
      url: base.url,
      hostname: base.hostname,
      allowed: false,
      blockedReason: 'loopback',
      resolvedAddresses,
    }
  }
  if (hasPrivateNetwork && !options.allowPrivateNetwork) {
    return {
      url: base.url,
      hostname: base.hostname,
      allowed: false,
      blockedReason: 'private-network',
      resolvedAddresses,
    }
  }

  return {
    url: base.url,
    hostname: base.hostname,
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
