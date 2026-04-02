export interface PictureGalleryTarget {
    summary: string;
    content: string;
    articleUrl: string;
    siteUrl: string;
    mediaUrls: string[];
}
export interface CachedPicturePreviewLike {
    etag?: string;
    lastModified?: string;
    feedTitle?: string;
    siteUrl?: string;
    imageUrl?: string;
    description?: string;
    entries?: Array<unknown>;
}
export interface PictureGalleryTile {
    url: string;
    width: string;
    overflowCount: number;
    isSquare: boolean;
}
function decodeBasicHtml(value: string): string {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}
function resolveAbsoluteUrl(baseUrl: string, value: string): string {
    const trimmed = (value || '').trim();
    if (!trimmed) {
        return '';
    }
    if (trimmed.startsWith('//')) {
        return `https:${trimmed}`;
    }
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
        return trimmed;
    }
    const base = (baseUrl || '').trim();
    if (!base) {
        return trimmed;
    }
    const originMatch = base.match(/^(https?:\/\/[^/]+)(\/.*)?$/i);
    const origin = originMatch?.[1] ?? '';
    const basePath = originMatch?.[2] ?? '/';
    if (!origin) {
        return trimmed;
    }
    if (trimmed.startsWith('/')) {
        return `${origin}${trimmed}`;
    }
    const normalizedBaseDir = basePath.includes('/')
        ? basePath.replace(/\/[^/]*$/, '/')
        : '/';
    return `${origin}${normalizedBaseDir}${trimmed}`.replace(/([^:]\/)\/+/g, '$1');
}
function isImageUrl(value: string): boolean {
    const normalized = (value || '').trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    return (/\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|#|$)/i.test(normalized) ||
        normalized.includes('cdninstagram') ||
        normalized.includes('scontent.') ||
        normalized.includes('fbcdn.net') ||
        normalized.includes('googleusercontent.com/') ||
        normalized.includes('ytimg.com/'));
}
function uniqueUrls(urls: string[]): string[] {
    const result: string[] = [];
    urls.forEach((url: string) => {
        const trimmed = url.trim();
        if (trimmed && !result.includes(trimmed)) {
            result.push(trimmed);
        }
    });
    return result;
}
function isStringField(value: unknown): boolean {
    return typeof value === 'string';
}
function isCompletePreviewPayload(cachedPayload?: CachedPicturePreviewLike): boolean {
    if (!cachedPayload) {
        return false;
    }
    return (Array.isArray(cachedPayload.entries) &&
        isStringField(cachedPayload.etag) &&
        isStringField(cachedPayload.lastModified) &&
        isStringField(cachedPayload.feedTitle) &&
        isStringField(cachedPayload.siteUrl) &&
        isStringField(cachedPayload.imageUrl) &&
        isStringField(cachedPayload.description));
}
function extractImageUrlsFromHtml(content: string, baseUrl: string): string[] {
    const raw = decodeBasicHtml(content || '');
    const results: string[] = [];
    const pushImage = (candidate: string): void => {
        const resolved = resolveAbsoluteUrl(baseUrl, decodeBasicHtml(candidate));
        if (!resolved || !isImageUrl(resolved) || results.includes(resolved)) {
            return;
        }
        results.push(resolved);
    };
    const imageTagMatches = raw.matchAll(/<img\b[^>]*>/gi);
    for (const matched of imageTagMatches) {
        const tag = matched[0] || '';
        const attrMatch = tag.match(/\b(?:data-src|data-original|src)=["']([^"']+)["']/i);
        if (attrMatch?.[1]) {
            pushImage(attrMatch[1]);
        }
    }
    return results;
}
export function extractEntryGalleryImageUrls(target: PictureGalleryTarget): string[] {
    const baseUrl = target.articleUrl || target.siteUrl;
    const mediaUrls = uniqueUrls((target.mediaUrls ?? []).filter((url: string) => isImageUrl(url)));
    if (mediaUrls.length > 0) {
        return mediaUrls;
    }
    return uniqueUrls(extractImageUrlsFromHtml(`${target.summary}\n${target.content}`, baseUrl));
}
export function resolvePictureGalleryColumns(photoCount: number): number {
    if (photoCount <= 1) {
        return 1;
    }
    if (photoCount <= 4) {
        return 2;
    }
    return 3;
}
export function resolvePictureGalleryItemWidth(photoCount: number): string {
    const columns = resolvePictureGalleryColumns(photoCount);
    if (columns <= 1) {
        return '100%';
    }
    if (columns === 2) {
        return '49%';
    }
    return '32%';
}
export function createPictureGalleryTiles(photoUrls: string[], maxVisibleCount: number = 9): PictureGalleryTile[] {
    const visibleUrls = uniqueUrls(photoUrls).slice(0, maxVisibleCount);
    const overflowCount = Math.max(0, uniqueUrls(photoUrls).length - visibleUrls.length);
    const width = resolvePictureGalleryItemWidth(visibleUrls.length);
    return visibleUrls.map((url: string, index: number) => ({
        url,
        width,
        overflowCount: index === visibleUrls.length - 1 ? overflowCount : 0,
        isSquare: true,
    }));
}
export function shouldUseCachedPicturePreview(isPicturesPreview: boolean, cachedPayload?: CachedPicturePreviewLike): boolean {
    if (!isCompletePreviewPayload(cachedPayload)) {
        return false;
    }
    if (!isPicturesPreview) {
        return true;
    }
    return (cachedPayload.entries?.length ?? 0) > 0;
}
