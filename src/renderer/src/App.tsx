import { lazy, Suspense, useLayoutEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { TitleBar } from './components/layout/TitleBar'
import { useAppIsReady } from './store/app-store'
import { markStartupComponentMounted } from './lib/startup-block-diagnostics'

const AppRuntime = lazy(() =>
  import('./app-runtime').then((module) => ({ default: module.AppRuntime })),
)

function AppSkeleton() {
  return <div className="h-full w-full" aria-hidden />
}

function AppLayer() {
  const appIsReady = useAppIsReady()
  const removedSkeleton = useRef(false)

  useLayoutEffect(() => {
    markStartupComponentMounted('AppLayer')
  }, [])

  useLayoutEffect(() => {
    if (appIsReady && !removedSkeleton.current) {
      removedSkeleton.current = true
      requestAnimationFrame(() => {
        document.getElementById('app-skeleton')?.remove()
      })
    }
  }, [appIsReady])

  return appIsReady ? <Outlet /> : <AppSkeleton />
}

export default function App() {
  const appIsReady = useAppIsReady()

  useLayoutEffect(() => {
    markStartupComponentMounted('App')
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AppLayer />
      <TitleBar />
      {appIsReady ? (
        <Suspense fallback={null}>
          <AppRuntime />
        </Suspense>
      ) : null}
    </div>
  )
}
