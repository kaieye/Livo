const YOUTUBE_CONTINUE_URL = 'https://m.youtube.com/'
const GOOGLE_LOGIN_URL = 'https://accounts.google.com/ServiceLogin'

export function resolveYouTubeLoginUrl(): string {
  return `${GOOGLE_LOGIN_URL}?service=youtube&uilel=3&passive=true&continue=${encodeURIComponent(YOUTUBE_CONTINUE_URL)}`
}
