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
      const keys = Object.keys(window).filter((k) => /INITIAL|__NUXT__|__pinia|__STORE__|__apollo/i.test(k));
      const initial = window.__INITIAL_STATE__ || window.__initialState__ || window.__INITIAL_DATA__ || null;
      const scripts = Array.from(document.scripts).map((s) => (s.textContent || '').slice(0, 400)).filter(Boolean).slice(0, 20);
      return {
        keys,
        initialType: initial ? typeof initial : null,
        initialKeys: initial && typeof initial === 'object' ? Object.keys(initial).slice(0, 30) : null,
        title: document.title,
        scripts,
      };
    })()`,
        true,
      )
      console.log(JSON.stringify(result, null, 2))
    } finally {
      if (!win.isDestroyed()) win.destroy()
      app.quit()
    }
  })
  .catch((err) => {
    console.error(err)
    app.quit()
  })
