import http from "@ohos:net.http";
import preferences from "@ohos:data.preferences";
import type { AccountProvider, AccountStatusResult } from '../models/LivoModels';
import { AppContextService } from "@bundle:com.livo.harmony/entry/ets/common/services/AppContextService";
import { resolveBilibiliStoredState } from "@bundle:com.livo.harmony/entry/ets/common/utils/BilibiliAccountStatus";
import { resolveYouTubeLoginUrl } from "@bundle:com.livo.harmony/entry/ets/common/utils/YouTubeLoginUrl";
const ACCOUNT_PREFERENCES_NAME = 'livo_harmony_accounts';
const BILIBILI_NAV_URL = 'https://api.bilibili.com/x/web-interface/nav';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36';
interface BilibiliNavResponse {
    code?: number;
    message?: string;
    data?: BilibiliNavData;
}
interface BilibiliNavData {
    isLogin?: boolean;
    uname?: string;
    mid?: number;
}
export class AccountSessionService {
    private static pref: preferences.Preferences | null = null;
    private static async getPref(): Promise<preferences.Preferences | null> {
        if (!AccountSessionService.pref) {
            try {
                AccountSessionService.pref = await preferences.getPreferences(AppContextService.getContext(), ACCOUNT_PREFERENCES_NAME);
            }
            catch (_error) {
                return null;
            }
        }
        return AccountSessionService.pref!;
    }
    private static linkedKey(provider: AccountProvider): string {
        return `account.${provider}.linked`;
    }
    private static displayNameKey(provider: AccountProvider): string {
        return `account.${provider}.displayName`;
    }
    private static bilibiliSessDataKey(): string {
        return 'account.bilibili.sessdata';
    }
    static loginUrl(provider: AccountProvider): string {
        switch (provider) {
            case 'youtube':
                return resolveYouTubeLoginUrl();
            case 'x':
                return 'https://x.com/i/flow/login';
            case 'instagram':
                return 'https://www.instagram.com/accounts/login/';
            case 'bilibili':
                return 'https://passport.bilibili.com/login';
            default:
                return '';
        }
    }
    private static providerLabel(provider: AccountProvider): string {
        switch (provider) {
            case 'youtube':
                return 'YouTube';
            case 'x':
                return 'X';
            case 'instagram':
                return 'Instagram';
            case 'bilibili':
                return 'Bilibili';
            default:
                return provider;
        }
    }
    private static async saveStatus(provider: AccountProvider, linked: boolean, displayName: string): Promise<void> {
        const pref = await AccountSessionService.getPref();
        if (!pref) {
            throw new Error('账号信息存储不可用');
        }
        try {
            await pref.put(AccountSessionService.linkedKey(provider), linked);
            await pref.put(AccountSessionService.displayNameKey(provider), displayName.trim());
            await pref.flush();
        }
        catch (error) {
            throw new Error(error instanceof Error ? error.message : '账号信息存储失败');
        }
    }
    private static async saveBilibiliSessDataValue(sessdata: string): Promise<void> {
        const pref = await AccountSessionService.getPref();
        if (!pref) {
            throw new Error('账号信息存储不可用');
        }
        try {
            await pref.put(AccountSessionService.bilibiliSessDataKey(), sessdata.trim());
            await pref.flush();
        }
        catch (error) {
            throw new Error(error instanceof Error ? error.message : '保存 Bilibili 会话失败');
        }
    }
    private static async fetchBilibiliNav(sessdata: string): Promise<BilibiliNavResponse> {
        const request = http.createHttp();
        try {
            const response = await request.request(BILIBILI_NAV_URL, {
                method: http.RequestMethod.GET,
                connectTimeout: 8000,
                readTimeout: 8000,
                header: {
                    'User-Agent': MOBILE_USER_AGENT,
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': 'https://www.bilibili.com/',
                    'Cookie': `SESSDATA=${sessdata}`,
                },
            });
            if (response.responseCode !== 200) {
                throw new Error(`HTTP ${response.responseCode}`);
            }
            return JSON.parse(String(response.result)) as BilibiliNavResponse;
        }
        catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Bilibili 状态请求失败');
        }
        finally {
            try {
                request.destroy();
            }
            catch (_error) {
            }
        }
    }
    private static emptyStatus(provider: AccountProvider): AccountStatusResult {
        const status: AccountStatusResult = {
            provider,
            linked: false,
            displayName: '',
            error: '',
        };
        return status;
    }
    static async status(provider: AccountProvider): Promise<AccountStatusResult> {
        try {
            const pref = await AccountSessionService.getPref();
            if (!pref) {
                const status = AccountSessionService.emptyStatus(provider);
                status.error = '读取账号状态失败';
                return status;
            }
            const linked = await pref.get(AccountSessionService.linkedKey(provider), false) as boolean;
            const displayName = await pref.get(AccountSessionService.displayNameKey(provider), linked ? `${AccountSessionService.providerLabel(provider)} 已关联` : '') as string;
            console.info(`AccountSessionService status storage provider=${provider} linked=${linked} displayName=${displayName.trim()} hasDisplayName=${displayName.trim() ? 'true' : 'false'}`);
            if (provider === 'bilibili') {
                const sessdata = await pref.get(AccountSessionService.bilibiliSessDataKey(), '') as string;
                const storedState = resolveBilibiliStoredState({
                    linked,
                    displayName,
                    sessdata,
                });
                if (!storedState.shouldTreatAsLinked) {
                    const status: AccountStatusResult = {
                        provider,
                        linked: false,
                        displayName: '',
                        error: '',
                    };
                    console.info('AccountSessionService bilibili status linked=false mode=empty hasSessdata=false');
                    return status;
                }
                if (!sessdata.trim()) {
                    if (!linked) {
                        await AccountSessionService.saveStatus(provider, true, storedState.displayName);
                    }
                    const status: AccountStatusResult = {
                        provider,
                        linked: true,
                        displayName: storedState.displayName,
                        error: '',
                    };
                    console.info(`AccountSessionService bilibili status linked=true displayName=${status.displayName} mode=stored-only hasSessdata=false`);
                    return status;
                }
                try {
                    console.info(`AccountSessionService bilibili nav verify start linked=${linked} displayName=${storedState.displayName} hasSessdata=true`);
                    const nav = await AccountSessionService.fetchBilibiliNav(sessdata.trim());
                    if (nav.code === 0 && nav.data?.isLogin) {
                        const nextDisplayName = (nav.data?.uname || storedState.displayName || 'Bilibili 已关联').trim();
                        await AccountSessionService.saveStatus(provider, true, nextDisplayName);
                        const status: AccountStatusResult = {
                            provider,
                            linked: true,
                            displayName: nextDisplayName,
                            error: '',
                        };
                        console.info(`AccountSessionService bilibili status linked=true displayName=${status.displayName} mode=nav-verified`);
                        return status;
                    }
                    const status: AccountStatusResult = {
                        provider,
                        linked: true,
                        displayName: storedState.displayName,
                        error: nav.message || 'SESSDATA 无效或已过期',
                    };
                    console.info(`AccountSessionService bilibili status linked=${status.linked} displayName=${status.displayName} error=${status.error} mode=nav-rejected hasSessdata=true`);
                    return status;
                }
                catch (error) {
                    if (!linked) {
                        await AccountSessionService.saveStatus(provider, true, storedState.displayName);
                    }
                    const fallbackStatus: AccountStatusResult = {
                        provider,
                        linked: true,
                        displayName: storedState.displayName,
                        error: '',
                    };
                    console.info(`AccountSessionService bilibili status linked=${fallbackStatus.linked} displayName=${fallbackStatus.displayName} mode=nav-fallback hasSessdata=true reason=${error instanceof Error ? error.message : 'unknown'}`);
                    return fallbackStatus;
                }
            }
            const status: AccountStatusResult = {
                provider,
                linked,
                displayName: linked ? displayName : '',
                error: '',
            };
            console.info(`AccountSessionService status provider=${provider} linked=${status.linked} displayName=${status.displayName} error=${status.error}`);
            return status;
        }
        catch (error) {
            const status = AccountSessionService.emptyStatus(provider);
            status.error = error instanceof Error ? error.message : '读取账号状态失败';
            console.info(`AccountSessionService status provider=${provider} linked=${status.linked} displayName=${status.displayName} error=${status.error} mode=exception`);
            return status;
        }
    }
    static async link(provider: AccountProvider): Promise<AccountStatusResult> {
        return AccountSessionService.status(provider);
    }
    static async unlink(provider: AccountProvider): Promise<AccountStatusResult> {
        try {
            const pref = await AccountSessionService.getPref();
            if (!pref) {
                const status = AccountSessionService.emptyStatus(provider);
                status.error = '取消关联失败';
                return status;
            }
            await pref.put(AccountSessionService.linkedKey(provider), false);
            await pref.put(AccountSessionService.displayNameKey(provider), '');
            if (provider === 'bilibili') {
                await pref.put(AccountSessionService.bilibiliSessDataKey(), '');
            }
            await pref.flush();
            return await AccountSessionService.status(provider);
        }
        catch (error) {
            const status = AccountSessionService.emptyStatus(provider);
            status.error = error instanceof Error ? error.message : '取消关联失败';
            return status;
        }
    }
    static async setDisplayName(provider: AccountProvider, displayName: string): Promise<AccountStatusResult> {
        const nextName = displayName.trim();
        if (!nextName) {
            const status = AccountSessionService.emptyStatus(provider);
            status.error = '请输入账号名';
            return status;
        }
        try {
            await AccountSessionService.saveStatus(provider, true, nextName);
            return await AccountSessionService.status(provider);
        }
        catch (error) {
            const status = AccountSessionService.emptyStatus(provider);
            status.error = error instanceof Error ? error.message : '保存账号名失败';
            return status;
        }
    }
    static async bilibiliSessData(): Promise<string> {
        try {
            const pref = await AccountSessionService.getPref();
            if (!pref) {
                return '';
            }
            const value = await pref.get(AccountSessionService.bilibiliSessDataKey(), '') as string;
            return value.trim();
        }
        catch (_error) {
            return '';
        }
    }
    static async setBilibiliSessData(sessdata: string): Promise<AccountStatusResult> {
        const nextValue = sessdata.trim();
        if (!nextValue) {
            const status = AccountSessionService.emptyStatus('bilibili');
            status.error = '请输入有效的 SESSDATA';
            return status;
        }
        try {
            const pref = await AccountSessionService.getPref();
            if (!pref) {
                const status = AccountSessionService.emptyStatus('bilibili');
                status.error = '保存 SESSDATA 失败';
                return status;
            }
            console.info(`AccountSessionService setBilibiliSessData hasSessdata=${nextValue ? 'true' : 'false'}`);
            await pref.put(AccountSessionService.linkedKey('bilibili'), true);
            await pref.put(AccountSessionService.bilibiliSessDataKey(), nextValue);
            await pref.flush();
            return await AccountSessionService.status('bilibili');
        }
        catch (error) {
            const status = AccountSessionService.emptyStatus('bilibili');
            status.error = error instanceof Error ? error.message : '保存 SESSDATA 失败';
            return status;
        }
    }
    static async setBilibiliVerifiedLink(displayName: string, sessdata?: string): Promise<AccountStatusResult> {
        const nextName = displayName.trim() || 'Bilibili 已关联';
        try {
            console.info(`AccountSessionService setBilibiliVerifiedLink displayName=${nextName} hasSessdata=${(sessdata || '').trim() ? 'true' : 'false'}`);
            await AccountSessionService.saveStatus('bilibili', true, nextName);
            if ((sessdata || '').trim()) {
                await AccountSessionService.saveBilibiliSessDataValue((sessdata || '').trim());
            }
            return await AccountSessionService.status('bilibili');
        }
        catch (error) {
            const status = AccountSessionService.emptyStatus('bilibili');
            status.error = error instanceof Error ? error.message : '保存 Bilibili 登录状态失败';
            return status;
        }
    }
    static async setVerifiedLink(provider: AccountProvider, displayName: string): Promise<AccountStatusResult> {
        const nextName = displayName.trim() || `${AccountSessionService.providerLabel(provider)} 已关联`;
        try {
            console.info(`AccountSessionService setVerifiedLink provider=${provider} displayName=${nextName}`);
            await AccountSessionService.saveStatus(provider, true, nextName);
            return await AccountSessionService.status(provider);
        }
        catch (error) {
            const status = AccountSessionService.emptyStatus(provider);
            status.error = error instanceof Error ? error.message : `保存${AccountSessionService.providerLabel(provider)}登录状态失败`;
            return status;
        }
    }
}
