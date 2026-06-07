/**
 * LRU Cache instances for EntryList component state persistence
 */
import { LRUCache } from '../../../../lib/lru-cache'

/** Cache for expanded state of social media items (entry ID -> expanded) */
export const expandedCache = new LRUCache<string, boolean>(200)

/** Cache for media expanded state (entry ID -> media expanded) */
export const mediaExpandedCache = new LRUCache<string, boolean>(200)

/** Cache for tweet translation results (entry ID -> translated paragraphs) */
export const tweetTranslationCache = new LRUCache<string, string[]>(100)

/** Cache for tweet summary results (entry ID -> summary text) */
export const tweetSummaryCache = new LRUCache<string, string>(100)
