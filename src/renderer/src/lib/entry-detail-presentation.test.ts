import { describe, expect, it } from 'vitest'
import { FeedViewType } from '../../../shared/types'
import { resolveEntryDetailPresentation } from './entry-detail-presentation'

describe('resolveEntryDetailPresentation', () => {
  it('uses the social detail presentation for an X feed entry selected from the all view', () => {
    expect(
      resolveEntryDetailPresentation({
        entryFeedView: FeedViewType.SocialMedia,
      }),
    ).toBe('social')
  })

  it('keeps the standard article presentation for a regular RSS entry', () => {
    expect(
      resolveEntryDetailPresentation({
        entryFeedView: FeedViewType.Articles,
      }),
    ).toBe('article')
  })
})
