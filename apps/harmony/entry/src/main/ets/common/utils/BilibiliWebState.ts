// Bilibili web state interfaces for login detection

export interface BilibiliWebNavResponse {
  code?: number
  message?: string
  data?: BilibiliWebNavData
}

export interface BilibiliWebNavData {
  isLogin?: boolean
  uname?: string
}

export interface BilibiliPageState {
  currentUrl: string
  title: string
  displayName: string
  loggedIn: boolean
  cookies: string
}
