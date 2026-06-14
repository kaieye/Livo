// 临时调试脚本 - 监控 feeds 状态变化
console.log('[DEBUG] Checking feeds cache...')
const cached = localStorage.getItem('livo-feeds-cache')
if (cached) {
  try {
    const feeds = JSON.parse(cached)
    console.log('[DEBUG] localStorage cache has', feeds.length, 'feeds')
  } catch (e) {
    console.log('[DEBUG] localStorage cache parse error:', e)
  }
} else {
  console.log('[DEBUG] localStorage cache is empty')
}
