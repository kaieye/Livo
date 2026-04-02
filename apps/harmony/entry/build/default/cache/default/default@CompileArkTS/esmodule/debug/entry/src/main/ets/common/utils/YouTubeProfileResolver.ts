const PROFILE_PATTERNS: RegExp[] = [
    /"channelHandle"\s*:\s*"(@[^"]+)"/i,
    /\\"channelHandle\\"\s*:\s*\\"(@[^\\"]+)\\"/i,
    /"accountName"\s*:\s*"([^"]+)"/i,
    /\\"accountName\\"\s*:\s*\\"([^\\"]+)\\"/i,
    /"channelName"\s*:\s*"([^"]+)"/i,
    /\\"channelName\\"\s*:\s*\\"([^\\"]+)\\"/i,
    /"displayName"\s*:\s*"([^"]+)"/i,
    /\\"displayName\\"\s*:\s*\\"([^\\"]+)\\"/i,
    /"fullName"\s*:\s*"([^"]+)"/i,
    /\\"fullName\\"\s*:\s*\\"([^\\"]+)\\"/i,
    /"givenName"\s*:\s*"([^"]+)"/i,
    /\\"givenName\\"\s*:\s*\\"([^\\"]+)\\"/i,
    /<meta\s+itemprop="name"\s+content="([^"]+)"/i,
    /Google Account[:\s]+([^"<]+)/i,
];
export function extractYouTubeProfileName(source: string): string {
    const text = source || '';
    for (const pattern of PROFILE_PATTERNS) {
        const matched = text.match(pattern);
        if (matched?.[1]?.trim()) {
            return matched[1].trim();
        }
    }
    return '';
}
export function normalizeYouTubeProfileSources(value: object | string[] | null | undefined): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((item: object | string | null | undefined) => typeof item === 'string')
        .map((item: object | string | null | undefined) => `${item}`.trim())
        .filter((item: string) => !!item);
}
export function resolveYouTubeProfileName(sources: string[]): string {
    for (const source of sources) {
        const name = extractYouTubeProfileName(source);
        if (name) {
            return name;
        }
    }
    return '';
}
