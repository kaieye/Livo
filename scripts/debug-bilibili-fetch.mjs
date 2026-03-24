import { app, BrowserWindow, session } from 'electron'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchOfficialDynamic(uid) {
  const apiUrl = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${encodeURIComponent(uid)}`
  try {
    const response = await session.defaultSession.fetch(apiUrl, {
      method: 'GET',
      headers: {
        Referer: `https://space.bilibili.com/${uid}/dynamic`,
        Origin: 'https://www.bilibili.com',
        Accept: 'application/json, text/plain, */*',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(20000),
    })
    const text = await response.text()
    return {
      ok: response.ok,
      status: response.status,
      sample: text.slice(0, 400),
    }
  } catch (error) {
    return { ok: false, status: 0, error: String(error) }
  }
}

async function scrapeVideoPage(uid) {
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 960,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
    },
  })

  try {
    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    win.webContents.setUserAgent(userAgent)
    await win.loadURL(
      `https://space.bilibili.com/${encodeURIComponent(uid)}/video`,
      {
        userAgent,
        httpReferrer: 'https://www.bilibili.com/',
      },
    )

    const result = await win.webContents.executeJavaScript(
      `(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const text = (value) => String(value || '').replace(/\\s+/g, ' ').trim()
        const abs = (value) => {
          const raw = String(value || '').trim()
          if (!raw) return ''
          if (/^https?:\\/\\//i.test(raw)) return raw
          if (raw.startsWith('//')) return 'https:' + raw
          if (raw.startsWith('/')) return 'https://www.bilibili.com' + raw
          return raw
        }
        const extract = () => {
          const anchors = Array.from(document.querySelectorAll('a[href*="/video/BV"]'))
          const titles = anchors
            .map((anchor) => ({
              href: abs(anchor.href || anchor.getAttribute('href')),
              title:
                text(anchor.getAttribute('title')) ||
                text(anchor.querySelector('[title]')?.getAttribute('title')) ||
                text(anchor.querySelector('.bili-video-card__info--tit, .title, .bili-cover-card__title, .video-name')?.textContent) ||
                text(anchor.textContent),
            }))
            .filter((item) => item.href && item.title)
          return {
            title: document.title,
            author:
              text(document.querySelector('.up-name, .h-name, .username')?.textContent) ||
              text(document.querySelector('title')?.textContent),
            count: titles.length,
            cards: titles.slice(0, 5),
            htmlLength: document.documentElement.outerHTML.length,
          }
        }
        let result = extract()
        for (let i = 0; i < 10; i += 1) {
          if (result.count > 0) return result
          window.scrollTo(0, document.body.scrollHeight)
          await wait(1000)
          result = extract()
        }
        return result
      })()`,
      true,
    )

    return result
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

async function main() {
  const uids = process.argv.slice(2)
  if (uids.length === 0) {
    console.log(
      'Usage: electron scripts/debug-bilibili-fetch.mjs <uid> [uid...]',
    )
    app.quit()
    return
  }

  for (const uid of uids) {
    const dynamic = await fetchOfficialDynamic(uid)
    const video = await scrapeVideoPage(uid)
    console.log(JSON.stringify({ uid, dynamic, video }, null, 2))
    await sleep(1000)
  }

  app.quit()
}

app
  .whenReady()
  .then(main)
  .catch((error) => {
    console.error(error)
    app.quit()
  })
