import { classifyExternalUrl } from '../../../shared/url-policy'

function ipv4ToInt(address: string): number {
  return address
    .split('.')
    .map((part) => Number(part))
    .reduce((acc, part) => ((acc << 8) | part) >>> 0, 0)
}

function isIpv4Address(address: string): boolean {
  const parts = address.split('.')
  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^\d+$/.test(part)) return false
      const n = Number(part)
      return n >= 0 && n <= 255
    })
  )
}

function isIpv4InRange(address: string, base: string, mask: number): boolean {
  const shift = 32 - mask
  return ipv4ToInt(address) >>> shift === ipv4ToInt(base) >>> shift
}

function ipv4FromMappedIpv6(address: string): string | null {
  const normalized = address.toLowerCase()
  const dottedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (dottedMatch && isIpv4Address(dottedMatch[1])) return dottedMatch[1]

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

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  const unbracketed =
    normalized.startsWith('[') && normalized.endsWith(']')
      ? normalized.slice(1, -1)
      : normalized
  const mappedIpv4 = ipv4FromMappedIpv6(unbracketed)
  if (mappedIpv4) return isPrivateOrLoopbackHost(mappedIpv4)

  if (unbracketed === 'localhost' || unbracketed.endsWith('.localhost')) {
    return true
  }
  if (isIpv4Address(unbracketed)) {
    return (
      isIpv4InRange(unbracketed, '0.0.0.0', 8) ||
      isIpv4InRange(unbracketed, '10.0.0.0', 8) ||
      isIpv4InRange(unbracketed, '127.0.0.0', 8) ||
      isIpv4InRange(unbracketed, '169.254.0.0', 16) ||
      isIpv4InRange(unbracketed, '172.16.0.0', 12) ||
      isIpv4InRange(unbracketed, '192.168.0.0', 16)
    )
  }

  return (
    unbracketed === '::' ||
    unbracketed === '::1' ||
    unbracketed === '0:0:0:0:0:0:0:1' ||
    unbracketed.startsWith('fc') ||
    unbracketed.startsWith('fd') ||
    unbracketed.startsWith('fe80:')
  )
}

export function isAllowedPlaybackMediaUrl(rawUrl: string): boolean {
  const result = classifyExternalUrl(rawUrl)
  if (!result.allowed) return false
  return !isPrivateOrLoopbackHost(result.hostname)
}

export function isAllowedPlaybackMediaSrcset(rawSrcset: string): boolean {
  return rawSrcset
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0] || '')
    .filter(Boolean)
    .every((url) => isAllowedPlaybackMediaUrl(url))
}
