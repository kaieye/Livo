const DEFAULT_BACKEND_BASE_URL = 'https://api.livospace.cn'

/**
 * 后端服务地址统一入口。
 * 桌面端默认连接生产后端，开发/测试环境可通过环境变量覆盖。
 */
export function getBackendBaseUrl(): string {
  return (
    process.env.LIVO_SERVER_BASE_URL?.trim() ||
    process.env.VITE_LIVO_SERVER_BASE_URL?.trim() ||
    DEFAULT_BACKEND_BASE_URL
  )
}
