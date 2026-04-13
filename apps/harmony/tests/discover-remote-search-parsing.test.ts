import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildInstagramCandidateFromProfile,
  buildInstagramProfileSeedFromProfile,
  buildXCandidateFromProfile,
  buildXProfileSeedFromProfile,
  dedupeAndLimitDiscoverCandidates,
  extractXFollowersFromText,
  parseInstagramProfilesFromTopsearchPayload,
  parseInstagramProfilesFromSearchHtml,
  parseXProfilesFromSearchHtml,
} from '../entry/src/main/ets/common/utils/DiscoverRemoteSearchParsing.ts'
import {
  extractInstagramUsername,
  formatInstagramFeedTitle,
  normalizeSocialFeedDescription,
  normalizeSocialFeedTitle,
} from '../entry/src/main/ets/common/utils/SocialFeedTitles.ts'
import { resolveSocialFeedDisplayImageUrl } from '../entry/src/main/ets/common/utils/SocialFeedPresentation.ts'

test('extractXFollowersFromText parses compact follower labels', () => {
  assert.equal(
    extractXFollowersFromText('OpenAI · 1.2M Followers · Following 12'),
    '1.2M followers',
  )
  assert.equal(extractXFollowersFromText('followers: 987K'), '987K followers')
  assert.equal(
    extractXFollowersFromText('4M 位粉丝，4 位关注，1,704 个帖子'),
    '4M followers',
  )
  assert.equal(
    extractXFollowersFromText('粉丝 25.6万 · 关注 12'),
    '25.6万 followers',
  )
})

test('parseXProfilesFromSearchHtml resolves absolute profile URLs and prefers meaningful title text', () => {
  const html = `
    <section>
      <a href="https://x.com/openai/?ref_src=twsrc%5Etfw">
        <img src="//pbs.twimg.com/profile_images/openai.jpg" />
        <span>@OpenAI</span>
        <span><strong>OpenAI</strong> Research</span>
        <span>1.8M Followers</span>
      </a>
    </section>
  `

  const profiles = parseXProfilesFromSearchHtml(html, 'openai')

  assert.equal(profiles.length, 1)
  assert.equal(profiles[0]?.username, 'openai')
  assert.equal(profiles[0]?.title, 'OpenAI Research')
  assert.equal(
    profiles[0]?.imageUrl,
    'https://pbs.twimg.com/profile_images/openai.jpg',
  )
  assert.equal(profiles[0]?.followers, '1.8M followers')
})

test('parseXProfilesFromSearchHtml joins richer inline title markup from nested spans', () => {
  const html = `
    <section>
      <a href="/openai/">
        <span>@openai</span>
        <span><strong>OpenAI</strong></span>
        <span><em>Research</em></span>
        <span>1.8M Followers</span>
      </a>
    </section>
  `

  const profiles = parseXProfilesFromSearchHtml(html, 'openai')

  assert.equal(profiles.length, 1)
  assert.equal(profiles[0]?.title, 'OpenAI Research')
})

test('parseXProfilesFromSearchHtml falls back to anchor text when structured spans are missing', () => {
  const html = `
    <section>
      <a href="https://x.com/openai">
        <img src="https://pbs.twimg.com/profile_images/openai.jpg" />
        OpenAI Research 1.8M Followers
      </a>
    </section>
  `

  const profiles = parseXProfilesFromSearchHtml(html, 'openai')

  assert.equal(profiles.length, 1)
  assert.equal(profiles[0]?.username, 'openai')
  assert.equal(profiles[0]?.title, 'OpenAI Research')
  assert.equal(profiles[0]?.followers, '1.8M followers')
})

test('parseInstagramProfilesFromSearchHtml resolves root-relative profile URLs and relative images', () => {
  const html = `
    <div>
      <a href="/studiolivo/?hl=en">
        <img src="images/studiolivo.jpg" />
        <span>@studiolivo</span>
        <span><strong>Studio</strong> Livo</span>
      </a>
    </div>
  `

  const profiles = parseInstagramProfilesFromSearchHtml(html, 'studiolivo')

  assert.equal(profiles.length, 1)
  assert.equal(profiles[0]?.username, 'studiolivo')
  assert.equal(profiles[0]?.title, 'Studio Livo')
  assert.equal(
    profiles[0]?.imageUrl,
    'https://www.instagram.com/studiolivo/images/studiolivo.jpg',
  )
})

test('parseInstagramProfilesFromSearchHtml keeps zh-CN follower text from profile metadata snippets', () => {
  const html = `
    <div>
      <a href="/openai/">
        <img src="https://cdninstagram.com/openai.jpg" />
        <span>@openai</span>
        <span>OpenAI</span>
        <span>4M 位粉丝，4 位关注，1,704 个帖子</span>
      </a>
    </div>
  `

  const profiles = parseInstagramProfilesFromSearchHtml(html, 'openai')

  assert.equal(profiles.length, 1)
  assert.equal(profiles[0]?.followers, '4M followers')
})

test('parseInstagramProfilesFromTopsearchPayload extracts matching users from official search payload', () => {
  const profiles = parseInstagramProfilesFromTopsearchPayload(
    {
      users: [
        {
          user: {
            username: 'openai',
            full_name: 'OpenAI',
            profile_pic_url: 'https://cdninstagram.com/openai.jpg',
            follower_count: 4200000,
          },
        },
        {
          user: {
            username: 'not-related',
            full_name: 'Someone Else',
            profile_pic_url: 'https://cdninstagram.com/other.jpg',
            follower_count: 20,
          },
        },
      ],
    },
    'open ai',
  )

  assert.equal(profiles.length, 1)
  assert.equal(profiles[0]?.username, 'openai')
  assert.equal(profiles[0]?.title, 'OpenAI')
  assert.equal(profiles[0]?.imageUrl, 'https://cdninstagram.com/openai.jpg')
  assert.equal(profiles[0]?.followers, '4200000 followers')
})

test('buildXCandidateFromProfile emits an X profile seed with follower-first description', () => {
  const seed = buildXProfileSeedFromProfile({
    username: 'openai',
    title: 'OpenAI',
    imageUrl: 'https://pbs.twimg.com/profile_images/openai.jpg',
    followers: '1.8M followers',
  })

  assert.equal(seed.platform, 'x')
  assert.equal(seed.profileUrl, 'https://x.com/openai')
  assert.equal(seed.title, 'OpenAI')
  assert.equal(seed.followers, '1.8M followers')
  assert.equal(seed.imageUrl, 'https://pbs.twimg.com/profile_images/openai.jpg')
})

test('buildInstagramCandidateFromProfile emits an Instagram profile seed with canonical profile URL and title fallback', () => {
  const seed = buildInstagramProfileSeedFromProfile({
    username: 'studiolivo',
    title: '',
    imageUrl: 'https://cdninstagram.com/studiolivo.jpg',
    followers: '',
  })

  assert.equal(seed.platform, 'instagram')
  assert.equal(seed.profileUrl, 'https://www.instagram.com/studiolivo/')
  assert.equal(seed.title, 'studiolivo')
  assert.equal(seed.followers, '')
  assert.equal(seed.imageUrl, 'https://cdninstagram.com/studiolivo.jpg')
})

test('buildXCandidateFromProfile adapts an X profile seed into Harmony discover candidate fields', () => {
  const xCandidate = buildXCandidateFromProfile(
    buildXProfileSeedFromProfile({
      username: 'openai',
      title: 'OpenAI',
      imageUrl: 'https://pbs.twimg.com/profile_images/openai.jpg',
      followers: '1.8M followers',
    }),
    {
      x: 1,
      instagram: 3,
    },
  )

  assert.deepEqual(xCandidate, {
    targetUrl: 'https://rsshub.pseudoyu.com/twitter/user/openai',
    targetTitle: 'OpenAI',
    targetView: 1,
    description: '1.8M followers',
    siteUrl: 'https://x.com/openai',
    sourceKind: 'X',
    imageUrl: 'https://pbs.twimg.com/profile_images/openai.jpg',
  })
})

test('buildInstagramCandidateFromProfile adapts an Instagram profile seed into Harmony discover candidate fields', () => {
  const instagramCandidate = buildInstagramCandidateFromProfile(
    buildInstagramProfileSeedFromProfile({
      username: 'studiolivo',
      title: 'Studio Livo',
      imageUrl: 'https://cdninstagram.com/studiolivo.jpg',
      followers: '',
    }),
    {
      x: 1,
      instagram: 3,
    },
  )

  assert.deepEqual(instagramCandidate, {
    targetUrl: 'https://rsshub.pseudoyu.com/instagram/user/studiolivo',
    targetTitle: 'Studio Livo',
    targetView: 3,
    description: '@studiolivo',
    siteUrl: 'https://www.instagram.com/studiolivo/',
    sourceKind: 'Instagram',
    imageUrl: 'https://cdninstagram.com/studiolivo.jpg',
  })
})

test('formatInstagramFeedTitle falls back to username for generic or mirror titles', () => {
  assert.equal(
    formatInstagramFeedTitle('Instagram', 'du_chenduling'),
    'du_chenduling',
  )
  assert.equal(
    formatInstagramFeedTitle(
      'du_chenduling  Watch instagram stories and profile anonymous',
      'du_chenduling',
    ),
    'du_chenduling',
  )
  assert.equal(
    formatInstagramFeedTitle('&#x9648;&#x90fd;&#x7075;', 'du_chenduling'),
    '陈都灵',
  )
})

test('formatInstagramFeedTitle strips Picnob mirror suffixes without losing the display name', () => {
  assert.equal(
    formatInstagramFeedTitle(
      '陈都灵 (@du_chenduling) public posts - Picnob',
      'du_chenduling',
    ),
    '陈都灵',
  )
  assert.equal(
    formatInstagramFeedTitle(
      'du_chenduling public posts - Picnob',
      'du_chenduling',
    ),
    'du_chenduling',
  )
})

test('formatInstagramFeedTitle keeps ordinary Instagram titles that merely contain @handle text', () => {
  assert.equal(
    formatInstagramFeedTitle('Photo by @acme', 'du_chenduling'),
    'Photo by @acme',
  )
})

test('formatInstagramFeedTitle does not strip parenthesized handles from ordinary titles', () => {
  assert.equal(
    formatInstagramFeedTitle('Behind the scenes (@studio)', 'du_chenduling'),
    'Behind the scenes (@studio)',
  )
})

test('normalizeSocialFeedTitle and description keep instagram feeds readable', () => {
  assert.equal(
    normalizeSocialFeedTitle(
      'du_chenduling  Watch instagram stories and profile anonymous',
      'https://rsshub.pseudoyu.com/instagram/user/du_chenduling',
      'https://www.instagram.com/du_chenduling/',
    ),
    'du_chenduling',
  )

  assert.equal(
    normalizeSocialFeedDescription(
      'Instagram 用户',
      'https://rsshub.pseudoyu.com/instagram/user/du_chenduling',
      'https://www.instagram.com/du_chenduling/',
    ),
    '@du_chenduling',
  )
  assert.equal(
    normalizeSocialFeedTitle(
      '陈都灵 (@du_chenduling) public posts - Picnob',
      'https://rsshub.pseudoyu.com/instagram/user/du_chenduling',
      'https://www.instagram.com/du_chenduling/',
    ),
    '陈都灵',
  )
})

test('extractInstagramUsername recognizes picnob mirror user routes', () => {
  assert.equal(
    extractInstagramUsername(
      'https://rsshub.pseudoyu.com/picnob/user/du_chenduling',
    ),
    'du_chenduling',
  )
  assert.equal(
    extractInstagramUsername(
      'https://rsshub.pseudoyu.com/pixnoy/user/du_chenduling',
    ),
    'du_chenduling',
  )
  assert.equal(
    extractInstagramUsername(
      'https://rsshub.pseudoyu.com/piokok/user/du_chenduling',
    ),
    'du_chenduling',
  )
})

test('resolveSocialFeedDisplayImageUrl falls back to instagram avatar for picnob feeds', () => {
  assert.equal(
    resolveSocialFeedDisplayImageUrl(
      '',
      'https://rsshub.pseudoyu.com/picnob/user/du_chenduling',
      'https://www.instagram.com/du_chenduling/',
      '陈都灵',
    ),
    'https://unavatar.io/instagram/du_chenduling?fallback=false',
  )
})

test('resolveSocialFeedDisplayImageUrl upgrades generic favicons to social avatars', () => {
  assert.equal(
    resolveSocialFeedDisplayImageUrl(
      'https://www.google.com/s2/favicons?domain=x.com&sz=128',
      'https://rsshub.pseudoyu.com/twitter/user/openai',
      'https://x.com/openai',
      'OpenAI',
    ),
    'https://unavatar.io/x/openai',
  )

  assert.equal(
    resolveSocialFeedDisplayImageUrl(
      'https://www.google.com/s2/favicons?domain=instagram.com&sz=128',
      'https://rsshub.pseudoyu.com/instagram/user/du_chenduling',
      'https://instagram.com/du_chenduling',
      '陈都灵',
    ),
    'https://unavatar.io/instagram/du_chenduling?fallback=false',
  )
})

test('dedupeAndLimitDiscoverCandidates keeps unique candidates and respects the limit', () => {
  const deduped = dedupeAndLimitDiscoverCandidates(
    [
      buildXProfileSeedFromProfile({
        username: 'openai',
        title: 'OpenAI',
        imageUrl: '',
        followers: '1.8M followers',
      }),
      buildXProfileSeedFromProfile({
        username: 'openai',
        title: 'OpenAI Labs',
        imageUrl: '',
        followers: '',
      }),
      buildInstagramProfileSeedFromProfile({
        username: 'studiolivo',
        title: 'Studio Livo',
        imageUrl: '',
        followers: '',
      }),
    ],
    2,
  )

  assert.equal(deduped.length, 2)
  assert.equal(deduped[0]?.platform, 'x')
  assert.equal(deduped[1]?.platform, 'instagram')
})
