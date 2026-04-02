export interface YouTubePlaybackDisplayState {
    playableUrl: string;
    fallbackUrl: string;
    actionHint: string;
}
export function resolveYouTubePlaybackDisplay(playableUrl: string, fallbackUrl: string): YouTubePlaybackDisplayState {
    if ((playableUrl || '').trim()) {
        return {
            playableUrl: playableUrl.trim(),
            fallbackUrl: (fallbackUrl || '').trim(),
            actionHint: '',
        };
    }
    if ((fallbackUrl || '').trim()) {
        return {
            playableUrl: '',
            fallbackUrl: fallbackUrl.trim(),
            actionHint: '',
        };
    }
    return {
        playableUrl: '',
        fallbackUrl: '',
        actionHint: '当前视频暂时无法解析直链，请稍后重试',
    };
}
