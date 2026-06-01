import { lazy, Suspense } from 'react'
import { createHashRouter } from 'react-router-dom'
import App from '../App'

const HomePage = lazy(() => import('../pages/HomePage'))
const SubscriptionsPage = lazy(() => import('../pages/SubscriptionsPage'))
const FeedDetailPage = lazy(() => import('../pages/FeedDetailPage'))
const ArticleDetailPage = lazy(() => import('../pages/ArticleDetailPage'))
const VideoPlayerPage = lazy(() => import('../pages/VideoPlayerPage'))
const ImageViewerPage = lazy(() => import('../pages/ImageViewerPage'))
const AccountLoginPage = lazy(() => import('../pages/AccountLoginPage'))
const DiscoverPreviewPage = lazy(() => import('../pages/DiscoverPreviewPage'))
const DiscoverSubscribeConfigPage = lazy(
  () => import('../pages/DiscoverSubscribeConfigPage'),
)

/**
 * Route definitions for the Livo desktop app.
 * Uses HashRouter since Electron serves via file:// protocol.
 *
 * Route order matters: specific paths must come before catch-all (:viewType).
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
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
        path: 'discover/preview',
        element: (
          <Suspense fallback={null}>
            <DiscoverPreviewPage />
          </Suspense>
        ),
      },
      {
        path: 'discover/subscribe',
        element: (
          <Suspense fallback={null}>
            <DiscoverSubscribeConfigPage />
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
      {
        path: 'subscriptions',
        element: (
          <Suspense fallback={null}>
            <SubscriptionsPage />
          </Suspense>
        ),
      },
      {
        path: 'feed-detail/:feedId',
        element: (
          <Suspense fallback={null}>
            <FeedDetailPage />
          </Suspense>
        ),
      },
      {
        path: 'entry/:entryId',
        element: (
          <Suspense fallback={null}>
            <ArticleDetailPage />
          </Suspense>
        ),
      },
      {
        path: 'video/:entryId',
        element: (
          <Suspense fallback={null}>
            <VideoPlayerPage />
          </Suspense>
        ),
      },
      {
        path: 'image/:entryId/:imageIndex?',
        element: (
          <Suspense fallback={null}>
            <ImageViewerPage />
          </Suspense>
        ),
      },
      {
        path: 'login/:provider?',
        element: (
          <Suspense fallback={null}>
            <AccountLoginPage />
          </Suspense>
        ),
      },
      // View-specific feed selection: preserves the active view type
      // when navigating to a specific feed within a view context.
      {
        path: ':viewType/feed/:feedId',
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
