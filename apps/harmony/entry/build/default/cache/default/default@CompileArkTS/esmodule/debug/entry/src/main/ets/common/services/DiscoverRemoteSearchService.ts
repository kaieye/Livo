import http from "@ohos:net.http";
import { FeedViewType } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { DiscoverSearchPlatform, ResolvedDiscoverCandidate } from './DiscoverService';
interface BilibiliSearchResult {
    mid?: number;
    uname?: string;
    usign?: string;
    upic?: string;
    fans?: number | string;
}
interface ParsedYouTubeChannel {
    channelId: string;
    title: string;
    imageUrl: string;
}
interface BilibiliSearchPayloadData {
    result?: BilibiliSearchResult[];
}
interface BilibiliSearchPayload {
    code?: number;
    data?: BilibiliSearchPayloadData;
}
interface RankedBilibiliCandidate {
    candidate: ResolvedDiscoverCandidate;
    score: number;
}
interface BilibiliHtmlUserCard {
    uid: string;
    title: string;
    description: string;
}
interface BilibiliAvatarPayloadCard {
    face?: string;
}
interface BilibiliAvatarPayloadData {
    card?: BilibiliAvatarPayloadCard;
}
interface BilibiliAvatarPayload {
    code?: number;
    data?: BilibiliAvatarPayloadData;
}
function decodeBasicEntities(value: string): string {
    return value
        .replace(/\\u0026/g, '&')
        .replace(/\\u003d/g, '=')
        .replace(/\\u002F/g, '/')
        .replace(/\\u002f/g, '/')
        .replace(/\\"/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&');
}
function stripHtml(value: string): string {
    return decodeBasicEntities(value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
function formatFollowers(value: number | string | undefined): string {
    if (value === undefined || value === null) {
        return '';
    }
    const raw = String(value).trim();
    if (!raw) {
        return '';
    }
    return `${raw} 粉丝`;
}
function normalizeMatchValue(value: string): string {
    return stripHtml(value)
        .toLowerCase()
        .replace(/[@\s_.\-|/]+/g, '')
        .trim();
}
function computeMatchTier(query: string, candidate: string): number {
    const q = normalizeMatchValue(query);
    const c = normalizeMatchValue(candidate);
    if (!q || !c) {
        return 0;
    }
    if (c === q) {
        return 3;
    }
    if (c.startsWith(q)) {
        return 2;
    }
    if (c.includes(q)) {
        return 1;
    }
    return 0;
}
function normalizeImageUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }
    if (trimmed.startsWith('//')) {
        return `https:${trimmed}`;
    }
    if (trimmed.startsWith('http://')) {
        return `https://${trimmed.substring('http://'.length)}`;
    }
    return trimmed;
}
function candidateQueryVariants(query: string): string[] {
    const variants: string[] = [];
    const pushVariant = (value: string): void => {
        const trimmed = value.trim();
        if (!trimmed || variants.includes(trimmed)) {
            return;
        }
        variants.push(trimmed);
    };
    pushVariant(query);
    pushVariant(query.toLowerCase());
    pushVariant(query.replace(/\s+/g, ''));
    pushVariant(query.replace(/\s+/g, '').toLowerCase());
    return variants;
}
function fallbackBilibiliQueryVariants(query: string): string[] {
    const variants: string[] = [];
    const normalized = query.trim();
    const compact = normalized.replace(/\s+/g, '');
    const pushVariant = (value: string): void => {
        const trimmed = value.trim();
        if (!trimmed || variants.includes(trimmed)) {
            return;
        }
        variants.push(trimmed);
    };
    if (compact.length >= 3) {
        pushVariant(compact.substring(0, compact.length - 1));
    }
    if (compact.length >= 5) {
        pushVariant(compact.substring(0, compact.length - 2));
    }
    if (normalized.length >= 3) {
        pushVariant(normalized.substring(0, normalized.length - 1));
    }
    return variants;
}
function dedupeCandidates(items: ResolvedDiscoverCandidate[]): ResolvedDiscoverCandidate[] {
    const result: ResolvedDiscoverCandidate[] = [];
    items.forEach((item: ResolvedDiscoverCandidate) => {
        if (!result.some((candidate: ResolvedDiscoverCandidate) => candidate.targetUrl === item.targetUrl)) {
            result.push(item);
        }
    });
    return result;
}
function createResolvedCandidate(targetUrl: string, targetTitle: string, targetView: FeedViewType, description: string, siteUrl: string, sourceKind: string, imageUrl: string): ResolvedDiscoverCandidate {
    return {
        targetUrl,
        targetTitle,
        targetView,
        description,
        siteUrl,
        sourceKind,
        imageUrl,
    };
}
function normalizeFollowerLabel(value: number | string | undefined): string {
    const label = formatFollowers(value);
    return label || 'Bilibili 用户';
}
function createParsedYouTubeChannel(channelId: string, title: string, imageUrl: string): ParsedYouTubeChannel {
    return {
        channelId,
        title,
        imageUrl,
    };
}
function createRankedBilibiliCandidate(candidate: ResolvedDiscoverCandidate, score: number): RankedBilibiliCandidate {
    return {
        candidate,
        score,
    };
}
function extractBilibiliUidFromCandidate(candidate: ResolvedDiscoverCandidate): string {
    const matched = candidate.targetUrl.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i);
    return matched?.[1] ?? '';
}
function createBilibiliHtmlUserCard(uid: string, title: string, description: string): BilibiliHtmlUserCard {
    return {
        uid,
        title,
        description,
    };
}
export class DiscoverRemoteSearchService {
    static async search(query: string, platform: DiscoverSearchPlatform): Promise<ResolvedDiscoverCandidate[]> {
        const trimmed = query.trim();
        if (!trimmed) {
            return [];
        }
        const tasks: Array<Promise<ResolvedDiscoverCandidate[]>> = [];
        if (platform === 'all' || platform === 'youtube') {
            tasks.push(DiscoverRemoteSearchService.searchYouTubeChannels(trimmed));
        }
        if (platform === 'all' || platform === 'bilibili') {
            tasks.push(DiscoverRemoteSearchService.searchBilibiliUsers(trimmed));
        }
        const groups = await Promise.all(tasks);
        const merged: ResolvedDiscoverCandidate[] = [];
        groups.forEach((group: ResolvedDiscoverCandidate[]) => {
            group.forEach((item: ResolvedDiscoverCandidate) => {
                merged.push(item);
            });
        });
        return dedupeCandidates(merged).slice(0, 12);
    }
    private static async searchBilibiliUsers(query: string): Promise<ResolvedDiscoverCandidate[]> {
        const ranked: RankedBilibiliCandidate[] = [];
        const seen = new Set<string>();
        const collectByVariants = async (variants: string[]): Promise<void> => {
            for (const variant of variants) {
                const items = await DiscoverRemoteSearchService.searchBilibiliUsersByVariant(variant);
                items.forEach((item: RankedBilibiliCandidate) => {
                    const uid = extractBilibiliUidFromCandidate(item.candidate);
                    const key = uid || item.candidate.targetUrl;
                    if (seen.has(key)) {
                        return;
                    }
                    seen.add(key);
                    ranked.push(item);
                });
            }
        };
        await collectByVariants(candidateQueryVariants(query));
        if (ranked.length === 0) {
            await collectByVariants(fallbackBilibiliQueryVariants(query));
        }
        if (ranked.length === 0) {
            return [];
        }
        ranked.sort((left: RankedBilibiliCandidate, right: RankedBilibiliCandidate) => right.score - left.score);
        return ranked.map((item: RankedBilibiliCandidate) => item.candidate).slice(0, 12);
    }
    private static async searchBilibiliUsersByVariant(query: string): Promise<RankedBilibiliCandidate[]> {
        const request = http.createHttp();
        try {
            const response = await request.request(`https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(query)}`, {
                method: http.RequestMethod.GET,
                connectTimeout: 8000,
                readTimeout: 8000,
                header: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Referer': 'https://www.bilibili.com/',
                    'Origin': 'https://www.bilibili.com',
                },
            });
            if (response.responseCode !== 200) {
                return await DiscoverRemoteSearchService.searchBilibiliUsersByHtml(query);
            }
            const payload = JSON.parse(String(response.result)) as BilibiliSearchPayload;
            if (payload.code === -412) {
                return await DiscoverRemoteSearchService.searchBilibiliUsersByHtml(query);
            }
            if (payload.code !== 0 || !payload.data?.result) {
                return [];
            }
            const candidates: RankedBilibiliCandidate[] = [];
            payload.data.result.slice(0, 40).forEach((user: BilibiliSearchResult) => {
                const uid = user.mid ? String(user.mid) : '';
                if (!uid) {
                    return;
                }
                const title = stripHtml(user.uname || `UID ${uid}`);
                const baseDescription = stripHtml(user.usign || '') || normalizeFollowerLabel(user.fans);
                const imageUrl = normalizeImageUrl(typeof user.upic === 'string' ? user.upic : '');
                const titleTier = computeMatchTier(query, title);
                const descriptionTier = computeMatchTier(query, baseDescription);
                const uidTier = computeMatchTier(query, uid);
                const score = titleTier * 1000 + descriptionTier * 180 + uidTier * 80;
                if (score <= 0) {
                    return;
                }
                candidates.push(createRankedBilibiliCandidate(createResolvedCandidate(`https://rsshub.pseudoyu.com/bilibili/user/dynamic/${uid}`, title, FeedViewType.SocialMedia, baseDescription, `https://space.bilibili.com/${uid}`, 'Bilibili', imageUrl), score + 8));
            });
            return candidates;
        }
        catch (_) {
            return await DiscoverRemoteSearchService.searchBilibiliUsersByHtml(query);
        }
        finally {
            request.destroy();
        }
    }
    private static async searchBilibiliUsersByHtml(query: string): Promise<RankedBilibiliCandidate[]> {
        const request = http.createHttp();
        try {
            const response = await request.request(`https://search.bilibili.com/upuser?keyword=${encodeURIComponent(query)}`, {
                method: http.RequestMethod.GET,
                connectTimeout: 8000,
                readTimeout: 8000,
                header: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Referer': 'https://www.bilibili.com/',
                },
            });
            if (response.responseCode !== 200) {
                return [];
            }
            const html = String(response.result);
            const cards = DiscoverRemoteSearchService.parseBilibiliUsersFromHtml(html);
            const candidates: RankedBilibiliCandidate[] = [];
            for (const card of cards.slice(0, 12)) {
                const titleTier = computeMatchTier(query, card.title);
                const descriptionTier = computeMatchTier(query, card.description);
                const uidTier = computeMatchTier(query, card.uid);
                const score = titleTier * 1000 + descriptionTier * 180 + uidTier * 80;
                if (score <= 0) {
                    continue;
                }
                const imageUrl = await DiscoverRemoteSearchService.fetchBilibiliAvatarByUid(card.uid);
                candidates.push(createRankedBilibiliCandidate(createResolvedCandidate(`https://rsshub.pseudoyu.com/bilibili/user/dynamic/${card.uid}`, card.title, FeedViewType.SocialMedia, card.description, `https://space.bilibili.com/${card.uid}`, 'Bilibili', imageUrl), score + 8));
            }
            return candidates;
        }
        catch (_) {
            return [];
        }
        finally {
            request.destroy();
        }
    }
    private static parseBilibiliUsersFromHtml(html: string): BilibiliHtmlUserCard[] {
        const cards: BilibiliHtmlUserCard[] = [];
        const seen = new Set<string>();
        const regex = /href="\/\/space\.bilibili\.com\/(\d+)"[\s\S]{0,1200}?title="([^"]+)"[\s\S]{0,600}?title="([^"]*粉丝[^"]*)"/gi;
        let matched: RegExpExecArray | null = regex.exec(html);
        while (matched) {
            const uid = matched[1] ?? '';
            const title = stripHtml(matched[2] ?? '');
            const description = stripHtml(matched[3] ?? '');
            if (uid && title && !seen.has(uid)) {
                seen.add(uid);
                cards.push(createBilibiliHtmlUserCard(uid, title, description));
            }
            matched = regex.exec(html);
        }
        return cards;
    }
    private static async fetchBilibiliAvatarByUid(uid: string): Promise<string> {
        const request = http.createHttp();
        try {
            const response = await request.request(`https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(uid)}`, {
                method: http.RequestMethod.GET,
                connectTimeout: 5000,
                readTimeout: 5000,
                header: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': `https://space.bilibili.com/${encodeURIComponent(uid)}`,
                    'Origin': 'https://www.bilibili.com',
                },
            });
            if (response.responseCode !== 200) {
                return '';
            }
            const payload = JSON.parse(String(response.result)) as BilibiliAvatarPayload;
            if (payload.code !== 0) {
                return '';
            }
            return normalizeImageUrl(payload.data?.card?.face ?? '');
        }
        catch (_) {
            return '';
        }
        finally {
            request.destroy();
        }
    }
    private static async searchYouTubeChannels(query: string): Promise<ResolvedDiscoverCandidate[]> {
        const request = http.createHttp();
        try {
            const response = await request.request(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D`, {
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
                return [];
            }
            const html = String(response.result);
            const channels = DiscoverRemoteSearchService.parseYouTubeChannels(html);
            return channels.slice(0, 8).map((channel: ParsedYouTubeChannel) => createResolvedCandidate(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel.channelId)}`, channel.title, FeedViewType.Videos, 'YouTube 频道', `https://www.youtube.com/channel/${channel.channelId}`, 'YouTube', channel.imageUrl));
        }
        catch (_) {
            return [];
        }
        finally {
            request.destroy();
        }
    }
    private static parseYouTubeChannels(html: string): ParsedYouTubeChannel[] {
        const results: ParsedYouTubeChannel[] = [];
        const seen = new Set<string>();
        const regex = /"channelId":"([^"]+)"[\s\S]{0,1800}?"title":\{"simpleText":"([^"]+)"|"title":\{"runs":\[\{"text":"([^"]+)"[\s\S]{0,1600}?"thumbnail":\{"thumbnails":\[(.*?)\]\}/g;
        let matched: RegExpExecArray | null = regex.exec(html);
        while (matched) {
            const channelId = matched[1] ?? '';
            const title = decodeBasicEntities(matched[2] || matched[3] || '').trim();
            const thumbBlock = matched[4] || '';
            const thumbMatch = thumbBlock.match(/"url":"([^"]+)"/);
            const imageUrl = thumbMatch?.[1] ? decodeBasicEntities(thumbMatch[1]) : '';
            if (channelId && title && !seen.has(channelId)) {
                seen.add(channelId);
                results.push(createParsedYouTubeChannel(channelId, title, imageUrl));
            }
            matched = regex.exec(html);
        }
        return results;
    }
}
