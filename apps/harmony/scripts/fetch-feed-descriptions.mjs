/**
 * Fetches descriptions for all feeds in the discover-builtin-feeds JSON files.
 * For each feed without a description, it tries to fetch the RSS/Atom feed and extract the channel description.
 * Falls back to a title-based heuristic if the feed is unreachable.
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FEEDS_DIR = join(
  __dirname,
  '../entry/src/main/ets/common/data/discover-builtin-feeds',
)

const FILES = [
  'articles.json',
  'social.json',
  'pictures.json',
  'videos.json',
  'ins.json',
]

const RSSHUB_BASE = 'https://rsshub.pseudoyu.com/'

function resolveUrl(url) {
  const trimmed = url.trim()
  if (trimmed.toLowerCase().startsWith('rsshub://')) {
    return RSSHUB_BASE + trimmed.slice('rsshub://'.length).replace(/^\/+/, '')
  }
  return trimmed
}

async function fetchFeedDescription(url) {
  const resolved = resolveUrl(url)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(resolved, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FeedBot/1.0)' },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const text = await res.text()

    // Try RSS <description> (channel level)
    let m = text.match(
      /<channel[\s\S]*?<description>([\s\S]*?)<\/description>/i,
    )
    if (m) {
      const desc = m[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .trim()
      if (desc && desc.length > 3 && desc.length < 300) return desc
    }

    // Try Atom <subtitle>
    m = text.match(/<subtitle[^>]*>([\s\S]*?)<\/subtitle>/i)
    if (m) {
      const desc = m[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .trim()
      if (desc && desc.length > 3 && desc.length < 300) return desc
    }

    // Try Atom <title> of feed (skip, we already have title)
    return null
  } catch {
    return null
  }
}

function heuristicDescription(title, url) {
  const t = title.toLowerCase()
  const u = url.toLowerCase()

  if (
    u.includes('youtube.com') ||
    u.includes('youtube/') ||
    t.includes('youtube')
  ) {
    if (t.includes('bilibili') || u.includes('bilibili'))
      return `${title} 的 Bilibili 频道`
    return `${title} 的 YouTube 频道`
  }
  if (
    u.includes('bilibili') ||
    t.includes('bilibili') ||
    t.includes('- bilibili')
  ) {
    return `${title} 的 Bilibili 频道`
  }
  if (u.includes('twitter') || u.includes('/twitter/') || t.includes('- x')) {
    const name = title.replace(/\s*-\s*x$/i, '').trim()
    return `${name} 的 X（Twitter）动态`
  }
  if (
    u.includes('instagram') ||
    u.includes('picnob') ||
    u.includes('/instagram/')
  ) {
    return `${title} 的 Instagram 主页`
  }
  if (u.includes('telegram') || u.includes('/telegram/')) {
    const name = title.replace(/\s*-\s*telegram channel$/i, '').trim()
    return `${name} 的 Telegram 频道`
  }
  if (u.includes('github') && u.includes('trending')) {
    return 'GitHub 每日/每周热门仓库榜单'
  }
  if (u.includes('github') && u.includes('releases')) {
    return `${title} 的 GitHub Release 更新`
  }
  if (u.includes('arxiv')) {
    return `arXiv 最新论文预印本`
  }
  if (
    u.includes('hackernews') ||
    u.includes('hnrss') ||
    t.includes('hacker news')
  ) {
    return 'Hacker News 热门技术讨论社区'
  }
  if (t.includes('product hunt')) {
    return '每日最新科技产品发现与评测'
  }
  if (t.includes('nasa')) {
    return 'NASA 官方图片与资讯'
  }
  if (t.includes('nat geo') || t.includes('national geographic')) {
    return '国家地理每日精选摄影图片'
  }
  if (t.includes('ted talks')) {
    return 'TED 每日精选演讲视频'
  }
  if (t.includes('techcrunch')) {
    return '全球领先科技创业媒体'
  }
  if (t.includes('the verge')) {
    return '科技、文化与消费电子资讯'
  }
  if (t.includes('wired')) {
    return 'WIRED 科技与文化深度报道'
  }
  if (t.includes('mit technology review')) {
    return 'MIT 技术评论，前沿科技深度分析'
  }
  if (t.includes('bloomberg')) {
    return '彭博社财经与商业资讯'
  }
  if (t.includes('少数派')) {
    return '面向效率与品质生活的数字内容平台'
  }
  if (t.includes('阮一峰')) {
    return '阮一峰的个人技术博客，涵盖编程与互联网趋势'
  }
  if (t.includes('v2ex')) {
    return 'V2EX 创意工作者社区讨论'
  }
  if (t.includes('知乎')) {
    return '知乎热门问答与精选内容'
  }
  if (t.includes('36氪')) {
    return '36氪科技创业资讯与深度报道'
  }
  if (t.includes('虎嗅')) {
    return '虎嗅网商业与科技深度分析'
  }
  if (t.includes('爱范儿')) {
    return '爱范儿科技生活方式媒体'
  }
  if (t.includes('ithome') || t.includes('it之家')) {
    return 'IT之家科技资讯聚合'
  }
  if (t.includes('paul graham')) {
    return 'Paul Graham 的创业与思维随笔'
  }
  if (t.includes('sam altman')) {
    return 'OpenAI CEO Sam Altman 的博客与动态'
  }
  if (t.includes('openai')) {
    return 'OpenAI 官方博客与产品动态'
  }
  if (t.includes('google')) {
    return 'Google 官方博客与技术动态'
  }
  if (t.includes('github changelog')) {
    return 'GitHub 产品功能更新日志'
  }
  if (t.includes('lobsters')) {
    return 'Lobsters 技术社区精选链接'
  }
  if (t.includes('producthunt') || t.includes('product hunt')) {
    return '每日最新科技产品发现与评测'
  }

  return null
}

async function processFile(filename) {
  const filepath = join(FEEDS_DIR, filename)
  const data = JSON.parse(readFileSync(filepath, 'utf-8'))
  const feeds = data.feeds

  let updated = 0
  let fetched = 0
  let heuristic = 0
  let skipped = 0

  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i]
    if (feed.description && feed.description.trim()) {
      skipped++
      continue
    }

    process.stdout.write(
      `[${filename}] (${i + 1}/${feeds.length}) ${feed.title} ... `,
    )

    // Try fetching from the feed URL
    let desc = await fetchFeedDescription(feed.url)
    if (desc) {
      // Truncate if too long, keep it as one sentence
      if (desc.length > 120) {
        desc = desc.slice(0, 117) + '...'
      }
      feed.description = desc
      fetched++
      updated++
      console.log(`✓ (fetched)`)
    } else {
      // Fall back to heuristic
      const h = heuristicDescription(feed.title, feed.url)
      if (h) {
        feed.description = h
        heuristic++
        updated++
        console.log(`~ (heuristic)`)
      } else {
        console.log(`✗ (no description)`)
      }
    }
  }

  writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(
    `\n[${filename}] Done: ${updated} updated (${fetched} fetched, ${heuristic} heuristic), ${skipped} already had description\n`,
  )
}

async function main() {
  for (const file of FILES) {
    await processFile(file)
  }
  console.log('All files processed.')
}

main().catch(console.error)
