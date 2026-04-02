function uniqueRoutes(routes: string[]): string[] {
    const result: string[] = [];
    routes.forEach((route: string) => {
        const trimmed = route.trim();
        if (trimmed && !result.includes(trimmed)) {
            result.push(trimmed);
        }
    });
    return result;
}
function extractInstagramUsernameFromRoute(route: string): string {
    const matched = route.trim().match(/^\/instagram\/user\/([^/?#]+)/i);
    return matched?.[1] ? decodeURIComponent(matched[1]).replace(/^@+/, '') : '';
}
function extractXUsernameFromRoute(route: string): string {
    const matched = route.trim().match(/^\/(?:x|twitter)\/user\/([^/?#]+)/i);
    return matched?.[1] ? decodeURIComponent(matched[1]).replace(/^@+/, '') : '';
}
export function expandRssHubFallbackRoutes(route: string): string[] {
    const trimmed = route.trim();
    if (!trimmed) {
        return [];
    }
    const username = extractInstagramUsernameFromRoute(trimmed);
    if (!username) {
        const xUsername = extractXUsernameFromRoute(trimmed);
        if (!xUsername) {
            return [trimmed];
        }
        const normalizedUsername = encodeURIComponent(xUsername);
        const isTwitterRoute = /^\/twitter\/user\//i.test(trimmed);
        return uniqueRoutes([
            trimmed,
            isTwitterRoute
                ? `/x/user/${normalizedUsername}`
                : `/twitter/user/${normalizedUsername}`,
        ]);
    }
    return uniqueRoutes([
        trimmed,
        `/instagram/user/${encodeURIComponent(username)}/count=100`,
        `/instagram/user/${encodeURIComponent(username)}?limit=100`,
        `/picnob/user/${encodeURIComponent(username)}`,
        `/picnob.info/user/${encodeURIComponent(username)}`,
        `/pixnoy/user/${encodeURIComponent(username)}`,
        `/piokok/user/${encodeURIComponent(username)}`,
    ]);
}
