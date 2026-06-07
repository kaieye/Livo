// Supabase 配置文件
// Desktop 应用的 Supabase 客户端配置

export const SUPABASE_CONFIG = {
  // 你的 Supabase 项目 URL
  url: 'https://qyzfulidhowhyjenzjpz.supabase.co',

  // anon key（公开的，可以放在前端）
  anonKey: 'YOUR_SUPABASE_ANON_KEY', // 需要从 Supabase Dashboard 获取

  // OAuth 回调配置
  auth: {
    // Desktop 深链接回调（需要在 Supabase Redirect URLs 中配置）
    redirectTo: 'livo://auth/callback',

    // Google OAuth 配置
    google: {
      scopes: 'openid email profile',
    },

    // 微信 OAuth 配置
    wechat: {
      // PC 扫码登录必须设置
      scopes: 'snsapi_login',
    },
  },
}
