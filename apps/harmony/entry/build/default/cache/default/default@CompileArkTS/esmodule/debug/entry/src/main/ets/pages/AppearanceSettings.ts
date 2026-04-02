if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface AppearanceSettings_Params {
}
import { goBack } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import { AppearanceSettingsPanel } from "@bundle:com.livo.harmony/entry/ets/common/components/AppearanceSettingsPanel";
class AppearanceSettings extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: AppearanceSettings_Params) {
    }
    updateStateVars(params: AppearanceSettings_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
    }
    aboutToBeDeleted() {
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
        }, Column);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new AppearanceSettingsPanel(this, {
                        showBackButton: true,
                        onClose: () => {
                            void goBack();
                        },
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/AppearanceSettings.ets", line: 9, col: 7 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            showBackButton: true,
                            onClose: () => {
                                void goBack();
                            }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        showBackButton: true
                    });
                }
            }, { name: "AppearanceSettingsPanel" });
        }
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "AppearanceSettings";
    }
}
registerNamedRoute(() => new AppearanceSettings(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/AppearanceSettings", pageFullPath: "entry/src/main/ets/pages/AppearanceSettings", integratedHsp: "false", moduleType: "followWithHap" });
