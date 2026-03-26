import http from "@ohos:net.http";
import type { Entry, Feed } from '../models/LivoModels';
interface ParsedItem {
    id: string;
    title: string;
    link: string;
    summary: string;
    content: string;
    author: string;
    publishedAt: number;
    tags: string[];
}
export interface FeedRefreshPayload {
    etag: string;
    lastModified: string;
    feedTitle: string;
    siteUrl: string;
    imageUrl: string;
    description: string;
    entries: Entry[];
}
function decodeHtml(value: string): string {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&nbsp;/g, ' ');
}
function stripHtml(value: string): string {
    return decodeHtml(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
function stripCdata(value: string): string {
    return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}
function pickTag(block: string, tagName: string): string {
    const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'i');
    const matched = block.match(regex);
    return matched && matched[1] ? stripCdata(matched[1]).trim() : '';
}
function pickFirst(block: string, tagNames: string[]): string {
    for (const tagName of tagNames) {
        const value = pickTag(block, tagName);
        if (value) {
            return value;
        }
    }
    return '';
}
function pickTagFromContainer(xml: string, containerName: string, tagName: string): string {
    const containerRegex = new RegExp(`<${containerName}(?:\\s[^>]*)?>([\\s\\S]*?)</${containerName}>`, 'i');
    const container = xml.match(containerRegex);
    if (!container?.[1]) {
        return '';
    }
    return pickTag(container[1], tagName);
}
function parseDate(value: string): number {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? Date.now() : timestamp;
}
function estimateReadingMinutes(content: string): number {
    const plainText = stripHtml(content);
    return Math.max(1, Math.ceil(plainText.length / 220));
}
function createEntryId(feedId: string, link: string, title: string, index: number): string {
    const normalized = `${feedId}-${link || title || index}`.toLowerCase();
    const compact = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return compact || `${feedId}-${index}`;
}
function parseTags(itemBlock: string): string[] {
    const matches = itemBlock.match(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi) ?? [];
    const tags: string[] = [];
    matches.forEach((tagBlock: string) => {
        const value = stripHtml(tagBlock.replace(/<\/?category(?:\s[^>]*)?>/gi, ''));
        if (value && !tags.includes(value)) {
            tags.push(value);
        }
    });
    return tags.slice(0, 6);
}
function resolveAbsoluteUrl(baseUrl: string, rawUrl: string): string {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
        return '';
    }
    // ArkTS 不支持 URL 构造函数，使用简单的字符串处理
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    if (trimmed.startsWith('//')) {
        try {
            const baseProtocol = new RegExp('^https?:').exec(baseUrl)?.[0] ?? 'https:';
            return `${baseProtocol}${trimmed}`;
        }
        catch (_) {
            return trimmed;
        }
    }
    if (trimmed.startsWith('/')) {
        try {
            const baseUrlObj = parseBaseUrl(baseUrl);
            return `${baseUrlObj.protocol}//${baseUrlObj.host}${trimmed}`;
        }
        catch (_) {
            return trimmed;
        }
    }
    // 相对路径
    try {
        const baseUrlObj = parseBaseUrl(baseUrl);
        const basePath = baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf('/') + 1);
        return `${baseUrlObj.protocol}//${baseUrlObj.host}${basePath}${trimmed}`;
    }
    catch (_) {
        return trimmed;
    }
}
interface ParsedUrl {
    protocol: string;
    host: string;
    pathname: string;
}
function parseBaseUrl(url: string): ParsedUrl {
    const match = url.match(/^(https?:)\/\/([^/]+)(.*)?/);
    if (!match) {
        return { protocol: 'https:', host: url, pathname: '' };
    }
    return {
        protocol: match[1],
        host: match[2],
        pathname: match[3] ?? '',
    };
}
function parseFeedTitle(xml: string): string {
    return stripHtml(pickTagFromContainer(xml, 'channel', 'title') || pickTag(xml, 'title'));
}
function parseFeedDescription(xml: string): string {
    return stripHtml(pickTagFromContainer(xml, 'channel', 'description')
        || pickTag(xml, 'subtitle')
        || pickTag(xml, 'description'));
}
function parseFeedSiteUrl(xml: string, feedUrl: string): string {
    const rssLink = stripHtml(pickTagFromContainer(xml, 'channel', 'link'));
    if (rssLink) {
        return resolveAbsoluteUrl(feedUrl, rssLink);
    }
    const atomAlternate = xml.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*\/?>/i);
    if (atomAlternate?.[1]) {
        return resolveAbsoluteUrl(feedUrl, atomAlternate[1]);
    }
    const atomHref = xml.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/i);
    if (atomHref?.[1]) {
        return resolveAbsoluteUrl(feedUrl, atomHref[1]);
    }
    return '';
}
function parseFeedImageUrl(xml: string, baseUrl: string): string {
    const rssImage = xml.match(/<image[\s\S]*?<url>([\s\S]*?)<\/url>[\s\S]*?<\/image>/i);
    if (rssImage?.[1]) {
        return resolveAbsoluteUrl(baseUrl, stripHtml(stripCdata(rssImage[1])));
    }
    const itunesImage = xml.match(/<itunes:image[^>]*href="([^"]+)"[^>]*\/?>/i);
    if (itunesImage?.[1]) {
        return resolveAbsoluteUrl(baseUrl, stripHtml(itunesImage[1]));
    }
    const atomLogo = pickFirst(xml, ['logo', 'icon']);
    if (atomLogo) {
        return resolveAbsoluteUrl(baseUrl, stripHtml(atomLogo));
    }
    return '';
}
function parseRssItems(feedId: string, xml: string): ParsedItem[] {
    const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
    return itemMatches.map((itemBlock: string, index: number) => {
        const title = stripHtml(pickTag(itemBlock, 'title')) || `远程条目 ${index + 1}`;
        const link = stripHtml(pickTag(itemBlock, 'link'));
        const description = pickFirst(itemBlock, ['content:encoded', 'description']);
        const summary = stripHtml(description) || '这条内容暂时没有摘要。';
        const author = stripHtml(pickFirst(itemBlock, ['author', 'dc:creator'])) || '未知作者';
        const pubDate = stripHtml(pickFirst(itemBlock, ['pubDate', 'published', 'updated']));
        const content = stripHtml(description) ? stripHtml(description) : summary;
        const parsedItem: ParsedItem = {
            id: createEntryId(feedId, link, title, index),
            title,
            link,
            summary,
            content,
            author,
            publishedAt: parseDate(pubDate),
            tags: parseTags(itemBlock),
        };
        return parsedItem;
    });
}
export class RssFeedService {
    static async fetchFeedEntries(feed: Feed): Promise<FeedRefreshPayload> {
        const request = http.createHttp();
        try {
            const headers: Record<string, string> = {};
            headers['Accept'] = 'application/rss+xml, application/xml, text/xml';
            if (feed.etag) {
                headers['If-None-Match'] = feed.etag;
            }
            if (feed.lastModified) {
                headers['If-Modified-Since'] = feed.lastModified;
            }
            const response = await request.request(feed.url, {
                method: http.RequestMethod.GET,
                connectTimeout: 10000,
                readTimeout: 10000,
                header: headers,
            });
            if (response.responseCode === 304) {
                return {
                    etag: feed.etag ?? '',
                    lastModified: feed.lastModified ?? '',
                    feedTitle: feed.title,
                    siteUrl: feed.siteUrl ?? '',
                    imageUrl: feed.imageUrl ?? '',
                    description: feed.description ?? '',
                    entries: [],
                };
            }
            if (response.responseCode !== 200) {
                throw new Error(`RSS request failed with status ${response.responseCode}`);
            }
            const xml = String(response.result);
            const items = parseRssItems(feed.id, xml);
            const resolvedSiteUrl = parseFeedSiteUrl(xml, feed.url) || feed.siteUrl || '';
            const resolvedImageUrl = parseFeedImageUrl(xml, resolvedSiteUrl || feed.url) || feed.imageUrl || '';
            const resolvedDescription = parseFeedDescription(xml) || feed.description || '';
            const resolvedTitle = parseFeedTitle(xml) || feed.title;
            if (items.length === 0) {
                throw new Error('RSS parsed without entries');
            }
            const now = Date.now();
            const entries: Entry[] = items.map((item: ParsedItem): Entry => ({
                id: item.id,
                feedId: feed.id,
                title: item.title,
                url: item.link || feed.siteUrl || feed.url,
                summary: item.summary,
                content: item.content,
                author: item.author,
                publishedAt: item.publishedAt,
                readingTimeMinutes: estimateReadingMinutes(item.content),
                tags: item.tags,
                isRead: false,
                isStarred: false,
                createdAt: now,
                updatedAt: now,
            }));
            return {
                etag: String(response.header['ETag'] ?? response.header['etag'] ?? ''),
                lastModified: String(response.header['Last-Modified'] ?? response.header['last-modified'] ?? ''),
                feedTitle: resolvedTitle,
                siteUrl: resolvedSiteUrl,
                imageUrl: resolvedImageUrl,
                description: resolvedDescription,
                entries,
            };
        }
        finally {
            request.destroy();
        }
    }
}
