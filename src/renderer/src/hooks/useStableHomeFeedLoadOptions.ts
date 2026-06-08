import { useRef } from 'react'

import {
  areHomeFeedLoadOptionsEqual,
  type HomeFeedLoadOptions,
} from '../lib/home-feed-scope'

export function useStableHomeFeedLoadOptions(
  options: HomeFeedLoadOptions,
): HomeFeedLoadOptions {
  const stableOptionsRef = useRef(options)
  if (!areHomeFeedLoadOptionsEqual(stableOptionsRef.current, options)) {
    stableOptionsRef.current = options
  }
  return stableOptionsRef.current
}
