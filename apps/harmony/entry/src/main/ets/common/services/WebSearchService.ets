import { http } from '@kit.NetworkKit'
import {
  REQUEST_CONNECT_TIMEOUT_MS,
  REQUEST_READ_TIMEOUT_MS,
  BASIC_BROWSER_USER_AGENT,
  ACCEPT_HTML,
} from '../AppConfig'

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

const SEARCH_TIMEOUT_MS = 8000
const MAX_SEARCH_RESULTS = 8

/**
 * WebSearchService - 提供网络搜索能力
 * 
 * 使用 DuckDuckGo HTML 搜索（无需API key）
 * 备选：SearXNG 公共实例
 */
export class WebSearchService {
  /**
   * 执行网络搜索
   * @param query 搜索关键词
   * @returns 搜索结果列表
   */
  static async search(query: string): Promise<WebSearchResult[]> {
    const trimmed = query.trim()
    if (!trimmed) {
      return []
    }

    // 使用 DuckDuckGo HTML 搜索
    return WebSearchService.searchDuckDuckGo(trimmed)
  }

  /**
   * DuckDuckGo HTML 搜索实现
   */
  private static async searchDuckDuckGo(query: string): Promise<WebSearchResult[]> {
    const encodedQuery = encodeURIComponent(query)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`
    
    const request = http.createHttp()
    try {
      const response = await request.request(searchUrl, {
        method: http.RequestMethod.GET,
        connectTimeout: REQUEST_CONNECT_TIMEOUT_MS,
        readTimeout: SEARCH_TIMEOUT_MS,
        header: {
          'User-Agent': BASIC_BROWSER_USER_AGENT,
          'Accept': ACCEPT_HTML,
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        expectDataType: 1, // string
      })

      if (response.responseCode !== 200) {
        console.error('[WebSearch] DuckDuckGo failed:', response.responseCode)
        return []
      }

      const html = response.result as string
      return WebSearchService.parseDuckDuckGoHtml(html)
    } catch (error) {
      console.error('[WebSearch] DuckDuckGo error:', error)
      return []
    } finally {
      request.destroy()
    }
  }

  /**
   * 解析 DuckDuckGo HTML 搜索结果
   */
  private static parseDuckDuckGoHtml(html: string): WebSearchResult[] {
    const results: WebSearchResult[] = []
    
    // DuckDuckGo HTML 结果格式：
    // <div class="result__body">
    //   <a class="result__a" href="...">标题</a>
    //   <a class="result__snippet">摘要</a>
    // </div>
    
    const resultRegex = /<div[^>]*class="result__body"[^>]*>([\s\S]*?)<\/div>/g
    let resultMatch = resultRegex.exec(html)
    
    while (resultMatch && results.length < MAX_SEARCH_RESULTS) {
      const resultHtml = resultMatch[1]
      
      // 提取标题和链接
      const titleRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/
      const titleMatch = titleRegex.exec(resultHtml)
      
      if (titleMatch) {
        const url = titleMatch[1]
        const title = titleMatch[2].replace(/<[^>]*>/g, '').trim()
        
        // 提取摘要
        const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/
        const snippetMatch = snippetRegex.exec(resultHtml)
        const snippet = snippetMatch 
          ? snippetMatch[1].replace(/<[^>]*>/g, '').trim()
          : ''
        
        if (title && url) {
          results.push({ title, url, snippet })
        }
      }
      
      resultMatch = resultRegex.exec(html)
    }
    
    return results
  }

  /**
   * 格式化搜索结果为文本（供AI使用）
   */
  static formatResultsForAI(results: WebSearchResult[], query: string): string {
    if (results.length === 0) {
      return `搜索 "${query}" 未找到结果。`
    }

    let output = `搜索 "${query}" 的结果（共 ${results.length} 条）：\n\n`
    
    results.forEach((result, index) => {
      output += `${index + 1}. ${result.title}\n`
      output += `   链接: ${result.url}\n`
      if (result.snippet) {
        output += `   摘要: ${result.snippet}\n`
      }
      output += '\n'
    })
    
    return output
  }
}
