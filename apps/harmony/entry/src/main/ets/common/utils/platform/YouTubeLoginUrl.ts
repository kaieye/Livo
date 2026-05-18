export function resolveYouTubeLoginUrl(): string {
  const continueUrl = encodeURIComponent('https://m.youtube.com/')
  return `https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&passive=true&prompt=select_account&continue=${continueUrl}`
}
