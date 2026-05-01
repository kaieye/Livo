import http from '@ohos.net.http'

export class FeedDetailVideoPreviewService {
  static async fetchBilibiliPreviewUrl(videoUrl: string): Promise<string> {
    if (!videoUrl.toLowerCase().includes('bilibili.com')) {
      return ''
    }

    const bvid = videoUrl.match(/\/video\/(BV[a-zA-Z0-9]+)/i)?.[1] ?? ''
    if (!bvid) {
      return ''
    }

    const request = http.createHttp()
    try {
      const response = await request.request(
        `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: 5000,
          readTimeout: 5000,
          header: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json, text/plain, */*',
            'Referer': `https://www.bilibili.com/video/${bvid}`,
            'Origin': 'https://www.bilibili.com',
          },
        },
      )

      if (response.responseCode !== 200) {
        return ''
      }

      const payload = JSON.parse(String(response.result)) as Record<string, Object | string | number>
      const data = payload['data'] as Record<string, string> | undefined
      return typeof data?.['pic'] === 'string' ? data['pic'] : ''
    } catch (_) {
      return ''
    } finally {
      request.destroy()
    }
  }
}
