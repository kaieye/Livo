const DEFAULT_BACKEND_BASE_URL = 'http://127.0.0.1:8787'

/**
 * 后端服务地址统一入口。
 * 开发环境默认连接本地 Livo-Server，生产环境可通过环境变量覆盖。
 */
export function getBackendBaseUrl(): string {
  return (
    process.env.LIVO_SERVER_BASE_URL?.trim() ||
    process.env.VITE_LIVO_SERVER_BASE_URL?.trim() ||
    DEFAULT_BACKEND_BASE_URL
  )
}
