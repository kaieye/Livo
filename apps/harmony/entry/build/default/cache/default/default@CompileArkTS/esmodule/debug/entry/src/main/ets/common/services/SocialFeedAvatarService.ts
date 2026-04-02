import http from "@ohos:net.http";
import { extractInstagramUsername } from "@bundle:com.livo.harmony/entry/ets/common/utils/SocialFeedTitles";
function trimValue(value: string | undefined): string {
    return (value || '').trim();
}
function decodeBasicEntities(value: string): string {
    return (value || '')
        .replace(/\\u0026/g, '&')
        .replace(/\\u003d/g, '=')
        .replace(/\\u002F/gi, '/')
        .replace(/\\"/g, '"')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&amp;/g, '&');
}
function extractMetaContent(html: string, propertyName: string): string {
    const pattern = /<meta\b[^>]*>/gi;
    let matched: RegExpExecArray | null = pattern.exec(html);
    while (matched) {
        const tag = matched[0] ?? '';
        if (!new RegExp(`\\bproperty=(["'])${propertyName}\\1`, 'i').test(tag)) {
            matched = pattern.exec(html);
            continue;
        }
        const content = tag.match(/\bcontent=(["'])([\s\S]*?)\1/i);
        if (content?.[2]) {
            return decodeBasicEntities(content[2]).trim();
        }
        matched = pattern.exec(html);
    }
    return '';
}
function isPlaceholderAvatar(url?: string): boolean {
    const raw = trimValue(url).toLowerCase();
    if (!raw) {
        return true;
    }
    return raw.includes('unavatar.io/instagram/')
        || raw.includes('instagram.com/static/images/ico')
        || raw.includes('instagram_static/images/ico')
        || raw.includes('instagram_logo')
        || raw.includes('instagram-logo')
        || raw.includes('/apple-touch-icon')
        || raw.includes('favicon')
        || ((raw.includes('picnob') || raw.includes('pixnoy') || raw.includes('piokok')) && raw.includes('logo'));
}
export class SocialFeedAvatarService {
    static async resolveFeedAvatar(feedUrl: string, siteUrl: string, incomingImageUrl: string, existingImageUrl: string = ''): Promise<string> {
        const preferredIncoming = trimValue(incomingImageUrl);
        if (preferredIncoming && !isPlaceholderAvatar(preferredIncoming)) {
            return preferredIncoming;
        }
        const username = extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl);
        if (username) {
            const fetched = await SocialFeedAvatarService.fetchInstagramAvatar(username);
            if (fetched) {
                return fetched;
            }
        }
        return preferredIncoming || trimValue(existingImageUrl);
    }
    static async fetchInstagramAvatar(username: string): Promise<string> {
        const clean = trimValue(username).replace(/^@+/, '');
        if (!clean) {
            return '';
        }
        const request = http.createHttp();
        try {
            const response = await request.request(`https://www.instagram.com/${encodeURIComponent(clean)}/`, {
                method: http.RequestMethod.GET,
                connectTimeout: 8000,
                readTimeout: 8000,
                header: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                },
            });
            if (response.responseCode !== 200) {
                return '';
            }
            const html = String(response.result);
            const ogImage = extractMetaContent(html, 'og:image');
            if (/^https?:\/\//i.test(ogImage)) {
                return ogImage;
            }
            const profilePic = html.match(/"profile_pic_url_hd":"(https?:\\\/\\\/[^"]+)"/i)?.[1] ?? '';
            if (profilePic) {
                return decodeBasicEntities(profilePic).replace(/\\\//g, '/');
            }
            return '';
        }
        catch (_) {
            return '';
        }
        finally {
            request.destroy();
        }
    }
}
