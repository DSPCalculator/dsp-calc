import {lazy, Suspense, useContext, useEffect, useState} from 'react';
import {ContextProvider} from './providers/AppProviders.jsx';
import {GameInfoContext} from './providers/app-contexts.js';
import {NeedsList} from '../features/needs/NeedsPanel.jsx';
import {NeedsListStorage} from '../features/needs/NeedsStorageControls.jsx';
import {GameVersion} from '../features/mod-selector/GameVersionSelector.jsx';
import {SchemeStorage} from '../features/settings/SchemeStorageControls.jsx';

const BatchSetting = lazy(() => import('../features/result/BatchPresetControls.jsx').then(module => ({default: module.BatchSetting})));
const Result = lazy(() => import('../features/result/ResultPanel.jsx').then(module => ({default: module.Result})));
const Settings = lazy(() => import('../features/settings/SettingsPanel.jsx').then(module => ({default: module.Settings})));

function UserSettings({show}) {
    let class_show = show ? "" : "d-none";
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
    const game_info = useContext(GameInfoContext);
    const [misc_show, set_misc_show] = useState(false);
    const [needs_list, set_needs_list] = useState({});
    useEffect(() => {
        set_needs_list({});
    }, [game_info]);

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
            <GameVersion needs_list={needs_list} set_needs_list={set_needs_list}/>
        </div>
        {/*生产策略、需求列表、清空数据缓存按钮、采矿参数&其他设置是否显示按钮*/}
        <div className="d-flex column-gap-4 row-gap-2 flex-wrap">
            <SchemeStorage/>
            <NeedsListStorage needs_list={needs_list} set_needs_list={set_needs_list}/>
            <button className="btn btn-outline-danger btn-sm" onClick={clearData}>清空数据缓存</button>
            <button className="btn btn-outline-primary btn-sm" onClick={() => set_misc_show(s => !s)}>
                采矿参数 & 其他设置
            </button>
        </div>
        {/*采矿参数&其他设置*/}
        <UserSettings show={misc_show}/>
        {/*添加需求、批量预设、计算结果*/}
        <div>
            <NeedsList needs_list={needs_list} set_needs_list={set_needs_list}/>
            <Suspense fallback={<div className="small text-muted mt-2">加载计算模块中...</div>}>
                <BatchSetting/>
                <Result needs_list={needs_list} set_needs_list={set_needs_list}/>
            </Suspense>
        </div>
    </>;
}

export default function App() {
    return <ContextProvider>
        <AppWithContexts/>
    </ContextProvider>;
}
