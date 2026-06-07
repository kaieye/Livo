import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { useAuthStore } from '../store/auth-store'

const AuthLoginPage = lazy(() => import('../pages/AuthLoginPage'))

/**
 * 认证包装器 - 检查用户是否已登录
 * 如果未登录，显示登录页面
 * 如果已登录，显示应用内容
 */
export function AuthGuard() {
  const { isAuthenticated, checkSession } = useAuthStore()

  // 启动时检查 session
  useEffect(() => {
    checkSession()
  }, [checkSession])

  if (!isAuthenticated) {
    return (
      <Suspense fallback={null}>
        <AuthLoginPage />
      </Suspense>
    )
  }

  return <Outlet />
}
