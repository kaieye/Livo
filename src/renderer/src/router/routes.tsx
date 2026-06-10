import { createHashRouter, type RouteObject } from 'react-router-dom'
import App from '../App'
import { traceStartupChunk } from '../lib/startup-block-diagnostics'

const homeRoute = {
  lazy: async () => ({
    Component: (
      await traceStartupChunk('HomePage', () => import('../pages/HomePage'))
    ).default,
  }),
}

const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, ...homeRoute },
      { path: 'starred', ...homeRoute },
      { path: 'feed/:feedId', ...homeRoute },
      {
        path: 'discover/preview',
        lazy: async () => ({
          Component: (
            await traceStartupChunk(
              'DiscoverPreviewPage',
              () => import('../pages/DiscoverPreviewPage'),
            )
          ).default,
        }),
      },
      {
        path: 'discover/subscribe',
        lazy: async () => ({
          Component: (
            await traceStartupChunk(
              'DiscoverSubscribeConfigPage',
              () => import('../pages/DiscoverSubscribeConfigPage'),
            )
          ).default,
        }),
      },
      { path: 'discover', ...homeRoute },
      { path: 'settings', ...homeRoute },
      { path: 'digest', ...homeRoute },
      {
        path: 'entry/:entryId',
        lazy: async () => ({
          Component: (
            await traceStartupChunk(
              'ArticleDetailPage',
              () => import('../pages/ArticleDetailPage'),
            )
          ).default,
        }),
      },
      {
        path: 'video/:entryId',
        lazy: async () => ({
          Component: (
            await traceStartupChunk(
              'VideoPlayerPage',
              () => import('../pages/VideoPlayerPage'),
            )
          ).default,
        }),
      },
      {
        path: 'image/:entryId/:imageIndex?',
        lazy: async () => ({
          Component: (
            await traceStartupChunk(
              'ImageViewerPage',
              () => import('../pages/ImageViewerPage'),
            )
          ).default,
        }),
      },
      {
        path: 'login/:provider?',
        lazy: async () => ({
          Component: (
            await traceStartupChunk(
              'AccountLoginPage',
              () => import('../pages/AccountLoginPage'),
            )
          ).default,
        }),
      },
      { path: ':viewType/feed/:feedId', ...homeRoute },
      { path: ':viewType', ...homeRoute },
    ],
  },
]

export const router = createHashRouter(routes)
