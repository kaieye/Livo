import { useEffect, useMemo, useRef, useState } from 'react'
import type { Entry } from '../../../shared/types'
import { dedupeSocialEntries } from '../lib/dedupe-social'

type DedupeWorkerRequest = {
  id: number
  entries: Entry[]
}

type DedupeWorkerResponse = {
  id: number
  entries: Entry[]
}

type UseAsyncSocialDedupeOptions = {
  enabled: boolean
  cacheKey: string
  workerThreshold?: number
}

const DEFAULT_WORKER_THRESHOLD = 12
const dedupeCacheByKey = new Map<string, Entry[]>()

export function useAsyncSocialDedupe(
  sourceEntries: Entry[],
  options: UseAsyncSocialDedupeOptions,
): { entries: Entry[]; isProcessing: boolean } {
  const {
    enabled,
    cacheKey,
    workerThreshold = DEFAULT_WORKER_THRESHOLD,
  } = options
  const [dedupedEntries, setDedupedEntries] = useState<Entry[]>(sourceEntries)
  const [isProcessing, setIsProcessing] = useState(false)

  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const activeKeyRef = useRef(cacheKey)

  const shouldUseWorker = useMemo(
    () =>
      enabled &&
      sourceEntries.length >= workerThreshold &&
      typeof Worker !== 'undefined',
    [enabled, sourceEntries.length, workerThreshold],
  )
  const renderEntries = useMemo(() => {
    if (!enabled) return sourceEntries
    if (activeKeyRef.current === cacheKey) return dedupedEntries
    return dedupeCacheByKey.get(cacheKey) ?? sourceEntries
  }, [cacheKey, dedupedEntries, enabled, sourceEntries])

  useEffect(() => {
    if (!shouldUseWorker) return
    if (workerRef.current) return
    workerRef.current = new Worker(
      new URL('../workers/social-dedupe.worker.ts', import.meta.url),
      { type: 'module' },
    )
  }, [shouldUseWorker])

  useEffect(() => {
    const worker = workerRef.current
    if (!worker) return
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      activeKeyRef.current = cacheKey
      setIsProcessing(false)
      return
    }

    if (activeKeyRef.current !== cacheKey) {
      activeKeyRef.current = cacheKey
      const cached = dedupeCacheByKey.get(cacheKey)
      setDedupedEntries(cached ?? sourceEntries)
    }

    if (!shouldUseWorker) {
      const deduped = dedupeSocialEntries(sourceEntries)
      setIsProcessing(false)
      setDedupedEntries(deduped)
      dedupeCacheByKey.set(cacheKey, deduped)
      return
    }

    const worker = workerRef.current
    if (!worker) {
      const deduped = dedupeSocialEntries(sourceEntries)
      setIsProcessing(false)
      setDedupedEntries(deduped)
      dedupeCacheByKey.set(cacheKey, deduped)
      return
    }

    const requestId = ++requestIdRef.current
    setIsProcessing(true)

    const handleMessage = (event: MessageEvent<DedupeWorkerResponse>) => {
      if (event.data.id !== requestIdRef.current) return
      const nextEntries = event.data.entries || []
      setDedupedEntries(nextEntries)
      dedupeCacheByKey.set(cacheKey, nextEntries)
      setIsProcessing(false)
    }

    const handleError = () => {
      if (requestId !== requestIdRef.current) return
      const deduped = dedupeSocialEntries(sourceEntries)
      setDedupedEntries(deduped)
      dedupeCacheByKey.set(cacheKey, deduped)
      setIsProcessing(false)
    }

    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleError)
    const payload: DedupeWorkerRequest = {
      id: requestId,
      entries: sourceEntries,
    }
    worker.postMessage(payload)

    return () => {
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
    }
  }, [cacheKey, enabled, shouldUseWorker, sourceEntries])

  return { entries: renderEntries, isProcessing }
}
