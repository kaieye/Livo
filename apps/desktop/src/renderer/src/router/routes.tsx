import { lazy, Suspense } from 'react'
import { createHashRouter } from 'react-router-dom'
import App from '../App'

const HomePage = lazy(() => import('../pages/HomePage'))

/**
 * Route definitions for the Livo desktop app.
 * Uses HashRouter since Electron serves via file:// protocol.
 *
 * Currently all routes render HomePage (the 3-column layout).
 * Independent pages (ArticleDetail, FeedDetail, VideoPlayer, ImageViewer, AccountLogin)
 * will be added as separate route components in tasks 1.1-1.6.
 *
 * Route order matters: specific paths must come before catch-all (:viewType).
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      // All routes currently use HomePage with URL sync.
      // The Layout component handles discover/settings as content-area overlays.
      {
        index: true,
        element: (
          <Suspense fallback={null}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'starred',
        element: (
          <Suspense fallback={null}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'feed/:feedId',
        element: (
          <Suspense fallback={null}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'discover',
        element: (
          <Suspense fallback={null}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={null}>
            <HomePage />
          </Suspense>
        ),
      },
      // Catch-all: view type filter (articles, social, videos, pictures)
      {
        path: ':viewType',
        element: (
          <Suspense fallback={null}>
            <HomePage />
          </Suspense>
        ),
      },
    ],
  },
])
