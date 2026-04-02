if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface Subscriptions_Params {
}
import { SubscriptionsContent } from "@bundle:com.livo.harmony/entry/ets/common/components/SubscriptionsContent";
import { openRootTab } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
class Subscriptions extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: Subscriptions_Params) {
    }
    updateStateVars(params: Subscriptions_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
    }
    aboutToBeDeleted() {
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    aboutToAppear(): void {
        void openRootTab('subscriptions', true);
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create();
            Stack.width('100%');
            Stack.height('100%');
        }, Stack);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new SubscriptionsContent(this, { showBottomTabs: true }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Subscriptions.ets", line: 13, col: 7 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            showBottomTabs: true
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        showBottomTabs: true
                    });
                }
            }, { name: "SubscriptionsContent" });
        }
        Stack.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "Subscriptions";
    }
}
registerNamedRoute(() => new Subscriptions(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/Subscriptions", pageFullPath: "entry/src/main/ets/pages/Subscriptions", integratedHsp: "false", moduleType: "followWithHap" });
