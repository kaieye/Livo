import { app, BrowserWindow } from 'electron'
const uid = process.argv[2] || '3546641441229141'
app
  .whenReady()
  .then(async () => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        javascript: true,
      },
    })
    try {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      win.webContents.setUserAgent(ua)
      await win.loadURL(`https://space.bilibili.com/${uid}/video`, {
        userAgent: ua,
        httpReferrer: 'https://www.bilibili.com/',
      })
      const result = await win.webContents.executeJavaScript(
        `(() => {
      const mirror = window.__INITIAL_MIRROR__;
      const summarize = (value, depth = 0) => {
        if (depth > 2) return typeof value;
        if (Array.isArray(value)) return { type: 'array', length: value.length, first: value.length ? summarize(value[0], depth + 1) : null };
        if (value && typeof value === 'object') {
          const keys = Object.keys(value).slice(0, 20);
          const out = { type: 'object', keys };
          for (const key of keys.slice(0, 5)) out[key] = summarize(value[key], depth + 1);
          return out;
        }
        return value;
      };
      return JSON.stringify(summarize(mirror));
    })()`,
        true,
      )
      console.log(result)
    } finally {
      if (!win.isDestroyed()) win.destroy()
      app.quit()
    }
  })
  .catch((err) => {
    console.error(err)
    app.quit()
  })
