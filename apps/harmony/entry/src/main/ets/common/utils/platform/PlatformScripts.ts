export interface BilibiliCookieGroupsInput {
  documentCookies: string
  currentUrl: string
  fetchCookie: (url: string) => string
  probeUrls?: string[]
}

export interface YouTubeCookieGroupsInput {
  documentCookies: string
  currentUrl: string
  fetchCookie: (url: string) => string
  probeUrls?: string[]
}

export const BILIBILI_PROBE_URLS: string[] = [
  'https://www.bilibili.com/',
  'https://passport.bilibili.com/',
  'https://m.bilibili.com/',
  'https://account.bilibili.com/',
]

export const YOUTUBE_PROBE_URLS: string[] = [
  'https://m.youtube.com/',
  'https://www.youtube.com/',
  'https://studio.youtube.com/',
  'https://myaccount.google.com/',
  'https://accounts.google.com/',
]

function buildCookieGroups(
  documentCookies: string,
  currentUrl: string,
  probeUrls: string[],
  fetchCookie: (url: string) => string,
): string[] {
  const cookieGroups: string[] = []
  if (documentCookies.trim()) {
    cookieGroups.push(documentCookies)
  }
  if (currentUrl.trim()) {
    cookieGroups.push(fetchCookie(currentUrl))
  }
  probeUrls.forEach((url: string) => {
    cookieGroups.push(fetchCookie(url))
  })
  return cookieGroups
}

export function buildBilibiliCookieGroups(
  input: BilibiliCookieGroupsInput,
): string[] {
  return buildCookieGroups(
    input.documentCookies,
    input.currentUrl,
    input.probeUrls || BILIBILI_PROBE_URLS,
    input.fetchCookie,
  )
}

export function buildYouTubeCookieGroups(
  input: YouTubeCookieGroupsInput,
): string[] {
  return buildCookieGroups(
    input.documentCookies,
    input.currentUrl,
    input.probeUrls || YOUTUBE_PROBE_URLS,
    input.fetchCookie,
  )
}

export function buildBilibiliNavScript(): string {
  return `
    (async () => {
      try {
        const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json, text/plain, */*' }
        });
        return await response.text();
      } catch (error) {
        return JSON.stringify({ __livo_error: String(error) });
      }
    })()
  `
}

export function buildBilibiliPageStateScript(): string {
  return `
    (() => {
      try {
        const html = document.documentElement?.innerHTML || '';
        const initialState = globalThis.__INITIAL_STATE__ || globalThis.__INITIAL_DATA__ || {};
        const stateText = JSON.stringify(initialState || {});
        const find = (patterns) => {
          for (const pattern of patterns) {
            const matched = html.match(pattern) || stateText.match(pattern);
            if (matched && matched[1]) {
              return String(matched[1]).trim();
            }
          }
          return '';
        };
        const displayName =
          find([
            /"uname":"([^"]+)"/,
            /"username":"([^"]+)"/,
            /"nickName":"([^"]+)"/
          ]) ||
          String(document.querySelector('[class*="name"],[class*="uname"],[data-user-name]')?.textContent || '').trim();
        const loggedIn =
          /"isLogin"\\s*:\\s*true/.test(html) ||
          /"isLogin"\\s*:\\s*true/.test(stateText) ||
          !!displayName;
        return JSON.stringify({
          currentUrl: location.href || '',
          title: document.title || '',
          displayName,
          loggedIn,
          cookies: document.cookie || ''
        });
      } catch (error) {
        return JSON.stringify({
          currentUrl: location.href || '',
          title: document.title || '',
          displayName: '',
          loggedIn: false,
          cookies: ''
        });
      }
    })()
  `
}

export function buildYouTubePageStateScript(): string {
  return `
    (() => {
      const read = (value) => typeof value === 'string' ? value.trim() : '';
      try {
        const html = document.documentElement?.innerHTML || '';
        const byPattern = (patterns) => {
          for (const pattern of patterns) {
            const matched = html.match(pattern);
            if (matched && matched[1]) {
              return String(matched[1]).trim();
            }
          }
          return '';
        };
        const channelHandle =
          read(document.querySelector('a[href^="/@"]')?.textContent) ||
          byPattern([
            /"channelHandle":"(@[^"]+)"/,
            /\\"channelHandle\\":"(@[^\\"]+)\\"/ 
          ]);
        const accountName =
          read(document.querySelector('yt-formatted-string#account-name')?.textContent) ||
          read(document.querySelector('button#avatar-btn')?.getAttribute('aria-label')).replace(/^Google Account[:\\s]*/i, '') ||
          read(document.querySelector('img#img')?.getAttribute('alt')).replace(/^Google Account[:\\s]*/i, '') ||
          byPattern([
            /"accountName":"([^"]+)"/,
            /\\"accountName\\":"([^\\"]+)\\"/ 
          ]);
        const channelName = byPattern([
          /"channelName":"([^"]+)"/,
          /\\"channelName\\":"([^\\"]+)\\"/ 
        ]);
        const displayName = byPattern([
          /"displayName":"([^"]+)"/,
          /\\"displayName\\":"([^\\"]+)\\"/,
          /"fullName":"([^"]+)"/,
          /\\"fullName\\":"([^\\"]+)\\"/,
          /"givenName":"([^"]+)"/,
          /\\"givenName\\":"([^\\"]+)\\"/ 
        ]);
        return JSON.stringify({
          currentUrl: location.href || '',
          title: document.title || '',
          cookies: document.cookie || '',
          pageHtml: JSON.stringify({ channelHandle, accountName, channelName, displayName })
        });
      } catch (error) {
        return JSON.stringify({
          currentUrl: location.href || '',
          title: document.title || '',
          cookies: document.cookie || '',
          pageHtml: ''
        });
      }
    })()
  `
}

export function buildYouTubeProfileFetchScript(): string {
  return `
    (async () => {
      const urls = [
        'https://www.youtube.com/account',
        'https://www.youtube.com/',
        'https://myaccount.google.com/',
        'https://myaccount.google.com/personal-info'
      ];
      const outputs = [];
      for (const target of urls) {
        try {
          const response = await fetch(target, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
          });
          outputs.push(response.ok ? await response.text() : '');
        } catch (error) {
          outputs.push('');
        }
      }
      return JSON.stringify(outputs);
    })()
  `
}
