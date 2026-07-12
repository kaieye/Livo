import React from 'react'
import { createRoot } from 'react-dom/client'

import type { Entry } from '../../src/shared/types'
import { useDeepLinkEntry } from '../../src/renderer/src/hooks/useDeepLinkEntry'
import { useEntryStore } from '../../src/renderer/src/store/entry-store'

const entry: Entry = {
  id: 'e2e-image-entry',
  feedId: 'e2e-feed',
  title: 'Selected image entry',
  url: 'https://example.com/articles/selected-image-entry',
  imageUrl: 'https://example.com/images/selected-image-entry.jpg',
  media: [
    {
      type: 'photo',
      url: 'https://example.com/images/selected-image-entry.jpg',
    },
  ],
  publishedAt: 1,
  createdAt: 1,
  isRead: true,
  isStarred: false,
}

function DeepLinkEntryHarness() {
  const { activeEntry, state } = useDeepLinkEntry(entry.id)
  return React.createElement(
    'div',
    {
      'data-state': state,
      'data-entry-id': activeEntry?.id ?? '',
    },
    activeEntry?.title ?? state,
  )
}

export async function mountDeepLinkEntryHarness(): Promise<void> {
  ;(
    window as unknown as {
      api: {
        entries: {
          get: (entryId: string) => Promise<Entry | null>
        }
      }
    }
  ).api = {
    entries: {
      get: async (entryId) => (entryId === entry.id ? entry : null),
    },
  }

  useEntryStore.setState({ entries: [entry] })
  await useEntryStore.getState().selectEntry(entry)

  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Missing harness root')

  createRoot(rootElement).render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(DeepLinkEntryHarness),
    ),
  )
}
