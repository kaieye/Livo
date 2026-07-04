export interface WechatQrStatus {
  isLoggedIn: boolean
  qrPending: boolean
  message: string
  tokenExpired?: boolean
  expiryTimestamp?: number
  expiryTime?: string
}

export interface WechatSearchResult {
  title: string
  description: string
  image: string
  fakeId: string
  rssUrl: string
  siteUrl: string
  source: 'wechat-rss'
  requiresLogin: true
}

export interface WechatSearchResponse {
  results: WechatSearchResult[]
  total: number
}
