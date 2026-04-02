if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface AccountLogin_Params {
    topAvoidArea?: number;
    theme?: ThemePalette;
    pageTitle?: string;
    loginUrl?: string;
    provider?: AccountProvider;
    loading?: boolean;
    loadError?: string;
    handledSuccess?: boolean;
    handlingSuccess?: boolean;
    initialBilibiliSessData?: string;
    initialBilibiliLinked?: boolean;
    webController?: webview.WebviewController;
    bilibiliCookiePollId?: number;
    youTubeCookiePollId?: number;
    mobileUserAgent?: string;
    bilibiliCookieProbeUrls?: string[];
    youTubeCookieProbeUrls?: string[];
}
import webview from "@ohos:web.webview";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { PageHeader } from "@bundle:com.livo.harmony/entry/ets/common/components/PageHeader";
import { getStringParams, goBack } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import type { AccountProvider } from '../common/models/LivoModels';
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { PAGE_HORIZONTAL_PADDING, PAGE_TOP_PADDING } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
import { buildAccountLoginRenderExitMessage, resolveAccountLoginWebPolicy, } from "@bundle:com.livo.harmony/entry/ets/common/utils/AccountLoginWebPolicy";
import { detectBilibiliLogin } from "@bundle:com.livo.harmony/entry/ets/common/utils/BilibiliLoginDetection";
import { detectYouTubeLoginState } from "@bundle:com.livo.harmony/entry/ets/common/utils/YouTubeLoginDetection";
import { normalizeYouTubeProfileSources, resolveYouTubeProfileName } from "@bundle:com.livo.harmony/entry/ets/common/utils/YouTubeProfileResolver";
const SETTINGS_ACTIVE_SHEET_KEY: string = 'settingsActiveSheetKey';
interface BilibiliWebNavResponse {
    code?: number;
    message?: string;
    data?: BilibiliWebNavData;
}
interface BilibiliWebNavData {
    isLogin?: boolean;
    uname?: string;
}
interface BilibiliPageState {
    currentUrl: string;
    title: string;
    displayName: string;
    loggedIn: boolean;
    cookies: string;
}
interface YouTubePageState {
    currentUrl: string;
    title: string;
    cookies: string;
    pageHtml: string;
}
class AccountLogin extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__topAvoidArea = this.createStorageProp('topAvoidArea', 0, "topAvoidArea");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.__pageTitle = new ObservedPropertySimplePU('账号关联', this, "pageTitle");
        this.__loginUrl = new ObservedPropertySimplePU('', this, "loginUrl");
        this.__provider = new ObservedPropertySimplePU('youtube', this, "provider");
        this.__loading = new ObservedPropertySimplePU(true, this, "loading");
        this.__loadError = new ObservedPropertySimplePU('', this, "loadError");
        this.__handledSuccess = new ObservedPropertySimplePU(false, this, "handledSuccess");
        this.__handlingSuccess = new ObservedPropertySimplePU(false, this, "handlingSuccess");
        this.__initialBilibiliSessData = new ObservedPropertySimplePU('', this, "initialBilibiliSessData");
        this.__initialBilibiliLinked = new ObservedPropertySimplePU(false, this, "initialBilibiliLinked");
        this.webController = new webview.WebviewController();
        this.bilibiliCookiePollId = -1;
        this.youTubeCookiePollId = -1;
        this.mobileUserAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36';
        this.bilibiliCookieProbeUrls = [
            'https://www.bilibili.com/',
            'https://passport.bilibili.com/',
            'https://m.bilibili.com/',
            'https://account.bilibili.com/',
        ];
        this.youTubeCookieProbeUrls = [
            'https://m.youtube.com/',
            'https://www.youtube.com/',
            'https://studio.youtube.com/',
            'https://myaccount.google.com/',
            'https://accounts.google.com/',
        ];
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: AccountLogin_Params) {
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.pageTitle !== undefined) {
            this.pageTitle = params.pageTitle;
        }
        if (params.loginUrl !== undefined) {
            this.loginUrl = params.loginUrl;
        }
        if (params.provider !== undefined) {
            this.provider = params.provider;
        }
        if (params.loading !== undefined) {
            this.loading = params.loading;
        }
        if (params.loadError !== undefined) {
            this.loadError = params.loadError;
        }
        if (params.handledSuccess !== undefined) {
            this.handledSuccess = params.handledSuccess;
        }
        if (params.handlingSuccess !== undefined) {
            this.handlingSuccess = params.handlingSuccess;
        }
        if (params.initialBilibiliSessData !== undefined) {
            this.initialBilibiliSessData = params.initialBilibiliSessData;
        }
        if (params.initialBilibiliLinked !== undefined) {
            this.initialBilibiliLinked = params.initialBilibiliLinked;
        }
        if (params.webController !== undefined) {
            this.webController = params.webController;
        }
        if (params.bilibiliCookiePollId !== undefined) {
            this.bilibiliCookiePollId = params.bilibiliCookiePollId;
        }
        if (params.youTubeCookiePollId !== undefined) {
            this.youTubeCookiePollId = params.youTubeCookiePollId;
        }
        if (params.mobileUserAgent !== undefined) {
            this.mobileUserAgent = params.mobileUserAgent;
        }
        if (params.bilibiliCookieProbeUrls !== undefined) {
            this.bilibiliCookieProbeUrls = params.bilibiliCookieProbeUrls;
        }
        if (params.youTubeCookieProbeUrls !== undefined) {
            this.youTubeCookieProbeUrls = params.youTubeCookieProbeUrls;
        }
    }
    updateStateVars(params: AccountLogin_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__topAvoidArea.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__pageTitle.purgeDependencyOnElmtId(rmElmtId);
        this.__loginUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__provider.purgeDependencyOnElmtId(rmElmtId);
        this.__loading.purgeDependencyOnElmtId(rmElmtId);
        this.__loadError.purgeDependencyOnElmtId(rmElmtId);
        this.__handledSuccess.purgeDependencyOnElmtId(rmElmtId);
        this.__handlingSuccess.purgeDependencyOnElmtId(rmElmtId);
        this.__initialBilibiliSessData.purgeDependencyOnElmtId(rmElmtId);
        this.__initialBilibiliLinked.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__topAvoidArea.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__pageTitle.aboutToBeDeleted();
        this.__loginUrl.aboutToBeDeleted();
        this.__provider.aboutToBeDeleted();
        this.__loading.aboutToBeDeleted();
        this.__loadError.aboutToBeDeleted();
        this.__handledSuccess.aboutToBeDeleted();
        this.__handlingSuccess.aboutToBeDeleted();
        this.__initialBilibiliSessData.aboutToBeDeleted();
        this.__initialBilibiliLinked.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __topAvoidArea: ObservedPropertyAbstractPU<number>;
    get topAvoidArea() {
        return this.__topAvoidArea.get();
    }
    set topAvoidArea(newValue: number) {
        this.__topAvoidArea.set(newValue);
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private __pageTitle: ObservedPropertySimplePU<string>;
    get pageTitle() {
        return this.__pageTitle.get();
    }
    set pageTitle(newValue: string) {
        this.__pageTitle.set(newValue);
    }
    private __loginUrl: ObservedPropertySimplePU<string>;
    get loginUrl() {
        return this.__loginUrl.get();
    }
    set loginUrl(newValue: string) {
        this.__loginUrl.set(newValue);
    }
    private __provider: ObservedPropertySimplePU<AccountProvider>;
    get provider() {
        return this.__provider.get();
    }
    set provider(newValue: AccountProvider) {
        this.__provider.set(newValue);
    }
    private __loading: ObservedPropertySimplePU<boolean>;
    get loading() {
        return this.__loading.get();
    }
    set loading(newValue: boolean) {
        this.__loading.set(newValue);
    }
    private __loadError: ObservedPropertySimplePU<string>;
    get loadError() {
        return this.__loadError.get();
    }
    set loadError(newValue: string) {
        this.__loadError.set(newValue);
    }
    private __handledSuccess: ObservedPropertySimplePU<boolean>;
    get handledSuccess() {
        return this.__handledSuccess.get();
    }
    set handledSuccess(newValue: boolean) {
        this.__handledSuccess.set(newValue);
    }
    private __handlingSuccess: ObservedPropertySimplePU<boolean>;
    get handlingSuccess() {
        return this.__handlingSuccess.get();
    }
    set handlingSuccess(newValue: boolean) {
        this.__handlingSuccess.set(newValue);
    }
    private __initialBilibiliSessData: ObservedPropertySimplePU<string>;
    get initialBilibiliSessData() {
        return this.__initialBilibiliSessData.get();
    }
    set initialBilibiliSessData(newValue: string) {
        this.__initialBilibiliSessData.set(newValue);
    }
    private __initialBilibiliLinked: ObservedPropertySimplePU<boolean>;
    get initialBilibiliLinked() {
        return this.__initialBilibiliLinked.get();
    }
    set initialBilibiliLinked(newValue: boolean) {
        this.__initialBilibiliLinked.set(newValue);
    }
    private webController: webview.WebviewController;
    private bilibiliCookiePollId: number;
    private youTubeCookiePollId: number;
    private readonly mobileUserAgent: string;
    private readonly bilibiliCookieProbeUrls: string[];
    private readonly youTubeCookieProbeUrls: string[];
    aboutToAppear(): void {
        this.theme = ThemeService.currentPalette();
        const params = getStringParams();
        this.pageTitle = params.title || '账号关联';
        this.loginUrl = params.loginUrl || '';
        const provider = params.provider;
        if (provider === 'youtube' || provider === 'x' || provider === 'instagram' || provider === 'bilibili') {
            this.provider = provider;
        }
        if (this.provider === 'bilibili') {
            void this.loadInitialBilibiliSessData();
            this.startBilibiliCookiePolling();
        }
        if (this.provider === 'youtube') {
            this.startYouTubeCookiePolling();
        }
    }
    aboutToDisappear(): void {
        this.stopBilibiliCookiePolling();
        this.stopYouTubeCookiePolling();
        void webview.WebCookieManager.saveCookieAsync();
        if (this.provider === 'bilibili' && !this.handledSuccess) {
            void this.persistBilibiliSessionIfAvailable(false);
        }
        if (this.provider === 'youtube' && !this.handledSuccess) {
            void this.persistYouTubeSessionIfAvailable(false);
        }
    }
    private async loadInitialBilibiliSessData(): Promise<void> {
        try {
            this.initialBilibiliSessData = await AppRepository.bilibiliSessData();
            const status = await AppRepository.accountStatus('bilibili');
            this.initialBilibiliLinked = status.linked && !status.error;
            console.info(`AccountLogin initial bilibili linked=${status.linked} displayName=${status.displayName} error=${status.error} hasSessdata=${this.initialBilibiliSessData ? 'true' : 'false'}`);
        }
        catch (_error) {
            this.initialBilibiliSessData = '';
            this.initialBilibiliLinked = false;
        }
    }
    private normalizeScriptResult(value: string): string {
        const trimmed = (value || '').trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
            return trimmed.substring(1, trimmed.length - 1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
        return trimmed;
    }
    private fetchCookieSafe(url: string): string {
        try {
            return webview.WebCookieManager.fetchCookieSync(url);
        }
        catch (_error) {
            return '';
        }
    }
    private async currentBilibiliNavState(): Promise<BilibiliWebNavResponse | null> {
        try {
            const script = `
        (async () => {
          try {
            const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Accept': 'application/json, text/plain, */*'
              }
            });
            return await response.text();
          } catch (error) {
            return JSON.stringify({ __livo_error: String(error) });
          }
        })()
      `;
            const result = await this.webController.runJavaScript(script);
            const normalized = this.normalizeScriptResult(result);
            if (!normalized) {
                return null;
            }
            return JSON.parse(normalized) as BilibiliWebNavResponse;
        }
        catch (_error) {
            return null;
        }
    }
    private async currentBilibiliPageState(): Promise<BilibiliPageState | null> {
        try {
            const script = `
        (() => {
          try {
            const html = document.documentElement?.innerHTML || '';
            const initialState = globalThis.__INITIAL_STATE__ || globalThis.__INITIAL_DATA__ || {};
            const stateText = JSON.stringify(initialState || {});
            const find = (patterns) => {
              for (const pattern of patterns) {
                const matched = html.match(pattern) || stateText.match(pattern);
                if (matched && matched[1]) {
                  return String(matched[1]).trim();
                }
              }
              return '';
            };
            const displayName =
              find([
                /"uname":"([^"]+)"/,
                /"username":"([^"]+)"/,
                /"nickName":"([^"]+)"/
              ]) ||
              String(document.querySelector('[class*="name"],[class*="uname"],[data-user-name]')?.textContent || '').trim();
            const loggedIn =
              /"isLogin"\\s*:\\s*true/.test(html) ||
              /"isLogin"\\s*:\\s*true/.test(stateText) ||
              !!displayName;
            return JSON.stringify({
              currentUrl: location.href || '',
              title: document.title || '',
              displayName,
              loggedIn,
              cookies: document.cookie || ''
            });
          } catch (error) {
            return JSON.stringify({
              currentUrl: location.href || '',
              title: document.title || '',
              displayName: '',
              loggedIn: false,
              cookies: ''
            });
          }
        })()
      `;
            const result = await this.webController.runJavaScript(script);
            const normalized = this.normalizeScriptResult(result);
            if (!normalized) {
                return null;
            }
            return JSON.parse(normalized) as BilibiliPageState;
        }
        catch (_error) {
            return null;
        }
    }
    private async currentDocumentCookies(): Promise<string> {
        try {
            const result = await this.webController.runJavaScript('document.cookie');
            return this.normalizeScriptResult(result);
        }
        catch (_error) {
            return '';
        }
    }
    private bilibiliCookieGroups(currentUrl: string, documentCookies: string): string[] {
        const cookieGroups: string[] = [];
        if (documentCookies.trim()) {
            cookieGroups.push(documentCookies);
        }
        if (currentUrl.trim()) {
            cookieGroups.push(this.fetchCookieSafe(currentUrl));
        }
        this.bilibiliCookieProbeUrls.forEach((url: string) => {
            cookieGroups.push(this.fetchCookieSafe(url));
        });
        return cookieGroups;
    }
    private youTubeCookieGroups(currentUrl: string, documentCookies: string): string[] {
        const cookieGroups: string[] = [];
        if (documentCookies.trim()) {
            cookieGroups.push(documentCookies);
        }
        if (currentUrl.trim()) {
            cookieGroups.push(this.fetchCookieSafe(currentUrl));
        }
        this.youTubeCookieProbeUrls.forEach((url: string) => {
            cookieGroups.push(this.fetchCookieSafe(url));
        });
        return cookieGroups;
    }
    private startBilibiliCookiePolling(): void {
        this.stopBilibiliCookiePolling();
        this.bilibiliCookiePollId = setInterval(() => {
            if (this.provider === 'bilibili') {
                void this.persistBilibiliSessionIfAvailable(true);
            }
        }, 1200);
    }
    private stopBilibiliCookiePolling(): void {
        if (this.bilibiliCookiePollId >= 0) {
            clearInterval(this.bilibiliCookiePollId);
            this.bilibiliCookiePollId = -1;
        }
    }
    private startYouTubeCookiePolling(): void {
        this.stopYouTubeCookiePolling();
        this.youTubeCookiePollId = setInterval(() => {
            if (this.provider === 'youtube') {
                void this.persistYouTubeSessionIfAvailable(true);
            }
        }, 1500);
    }
    private stopYouTubeCookiePolling(): void {
        if (this.youTubeCookiePollId >= 0) {
            clearInterval(this.youTubeCookiePollId);
            this.youTubeCookiePollId = -1;
        }
    }
    private async fetchYouTubeProfileSources(): Promise<string[]> {
        try {
            const script = `
        (async () => {
          const urls = [
            'https://www.youtube.com/account',
            'https://www.youtube.com/',
            'https://myaccount.google.com/',
            'https://myaccount.google.com/personal-info'
          ];
          const outputs = [];
          for (const target of urls) {
            try {
              const response = await fetch(target, {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
              });
              outputs.push(response.ok ? await response.text() : '');
            } catch (error) {
              outputs.push('');
            }
          }
          return JSON.stringify(outputs);
        })()
      `;
            const result = await this.webController.runJavaScript(script);
            const normalized = this.normalizeScriptResult(result);
            if (!normalized) {
                return [];
            }
            return normalizeYouTubeProfileSources(JSON.parse(normalized) as Object | string[] | null | undefined);
        }
        catch (_error) {
            return [];
        }
    }
    private async resolveYouTubeDisplayName(currentPageHtml: string): Promise<string> {
        const sources: string[] = [];
        if (currentPageHtml.trim()) {
            sources.push(currentPageHtml);
        }
        const fetchedSources = normalizeYouTubeProfileSources(await this.fetchYouTubeProfileSources());
        fetchedSources.forEach((html: string) => {
            if (html.trim()) {
                sources.push(html);
            }
        });
        return resolveYouTubeProfileName(sources);
    }
    private async persistBilibiliSessionIfAvailable(shouldAutoBack: boolean): Promise<void> {
        if (this.provider !== 'bilibili' || this.handledSuccess || this.handlingSuccess) {
            return;
        }
        try {
            await webview.WebCookieManager.saveCookieAsync();
            const nav = await this.currentBilibiliNavState();
            const pageState = await this.currentBilibiliPageState();
            const currentUrl = this.webController.getUrl();
            const documentCookies = (pageState?.cookies || '').trim() || await this.currentDocumentCookies();
            const detection = detectBilibiliLogin({
                nav,
                pageState,
                currentUrl,
                cookieGroups: this.bilibiliCookieGroups(currentUrl, documentCookies),
            });
            const fallbackDisplayName = detection.displayName || 'Bilibili 已关联';
            console.info(`AccountLogin bilibili detect currentUrl=${detection.effectiveUrl} navLoggedIn=${detection.navLoggedIn} pageLoggedIn=${detection.pageLoggedIn} hasSessionCookie=${detection.hasSessionCookie} displayName=${fallbackDisplayName} hasSessdata=${detection.sessdata ? 'true' : 'false'}`);
            if (!detection.loggedIn) {
                return;
            }
            this.handlingSuccess = true;
            const status = await AppRepository.setBilibiliVerifiedLink(fallbackDisplayName, detection.sessdata);
            console.info(`AccountLogin bilibili persist linked=${status.linked} displayName=${status.displayName} error=${status.error}`);
            if (!status.linked || !!status.error) {
                console.error(`AccountLogin bilibili persist rejected linked=${status.linked} displayName=${status.displayName} error=${status.error}`);
                this.handlingSuccess = false;
                return;
            }
            this.handledSuccess = true;
            this.initialBilibiliSessData = detection.sessdata;
            this.initialBilibiliLinked = true;
            this.stopBilibiliCookiePolling();
            AppStorage.setOrCreate(SETTINGS_ACTIVE_SHEET_KEY, 'accounts');
            AppStorage.setOrCreate('settingsOverlayLevel', 1);
            AppStorage.setOrCreate('accountLinkResultProvider', 'bilibili');
            AppStorage.setOrCreate('accountLinkResultDisplayName', fallbackDisplayName);
            AppStorage.setOrCreate('accountLinkResultLinked', true);
            AppStorage.setOrCreate('accountLinkResultAt', Date.now());
            AppStorage.setOrCreate('accountsStatusRefreshAt', Date.now());
            if (shouldAutoBack) {
                setTimeout(() => {
                    void goBack();
                }, 120);
            }
        }
        catch (error) {
            console.error(`AccountLogin bilibili persist exception: ${error instanceof Error ? error.message : `${error}`}`);
            this.handlingSuccess = false;
        }
    }
    private async tryHandleBilibiliLogin(): Promise<void> {
        if (this.provider !== 'bilibili' || this.handledSuccess || this.handlingSuccess) {
            return;
        }
        try {
            await this.persistBilibiliSessionIfAvailable(true);
        }
        catch (_error) {
        }
    }
    private async currentYouTubePageState(): Promise<YouTubePageState | null> {
        try {
            const script = `
        (() => {
          const read = (value) => typeof value === 'string' ? value.trim() : '';
          try {
            const html = document.documentElement?.innerHTML || '';
            const byPattern = (patterns) => {
              for (const pattern of patterns) {
                const matched = html.match(pattern);
                if (matched && matched[1]) {
                  return String(matched[1]).trim();
                }
              }
              return '';
            };
            const channelHandle =
              read(document.querySelector('a[href^="/@"]')?.textContent) ||
              byPattern([
                /"channelHandle":"(@[^"]+)"/,
                /\\"channelHandle\\":"(@[^\\"]+)\\"/
              ]);
            const accountName =
              read(document.querySelector('yt-formatted-string#account-name')?.textContent) ||
              read(document.querySelector('button#avatar-btn')?.getAttribute('aria-label')).replace(/^Google Account[:\\s]*/i, '') ||
              read(document.querySelector('img#img')?.getAttribute('alt')).replace(/^Google Account[:\\s]*/i, '') ||
              byPattern([
                /"accountName":"([^"]+)"/,
                /\\"accountName\\":"([^\\"]+)\\"/
              ]);
            const channelName = byPattern([
              /"channelName":"([^"]+)"/,
              /\\"channelName\\":"([^\\"]+)\\"/
            ]);
            const displayName = byPattern([
              /"displayName":"([^"]+)"/,
              /\\"displayName\\":"([^\\"]+)\\"/,
              /"fullName":"([^"]+)"/,
              /\\"fullName\\":"([^\\"]+)\\"/,
              /"givenName":"([^"]+)"/,
              /\\"givenName\\":"([^\\"]+)\\"/
            ]);
            return JSON.stringify({
              currentUrl: location.href || '',
              title: document.title || '',
              cookies: document.cookie || '',
              pageHtml: JSON.stringify({
                channelHandle,
                accountName,
                channelName,
                displayName
              })
            });
          } catch (error) {
            return JSON.stringify({
              currentUrl: location.href || '',
              title: document.title || '',
              cookies: document.cookie || '',
              pageHtml: ''
            });
          }
        })()
      `;
            const result = await this.webController.runJavaScript(script);
            const normalized = this.normalizeScriptResult(result);
            if (!normalized) {
                return null;
            }
            return JSON.parse(normalized) as YouTubePageState;
        }
        catch (_error) {
            return null;
        }
    }
    private async persistYouTubeSessionIfAvailable(shouldAutoBack: boolean): Promise<void> {
        if (this.provider !== 'youtube' || this.handledSuccess || this.handlingSuccess) {
            return;
        }
        try {
            await webview.WebCookieManager.saveCookieAsync();
            const pageState = await this.currentYouTubePageState();
            const currentUrl = (pageState?.currentUrl || this.webController.getUrl() || '').trim();
            const documentCookies = (pageState?.cookies || '').trim() || await this.currentDocumentCookies();
            const detection = detectYouTubeLoginState({
                currentUrl,
                title: pageState?.title || '',
                documentCookies: this.youTubeCookieGroups(currentUrl, documentCookies).join('; '),
                pageHtml: pageState?.pageHtml || '',
            });
            if (!detection.loggedIn) {
                return;
            }
            this.handlingSuccess = true;
            this.stopYouTubeCookiePolling();
            const resolvedDisplayName = await this.resolveYouTubeDisplayName(pageState?.pageHtml || '');
            const fallbackDisplayName = resolvedDisplayName || detection.displayName || 'YouTube 已关联';
            console.info(`AccountLogin youtube detect currentUrl=${currentUrl} loggedIn=${detection.loggedIn} inLoginFlow=${detection.inLoginFlow} hasSessionCookie=${detection.hasSessionCookie} detectedDisplayName=${detection.displayName || ''} resolvedDisplayName=${resolvedDisplayName || ''} fallbackDisplayName=${fallbackDisplayName}`);
            const status = await AppRepository.setVerifiedAccountLink('youtube', fallbackDisplayName);
            console.info(`AccountLogin youtube persist linked=${status.linked} displayName=${status.displayName} error=${status.error}`);
            if (!status.linked || !!status.error) {
                console.error(`AccountLogin youtube persist rejected linked=${status.linked} displayName=${status.displayName} error=${status.error}`);
                this.handlingSuccess = false;
                return;
            }
            this.handledSuccess = true;
            AppStorage.setOrCreate(SETTINGS_ACTIVE_SHEET_KEY, 'accounts');
            AppStorage.setOrCreate('settingsOverlayLevel', 1);
            AppStorage.setOrCreate('accountLinkResultProvider', 'youtube');
            AppStorage.setOrCreate('accountLinkResultDisplayName', fallbackDisplayName);
            AppStorage.setOrCreate('accountLinkResultLinked', true);
            AppStorage.setOrCreate('accountLinkResultAt', Date.now());
            AppStorage.setOrCreate('accountsStatusRefreshAt', Date.now());
            if (shouldAutoBack) {
                setTimeout(() => {
                    void goBack();
                }, 120);
            }
        }
        catch (error) {
            console.error(`AccountLogin youtube persist exception: ${error instanceof Error ? error.message : `${error}`}`);
            this.handlingSuccess = false;
            if (this.provider === 'youtube' && !this.handledSuccess) {
                this.startYouTubeCookiePolling();
            }
        }
    }
    private async tryHandleYouTubeLogin(): Promise<void> {
        if (this.provider !== 'youtube' || this.handledSuccess || this.handlingSuccess) {
            return;
        }
        try {
            await this.persistYouTubeSessionIfAvailable(true);
        }
        catch (_error) {
        }
    }
    private allowWindowOpenMethod(): boolean {
        return resolveAccountLoginWebPolicy(this.provider).allowWindowOpenMethod;
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 0 });
            Column.width('100%');
            Column.height('100%');
            Column.padding({ top: this.topAvoidArea });
            Column.backgroundColor(this.theme.background);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 10 });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.width('100%');
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new PageHeader(this, {
                        title: this.pageTitle,
                        theme: this.theme,
                        showBackButton: true,
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0,
                        onBack: () => { void goBack(); },
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/AccountLogin.ets", line: 574, col: 9 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            title: this.pageTitle,
                            theme: this.theme,
                            showBackButton: true,
                            titleSize: 20,
                            topPadding: 0,
                            bottomPadding: 0,
                            onBack: () => { void goBack(); }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        title: this.pageTitle,
                        theme: this.theme,
                        showBackButton: true,
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0
                    });
                }
            }, { name: "PageHeader" });
        }
        __Common__.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.loginUrl) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Stack.create({ alignContent: Alignment.Center });
                        Stack.width('100%');
                        Stack.layoutWeight(1);
                    }, Stack);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Web.create({
                            src: this.loginUrl,
                            controller: this.webController,
                        });
                        Web.width('100%');
                        Web.height('100%');
                        Web.javaScriptAccess(true);
                        Web.domStorageAccess(true);
                        Web.mixedMode(MixedMode.All);
                        Web.allowWindowOpenMethod(this.allowWindowOpenMethod());
                        Web.onControllerAttached(() => {
                            try {
                                webview.WebCookieManager.putAcceptCookieEnabled(true);
                                webview.WebCookieManager.putAcceptThirdPartyCookieEnabled(true);
                                this.webController.setCustomUserAgent(this.mobileUserAgent);
                            }
                            catch (_error) {
                            }
                        });
                        Web.onPageBegin((_event: OnPageBeginEvent) => {
                            this.loading = true;
                            this.loadError = '';
                        });
                        Web.onPageEnd((_event: OnPageEndEvent) => {
                            this.loading = false;
                            if (this.provider === 'bilibili') {
                                void this.tryHandleBilibiliLogin();
                            }
                            if (this.provider === 'youtube') {
                                void this.tryHandleYouTubeLogin();
                            }
                        });
                        Web.onErrorReceive((event: OnErrorReceiveEvent) => {
                            if (event.request?.isMainFrame()) {
                                this.loading = false;
                                this.loadError = '登录页加载失败，请稍后重试';
                            }
                        });
                        Web.onRenderExited((event: OnRenderExitedEvent) => {
                            this.loading = false;
                            this.loadError = buildAccountLoginRenderExitMessage(this.provider, event?.renderExitReason ?? -1);
                            console.error(`AccountLogin render exited provider=${this.provider} reason=${event?.renderExitReason ?? -1}`);
                        });
                    }, Web);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.loading && !this.loadError) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Column.create({ space: 10 });
                                    Column.padding({ left: 18, right: 18, top: 14, bottom: 14 });
                                    Column.backgroundColor('rgba(255,255,255,0.88)');
                                    Column.borderRadius(18);
                                }, Column);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    LoadingProgress.create();
                                    LoadingProgress.width(26);
                                    LoadingProgress.height(26);
                                    LoadingProgress.color(this.theme.accent);
                                }, LoadingProgress);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create('正在打开登录页...');
                                    Text.fontSize(13);
                                    Text.fontColor(this.theme.textSecondary);
                                }, Text);
                                Text.pop();
                                Column.pop();
                            });
                        }
                        else {
                            this.ifElseBranchUpdateFunction(1, () => {
                            });
                        }
                    }, If);
                    If.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.loadError) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Column.create({ space: 8 });
                                    Column.padding({ left: 18, right: 18, top: 16, bottom: 16 });
                                    Column.backgroundColor(this.theme.surface);
                                    Column.borderRadius(18);
                                    Column.margin({ left: 24, right: 24 });
                                }, Column);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create('打开失败');
                                    Text.fontSize(16);
                                    Text.fontWeight(FontWeight.Bold);
                                    Text.fontColor(this.theme.textPrimary);
                                }, Text);
                                Text.pop();
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create(this.loadError);
                                    Text.fontSize(13);
                                    Text.lineHeight(20);
                                    Text.fontColor(this.theme.textSecondary);
                                    Text.textAlign(TextAlign.Center);
                                }, Text);
                                Text.pop();
                                Column.pop();
                            });
                        }
                        else {
                            this.ifElseBranchUpdateFunction(1, () => {
                            });
                        }
                    }, If);
                    If.pop();
                    Stack.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 10 });
                        Column.width('100%');
                        Column.layoutWeight(1);
                        Column.justifyContent(FlexAlign.Center);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('未找到登录地址');
                        Text.fontSize(18);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('请返回上一页后重试。');
                        Text.fontSize(13);
                        Text.fontColor(this.theme.textSecondary);
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "AccountLogin";
    }
}
registerNamedRoute(() => new AccountLogin(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/AccountLogin", pageFullPath: "entry/src/main/ets/pages/AccountLogin", integratedHsp: "false", moduleType: "followWithHap" });
