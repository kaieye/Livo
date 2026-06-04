import { assertNetworkFetchUrl } from '../system/network-url-policy'

export function assertPublicDiscoveryUrl(rawUrl: string): Promise<string> {
  return assertNetworkFetchUrl(rawUrl)
}
