if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface AccountsSettingsPanel_Params {
    accountsStatusRefreshAt?: number;
    accountLinkResultAt?: number;
    accountLinkResultProvider?: AccountProvider | '';
    accountLinkResultDisplayName?: string;
    accountLinkResultLinked?: boolean;
    theme?: ThemePalette;
    inheritedTheme?: ThemePalette;
    providerCards?: AccountProviderCard[];
    providerDrafts?: ProviderDraft[];
    providerMessages?: ProviderDraft[];
    activeProvider?: AccountProvider | '';
    selfChecking?: boolean;
    selfCheckSummary?: string;
    selfCheckRows?: AccountSelfCheckRow[];
    bilibiliPreviewing?: boolean;
    bilibiliImporting?: boolean;
    bilibiliFeedback?: string;
    bilibiliPendingCreators?: PendingBilibiliCreator[];
    bilibiliSelectedMids?: number[];
    bilibiliSelectedViews?: FeedViewType[];
    bilibiliImportProgressText?: string;
    bilibiliSessData?: string;
}
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { FeedViewType, } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { AccountProvider, AccountSelfCheckRow, AccountStatusResult, BilibiliImportProgress, PendingBilibiliCreator } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { PageHeader } from "@bundle:com.livo.harmony/entry/ets/common/components/PageHeader";
import { AccountSelfCheckService } from "@bundle:com.livo.harmony/entry/ets/common/services/AccountSelfCheckService";
import { ExternalUrlService } from "@bundle:com.livo.harmony/entry/ets/common/services/ExternalUrlService";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { openAccountLogin } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import { accountCardHeadlineStatus } from "@bundle:com.livo.harmony/entry/ets/common/utils/AccountCardHeadline";
import { accountCardRenderKey } from "@bundle:com.livo.harmony/entry/ets/common/utils/AccountCardRenderKey";
import { resolveExternalBrowserCheckMessage } from "@bundle:com.livo.harmony/entry/ets/common/utils/AccountBrowserCheckMessage";
import { resolveAccountLoginWebPolicy } from "@bundle:com.livo.harmony/entry/ets/common/utils/AccountLoginWebPolicy";
import { buildLinkNavigationFailureStatus } from "@bundle:com.livo.harmony/entry/ets/common/utils/AccountNavigationError";
import { mergeStatusWithAccountLinkResult } from "@bundle:com.livo.harmony/entry/ets/common/utils/AccountLinkResult";
import type { AccountLinkResultState } from "@bundle:com.livo.harmony/entry/ets/common/utils/AccountLinkResult";
import { CARD_RADIUS_MD, CHIP_RADIUS, PAGE_HORIZONTAL_PADDING, SECTION_GAP_MD, } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
const PANEL_HANDLE_TOP_PADDING: number = 10;
const PANEL_HANDLE_BOTTOM_PADDING: number = 8;
const PANEL_SECTION_SPACING: number = 2;
const ACTION_BUTTON_HEIGHT: number = 32;
const INPUT_HEIGHT: number = 42;
const PROVIDER_BADGE_SIZE: number = 48;
const CARD_INNER_PADDING: number = 12;
interface AccountProviderCard {
    provider: AccountProvider;
    title: string;
    description: string;
    status: AccountStatusResult;
}
interface AccountProviderCardDefinition {
    provider: AccountProvider;
    title: string;
    description: string;
}
interface ProviderDraft {
    provider: AccountProvider;
    value: string;
}
const ACCOUNT_PROVIDER_CARDS: AccountProviderCardDefinition[] = [
    {
        provider: 'youtube',
        title: 'YouTube',
        description: '读取 YouTube 账号状态并同步关联信息',
    },
    {
        provider: 'x',
        title: 'X / Twitter',
        description: '读取 X 账号状态并同步关联信息',
    },
    {
        provider: 'instagram',
        title: 'Instagram',
        description: '读取 Instagram 账号状态并同步关联信息',
    },
    {
        provider: 'bilibili',
        title: 'Bilibili',
        description: '读取 Bilibili 账号状态并同步关联信息',
    },
];
function createEmptyStatus(provider: AccountProvider): AccountStatusResult {
    const status: AccountStatusResult = {
        provider,
        linked: false,
        displayName: '',
        error: '',
    };
    return status;
}
function createCardDefinitionStatus(provider: AccountProvider, title: string, description: string, status: AccountStatusResult): AccountProviderCard {
    const card: AccountProviderCard = {
        provider,
        title,
        description,
        status,
    };
    return card;
}
function createProviderDraft(provider: AccountProvider, value: string): ProviderDraft {
    const draft: ProviderDraft = {
        provider,
        value,
    };
    return draft;
}
function createInitialCards(): AccountProviderCard[] {
    return ACCOUNT_PROVIDER_CARDS.map((card: AccountProviderCardDefinition) => {
        return createCardDefinitionStatus(card.provider, card.title, card.description, createEmptyStatus(card.provider));
    });
}
function createInitialProviderDrafts(): ProviderDraft[] {
    return ACCOUNT_PROVIDER_CARDS.map((card: AccountProviderCardDefinition) => {
        return createProviderDraft(card.provider, '');
    });
}
function providerBadgeResource(provider: AccountProvider): Resource {
    switch (provider) {
        case 'youtube':
            return { "id": 16777228, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
        case 'x':
            return { "id": 16777227, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
        case 'instagram':
            return { "id": 16777226, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
        case 'bilibili':
            return { "id": 16777225, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
        default:
            return { "id": 16777227, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
    }
}
export class AccountsSettingsPanel extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__accountsStatusRefreshAt = this.createStorageProp('accountsStatusRefreshAt', 0, "accountsStatusRefreshAt");
        this.__accountLinkResultAt = this.createStorageProp('accountLinkResultAt', 0, "accountLinkResultAt");
        this.__accountLinkResultProvider = this.createStorageProp('accountLinkResultProvider', '', "accountLinkResultProvider");
        this.__accountLinkResultDisplayName = this.createStorageProp('accountLinkResultDisplayName', '', "accountLinkResultDisplayName");
        this.__accountLinkResultLinked = this.createStorageProp('accountLinkResultLinked', false, "accountLinkResultLinked");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.__inheritedTheme = new SynchedPropertyObjectOneWayPU(params.inheritedTheme, this, "inheritedTheme");
        this.__providerCards = new ObservedPropertyObjectPU(createInitialCards(), this, "providerCards");
        this.__providerDrafts = new ObservedPropertyObjectPU(createInitialProviderDrafts(), this, "providerDrafts");
        this.__providerMessages = new ObservedPropertyObjectPU(createInitialProviderDrafts(), this, "providerMessages");
        this.__activeProvider = new ObservedPropertySimplePU('', this, "activeProvider");
        this.__selfChecking = new ObservedPropertySimplePU(false, this, "selfChecking");
        this.__selfCheckSummary = new ObservedPropertySimplePU('', this, "selfCheckSummary");
        this.__selfCheckRows = new ObservedPropertyObjectPU([], this, "selfCheckRows");
        this.__bilibiliPreviewing = new ObservedPropertySimplePU(false, this, "bilibiliPreviewing");
        this.__bilibiliImporting = new ObservedPropertySimplePU(false, this, "bilibiliImporting");
        this.__bilibiliFeedback = new ObservedPropertySimplePU('', this, "bilibiliFeedback");
        this.__bilibiliPendingCreators = new ObservedPropertyObjectPU([], this, "bilibiliPendingCreators");
        this.__bilibiliSelectedMids = new ObservedPropertyObjectPU([], this, "bilibiliSelectedMids");
        this.__bilibiliSelectedViews = new ObservedPropertyObjectPU([FeedViewType.Videos], this, "bilibiliSelectedViews");
        this.__bilibiliImportProgressText = new ObservedPropertySimplePU('', this, "bilibiliImportProgressText");
        this.__bilibiliSessData = new ObservedPropertySimplePU('', this, "bilibiliSessData");
        this.setInitiallyProvidedValue(params);
        this.declareWatch("accountsStatusRefreshAt", this.handleAccountsRefreshSignal);
        this.declareWatch("accountLinkResultAt", this.handleAccountLinkResultSignal);
        this.declareWatch("inheritedTheme", this.syncInheritedTheme);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: AccountsSettingsPanel_Params) {
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.inheritedTheme === undefined) {
            this.__inheritedTheme.set(ThemeService.currentPalette());
        }
        if (params.providerCards !== undefined) {
            this.providerCards = params.providerCards;
        }
        if (params.providerDrafts !== undefined) {
            this.providerDrafts = params.providerDrafts;
        }
        if (params.providerMessages !== undefined) {
            this.providerMessages = params.providerMessages;
        }
        if (params.activeProvider !== undefined) {
            this.activeProvider = params.activeProvider;
        }
        if (params.selfChecking !== undefined) {
            this.selfChecking = params.selfChecking;
        }
        if (params.selfCheckSummary !== undefined) {
            this.selfCheckSummary = params.selfCheckSummary;
        }
        if (params.selfCheckRows !== undefined) {
            this.selfCheckRows = params.selfCheckRows;
        }
        if (params.bilibiliPreviewing !== undefined) {
            this.bilibiliPreviewing = params.bilibiliPreviewing;
        }
        if (params.bilibiliImporting !== undefined) {
            this.bilibiliImporting = params.bilibiliImporting;
        }
        if (params.bilibiliFeedback !== undefined) {
            this.bilibiliFeedback = params.bilibiliFeedback;
        }
        if (params.bilibiliPendingCreators !== undefined) {
            this.bilibiliPendingCreators = params.bilibiliPendingCreators;
        }
        if (params.bilibiliSelectedMids !== undefined) {
            this.bilibiliSelectedMids = params.bilibiliSelectedMids;
        }
        if (params.bilibiliSelectedViews !== undefined) {
            this.bilibiliSelectedViews = params.bilibiliSelectedViews;
        }
        if (params.bilibiliImportProgressText !== undefined) {
            this.bilibiliImportProgressText = params.bilibiliImportProgressText;
        }
        if (params.bilibiliSessData !== undefined) {
            this.bilibiliSessData = params.bilibiliSessData;
        }
    }
    updateStateVars(params: AccountsSettingsPanel_Params) {
        this.__inheritedTheme.reset(params.inheritedTheme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__accountsStatusRefreshAt.purgeDependencyOnElmtId(rmElmtId);
        this.__accountLinkResultAt.purgeDependencyOnElmtId(rmElmtId);
        this.__accountLinkResultProvider.purgeDependencyOnElmtId(rmElmtId);
        this.__accountLinkResultDisplayName.purgeDependencyOnElmtId(rmElmtId);
        this.__accountLinkResultLinked.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__inheritedTheme.purgeDependencyOnElmtId(rmElmtId);
        this.__providerCards.purgeDependencyOnElmtId(rmElmtId);
        this.__providerDrafts.purgeDependencyOnElmtId(rmElmtId);
        this.__providerMessages.purgeDependencyOnElmtId(rmElmtId);
        this.__activeProvider.purgeDependencyOnElmtId(rmElmtId);
        this.__selfChecking.purgeDependencyOnElmtId(rmElmtId);
        this.__selfCheckSummary.purgeDependencyOnElmtId(rmElmtId);
        this.__selfCheckRows.purgeDependencyOnElmtId(rmElmtId);
        this.__bilibiliPreviewing.purgeDependencyOnElmtId(rmElmtId);
        this.__bilibiliImporting.purgeDependencyOnElmtId(rmElmtId);
        this.__bilibiliFeedback.purgeDependencyOnElmtId(rmElmtId);
        this.__bilibiliPendingCreators.purgeDependencyOnElmtId(rmElmtId);
        this.__bilibiliSelectedMids.purgeDependencyOnElmtId(rmElmtId);
        this.__bilibiliSelectedViews.purgeDependencyOnElmtId(rmElmtId);
        this.__bilibiliImportProgressText.purgeDependencyOnElmtId(rmElmtId);
        this.__bilibiliSessData.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__accountsStatusRefreshAt.aboutToBeDeleted();
        this.__accountLinkResultAt.aboutToBeDeleted();
        this.__accountLinkResultProvider.aboutToBeDeleted();
        this.__accountLinkResultDisplayName.aboutToBeDeleted();
        this.__accountLinkResultLinked.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__inheritedTheme.aboutToBeDeleted();
        this.__providerCards.aboutToBeDeleted();
        this.__providerDrafts.aboutToBeDeleted();
        this.__providerMessages.aboutToBeDeleted();
        this.__activeProvider.aboutToBeDeleted();
        this.__selfChecking.aboutToBeDeleted();
        this.__selfCheckSummary.aboutToBeDeleted();
        this.__selfCheckRows.aboutToBeDeleted();
        this.__bilibiliPreviewing.aboutToBeDeleted();
        this.__bilibiliImporting.aboutToBeDeleted();
        this.__bilibiliFeedback.aboutToBeDeleted();
        this.__bilibiliPendingCreators.aboutToBeDeleted();
        this.__bilibiliSelectedMids.aboutToBeDeleted();
        this.__bilibiliSelectedViews.aboutToBeDeleted();
        this.__bilibiliImportProgressText.aboutToBeDeleted();
        this.__bilibiliSessData.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __accountsStatusRefreshAt: ObservedPropertyAbstractPU<number>;
    get accountsStatusRefreshAt() {
        return this.__accountsStatusRefreshAt.get();
    }
    set accountsStatusRefreshAt(newValue: number) {
        this.__accountsStatusRefreshAt.set(newValue);
    }
    private __accountLinkResultAt: ObservedPropertyAbstractPU<number>;
    get accountLinkResultAt() {
        return this.__accountLinkResultAt.get();
    }
    set accountLinkResultAt(newValue: number) {
        this.__accountLinkResultAt.set(newValue);
    }
    private __accountLinkResultProvider: ObservedPropertyAbstractPU<AccountProvider | ''>;
    get accountLinkResultProvider() {
        return this.__accountLinkResultProvider.get();
    }
    set accountLinkResultProvider(newValue: AccountProvider | '') {
        this.__accountLinkResultProvider.set(newValue);
    }
    private __accountLinkResultDisplayName: ObservedPropertyAbstractPU<string>;
    get accountLinkResultDisplayName() {
        return this.__accountLinkResultDisplayName.get();
    }
    set accountLinkResultDisplayName(newValue: string) {
        this.__accountLinkResultDisplayName.set(newValue);
    }
    private __accountLinkResultLinked: ObservedPropertyAbstractPU<boolean>;
    get accountLinkResultLinked() {
        return this.__accountLinkResultLinked.get();
    }
    set accountLinkResultLinked(newValue: boolean) {
        this.__accountLinkResultLinked.set(newValue);
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private __inheritedTheme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get inheritedTheme() {
        return this.__inheritedTheme.get();
    }
    set inheritedTheme(newValue: ThemePalette) {
        this.__inheritedTheme.set(newValue);
    }
    private __providerCards: ObservedPropertyObjectPU<AccountProviderCard[]>;
    get providerCards() {
        return this.__providerCards.get();
    }
    set providerCards(newValue: AccountProviderCard[]) {
        this.__providerCards.set(newValue);
    }
    private __providerDrafts: ObservedPropertyObjectPU<ProviderDraft[]>;
    get providerDrafts() {
        return this.__providerDrafts.get();
    }
    set providerDrafts(newValue: ProviderDraft[]) {
        this.__providerDrafts.set(newValue);
    }
    private __providerMessages: ObservedPropertyObjectPU<ProviderDraft[]>;
    get providerMessages() {
        return this.__providerMessages.get();
    }
    set providerMessages(newValue: ProviderDraft[]) {
        this.__providerMessages.set(newValue);
    }
    private __activeProvider: ObservedPropertySimplePU<AccountProvider | ''>;
    get activeProvider() {
        return this.__activeProvider.get();
    }
    set activeProvider(newValue: AccountProvider | '') {
        this.__activeProvider.set(newValue);
    }
    private __selfChecking: ObservedPropertySimplePU<boolean>;
    get selfChecking() {
        return this.__selfChecking.get();
    }
    set selfChecking(newValue: boolean) {
        this.__selfChecking.set(newValue);
    }
    private __selfCheckSummary: ObservedPropertySimplePU<string>;
    get selfCheckSummary() {
        return this.__selfCheckSummary.get();
    }
    set selfCheckSummary(newValue: string) {
        this.__selfCheckSummary.set(newValue);
    }
    private __selfCheckRows: ObservedPropertyObjectPU<AccountSelfCheckRow[]>;
    get selfCheckRows() {
        return this.__selfCheckRows.get();
    }
    set selfCheckRows(newValue: AccountSelfCheckRow[]) {
        this.__selfCheckRows.set(newValue);
    }
    private __bilibiliPreviewing: ObservedPropertySimplePU<boolean>;
    get bilibiliPreviewing() {
        return this.__bilibiliPreviewing.get();
    }
    set bilibiliPreviewing(newValue: boolean) {
        this.__bilibiliPreviewing.set(newValue);
    }
    private __bilibiliImporting: ObservedPropertySimplePU<boolean>;
    get bilibiliImporting() {
        return this.__bilibiliImporting.get();
    }
    set bilibiliImporting(newValue: boolean) {
        this.__bilibiliImporting.set(newValue);
    }
    private __bilibiliFeedback: ObservedPropertySimplePU<string>;
    get bilibiliFeedback() {
        return this.__bilibiliFeedback.get();
    }
    set bilibiliFeedback(newValue: string) {
        this.__bilibiliFeedback.set(newValue);
    }
    private __bilibiliPendingCreators: ObservedPropertyObjectPU<PendingBilibiliCreator[]>;
    get bilibiliPendingCreators() {
        return this.__bilibiliPendingCreators.get();
    }
    set bilibiliPendingCreators(newValue: PendingBilibiliCreator[]) {
        this.__bilibiliPendingCreators.set(newValue);
    }
    private __bilibiliSelectedMids: ObservedPropertyObjectPU<number[]>;
    get bilibiliSelectedMids() {
        return this.__bilibiliSelectedMids.get();
    }
    set bilibiliSelectedMids(newValue: number[]) {
        this.__bilibiliSelectedMids.set(newValue);
    }
    private __bilibiliSelectedViews: ObservedPropertyObjectPU<FeedViewType[]>;
    get bilibiliSelectedViews() {
        return this.__bilibiliSelectedViews.get();
    }
    set bilibiliSelectedViews(newValue: FeedViewType[]) {
        this.__bilibiliSelectedViews.set(newValue);
    }
    private __bilibiliImportProgressText: ObservedPropertySimplePU<string>;
    get bilibiliImportProgressText() {
        return this.__bilibiliImportProgressText.get();
    }
    set bilibiliImportProgressText(newValue: string) {
        this.__bilibiliImportProgressText.set(newValue);
    }
    private __bilibiliSessData: ObservedPropertySimplePU<string>;
    get bilibiliSessData() {
        return this.__bilibiliSessData.get();
    }
    set bilibiliSessData(newValue: string) {
        this.__bilibiliSessData.set(newValue);
    }
    aboutToAppear(): void {
        this.theme = this.inheritedTheme;
        this.applyLatestAccountLinkResult();
        void this.loadProviderStatuses();
        void this.loadBilibiliSessData();
    }
    private syncInheritedTheme(): void {
        this.theme = this.inheritedTheme;
    }
    private handleAccountsRefreshSignal(): void {
        void this.loadProviderStatuses();
    }
    private handleAccountLinkResultSignal(): void {
        this.applyLatestAccountLinkResult();
        void this.loadProviderStatuses();
    }
    private applyLatestAccountLinkResult(): void {
        const provider = this.accountLinkResultProvider;
        const displayName = this.accountLinkResultDisplayName || '';
        const linked = this.accountLinkResultLinked;
        console.info(`AccountsSettingsPanel applyLatestAccountLinkResult provider=${provider || ''} linked=${linked} displayName=${displayName}`);
        if (!provider) {
            return;
        }
        this.replaceCard(provider, (card: AccountProviderCard) => {
            const status: AccountStatusResult = {
                provider,
                linked,
                displayName: linked ? (displayName || card.status.displayName || `${card.title} 已关联`) : '',
                error: '',
            };
            return createCardDefinitionStatus(card.provider, card.title, card.description, status);
        });
        if (linked) {
            this.syncProviderDraft(provider, displayName);
        }
    }
    private isProviderLoading(provider: AccountProvider): boolean {
        return this.activeProvider === provider;
    }
    private replaceCard(provider: AccountProvider, updater: (card: AccountProviderCard) => AccountProviderCard): void {
        this.providerCards = this.providerCards.map((card: AccountProviderCard) => {
            if (card.provider !== provider) {
                return card;
            }
            return updater(card);
        });
    }
    private updateProviderDraft(provider: AccountProvider, value: string): void {
        this.providerDrafts = this.providerDrafts.map((draft: ProviderDraft) => {
            if (draft.provider !== provider) {
                return draft;
            }
            return createProviderDraft(draft.provider, value);
        });
    }
    private updateProviderMessage(provider: AccountProvider, value: string): void {
        this.providerMessages = this.providerMessages.map((message: ProviderDraft) => {
            if (message.provider !== provider) {
                return message;
            }
            return createProviderDraft(message.provider, value);
        });
    }
    private providerDraftValue(provider: AccountProvider): string {
        const matched = this.providerDrafts.find((draft: ProviderDraft) => draft.provider === provider);
        return matched ? matched.value : '';
    }
    private providerMessageValue(provider: AccountProvider): string {
        const matched = this.providerMessages.find((message: ProviderDraft) => message.provider === provider);
        return matched ? matched.value : '';
    }
    private syncProviderDraft(provider: AccountProvider, value: string): void {
        if (!this.providerDraftValue(provider).trim()) {
            this.updateProviderDraft(provider, value);
        }
    }
    private currentAccountLinkResult(): AccountLinkResultState {
        return {
            provider: this.accountLinkResultProvider,
            displayName: this.accountLinkResultDisplayName || '',
            linked: this.accountLinkResultLinked,
        };
    }
    private usesExternalBrowser(provider: AccountProvider): boolean {
        return resolveAccountLoginWebPolicy(provider).usesExternalBrowser;
    }
    private externalLoginHint(provider: AccountProvider): string {
        if (provider === 'youtube') {
            return '已在浏览器打开登录页，完成登录后返回此处检查，或手动保存账号名完成关联';
        }
        return '已打开外部登录页';
    }
    private async loadProviderStatuses(): Promise<void> {
        const nextCards: AccountProviderCard[] = [];
        for (const card of this.providerCards) {
            nextCards.push(createCardDefinitionStatus(card.provider, card.title, card.description, createEmptyStatus(card.provider)));
        }
        this.providerCards = nextCards;
        const refreshedCards: AccountProviderCard[] = [];
        const linkResult = this.currentAccountLinkResult();
        for (const card of ACCOUNT_PROVIDER_CARDS) {
            try {
                let status = await AppRepository.accountStatus(card.provider);
                const merged = mergeStatusWithAccountLinkResult(card.provider, {
                    linked: status.linked,
                    displayName: status.displayName,
                    error: status.error,
                }, card.title, linkResult);
                status = {
                    provider: card.provider,
                    linked: merged.linked,
                    displayName: merged.displayName,
                    error: merged.error,
                };
                console.info(`AccountsSettingsPanel status provider=${card.provider} linked=${status.linked} displayName=${status.displayName} error=${status.error} resultProvider=${linkResult.provider || ''} resultLinked=${linkResult.linked} resultDisplayName=${linkResult.displayName}`);
                refreshedCards.push(createCardDefinitionStatus(card.provider, card.title, card.description, status));
                this.syncProviderDraft(card.provider, status.displayName);
                if (status.linked) {
                    this.updateProviderMessage(card.provider, '');
                }
            }
            catch (error) {
                const status: AccountStatusResult = {
                    provider: card.provider,
                    linked: false,
                    displayName: '',
                    error: error instanceof Error ? error.message : '状态刷新失败',
                };
                refreshedCards.push(createCardDefinitionStatus(card.provider, card.title, card.description, status));
            }
        }
        this.providerCards = refreshedCards;
    }
    private async updateProviderStatus(provider: AccountProvider, action: 'link' | 'unlink' | 'refresh'): Promise<void> {
        if (action === 'link') {
            const card = this.providerCards.find((item: AccountProviderCard) => item.provider === provider);
            const loginUrl = AppRepository.accountLoginUrl(provider);
            if (!loginUrl) {
                this.replaceCard(provider, (current: AccountProviderCard) => {
                    const failedStatus: AccountStatusResult = {
                        provider,
                        linked: current.status.linked,
                        displayName: current.status.displayName,
                        error: '未找到登录入口',
                    };
                    return createCardDefinitionStatus(current.provider, current.title, current.description, failedStatus);
                });
                return;
            }
            this.activeProvider = provider;
            try {
                if (this.usesExternalBrowser(provider)) {
                    await ExternalUrlService.open(loginUrl);
                    this.updateProviderMessage(provider, this.externalLoginHint(provider));
                    this.replaceCard(provider, (current: AccountProviderCard) => {
                        const status: AccountStatusResult = {
                            provider,
                            linked: current.status.linked,
                            displayName: current.status.displayName,
                            error: '',
                        };
                        return createCardDefinitionStatus(current.provider, current.title, current.description, status);
                    });
                }
                else {
                    await openAccountLogin(provider, card?.title || '账号关联', loginUrl);
                }
            }
            catch (error) {
                const failedStatus = buildLinkNavigationFailureStatus(provider, !!card?.status.linked, card?.status.displayName || '', error instanceof Error ? error.message : '打开账号关联页面失败');
                console.error(`AccountsSettingsPanel openAccountLogin failed provider=${provider} error=${failedStatus.error}`);
                this.replaceCard(provider, (current: AccountProviderCard) => {
                    return createCardDefinitionStatus(current.provider, current.title, current.description, failedStatus);
                });
            }
            finally {
                this.activeProvider = '';
            }
            return;
        }
        this.activeProvider = provider;
        this.replaceCard(provider, (card: AccountProviderCard) => {
            const status: AccountStatusResult = {
                provider: card.provider,
                linked: card.status.linked,
                displayName: card.status.displayName,
                error: '',
            };
            return createCardDefinitionStatus(card.provider, card.title, card.description, status);
        });
        try {
            const nextStatus = action === 'unlink'
                ? await AppRepository.unlinkAccount(provider)
                : await AppRepository.accountStatus(provider);
            if (provider === 'youtube' && action === 'refresh' && !nextStatus.linked) {
                nextStatus.error = '';
                this.updateProviderMessage(provider, resolveExternalBrowserCheckMessage(provider, nextStatus.linked, nextStatus.displayName));
            }
            else if (provider === 'youtube' && action === 'refresh') {
                this.updateProviderMessage(provider, resolveExternalBrowserCheckMessage(provider, nextStatus.linked, nextStatus.displayName));
            }
            if (action === 'unlink' || nextStatus.linked) {
                if (!(provider === 'youtube' && action === 'refresh')) {
                    this.updateProviderMessage(provider, '');
                }
            }
            this.replaceCard(provider, (card: AccountProviderCard) => {
                return createCardDefinitionStatus(card.provider, card.title, card.description, nextStatus);
            });
            this.updateProviderDraft(provider, nextStatus.displayName);
        }
        catch (error) {
            const status: AccountStatusResult = {
                provider,
                linked: false,
                displayName: '',
                error: error instanceof Error ? error.message : '账号状态更新失败',
            };
            this.replaceCard(provider, (card: AccountProviderCard) => {
                return createCardDefinitionStatus(card.provider, card.title, card.description, status);
            });
        }
        finally {
            this.activeProvider = '';
        }
    }
    private statusText(status: AccountStatusResult): string {
        if (status.linked) {
            return status.displayName || '已关联';
        }
        if (status.error) {
            return status.error;
        }
        return '未关联';
    }
    private actionLabel(status: AccountStatusResult): string {
        return status.linked ? '断开' : '关联';
    }
    private secondaryActionLabel(provider: AccountProvider): string {
        if (provider === 'youtube') {
            return '检查';
        }
        return '';
    }
    private bilibiliStatus(): AccountStatusResult {
        const card = this.providerCards.find((item: AccountProviderCard) => item.provider === 'bilibili');
        return card ? card.status : createEmptyStatus('bilibili');
    }
    private async loadBilibiliSessData(): Promise<void> {
        this.bilibiliSessData = await AppRepository.bilibiliSessData();
    }
    private async handleSaveDisplayName(provider: AccountProvider): Promise<void> {
        this.activeProvider = provider;
        try {
            const nextStatus = await AppRepository.setAccountDisplayName(provider, this.providerDraftValue(provider));
            this.updateProviderMessage(provider, '');
            this.replaceCard(provider, (card: AccountProviderCard) => {
                return createCardDefinitionStatus(card.provider, card.title, card.description, nextStatus);
            });
            this.updateProviderDraft(provider, nextStatus.displayName);
        }
        catch (error) {
            const failedStatus: AccountStatusResult = {
                provider,
                linked: false,
                displayName: this.providerDraftValue(provider),
                error: error instanceof Error ? error.message : '保存账号名失败',
            };
            this.replaceCard(provider, (card: AccountProviderCard) => {
                return createCardDefinitionStatus(card.provider, card.title, card.description, failedStatus);
            });
        }
        finally {
            this.activeProvider = '';
        }
    }
    private async handleSaveBilibiliSessData(): Promise<void> {
        this.activeProvider = 'bilibili';
        try {
            const nextStatus = await AppRepository.setBilibiliSessData(this.bilibiliSessData);
            this.replaceCard('bilibili', (card: AccountProviderCard) => {
                return createCardDefinitionStatus(card.provider, card.title, card.description, nextStatus);
            });
            this.updateProviderDraft('bilibili', nextStatus.displayName);
            this.bilibiliFeedback = nextStatus.error ? nextStatus.error : 'SESSDATA 已保存';
        }
        catch (error) {
            this.bilibiliFeedback = error instanceof Error ? error.message : '保存 SESSDATA 失败';
        }
        finally {
            this.activeProvider = '';
        }
    }
    private async handlePreviewBilibili(): Promise<void> {
        this.bilibiliPreviewing = true;
        this.bilibiliFeedback = '';
        this.bilibiliImportProgressText = '';
        try {
            const creators = await AppRepository.previewBilibiliFollowings();
            this.bilibiliPendingCreators = creators;
            this.bilibiliSelectedMids = creators.filter((creator: PendingBilibiliCreator) => !creator.exists).map((creator: PendingBilibiliCreator) => creator.mid);
            this.bilibiliFeedback = creators.length > 0
                ? `预览完成：共 ${creators.length} 个关注对象`
                : '未读取到可导入的关注对象';
        }
        catch (error) {
            this.bilibiliPendingCreators = [];
            this.bilibiliSelectedMids = [];
            this.bilibiliFeedback = error instanceof Error ? error.message : '预览关注列表失败';
        }
        finally {
            this.bilibiliPreviewing = false;
        }
    }
    private toggleBilibiliCreator(mid: number): void {
        if (this.bilibiliSelectedMids.includes(mid)) {
            this.bilibiliSelectedMids = this.bilibiliSelectedMids.filter((item: number) => item !== mid);
            return;
        }
        this.bilibiliSelectedMids = [...this.bilibiliSelectedMids, mid];
    }
    private toggleImportView(view: FeedViewType): void {
        if (this.bilibiliSelectedViews.includes(view)) {
            if (this.bilibiliSelectedViews.length === 1) {
                return;
            }
            this.bilibiliSelectedViews = this.bilibiliSelectedViews.filter((item: FeedViewType) => item !== view);
            return;
        }
        this.bilibiliSelectedViews = [...this.bilibiliSelectedViews, view];
    }
    private importViewLabel(view: FeedViewType): string {
        switch (view) {
            case FeedViewType.Videos:
                return '视频';
            case FeedViewType.SocialMedia:
                return '社交媒体';
            case FeedViewType.Articles:
                return '文章';
            default:
                return '未知';
        }
    }
    private isImportViewSelected(view: FeedViewType): boolean {
        return this.bilibiliSelectedViews.includes(view);
    }
    private isBilibiliCreatorSelected(mid: number): boolean {
        return this.bilibiliSelectedMids.includes(mid);
    }
    private providerAccent(provider: AccountProvider): string {
        switch (provider) {
            case 'youtube':
                return '#EF4444';
            case 'x':
                return '#111827';
            case 'instagram':
                return '#DB2777';
            case 'bilibili':
                return '#0EA5E9';
            default:
                return this.theme.accent;
        }
    }
    private providerBadgeBackground(provider: AccountProvider): string {
        switch (provider) {
            case 'youtube':
                return '#FEE2E2';
            case 'x':
                return this.theme.elevated;
            case 'instagram':
                return '#FCE7F3';
            case 'bilibili':
                return '#E0F2FE';
            default:
                return this.theme.elevated;
        }
    }
    private providerHint(provider: AccountProvider): string {
        return provider === 'bilibili' ? '支持导入' : '';
    }
    private statusBadgeText(status: AccountStatusResult): string {
        if (status.linked && !status.error) {
            return '已关联';
        }
        if (status.error) {
            return '需处理';
        }
        return '未关联';
    }
    private statusBadgeBackground(status: AccountStatusResult): string {
        if (status.linked && !status.error) {
            return this.theme.accent;
        }
        if (status.error) {
            return '#FEE2E2';
        }
        return this.theme.elevated;
    }
    private statusBadgeColor(status: AccountStatusResult): string {
        if (status.linked && !status.error) {
            return this.theme.accentText;
        }
        if (status.error) {
            return '#DC2626';
        }
        return this.theme.textSecondary;
    }
    private statusLineText(status: AccountStatusResult): string {
        if (status.linked && status.displayName.trim()) {
            return status.displayName.trim();
        }
        if (status.error) {
            return status.error;
        }
        return '未关联';
    }
    private titleStatusText(status: AccountStatusResult): string {
        return accountCardHeadlineStatus(status.linked, status.displayName, status.error);
    }
    private shouldShowSecondaryAction(provider: AccountProvider): boolean {
        return this.usesExternalBrowser(provider) && provider === 'youtube';
    }
    private shouldShowManualSave(provider: AccountProvider, status: AccountStatusResult): boolean {
        return this.usesExternalBrowser(provider) && provider === 'youtube' && !status.linked;
    }
    private providerDetailText(card: AccountProviderCard): string {
        const message = this.providerMessageValue(card.provider).trim();
        if (message) {
            return message;
        }
        if (card.status.linked && card.status.displayName.trim()) {
            return `已关联账号：${card.status.displayName.trim()}`;
        }
        if (card.status.error.trim()) {
            return card.status.error.trim();
        }
        return card.description;
    }
    private selfCheckSummaryColor(): string {
        return this.selfCheckSummary.indexOf('通过') >= 0 ? this.theme.accent : '#DC2626';
    }
    private async handleImportBilibili(): Promise<void> {
        const creators = this.bilibiliPendingCreators.filter((creator: PendingBilibiliCreator) => this.bilibiliSelectedMids.includes(creator.mid));
        if (creators.length === 0) {
            this.bilibiliFeedback = '请先选择要导入的关注对象';
            return;
        }
        this.bilibiliImporting = true;
        this.bilibiliFeedback = '';
        this.bilibiliImportProgressText = '';
        try {
            await AppRepository.importBilibiliFollowings(creators, this.bilibiliSelectedViews, (progress: BilibiliImportProgress) => {
                this.bilibiliImportProgressText =
                    `${progress.completed}/${progress.total} · 已导入 ${progress.imported} · 跳过 ${progress.skipped} · 失败 ${progress.failed}`;
            });
            this.bilibiliFeedback = '导入完成';
        }
        catch (error) {
            this.bilibiliFeedback = error instanceof Error ? error.message : '导入关注列表失败';
        }
        finally {
            this.bilibiliImporting = false;
        }
    }
    private async handleSelfCheck(): Promise<void> {
        this.selfChecking = true;
        this.selfCheckSummary = '';
        this.selfCheckRows = [];
        try {
            const result = await AccountSelfCheckService.run();
            this.selfCheckSummary = result.summary;
            this.selfCheckRows = result.rows;
        }
        finally {
            this.selfChecking = false;
        }
    }
    private SheetHandle(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Center);
            Column.padding({ top: PANEL_HANDLE_TOP_PADDING, bottom: PANEL_HANDLE_BOTTOM_PADDING });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width(40);
            Row.height(5);
            Row.borderRadius(999);
            Row.backgroundColor(this.theme.dragHandle);
        }, Row);
        Row.pop();
        Column.pop();
    }
    private PanelHeader(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.width('100%');
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new PageHeader(this, {
                        title: '账户关联',
                        theme: this.theme,
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0,
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/AccountsSettingsPanel.ets", line: 728, col: 5 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            title: '账户关联',
                            theme: this.theme,
                            titleSize: 20,
                            topPadding: 0,
                            bottomPadding: 0
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        title: '账户关联',
                        theme: this.theme,
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0
                    });
                }
            }, { name: "PageHeader" });
        }
        __Common__.pop();
    }
    private SelfCheckSection(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width(0);
            Column.height(0);
        }, Column);
        Column.pop();
    }
    private ProviderCard(card: AccountProviderCard, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 10 });
            Column.width('100%');
            Column.padding(CARD_INNER_PADDING);
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(CARD_RADIUS_MD);
            Column.border({ width: 0.8, color: this.theme.divider });
            Column.constraintSize({ minHeight: 76 });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 10 });
            Row.layoutWeight(1);
            Row.alignItems(VerticalAlign.Top);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Image.create(providerBadgeResource(card.provider));
            Image.width(34);
            Image.height(34);
            Image.objectFit(ImageFit.Contain);
            Image.padding(4);
            Image.backgroundColor(this.providerBadgeBackground(card.provider));
            Image.borderRadius(17);
        }, Image);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 4 });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.alignItems(VerticalAlign.Center);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(card.title);
            Text.fontSize(15);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(` - ${this.titleStatusText(card.status)}`);
            Text.fontSize(14);
            Text.fontColor(card.status.error ? '#DC2626' : this.theme.textSecondary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.providerDetailText(card));
            Text.fontSize(12);
            Text.lineHeight(18);
            Text.fontColor(card.status.error ? '#DC2626' : this.theme.textSecondary);
        }, Text);
        Text.pop();
        Column.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.alignItems(HorizontalAlign.End);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel(this.isProviderLoading(card.provider) ? '处理中...' : this.actionLabel(card.status));
            Button.enabled(!this.isProviderLoading(card.provider));
            Button.height(ACTION_BUTTON_HEIGHT);
            Button.backgroundColor(card.status.linked ? this.theme.elevated : this.theme.accent);
            Button.fontColor(card.status.linked ? this.theme.textPrimary : this.theme.accentText);
            Button.fontSize(13);
            Button.borderRadius(CHIP_RADIUS);
            Button.padding({ left: 14, right: 14 });
            Button.onClick(() => {
                void this.updateProviderStatus(card.provider, card.status.linked ? 'unlink' : 'link');
            });
        }, Button);
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.shouldShowSecondaryAction(card.provider)) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Button.createWithLabel(this.secondaryActionLabel(card.provider));
                        Button.enabled(!this.isProviderLoading(card.provider));
                        Button.height(ACTION_BUTTON_HEIGHT);
                        Button.backgroundColor(this.theme.elevated);
                        Button.fontColor(this.theme.textPrimary);
                        Button.fontSize(13);
                        Button.borderRadius(CHIP_RADIUS);
                        Button.padding({ left: 14, right: 14 });
                        Button.onClick(() => {
                            void this.updateProviderStatus(card.provider, 'refresh');
                        });
                    }, Button);
                    Button.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        Column.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.shouldShowManualSave(card.provider, card.status)) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create({ space: 8 });
                        Row.width('100%');
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        TextInput.create({ text: this.providerDraftValue(card.provider), placeholder: '登录后手动输入 YouTube 账号名' });
                        TextInput.height(INPUT_HEIGHT);
                        TextInput.layoutWeight(1);
                        TextInput.backgroundColor(this.theme.elevated);
                        TextInput.fontColor(this.theme.textPrimary);
                        TextInput.placeholderColor(this.theme.textMuted);
                        TextInput.borderRadius(12);
                        TextInput.padding({ left: 14, right: 14 });
                        TextInput.onChange((value: string) => {
                            this.updateProviderDraft(card.provider, value);
                        });
                    }, TextInput);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Button.createWithLabel('保存');
                        Button.enabled(!this.isProviderLoading(card.provider) && !!this.providerDraftValue(card.provider).trim());
                        Button.height(INPUT_HEIGHT);
                        Button.backgroundColor(this.theme.accent);
                        Button.fontColor(this.theme.accentText);
                        Button.fontSize(13);
                        Button.borderRadius(CHIP_RADIUS);
                        Button.padding({ left: 14, right: 14 });
                        Button.onClick(() => {
                            void this.handleSaveDisplayName(card.provider);
                        });
                    }, Button);
                    Button.pop();
                    Row.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    private ImportViewChip(view: FeedViewType, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.importViewLabel(view));
            Text.fontSize(12);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.isImportViewSelected(view) ? this.theme.accentText : this.theme.textSecondary);
            Text.padding({ left: 12, right: 12, top: 8, bottom: 8 });
            Text.backgroundColor(this.isImportViewSelected(view) ? this.theme.accent : this.theme.elevated);
            Text.borderRadius(999);
            Text.onClick(() => {
                this.toggleImportView(view);
            });
        }, Text);
        Text.pop();
    }
    private BilibiliSection(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width(0);
            Column.height(0);
        }, Column);
        Column.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.width('100%');
            Scroll.height('100%');
            Scroll.scrollBar(BarState.Off);
            Scroll.backgroundColor(this.theme.background);
            Scroll.edgeEffect(EdgeEffect.Spring);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: PANEL_SECTION_SPACING });
            Column.width('100%');
            Column.constraintSize({ minHeight: '100%' });
            Column.justifyContent(FlexAlign.Start);
            Column.padding({
                left: PAGE_HORIZONTAL_PADDING,
                right: PAGE_HORIZONTAL_PADDING,
                top: 0,
                bottom: 12,
            });
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.SheetHandle.bind(this)();
        this.PanelHeader.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: SECTION_GAP_MD });
            Column.width('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const card = _item;
                this.ProviderCard.bind(this)(card);
            };
            this.forEachUpdateFunction(elmtId, this.providerCards, forEachItemGenFunction, (card: AccountProviderCard) => accountCardRenderKey(card.provider, card.status.linked, card.status.displayName, card.status.error), false, false);
        }, ForEach);
        ForEach.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.height(24);
            Row.width('100%');
        }, Row);
        Row.pop();
        Column.pop();
        Scroll.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}
