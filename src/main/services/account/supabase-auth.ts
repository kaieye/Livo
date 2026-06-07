import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_CONFIG } from '../../../shared/supabase-config'
import type {
  AccountProvider,
  AccountSessionState,
} from '../../../shared/types'
import { shell } from 'electron'

/**
 * Supabase 认证服务
 * 替代原有的 account-auth.ts
 */

// 创建 Supabase 客户端
let supabase: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  }
  return supabase
}

/**
 * 获取账号状态
 */
export async function getAccountState(
  provider: AccountProvider,
): Promise<AccountSessionState> {
  if (provider !== 'google' && provider !== 'wechat') {
    return {
      provider,
      linked: false,
      displayName: null,
      error: 'Unsupported provider',
    }
  }

  const client = getSupabaseClient()
  const {
    data: { session },
  } = await client.auth.getSession()

  if (!session) {
    return {
      provider,
      linked: false,
      displayName: null,
    }
  }

  // 检查用户的 provider 是否匹配
  const userProvider = session.user.app_metadata.provider
  if (userProvider !== provider) {
    return {
      provider,
      linked: false,
      displayName: null,
    }
  }

  // 获取用户信息
  const displayName =
    session.user.user_metadata.display_name ||
    session.user.user_metadata.name ||
    session.user.email ||
    null

  return {
    provider,
    linked: true,
    displayName,
  }
}

/**
 * Google OAuth 登录
 */
export async function linkGoogleOAuthAccount(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const client = getSupabaseClient()

    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: SUPABASE_CONFIG.auth.redirectTo,
        scopes: SUPABASE_CONFIG.auth.google.scopes,
      },
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data.url) {
      return { success: false, error: 'No authorization URL returned' }
    }

    // 打开浏览器进行 OAuth 授权
    await shell.openExternal(data.url)

    // 等待回调（通过深链接或轮询）
    // 这里需要配合 Deep Link 处理
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 微信 OAuth 登录
 * 注意：Supabase 默认不支持 wechat provider，需要自定义实现
 */
export async function linkWechatOAuthAccount(): Promise<{
  success: boolean
  error?: string
}> {
  // TODO: 微信登录需要自定义 OAuth 流程
  // Supabase 的 signInWithOAuth 不支持 'wechat' 作为 provider
  return {
    success: false,
    error: 'WeChat OAuth not yet implemented',
  }
}

/**
 * 登出账号
 */
export async function unlinkAccount(
  provider: AccountProvider,
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient()
    const { error } = await client.auth.signOut()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 处理 OAuth 回调（Deep Link）
 * 当用户授权完成后，会跳转到 livo://auth/callback?code=xxx&state=xxx
 */
export async function handleOAuthCallback(
  callbackUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient()

    // 从 URL 中提取 code 和 state 参数
    const url = new URL(callbackUrl)
    const code = url.searchParams.get('code')

    if (!code) {
      return { success: false, error: 'No authorization code in callback URL' }
    }

    // 使用 exchangeCodeForSession 交换 code 获取 session
    const { data, error } = await client.auth.exchangeCodeForSession(code)

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data.session) {
      return { success: false, error: 'No session returned' }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 获取当前用户的 session
 */
export async function getCurrentSession() {
  const client = getSupabaseClient()
  const {
    data: { session },
  } = await client.auth.getSession()
  return session
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser() {
  const client = getSupabaseClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  return user
}
