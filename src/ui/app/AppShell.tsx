import {lazy, Suspense, useState} from 'react';
import {FaCog, FaTrashAlt} from 'react-icons/fa';
import {ContextProvider} from './providers/AppProviders';
import {NeedsList} from '@ui/features/needs/NeedsPanel';
import {NeedsListStorage} from '@ui/features/needs/NeedsStorageControls';
import {GameVersion} from '@ui/features/mod-selector/GameVersionSelector';
import type {ComparisonBaseline} from '@ui/features/result/BatchPresetControls';
import {SchemeStorage} from '@ui/features/settings/SchemeStorageControls';
import type {NumericMap} from '@engine/types/domain';

const BatchSetting = lazy(() => import('@ui/features/result/BatchPresetControls').then(module => ({default: module.BatchSetting})));
const Result = lazy(() => import('@ui/features/result/ResultPanel').then(module => ({default: module.Result})));
const Settings = lazy(() => import('@ui/features/settings/SettingsPanel').then(module => ({default: module.Settings})));

function UserSettings({show}: {show: boolean}) {
    const class_show = show ? "" : "d-none";
    return <div className={`d-flex gap-3 ${class_show}`}>
        <fieldset>
            <legend><small>设置</small></legend>
            <Suspense fallback={<div className="small text-muted">加载设置中...</div>}>
                <Settings/>
            </Suspense>
        </fieldset>
    </div>;
}

function AppWithContexts() {
    const [misc_show, set_misc_show] = useState(false);
    const [needs_list, set_needs_list] = useState<NumericMap>({});
    const [comparison_baseline, set_comparison_baseline] = useState<ComparisonBaseline | null>(null);

    function update_needs_list(next_needs_list: NumericMap) {
        set_comparison_baseline(null);
        set_needs_list(next_needs_list);
    }

    function clearData() {
        if (!confirm(`即将清空所有保存的生产策略、需求列表等数据，初始化整个计算器，是否继续`)) {
            return;// 用户取消保存
        }
        localStorage.clear();
        window.location.reload();
    }

    return <>
        {/*游戏版本、模组选择*/}
        <div className="d-flex column-gap-4 row-gap-2 flex-wrap">
            <GameVersion needs_list={needs_list} set_needs_list={update_needs_list}/>
        </div>
        {/*生产策略、需求列表、清空数据缓存按钮、采矿参数&其他设置是否显示按钮*/}
        <div className="d-flex column-gap-4 row-gap-2 flex-wrap">
            <SchemeStorage/>
            <NeedsListStorage needs_list={needs_list} set_needs_list={update_needs_list}/>
            <button className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1" onClick={clearData}>
                <FaTrashAlt/>
                <span>清空数据缓存</span>
            </button>
            <button className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                    onClick={() => set_misc_show(s => !s)}>
                <FaCog/>
                采矿参数 & 其他设置
            </button>
        </div>
        {/*采矿参数&其他设置*/}
        <UserSettings show={misc_show}/>
        {/*添加需求、批量预设、计算结果*/}
        <div>
            <NeedsList needs_list={needs_list} set_needs_list={update_needs_list}/>
            <Suspense fallback={<div className="small text-muted mt-2">加载计算模块中...</div>}>
                <BatchSetting captureComparisonBaseline={set_comparison_baseline} needs_list={needs_list}/>
                <Result
                    captureComparisonBaseline={set_comparison_baseline}
                    comparison_baseline={comparison_baseline}
                    needs_list={needs_list}
                    set_needs_list={update_needs_list}
                />
            </Suspense>
        </div>
    </>;
}

export default function App() {
    return <ContextProvider>
        <AppWithContexts/>
    </ContextProvider>;
}
