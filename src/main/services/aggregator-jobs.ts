import type { Feed } from "../../shared/types"
import { getAllFeeds } from "../database"
import { getSettings } from "../handlers/settings-handlers"
import { warmAggregatorForFeeds } from "./feed-source-provider"

let warmupTimer: ReturnType<typeof setInterval> | null = null

async function runWarmup(feeds?: Feed[]): Promise<void> {
  const targetFeeds = feeds || getAllFeeds()
  await warmAggregatorForFeeds(targetFeeds)
}

export function startAggregatorJobs(initialFeeds?: Feed[]): void {
  if (warmupTimer) clearInterval(warmupTimer)

  void runWarmup(initialFeeds).catch(() => {})

  const intervalSeconds = Math.max(300, getSettings().aggregator.pollIntervalSeconds || 900)
  warmupTimer = setInterval(() => {
    void runWarmup().catch(() => {})
  }, intervalSeconds * 1000)
}

export function stopAggregatorJobs(): void {
  if (!warmupTimer) return
  clearInterval(warmupTimer)
  warmupTimer = null
}
