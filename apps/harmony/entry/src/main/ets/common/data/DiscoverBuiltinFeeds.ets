import { FeedViewType } from '../models/LivoModels'

export type DiscoverBuiltinFeedSourceKey = '' | 'ins'

export interface DiscoverBuiltinFeedSeed {
  title: string
  url: string
  language: string
}

export interface DiscoverBuiltinFeed {
  title: string
  url: string
  siteUrl: string
  description: string
  view: FeedViewType
  category: string
  sourceKey: DiscoverBuiltinFeedSourceKey
  imageUrl?: string
  followers?: string
}

export interface DiscoverBuiltinFeedViewMap {
  articles: DiscoverBuiltinFeed[]
  social: DiscoverBuiltinFeed[]
  pictures: DiscoverBuiltinFeed[]
  videos: DiscoverBuiltinFeed[]
  ins: DiscoverBuiltinFeed[]
}

function normalizeBuiltinFeedUrl(url: string): string {
  const trimmed = url.trim()
  const prefix = 'rsshub://'
  if (trimmed.toLowerCase().startsWith(prefix)) {
    return 'https://rsshub.pseudoyu.com/' + trimmed.slice(prefix.length).replace(/^\/+/, '')
  }
  return trimmed
}

function extractOrigin(url: string): string {
  const trimmed = url.trim()
  const schemeIndex = trimmed.indexOf('://')
  if (schemeIndex < 0) {
    return ''
  }
  const slashIndex = trimmed.indexOf('/', schemeIndex + 3)
  return slashIndex >= 0 ? trimmed.slice(0, slashIndex) : trimmed
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch (_) {
    return value
  }
}

function resolveBuiltinFeedSiteUrl(normalizedUrl: string): string {
  const lower = normalizedUrl.toLowerCase()
  const origin = extractOrigin(normalizedUrl)

  const twitterPrefix = '/twitter/user/'
  const xPrefix = '/x/user/'
  const twitterIndex = lower.indexOf(twitterPrefix)
  const xIndex = lower.indexOf(xPrefix)
  if (twitterIndex >= 0 || xIndex >= 0) {
    const prefix = twitterIndex >= 0 ? twitterPrefix : xPrefix
    const start = (twitterIndex >= 0 ? twitterIndex : xIndex) + prefix.length
    const handle = decodeSegment(normalizedUrl.slice(start).split('/')[0]).replace(/^@+/, '')
    return `https://x.com/${handle}`
  }

  const instagramPrefix = '/instagram/user/'
  const picnobPrefix = '/picnob/user/'
  const instagramIndex = lower.indexOf(instagramPrefix)
  const picnobIndex = lower.indexOf(picnobPrefix)
  if (instagramIndex >= 0 || picnobIndex >= 0) {
    const prefix = instagramIndex >= 0 ? instagramPrefix : picnobPrefix
    const start = (instagramIndex >= 0 ? instagramIndex : picnobIndex) + prefix.length
    const handle = decodeSegment(normalizedUrl.slice(start).split('/')[0]).replace(/^@+/, '')
    return `https://www.instagram.com/${handle}/`
  }

  const youtubeChannelPrefix = '/youtube/channel/'
  const youtubeChannelIndex = lower.indexOf(youtubeChannelPrefix)
  if (youtubeChannelIndex >= 0) {
    const channelId = decodeSegment(normalizedUrl.slice(youtubeChannelIndex + youtubeChannelPrefix.length).split('/')[0])
    return `https://www.youtube.com/channel/${channelId}`
  }

  const youtubeUserPrefix = '/youtube/user/'
  const youtubeCPrefix = '/youtube/c/'
  const youtubeUserIndex = lower.indexOf(youtubeUserPrefix)
  const youtubeCIndex = lower.indexOf(youtubeCPrefix)
  if (youtubeUserIndex >= 0 || youtubeCIndex >= 0) {
    const prefix = youtubeUserIndex >= 0 ? youtubeUserPrefix : youtubeCPrefix
    const handle = decodeSegment(normalizedUrl.slice((youtubeUserIndex >= 0 ? youtubeUserIndex : youtubeCIndex) + prefix.length).split('/')[0]).replace(/^@+/, '')
    return `https://www.youtube.com/@${handle}`
  }

  const bilibiliVideoPrefix = '/bilibili/user/video/'
  const bilibiliDynamicPrefix = '/bilibili/user/dynamic/'
  const bilibiliVideoIndex = lower.indexOf(bilibiliVideoPrefix)
  const bilibiliDynamicIndex = lower.indexOf(bilibiliDynamicPrefix)
  if (bilibiliVideoIndex >= 0 || bilibiliDynamicIndex >= 0) {
    const prefix = bilibiliVideoIndex >= 0 ? bilibiliVideoPrefix : bilibiliDynamicPrefix
    const uid = normalizedUrl.slice((bilibiliVideoIndex >= 0 ? bilibiliVideoIndex : bilibiliDynamicIndex) + prefix.length).split('/')[0]
    return `https://space.bilibili.com/${uid}`
  }

  if (lower.includes('/github/trending/')) {
    return 'https://github.com/trending'
  }

  if (lower.includes('/hackernews')) {
    return 'https://news.ycombinator.com'
  }

  if (lower.includes('youtube.com/feeds/videos.xml')) {
    return 'https://www.youtube.com'
  }

  return origin || normalizedUrl
}

function buildBuiltinFeeds(
  view: FeedViewType,
  seeds: DiscoverBuiltinFeedSeed[],
  sourceKey: DiscoverBuiltinFeedSourceKey = '',
): DiscoverBuiltinFeed[] {
  return seeds.map((seed: DiscoverBuiltinFeedSeed): DiscoverBuiltinFeed => {
    const normalizedUrl = normalizeBuiltinFeedUrl(seed.url)
    return {
      title: seed.title,
      url: normalizedUrl,
      siteUrl: resolveBuiltinFeedSiteUrl(normalizedUrl),
      description: '',
      view,
      category: sourceKey ? '内置-Ins' : '内置',
      sourceKey,
    }
  })
}

export const BUILTIN_DISCOVER_FEEDS_BY_VIEW: DiscoverBuiltinFeedViewMap = {
  articles: buildBuiltinFeeds(FeedViewType.Articles, [
    { title: "a16z Podcast", url: "https://feeds.simplecast.com/JGE3yC0V", language: "English" },
    { title: "Cal Newport", url: "https://calnewport.com/feed/", language: "English" },
    { title: "Collab Fund", url: "http://feeds.feedburner.com/collabfund", language: "English" },
    { title: "Derek Sivers blog", url: "https://sive.rs/en.atom", language: "English" },
    { title: "IGN Articles", url: "https://www.ign.com/rss/articles/feed?tags=games", language: "English" },
    { title: "International homepage", url: "https://www.ft.com/rss/home", language: "English" },
    { title: "LessWrong", url: "https://www.lesswrong.com/feed.xml?view=curated-rss", language: "English" },
    { title: "Marginal REVOLUTION", url: "https://marginalrevolution.com/feed", language: "English" },
    { title: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", language: "English" },
    { title: "Mr. Money Mustache", url: "https://feeds.feedburner.com/mrmoneymustache", language: "English" },
    { title: "Nautilus", url: "https://nautil.us/feed/", language: "English" },
    { title: "Obsidian Changelog", url: "https://obsidian.md/changelog.xml", language: "English" },
    { title: "Paul Graham - Essays", url: "rsshub://paulgraham/articles", language: "English" },
    { title: "Peter Attia", url: "https://peterattiamd.com/feed/", language: "English" },
    { title: "Research & Insights", url: "https://www.bridgewater.com/research-and-insights.rss", language: "English" },
    { title: "RSSHub has new routes", url: "rsshub://rsshub/routes", language: "English" },
    { title: "TechCrunch", url: "https://techcrunch.com/feed/", language: "English" },
    { title: "The Memo by Howard Marks", url: "https://rss.art19.com/the-memo-by-howard-marks", language: "English" },
    { title: "The Verge", url: "https://www.theverge.com/rss/index.xml", language: "English" },
    { title: "WIRED", url: "https://www.wired.com/feed/rss", language: "English" },
    { title: "New Cryptocurrency Listing", url: "rsshub://binance/announcement/new-cryptocurrency-listing", language: "English" },
    { title: "Epic Games Store - Free Games", url: "rsshub://epicgames/freegames/en-US/US", language: "English" },
    { title: "IMDb Top 250 Movies", url: "rsshub://imdb/chart/top", language: "English" },
    { title: "Bloomberg New", url: "https://bloombergnew.buzzing.cc/feed.xml", language: "English" },
    { title: "Sam Altman", url: "https://blog.samaltman.com/posts.atom", language: "English" },
    { title: "少数派", url: "rsshub://sspai/index", language: "Chinese" },
    { title: "小众软件", url: "https://feeds.appinn.com/appinns/", language: "Chinese" },
    { title: "财新网 - 最新文章", url: "rsshub://caixin/latest", language: "Chinese" },
    { title: "阮一峰的网络日志", url: "https://feeds.feedburner.com/ruanyifeng", language: "Chinese" },
    { title: "潮流周刊", url: "https://weekly.tw93.fun/rss.xml", language: "Chinese" },
    { title: "Hi, DIYgod", url: "https://diygod.cc/feed", language: "Chinese" },
    { title: "简书首页", url: "rsshub://jianshu/home", language: "Chinese" },
    { title: "张小珺Jùn｜商业访谈录", url: "https://feed.xyzfm.space/dk4yh3pkpjp3", language: "Chinese" },
    { title: "迷因电波", url: "rsshub://xiaoyuzhou/podcast/61d52b3bee197a3aac3dac44", language: "Chinese" },
    { title: "金十数据", url: "rsshub://jin10", language: "Chinese" },
    { title: "介绍 on SuperTechFans", url: "https://www.supertechfans.com/cn/index.xml", language: "Chinese" },
    { title: "异次元软件世界", url: "https://feed.iplaysoft.com/", language: "Chinese" },
    { title: "知乎每日精选", url: "https://www.zhihu.com/rss", language: "Chinese" },
    { title: "爱范儿", url: "https://www.ifanr.com/feed", language: "Chinese" },
    { title: "IT之家", url: "https://www.ithome.com/rss/", language: "Chinese" },
    { title: "美团技术团队", url: "https://tech.meituan.com/feed/", language: "Chinese" },
    { title: "宝玉的分享", url: "https://s.baoyu.io/feed.xml", language: "Chinese" },
    { title: "Pseudoyu", url: "https://www.pseudoyu.com/zh/index.xml", language: "Chinese" },
    { title: "老胡的周刊", url: "https://weekly.howie6879.com/rss/rss.xml", language: "Chinese" },
    { title: "Owen的博客", url: "https://www.owenyoung.com/atom.xml", language: "Chinese" },
    { title: "有知有行 - 全部", url: "rsshub://youzhiyouxing/materials/0", language: "Chinese" },
    { title: "奇客Solidot", url: "https://www.solidot.org/index.rss", language: "Chinese" },
    { title: "月光博客", url: "https://www.williamlong.info/rss.xml", language: "Chinese" },
    { title: "少数派 - 派早报", url: "https://feeds.feedburner.com/sspai/paizaobao", language: "Chinese" },
    { title: "InfoQ 推荐", url: "rsshub://infoq/recommend", language: "Chinese" },
    { title: "HelloGitHub 月刊", url: "https://hellogithub.com/rss", language: "Chinese" },
    { title: "太隐", url: "https://wangyurui.com/feed.xml", language: "Chinese" },
    { title: "Decohack", url: "https://decohack.com/feed/", language: "English" },
    { title: "Tw93 Blog", url: "https://tw93.fun/feed.xml", language: "Chinese" },
    { title: "Randy's Blog", url: "https://lutaonan.com/rss.xml", language: "Chinese" },
    { title: "McKinsey Greater China - 洞见", url: "rsshub://mckinsey/cn/25", language: "Chinese" },
    { title: "机核", url: "https://www.gcores.com/rss", language: "Chinese" },
    { title: "小众软件", url: "https://www.appinn.com/feed/", language: "Chinese" },
    { title: "站酷总榜设计", url: "rsshub://zcool/top/design", language: "Chinese" },
    { title: "让小产品的独立变现更简单", url: "https://www.ezindie.com/feed/rss.xml", language: "Chinese" },
    { title: "专题报告 - AI量化知识库", url: "rsshub://bigquant/collections", language: "Chinese" },
    { title: "AIGC Weekly", url: "https://quaily.com/op7418/feed/atom", language: "Chinese" },
    { title: "槿呈Goidea", url: "https://justgoidea.com/rss.xml", language: "Chinese" },
    { title: "云风的 BLOG", url: "https://blog.codingnow.com/atom.xml", language: "Chinese" },
    { title: "Readhub - 每日早报", url: "rsshub://readhub/daily", language: "Chinese" },
    { title: "印记", url: "https://yinji.org/feed", language: "Chinese" },
    { title: "酷壳 – CoolShell", url: "https://coolshell.cn/feed", language: "Chinese" },
    { title: "理想生活实验室", url: "https://www.toodaylab.com/feed", language: "Chinese" },
    { title: "BMPI", url: "https://www.bmpi.dev/index.xml", language: "Chinese" },
    { title: "LINUX DO - 最新话题", url: "https://linux.do/latest.rss", language: "Chinese" },
    { title: "Another Dayu", url: "https://anotherdayu.com/feed/", language: "Chinese" },
    { title: "热帖 - 雪球", url: "rsshub://xueqiu/hots", language: "Chinese" },
    { title: "张鑫旭-鑫空间-鑫生活", url: "https://www.zhangxinxu.com/wordpress/feed/", language: "Chinese" },
    { title: "发现频道 - 小众软件官方论坛", url: "https://meta.appinn.net/c/faxian/10.rss", language: "Chinese" },
    { title: "知乎日报", url: "https://feedx.net/rss/zhihudaily.xml", language: "Chinese" },
    { title: "Mac玩儿法", url: "https://www.waerfa.com/feed", language: "Chinese" },
    { title: "1Link.Fun 科技周刊", url: "https://1link.fun/rss/", language: "Chinese" },
    { title: "CatCoding", url: "https://catcoding.me/atom.xml", language: "Chinese" },
    { title: "晚点 - 最新报道", url: "rsshub://latepost", language: "Chinese" },
    { title: "编程随想的博客", url: "https://feeds2.feedburner.com/programthink", language: "Chinese" },
    { title: "草榴社区 - 技术讨论区", url: "rsshub://t66y/7", language: "Chinese" },
    { title: "二丫讲梵", url: "https://wiki.eryajf.net/rss.xml", language: "Chinese" },
    { title: "椒盐豆豉", url: "https://blog.douchi.space/index.xml", language: "Chinese" },
    { title: "Airing 的博客", url: "https://blog.ursb.me/feed.xml", language: "English" },
    { title: "澎湃新闻 - 首页头条", url: "rsshub://thepaper/featured", language: "Chinese" },
    { title: "卡瓦邦噶！", url: "https://www.kawabangga.com/feed", language: "Chinese" },
    { title: "61's life", url: "https://61.life/feed.xml", language: "Chinese" },
    { title: "36氪", url: "https://36kr.com/feed", language: "Chinese" },
    { title: "胡涂说", url: "https://hutusi.com/feed.xml", language: "Chinese" },
    { title: "纽约时报中文网 - 中英对照版", url: "rsshub://nytimes/dual", language: "English" },
    { title: "精品MAC应用分享", url: "https://xclient.info/feed/", language: "Chinese" },
    { title: "槽边往事", url: "https://www.hecaitou.com/feeds/posts/default", language: "English" },
    { title: "人民日报", url: "https://plink.anyfeeder.com/people-daily", language: "Chinese" },
    { title: "人人影视-今日播出", url: "rsshub://yyets/today", language: "Chinese" },
    { title: "CnGal - 每周速报", url: "rsshub://cngal/weekly", language: "Chinese" },
    { title: "虎嗅", url: "https://rss.huxiu.com/", language: "Chinese" },
    { title: "MacTalk-池建强的随想录", url: "https://macshuo.com/?feed=rss2", language: "Chinese" },
    { title: "電腦玩物", url: "http://feeds.feedburner.com/playpc", language: "Chinese" },
    { title: "见字如面", url: "https://hiwannz.com/feed", language: "Chinese" },
    { title: "拾月", url: "https://www.skyue.com/feed/", language: "Chinese" },
    { title: "#UNTAG", url: "https://rss.utgd.net/feed/", language: "Chinese" },
    { title: "积薪 - 文章", url: "https://darmau.co/zh/article/rss.xml", language: "Chinese" },
    { title: "如有乐享", url: "https://51.ruyo.net/feed", language: "Chinese" },
    { title: "王登科-DK博客", url: "https://greatdk.com/feed", language: "Chinese" },
    { title: "离别歌", url: "https://www.leavesongs.com/feed/", language: "Chinese" },
    { title: "我不是咕咕鸽", url: "https://blog.laoda.de/rss.xml", language: "Chinese" },
    { title: "知行小酒馆", url: "rsshub://xiaoyuzhou/podcast/6013f9f58e2f7ee375cf4216", language: "Chinese" },
    { title: "大破进击", url: "https://jesor.me/feed.xml", language: "Chinese" },
    { title: "子舒的博客", url: "https://zishu.me/index.xml", language: "Chinese" },
    { title: "奔跑中的奶酪", url: "https://www.runningcheese.com/feed", language: "Chinese" },
    { title: "OneV's Den", url: "https://onevcat.com/feed.xml", language: "Chinese" },
    { title: "KAIX.IN", url: "https://kaix.in/feed/", language: "Chinese" },
    { title: "每日一拍", url: "rsshub://500px/tribe/set/302261e93f0441c9a5323a565279b0e3", language: "Chinese" },
    { title: "少数派 -- Matrix", url: "rsshub://sspai/matrix", language: "Chinese" },
    { title: "Limboy's Essays", url: "https://limboy.me/index.xml", language: "Chinese" },
    { title: "Blog | Phodal - A Growth Engineer", url: "https://www.phodal.com/blog/feeds/rss/", language: "Chinese" },
    { title: "罗磊的独立博客", url: "https://luolei.org/feed/", language: "Chinese" },
    { title: "四火的唠叨", url: "https://www.raychase.net/feed", language: "Chinese" },
    { title: "华尔街日报", url: "https://feedx.net/rss/wsj.xml", language: "Chinese" },
    { title: "南方周末-新闻", url: "rsshub://infzm/2", language: "Chinese" },
    { title: "GeekPlux", url: "https://geekplux.com/feed.xml", language: "Chinese" },
    { title: "静かな森", url: "https://innei.in/feed", language: "English" },
    { title: "《联合早报》-中港台-即时", url: "rsshub://zaobao/realtime/china", language: "Chinese" },
    { title: "纵横四海", url: "rsshub://xiaoyuzhou/podcast/62694abdb221dd5908417d1e", language: "Chinese" },
    { title: "Elmagnifico's Blog", url: "https://elmagnifico.tech/feed.xml", language: "English" },
    { title: "游研社", url: "https://www.yystv.cn/rss/feed", language: "Chinese" },
    { title: "声动早咖啡", url: "rsshub://xiaoyuzhou/podcast/60de7c003dd577b40d5a40f3", language: "Chinese" },
    { title: "小球飞鱼", url: "https://mantyke.icu/index.xml", language: "Chinese" },
    { title: "书伴", url: "https://feeds.feedburner.com/bookfere", language: "Chinese" },
    { title: "有知有行 - 全部", url: "rsshub://youzhiyouxing/materials", language: "Chinese" },
    { title: "初之音", url: "https://www.himiku.com/feed/", language: "Chinese" },
    { title: "不死鸟 - 分享为王官网", url: "https://iui.su/feed/", language: "Chinese" },
    { title: "豌豆花下猫", url: "https://pythoncat.top/rss.xml", language: "Chinese" },
    { title: "酷安图文 - 编辑精选", url: "rsshub://coolapk/tuwen", language: "Chinese" },
    { title: "唐巧的博客", url: "https://blog.devtang.com/atom.xml", language: "Chinese" },
    { title: "卢昌海个人主页", url: "https://www.changhai.org/feed.xml", language: "Chinese" },
    { title: "The Verge", url: "https://www.theverge.com/rss/index.xml", language: "English" },
    { title: "吾爱破解论坛", url: "https://wechat2rss.xlab.app/feed/90c827b8290310a96ef80a13df9dbcc06ab69892.xml", language: "English" },
    { title: "晚晴幽草轩", url: "https://www.jeffjade.com/atom.xml", language: "Chinese" },
    { title: "ahhhhfs", url: "https://www.ahhhhfs.com/feed/", language: "Chinese" },
    { title: "木木木木木", url: "https://immmmm.com/atom.xml", language: "English" },
    { title: "laike9m's blog", url: "https://laike9m.com/blog/rss/", language: "Chinese" },
    { title: "豆瓣电影本周口碑榜", url: "https://feedx.net/rss/doubanmvweek.xml", language: "Chinese" },
    { title: "t9t.io", url: "https://blog.t9t.io/atom.xml", language: "Chinese" },
    { title: "月球背面", url: "https://moonvy.com/blog/rss.xml", language: "Chinese" },
    { title: "三联生活周刊", url: "https://plink.anyfeeder.com/weixin/lifeweek", language: "Chinese" },
    { title: "依云's Blog", url: "https://blog.lilydjwg.me/feed?code=c6f56c4214621ab98b86acbcae6b4405", language: "Chinese" },
    { title: "技术小黑屋", url: "https://droidyue.com/atom.xml", language: "Chinese" },
    { title: "笨方法学写作", url: "https://www.cnfeat.com/feed.xml", language: "Chinese" },
    { title: "数据发布 - 国家统计局", url: "rsshub://gov/stats/sj/zxfb", language: "Chinese" },
    { title: "Macin", url: "https://macin.org/atom.xml", language: "Chinese" },
    { title: "Epic Games Store - Free Games (CN)", url: "rsshub://epicgames/freegames/zh-CN/CN", language: "Chinese" },
    { title: "一天一篇经济学人(双语)", url: "https://plink.anyfeeder.com/weixin/Economist_fans", language: "Chinese" },
    { title: "少数派", url: "https://sspai.com/feed", language: "" },
    { title: "阮一峰的网络日志", url: "https://www.ruanyifeng.com/blog/atom.xml", language: "" },
    { title: "OpenAI News", url: "https://openai.com/news/rss.xml", language: "" },
    { title: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", language: "" },
    { title: "GitHub Changelog", url: "https://github.blog/changelog/feed/", language: "" },
    { title: "V2EX 技术", url: "https://www.v2ex.com/feed/tab/tech.xml", language: "" },
    { title: "simonwillison.net", url: "https://simonwillison.net/atom/everything/", language: "English" },
    { title: "jeffgeerling.com", url: "https://www.jeffgeerling.com/blog.xml", language: "English" },
    { title: "seangoedecke.com", url: "https://www.seangoedecke.com/rss.xml", language: "English" },
    { title: "krebsonsecurity.com", url: "https://krebsonsecurity.com/feed/", language: "English" },
    { title: "daringfireball.net", url: "https://daringfireball.net/feeds/main", language: "English" },
    { title: "ericmigi.com", url: "https://ericmigi.com/rss.xml", language: "English" },
    { title: "antirez.com", url: "http://antirez.com/rss", language: "English" },
    { title: "idiallo.com", url: "https://idiallo.com/feed.rss", language: "English" },
    { title: "maurycyz.com", url: "https://maurycyz.com/index.xml", language: "English" },
    { title: "pluralistic.net", url: "https://pluralistic.net/feed/", language: "English" },
    { title: "shkspr.mobi", url: "https://shkspr.mobi/blog/feed/", language: "English" },
    { title: "lcamtuf.substack.com", url: "https://lcamtuf.substack.com/feed", language: "English" },
    { title: "mitchellh.com", url: "https://mitchellh.com/feed.xml", language: "English" },
    { title: "dynomight.net", url: "https://dynomight.net/feed.xml", language: "English" },
    { title: "utcc.utoronto.ca/~cks", url: "https://utcc.utoronto.ca/~cks/space/blog/?atom", language: "English" },
    { title: "xeiaso.net", url: "https://xeiaso.net/blog.rss", language: "English" },
    { title: "devblogs.microsoft.com/oldnewthing", url: "https://devblogs.microsoft.com/oldnewthing/feed", language: "English" },
    { title: "righto.com", url: "https://www.righto.com/feeds/posts/default", language: "English" },
    { title: "lucumr.pocoo.org", url: "https://lucumr.pocoo.org/feed.atom", language: "English" },
    { title: "skyfall.dev", url: "https://skyfall.dev/rss.xml", language: "English" },
    { title: "garymarcus.substack.com", url: "https://garymarcus.substack.com/feed", language: "English" },
    { title: "rachelbythebay.com", url: "https://rachelbythebay.com/w/atom.xml", language: "English" },
    { title: "overreacted.io", url: "https://overreacted.io/rss.xml", language: "English" },
    { title: "timsh.org", url: "https://timsh.org/rss/", language: "English" },
    { title: "johndcook.com", url: "https://www.johndcook.com/blog/feed/", language: "English" },
    { title: "gilesthomas.com", url: "https://gilesthomas.com/feed/rss.xml", language: "English" },
    { title: "matklad.github.io", url: "https://matklad.github.io/feed.xml", language: "English" },
    { title: "derekthompson.org", url: "https://www.theatlantic.com/feed/author/derek-thompson/", language: "English" },
    { title: "evanhahn.com", url: "https://evanhahn.com/feed.xml", language: "English" },
    { title: "terriblesoftware.org", url: "https://terriblesoftware.org/feed/", language: "English" },
    { title: "rakhim.exotext.com", url: "https://rakhim.exotext.com/rss.xml", language: "English" },
    { title: "joanwestenberg.com", url: "https://joanwestenberg.com/rss", language: "English" },
    { title: "xania.org", url: "https://xania.org/feed", language: "English" },
    { title: "micahflee.com", url: "https://micahflee.com/feed/", language: "English" },
    { title: "nesbitt.io", url: "https://nesbitt.io/feed.xml", language: "English" },
    { title: "construction-physics.com", url: "https://www.construction-physics.com/feed", language: "English" },
    { title: "tedium.co", url: "https://feed.tedium.co/", language: "English" },
    { title: "susam.net", url: "https://susam.net/feed.xml", language: "English" },
    { title: "entropicthoughts.com", url: "https://entropicthoughts.com/feed.xml", language: "English" },
    { title: "buttondown.com/hillelwayne", url: "https://buttondown.com/hillelwayne/rss", language: "English" },
    { title: "dwarkesh.com", url: "https://www.dwarkeshpatel.com/feed", language: "English" },
    { title: "borretti.me", url: "https://borretti.me/feed.xml", language: "English" },
    { title: "wheresyoured.at", url: "https://www.wheresyoured.at/rss/", language: "English" },
    { title: "jayd.ml", url: "https://jayd.ml/feed.xml", language: "English" },
    { title: "minimaxir.com", url: "https://minimaxir.com/index.xml", language: "English" },
    { title: "geohot.github.io", url: "https://geohot.github.io/blog/feed.xml", language: "English" },
    { title: "paulgraham.com", url: "http://www.aaronsw.com/2002/feeds/pgessays.rss", language: "English" },
    { title: "filfre.net", url: "https://www.filfre.net/feed/", language: "English" },
    { title: "blog.jim-nielsen.com", url: "https://blog.jim-nielsen.com/feed.xml", language: "English" },
    { title: "dfarq.homeip.net", url: "https://dfarq.homeip.net/feed/", language: "English" },
    { title: "jyn.dev", url: "https://jyn.dev/atom.xml", language: "English" },
    { title: "geoffreylitt.com", url: "https://www.geoffreylitt.com/feed.xml", language: "English" },
    { title: "downtowndougbrown.com", url: "https://www.downtowndougbrown.com/feed/", language: "English" },
    { title: "brutecat.com", url: "https://brutecat.com/rss.xml", language: "English" },
    { title: "eli.thegreenplace.net", url: "https://eli.thegreenplace.net/feeds/all.atom.xml", language: "English" },
    { title: "abortretry.fail", url: "https://www.abortretry.fail/feed", language: "English" },
    { title: "fabiensanglard.net", url: "https://fabiensanglard.net/rss.xml", language: "English" },
    { title: "oldvcr.blogspot.com", url: "https://oldvcr.blogspot.com/feeds/posts/default", language: "English" },
    { title: "bogdanthegeek.github.io", url: "https://bogdanthegeek.github.io/blog/index.xml", language: "English" },
    { title: "hugotunius.se", url: "https://hugotunius.se/feed.xml", language: "English" },
    { title: "gwern.net", url: "https://gwern.substack.com/feed", language: "English" },
    { title: "berthub.eu", url: "https://berthub.eu/articles/index.xml", language: "English" },
    { title: "chadnauseam.com", url: "https://chadnauseam.com/rss.xml", language: "English" },
    { title: "simone.org", url: "https://simone.org/feed/", language: "English" },
    { title: "it-notes.dragas.net", url: "https://it-notes.dragas.net/feed/", language: "English" },
    { title: "beej.us", url: "https://beej.us/blog/rss.xml", language: "English" },
    { title: "hey.paris", url: "https://hey.paris/index.xml", language: "English" },
    { title: "danielwirtz.com", url: "https://danielwirtz.com/rss.xml", language: "English" },
    { title: "matduggan.com", url: "https://matduggan.com/rss/", language: "English" },
    { title: "refactoringenglish.com", url: "https://refactoringenglish.com/index.xml", language: "English" },
    { title: "worksonmymachine.substack.com", url: "https://worksonmymachine.substack.com/feed", language: "English" },
    { title: "philiplaine.com", url: "https://philiplaine.com/index.xml", language: "English" },
    { title: "steveblank.com", url: "https://steveblank.com/feed/", language: "English" },
    { title: "bernsteinbear.com", url: "https://bernsteinbear.com/feed.xml", language: "English" },
    { title: "danieldelaney.net", url: "https://danieldelaney.net/feed", language: "English" },
    { title: "troyhunt.com", url: "https://www.troyhunt.com/rss/", language: "English" },
    { title: "herman.bearblog.dev", url: "https://herman.bearblog.dev/feed/", language: "English" },
    { title: "tomrenner.com", url: "https://tomrenner.com/index.xml", language: "English" },
    { title: "blog.pixelmelt.dev", url: "https://blog.pixelmelt.dev/rss/", language: "English" },
    { title: "martinalderson.com", url: "https://martinalderson.com/feed.xml", language: "English" },
    { title: "danielchasehooper.com", url: "https://danielchasehooper.com/feed.xml", language: "English" },
    { title: "chiark.greenend.org.uk/~sgtatham", url: "https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/feed.xml", language: "English" },
    { title: "grantslatton.com", url: "https://grantslatton.com/rss.xml", language: "English" },
    { title: "experimental-history.com", url: "https://www.experimental-history.com/feed", language: "English" },
    { title: "anildash.com", url: "https://anildash.com/feed.xml", language: "English" },
    { title: "aresluna.org", url: "https://aresluna.org/main.rss", language: "English" },
    { title: "michael.stapelberg.ch", url: "https://michael.stapelberg.ch/feed.xml", language: "English" },
    { title: "miguelgrinberg.com", url: "https://blog.miguelgrinberg.com/feed", language: "English" },
    { title: "keygen.sh", url: "https://keygen.sh/blog/feed.xml", language: "English" },
    { title: "mjg59.dreamwidth.org", url: "https://mjg59.dreamwidth.org/data/rss", language: "English" },
    { title: "computer.rip", url: "https://computer.rip/rss.xml", language: "English" },
    { title: "tedunangst.com", url: "https://www.tedunangst.com/flak/rss", language: "English" },
  ]),
  social: buildBuiltinFeeds(FeedViewType.SocialMedia, [
    { title: "Hacker News", url: "rsshub://hackernews", language: "English" },
    { title: "Product Hunt", url: "https://www.producthunt.com/feed", language: "English" },
    { title: "Trending repositories on GitHub this week", url: "rsshub://github/trending/weekly/any", language: "English" },
    { title: "Trending repositories on GitHub today", url: "rsshub://github/trending/daily/any", language: "English" },
    { title: "David Sinclair - X", url: "rsshub://twitter/user/davidasinclair", language: "English" },
    { title: "Elon Musk - X", url: "rsshub://twitter/user/elonmusk", language: "English" },
    { title: "Follow - X", url: "rsshub://twitter/user/folo_is", language: "English" },
    { title: "James Clear - X", url: "rsshub://twitter/user/JamesClear", language: "English" },
    { title: "Stock Edge", url: "rsshub://stockedge/daily-updates/news", language: "English" },
    { title: "Bloomberg - News", url: "rsshub://bloomberg/%2F", language: "English" },
    { title: "AInvest - Latest News", url: "rsshub://ainvest/news", language: "English" },
    { title: "GQ", url: "rsshub://gq/news", language: "English" },
    { title: "知乎热榜 - 全站", url: "rsshub://zhihu/hot/total", language: "Chinese" },
    { title: "V2EX-最热主题", url: "rsshub://v2ex/topics/hot", language: "Chinese" },
    { title: "V2EX-最新主题", url: "rsshub://v2ex/topics/latest", language: "Chinese" },
    { title: "bilibili 排行榜-全站 - Bilibili", url: "rsshub://bilibili/ranking/0", language: "Chinese" },
    { title: "DIYgod - X", url: "rsshub://twitter/user/DIYgod", language: "Chinese" },
    { title: "实时财经快讯 - FastBull", url: "rsshub://fastbull/express-news", language: "Chinese" },
    { title: "格隆汇快讯", url: "rsshub://gelonghui/live", language: "Chinese" },
    { title: "深潮TechFlow - 快讯", url: "rsshub://techflowpost/express", language: "Chinese" },
    { title: "TheBlockBeats - 快讯", url: "rsshub://theblockbeats/newsflash/0", language: "Chinese" },
    { title: "律动BlockBeats", url: "https://api.theblockbeats.news/v1/open-api/home-xml", language: "Chinese" },
    { title: "36氪 - 24小时热榜", url: "rsshub://36kr/hot-list", language: "Chinese" },
    { title: "奇客的资讯，重要的东西", url: "rsshub://solidot/www", language: "Chinese" },
    { title: "资讯列表 - 人人影视", url: "rsshub://yyets/article/all", language: "Chinese" },
    { title: "科技圈在花频道 - Telegram Channel", url: "rsshub://telegram/channel/TestFlightCN", language: "Chinese" },
    { title: "竹新社 - Telegram Channel", url: "rsshub://telegram/channel/tnews365", language: "Chinese" },
    { title: "分享创造日报", url: "https://v2ex-create.nexmm.com/rss.xml", language: "Chinese" },
    { title: "金色财经 - 全部", url: "rsshub://jinse/lives/0", language: "Chinese" },
    { title: "7x24小时快讯", url: "rsshub://fx678/kx", language: "Chinese" },
    { title: "V2EX", url: "https://www.v2ex.com/index.xml", language: "Chinese" },
    { title: "ahhhhfs｜A姐分享 - Telegram Channel", url: "rsshub://telegram/channel/abskoop", language: "Chinese" },
    { title: "小声逼逼 - Telegram Channel", url: "rsshub://telegram/channel/me888888888888", language: "Chinese" },
    { title: "阿里、夸克、百度等网盘4K影视资源 - Telegram Channel", url: "rsshub://telegram/channel/Aliyun_4K_Movies", language: "Chinese" },
    { title: "社群 - 韭研公社", url: "rsshub://jiuyangongshe/community", language: "Chinese" },
    { title: "阿里云盘吧 - Telegram Channel", url: "rsshub://telegram/channel/Q66Share", language: "Chinese" },
    { title: "阿里云盘发布频道 - Telegram Channel", url: "rsshub://telegram/channel/shareAliyun", language: "Chinese" },
    { title: "一觉醒来发生了什么 - 即刻圈子", url: "rsshub://jike/topic/553870e8e4b0cafb0a1bef68", language: "Chinese" },
    { title: "Follow - X", url: "rsshub://twitter/user/folo_is", language: "English" },
    { title: "即刻精选 - Telegram Channel", url: "rsshub://telegram/channel/jike_collection", language: "Chinese" },
    { title: "cnBeta.COM - 中文业界资讯站", url: "rsshub://cnbeta", language: "Chinese" },
    { title: "36氪资讯热榜", url: "https://feeds.feedburner.com/36kr/hot-list", language: "Chinese" },
    { title: "宝玉 - X", url: "rsshub://twitter/user/dotey", language: "English" },
    { title: "风向旗参考快讯 - Telegram Channel", url: "rsshub://telegram/channel/xhqcankao", language: "Chinese" },
    { title: "掘金本周最热", url: "https://rsshub.bestblogs.dev/juejin/trending/all/weekly", language: "Chinese" },
    { title: "分享创造", url: "https://www.v2ex.com/feed/create.xml", language: "Chinese" },
    { title: "V2EX - 创意", url: "https://www.v2ex.com/feed/tab/creative.xml", language: "Chinese" },
    { title: "Yu's Life - Telegram Channel", url: "rsshub://telegram/channel/pseudoyulife", language: "Chinese" },
    { title: "Hacker News", url: "https://hnrss.org/frontpage", language: "" },
    { title: "Lobsters", url: "https://lobste.rs/rss", language: "" },
    { title: "老番茄 - Bilibili", url: "https://rsshub.pseudoyu.com/bilibili/user/dynamic/546195", language: "" },
    { title: "OpenAI - X", url: "https://rsshub.pseudoyu.com/twitter/user/openai", language: "" },
    { title: "GitHub - X", url: "https://rsshub.pseudoyu.com/twitter/user/github", language: "" },
    { title: "verge - X", url: "https://rsshub.pseudoyu.com/twitter/user/verge", language: "" },
    { title: "Figma - X", url: "https://rsshub.pseudoyu.com/twitter/user/figma", language: "" },
    { title: "MiniMax (official)", url: "https://rsshub.pseudoyu.com/twitter/user/minimax_ai", language: "" },
    { title: "Z.ai", url: "https://rsshub.pseudoyu.com/twitter/user/zai_org", language: "" },
    { title: "Elon Musk", url: "https://rsshub.pseudoyu.com/twitter/user/elonmusk", language: "" },
    { title: "DAN KOE", url: "https://rsshub.pseudoyu.com/twitter/user/thedankoe", language: "" },
    { title: "DeepSeek", url: "https://rsshub.pseudoyu.com/twitter/user/deepseek_ai", language: "" },
    { title: "Andrej Karpathy", url: "https://rsshub.pseudoyu.com/twitter/user/karpathy", language: "" },
    { title: "Greg Brockman", url: "https://rsshub.pseudoyu.com/twitter/user/gdb", language: "" },
    { title: "Sam Altman", url: "https://rsshub.pseudoyu.com/twitter/user/sama", language: "" },
  ]),
  pictures: buildBuiltinFeeds(FeedViewType.Pictures, [
    { title: "NASA Astronomy Picture of the Day", url: "rsshub://nasa/apod", language: "English" },
    { title: "Nat Geo Photo of the Day", url: "rsshub://natgeo/dailyphoto", language: "English" },
    { title: "每日一图-北京天文馆", url: "rsshub://bjp/apod", language: "Chinese" },
    { title: "Nat Geo Photo of the Day", url: "rsshub://natgeo/dailyphoto", language: "English" },
    { title: "爱范儿", url: "https://www.ifanr.com/feed", language: "" },
    { title: "NASA Image of the Day", url: "https://www.nasa.gov/feeds/iotd-feed/", language: "" },
    { title: "Astronomy Picture of the Day", url: "https://apod.nasa.gov/apod.rss", language: "" },
    { title: "NASA - Instagram", url: "https://rsshub.pseudoyu.com/instagram/user/nasa", language: "" },
    { title: "National Geographic - Instagram", url: "https://rsshub.pseudoyu.com/instagram/user/natgeo", language: "" },
    { title: "Figma - Instagram", url: "https://rsshub.pseudoyu.com/instagram/user/figma", language: "" },
    { title: "Google - Instagram", url: "https://rsshub.pseudoyu.com/instagram/user/google", language: "" },
  ]),
  videos: buildBuiltinFeeds(FeedViewType.Videos, [
    { title: "Andrew Huberman - YouTube", url: "rsshub://youtube/user/@hubermanlab", language: "English" },
    { title: "Lex Fridman - YouTube", url: "rsshub://youtube/user/%40lexfridman", language: "English" },
    { title: "Marques Brownlee - YouTube", url: "rsshub://youtube/user/@mkbhd", language: "English" },
    { title: "Sabine Hossenfelder - YouTube", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC1yNl2E66ZzKApQdRuTQ4tw", language: "English" },
    { title: "TED Talks Daily", url: "https://feeds.acast.com/public/shows/67587e77c705e441797aff96", language: "English" },
    { title: "小Lin说 - YouTube", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCilwQlk62k1z7aUEZPOB6yw", language: "Chinese" },
    { title: "胡子观币 - YouTube", url: "rsshub://youtube/user/%40huziguanbi", language: "Chinese" },
    { title: "影视飓风 的 bilibili 空间 - Bilibili", url: "rsshub://bilibili/user/video/946974", language: "Chinese" },
    { title: "小Lin说 - YouTube", url: "rsshub://youtube/user/%40xiao_lin_shuo", language: "Chinese" },
    { title: "王志安 - YouTube", url: "rsshub://youtube/user/%40wangzhian", language: "Chinese" },
    { title: "Mediastorm影视飓风 - YouTube", url: "rsshub://youtube/user/%40mediastorm6801", language: "Chinese" },
    { title: "极客湾Geekerwan 的 bilibili 空间 - Bilibili", url: "rsshub://bilibili/user/video/25876945", language: "Chinese" },
    { title: "不良林 - YouTube", url: "rsshub://youtube/user/%40bulianglin", language: "Chinese" },
    { title: "老高與小茉 Mr & Mrs Gao - YouTube", url: "rsshub://youtube/user/%40laogao", language: "Chinese" },
    { title: "TED Talks Daily", url: "https://feeds.feedburner.com/TEDTalks_audio", language: "" },
    { title: "NPR Video", url: "https://feeds.npr.org/1004/rss.xml", language: "" },
    { title: "OpenAI - YouTube", url: "https://rsshub.pseudoyu.com/youtube/channel/UCXZCJLdBC09xxGZ6gcdrc6A", language: "" },
    { title: "Google Developers - YouTube", url: "https://rsshub.pseudoyu.com/youtube/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw", language: "" },
    { title: "Fireship - YouTube", url: "https://rsshub.pseudoyu.com/youtube/channel/UC2Xd-TjJByJyK2w1zNwY0zQ", language: "" },
    { title: "Veritasium - YouTube", url: "https://rsshub.pseudoyu.com/youtube/channel/UCHnyfMqiRRG1u-2MsSQLbXA", language: "" },
    { title: "罗翔说刑法 - Bilibili", url: "https://rsshub.pseudoyu.com/bilibili/user/video/517327498", language: "" },
    { title: "影视飓风 - Bilibili", url: "https://rsshub.pseudoyu.com/bilibili/user/video/946974", language: "" },
    { title: "老师好我叫何同学 - Bilibili", url: "https://rsshub.pseudoyu.com/bilibili/user/video/163637592", language: "" },
    { title: "Google for Developers - YouTube", url: "https://rsshub.liumingye.cn/youtube/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw", language: "" },
    { title: "Dan Koe - YouTube", url: "https://rsshub.liumingye.cn/youtube/channel/UCWXYDYv5STLk-zoxMP2I1Lw", language: "" },
    { title: "Beyond Fireship - YouTube", url: "https://rsshub.ktachibana.party/youtube/channel/UC2Xd-TjJByJyK2w1zNwY0zQ", language: "" },
  ]),
  ins: buildBuiltinFeeds(FeedViewType.Pictures, [
    { title: "YUQI", url: "https://rsshub.liumingye.cn/picnob/user/yuqisong.923", language: "" },
    { title: "SOYEON / 전소연", url: "https://rsshub.liumingye.cn/picnob/user/tiny.pretty.j", language: "" },
    { title: "NewJeans", url: "https://rsshub.liumingye.cn/picnob/user/newjeans_official", language: "" },
    { title: "JIHYO", url: "https://rsshub.liumingye.cn/picnob/user/_zyozyo", language: "" },
    { title: "ROSÉ", url: "https://rsshub.liumingye.cn/picnob/user/roses_are_rosie", language: "" },
    { title: "김예림 🪽 yeri", url: "https://rsshub.liumingye.cn/picnob/user/yerimiese", language: "" },
    { title: "안유진 AN YUJIN", url: "https://rsshub.liumingye.cn/picnob/user/_yujin_an", language: "" },
    { title: "Wendy", url: "https://rsshub.liumingye.cn/picnob/user/todayis_wendy", language: "" },
    { title: "Sakura Miyawaki", url: "https://rsshub.liumingye.cn/picnob/user/39saku_chan", language: "" },
    { title: "HUH YUNJIN", url: "https://rsshub.liumingye.cn/picnob/user/jenaissante", language: "" },
    { title: "김채원 (CHAEWON)", url: "https://rsshub.liumingye.cn/picnob/user/_chaechae_1", language: "" },
    { title: "이서 LEESEO", url: "https://rsshub.liumingye.cn/picnob/user/eeseooes", language: "" },
    { title: "HONG EUNCHAE", url: "https://rsshub.liumingye.cn/picnob/user/hhh.e_c.v", language: "" },
    { title: "나연 (NAYEON)", url: "https://rsshub.liumingye.cn/picnob/user/nayeonyny", language: "" },
    { title: "리즈 LIZ", url: "https://rsshub.liumingye.cn/picnob/user/liz.yeyo", language: "" },
    { title: "JISOO🪐", url: "https://rsshub.liumingye.cn/picnob/user/sooyaaa__", language: "" },
    { title: "WINTER", url: "https://rsshub.liumingye.cn/picnob/user/imwinter", language: "" },
    { title: "Joy", url: "https://rsshub.liumingye.cn/picnob/user/_imyour_joy", language: "" },
    { title: "쯔위 (TZUYU)", url: "https://rsshub.liumingye.cn/picnob/user/thinkaboutzu", language: "" },
    { title: "MINNIE", url: "https://rsshub.pseudoyu.com/picnob/user/min.nicha", language: "" },
    { title: "YUNA", url: "https://rsshub.pseudoyu.com/picnob/user/igotyuandme", language: "" },
    { title: "LIA", url: "https://rsshub.pseudoyu.com/picnob/user/lia_loves___", language: "" },
    { title: "IRENE", url: "https://rsshub.liumingye.cn/picnob/user/renebaebae", language: "" },
    { title: "슬기 Seulgi", url: "https://rsshub.rssforever.com/picnob/user/hi_sseulgi", language: "" },
    { title: "장원영 WONYOUNG", url: "https://rsshub.rssforever.com/picnob/user/for_everyoung10", language: "" },
    { title: "YEJI", url: "https://rsshub.liumingye.cn/picnob/user/yezyizhere", language: "" },
    { title: "MIYEON / 미연", url: "https://rsshub.liumingye.cn/picnob/user/noodle.zip", language: "" },
    { title: "다현 (DAHYUN)", url: "https://rsshub.liumingye.cn/picnob/user/dahhyunnee", language: "" },
    { title: "KAZUHA", url: "https://rsshub.pseudoyu.com/picnob/user/zuhazana", language: "" },
    { title: "사나 𝚂𝚊𝚗𝚊", url: "https://rsshub.liumingye.cn/picnob/user/m.by__sana", language: "" },
    { title: "鞠婧祎 ju jingyi", url: "https://rsshub.liumingye.cn/picnob/user/jujingyi_kikuuu", language: "" },
    { title: "BABYMONSTER PHARITA (파리타)", url: "https://rsshub.ktachibana.party/picnob/user/pharitas.babymonsters", language: "" },
    { title: "陈都灵", url: "https://rsshub.liumingye.cn/picnob/user/du_chenduling", language: "" },
    { title: "모모 (MOMO)", url: "https://rsshub.ktachibana.party/picnob/user/momo", language: "" },
    { title: "nana", url: "https://rsshub.liumingye.cn/picnob/user/nanaouyang", language: "" },
    { title: "LISA", url: "https://rsshub.ktachibana.party/picnob/user/lalalalisa_m", language: "" },
    { title: "Shuhua", url: "https://rsshub.ktachibana.party/picnob/user/yeh.shaa_", language: "" },
    { title: "周也 Zhou Ye", url: "https://rsshub.ktachibana.party/picnob/user/yeahzhoou", language: "" },
    { title: "BABYMONSTER ASA (아사) FANPAGE", url: "https://rsshub.ktachibana.party/picnob/user/asa__babymonsters", language: "" },
    { title: "J", url: "https://rsshub.liumingye.cn/picnob/user/jennierubyjane", language: "" },
    { title: "KARINA", url: "https://rsshub.liumingye.cn/picnob/user/katarinabluu", language: "" },
    { title: "BABYMONSTER AHYEON (정아현)", url: "https://rsshub.ktachibana.party/picnob/user/ahyeon_babymoster", language: "" },
    { title: "미나 (MINA)", url: "https://rsshub.ktachibana.party/picnob/user/mina_sr_my", language: "" },
    { title: "레이 REI", url: "https://rsshub.pseudoyu.com/picnob/user/reinyourheart", language: "" },
    { title: "가을 GAEUL", url: "https://rsshub.pseudoyu.com/picnob/user/fallingin__fall", language: "" },
    { title: "정연 (JEONGYEON)", url: "https://rsshub.pseudoyu.com/picnob/user/jy_piece", language: "" },
    { title: "CHAERYEONG", url: "https://rsshub.pseudoyu.com/picnob/user/chaerrry0", language: "" },
    { title: "채영 CHAEYOUNG", url: "https://rsshub.pseudoyu.com/picnob/user/chaeyo.0", language: "" },
    { title: "BABYMONSTER RUKA 루카 𝘒𝘢𝘮𝘢𝘭 𝘞𝘢𝘭𝘪𝘢", url: "https://rsshub.ktachibana.party/picnob/user/ruka.babymonstar", language: "" },
    { title: "NINGNING", url: "https://rsshub.liumingye.cn/picnob/user/imnotningning", language: "" },
    { title: "public posts", url: "https://rsshub.liumingye.cn/picnob/user/aerichandesu", language: "" },
    { title: "BABYMONSTER RAMI (라미) FANPAGE", url: "https://rsshub.liumingye.cn/picnob/user/rami.babymonster", language: "" },
  ], 'ins'),
}

export function builtinDiscoverFeedsByView(view: FeedViewType): DiscoverBuiltinFeed[] {
  switch (view) {
    case FeedViewType.SocialMedia:
      return BUILTIN_DISCOVER_FEEDS_BY_VIEW.social
    case FeedViewType.Pictures:
      return BUILTIN_DISCOVER_FEEDS_BY_VIEW.pictures
    case FeedViewType.Videos:
      return BUILTIN_DISCOVER_FEEDS_BY_VIEW.videos
    default:
      return BUILTIN_DISCOVER_FEEDS_BY_VIEW.articles
  }
}

export function builtinDiscoverFeedsBySourceKey(sourceKey: DiscoverBuiltinFeedSourceKey): DiscoverBuiltinFeed[] {
  if (sourceKey === 'ins') {
    return BUILTIN_DISCOVER_FEEDS_BY_VIEW.ins
  }
  return []
}

export function builtinDiscoverFeedsAll(): DiscoverBuiltinFeed[] {
  return [
    ...BUILTIN_DISCOVER_FEEDS_BY_VIEW.articles,
    ...BUILTIN_DISCOVER_FEEDS_BY_VIEW.social,
    ...BUILTIN_DISCOVER_FEEDS_BY_VIEW.pictures,
    ...BUILTIN_DISCOVER_FEEDS_BY_VIEW.videos,
    ...BUILTIN_DISCOVER_FEEDS_BY_VIEW.ins,
  ]
}
