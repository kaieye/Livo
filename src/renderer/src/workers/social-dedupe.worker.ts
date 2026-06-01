/// <reference lib="webworker" />

import { dedupeSocialEntries } from '../lib/dedupe-social'
import type { Entry } from '../../../shared/types'

type DedupRequest = {
  id: number
  entries: Entry[]
}

type DedupResponse = {
  id: number
  entries: Entry[]
}

self.onmessage = (event: MessageEvent<DedupRequest>) => {
  const { id, entries } = event.data
  const deduped = dedupeSocialEntries(entries || [])
  const payload: DedupResponse = { id, entries: deduped }
  self.postMessage(payload)
}

export {}
