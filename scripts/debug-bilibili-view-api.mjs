import { app, session } from 'electron'
app
  .whenReady()
  .then(async () => {
    try {
      const response = await session.defaultSession.fetch(
        'https://api.bilibili.com/x/web-interface/view?bvid=BV1TeXFByEuL',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Referer: 'https://www.bilibili.com/',
            Accept: 'application/json, text/plain, */*',
          },
        },
      )
      console.log(await response.text())
    } finally {
      app.quit()
    }
  })
  .catch((err) => {
    console.error(err)
    app.quit()
  })
