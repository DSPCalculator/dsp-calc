import {lazy, Suspense, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {FaCog, FaTrashAlt} from 'react-icons/fa';
import {ContextProvider} from './providers/AppProviders';
import {GlobalStateContext, SettingsContext} from './providers/app-contexts';
import {
    clearCalculatorUrlState,
    compactCalculatorUrlState,
    type ExpandedCalculatorUrlState,
    expandCalculatorUrlState,
    readCalculatorUrlState,
    writeCalculatorUrlState
} from './urlState';
import {NeedsList} from '@ui/features/needs/NeedsPanel';
import {NeedsListStorage} from '@ui/features/needs/NeedsStorageControls';
import {GameVersion} from '@ui/features/mod-selector/GameVersionSelector';
import type {ComparisonBaseline} from '@ui/features/result/BatchPresetControls';
import {SchemeStorage} from '@ui/features/settings/SchemeStorageControls';
import {get_default_settings_for_game_data} from './providers/default-settings';
import {decode_mod_selection, default_game_data, encode_mod_selection, get_game_data} from '@engine/data/gameData';
import {init_low_footprint_scheme_data} from '@engine/scheme/defaultScheme';
import type {GameData, NumericMap} from '@engine/types/domain';

const BatchSetting = lazy(() => import('@ui/features/result/BatchPresetControls').then(module => ({default: module.BatchSetting})));
const Result = lazy(() => import('@ui/features/result/ResultPanel').then(module => ({default: module.Result})));
const Settings = lazy(() => import('@ui/features/settings/SettingsPanel').then(module => ({default: module.Settings})));

type ToolbarActionsMode = 'full' | 'buttons-compact' | 'icons-only';

function measureToolbarActionsWidth(toolbarRow: HTMLDivElement, mode: ToolbarActionsMode): number {
    const clone = toolbarRow.cloneNode(true) as HTMLDivElement;
    clone.classList.remove('calculator-toolbar-actions-buttons-compact', 'calculator-toolbar-actions-icons-only');
    if (mode === 'buttons-compact') {
        clone.classList.add('calculator-toolbar-actions-buttons-compact');
    } else if (mode === 'icons-only') {
        clone.classList.add('calculator-toolbar-actions-icons-only');
    }
    clone.style.position = 'absolute';
    clone.style.left = '-99999px';
    clone.style.top = '0';
    clone.style.width = 'max-content';
    clone.style.maxWidth = 'none';
    clone.style.flexWrap = 'nowrap';
    clone.style.overflow = 'visible';
    clone.style.visibility = 'hidden';
    clone.style.pointerEvents = 'none';
    document.body.appendChild(clone);
    const width = Math.ceil(clone.getBoundingClientRect().width);
    document.body.removeChild(clone);
    return width;
}

function UserSettings({
    needs_list,
    set_needs_list,
    show,
}: {
    needs_list: NumericMap;
    set_needs_list: (next_needs_list: NumericMap) => void;
    show: boolean;
}) {
    const class_show = show ? "" : "d-none";
    return <div className={`calculator-settings-panel ${class_show}`}>
        <fieldset className="calculator-settings-fieldset">
            <legend><small>设置</small></legend>
            <Suspense fallback={<div className="small text-muted">加载设置中...</div>}>
                <Settings needs_list={needs_list} set_needs_list={set_needs_list}/>
            </Suspense>
        </fieldset>
    </div>;
}

function AppWithContexts({initial_needs_list}: {initial_needs_list?: NumericMap}) {
    const global_state = useContext(GlobalStateContext);
    const settings = useContext(SettingsContext);
    const [misc_show, set_misc_show] = useState(false);
    const [needs_list, set_needs_list] = useState<NumericMap>(() => initial_needs_list || {});
    const [comparison_baseline, set_comparison_baseline] = useState<ComparisonBaseline | null>(null);
    const toolbar_actions_ref = useRef<HTMLDivElement | null>(null);
    const [toolbar_actions_mode, set_toolbar_actions_mode] = useState<ToolbarActionsMode>('full');

    function update_needs_list(next_needs_list: NumericMap) {
        set_comparison_baseline(null);
        set_needs_list(next_needs_list);
    }

    function clearData() {
        if (!confirm(`即将清空所有保存的生产策略、需求列表等数据，初始化整个计算器，是否继续`)) {
            return;// 用户取消保存
        }
        localStorage.clear();
        clearCalculatorUrlState();
        window.location.reload();
    }

    useEffect(() => {
        const default_settings = get_default_settings_for_game_data(global_state.game_data);
        writeCalculatorUrlState(compactCalculatorUrlState({
            mod_selection: encode_mod_selection(global_state.game_data.mod_guid_list),
            needs_list,
            settings,
            scheme_data: global_state.raw_scheme_data,
        }, init_low_footprint_scheme_data(global_state.game_data, default_settings), global_state.game_data, default_settings));
    }, [global_state.game_data, global_state.raw_scheme_data, needs_list, settings]);

    useLayoutEffect(() => {
        const toolbar_row = toolbar_actions_ref.current;
        if (!toolbar_row) {
            return;
        }

        const updateCompactState = () => {
            const full_width = measureToolbarActionsWidth(toolbar_row, 'full');
            const buttons_compact_width = measureToolbarActionsWidth(toolbar_row, 'buttons-compact');
            const available_width = toolbar_row.clientWidth;
            let next_mode: ToolbarActionsMode = 'full';

            if (available_width > 0 && available_width < full_width) {
                next_mode = available_width >= buttons_compact_width ? 'buttons-compact' : 'icons-only';
            }

            set_toolbar_actions_mode(prev => prev === next_mode ? prev : next_mode);
        };

        const resize_observer = new ResizeObserver(updateCompactState);
        resize_observer.observe(toolbar_row);
        updateCompactState();

        return () => {
            resize_observer.disconnect();
        };
    }, []);

    return <div className="calculator-page">
        <div className="calculator-toolbar-stack">
            {/*游戏版本、模组选择*/}
            <div className="calculator-toolbar-row d-flex column-gap-4 row-gap-2 flex-wrap">
                <GameVersion needs_list={needs_list} set_needs_list={update_needs_list}/>
            </div>
            {/*生产策略、需求列表、清空数据缓存按钮、采矿参数&其他设置是否显示按钮*/}
            <div ref={toolbar_actions_ref}
                 className={`calculator-toolbar-row calculator-toolbar-actions d-flex column-gap-4 row-gap-2 flex-wrap${toolbar_actions_mode === 'buttons-compact' ? ' calculator-toolbar-actions-buttons-compact' : ''}${toolbar_actions_mode === 'icons-only' ? ' calculator-toolbar-actions-icons-only' : ''}`}>
                <SchemeStorage/>
                <NeedsListStorage needs_list={needs_list} set_needs_list={update_needs_list}/>
                <button className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1 mobile-icon-button"
                        title="清空数据缓存"
                        aria-label="清空数据缓存"
                        onClick={clearData}>
                    <FaTrashAlt/>
                    <span className="mobile-icon-button-label">清空数据缓存</span>
                </button>
                <button className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1 mobile-icon-button"
                        title="采矿参数和其他设置"
                        aria-label="采矿参数和其他设置"
                        onClick={() => set_misc_show(s => !s)}>
                    <FaCog/>
                    <span className="mobile-icon-button-label">采矿参数 & 其他设置</span>
                </button>
            </div>
        </div>
        {/*采矿参数&其他设置*/}
        <UserSettings needs_list={needs_list} set_needs_list={update_needs_list} show={misc_show}/>
        {/*添加需求、批量预设、计算结果*/}
        <div className="calculator-main-stack">
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
    </div>;
}

export default function App() {
    const raw_url_state = useMemo(() => readCalculatorUrlState(), []);
    const initial_mods = useMemo(() => decode_mod_selection(raw_url_state?.m), [raw_url_state]);
    const [initial_game_data, set_initial_game_data] = useState<GameData | undefined>(
        () => initial_mods.length === 0 ? default_game_data : undefined,
    );

    useEffect(() => {
        let canceled = false;
        if (initial_mods.length > 0) {
            get_game_data(initial_mods).then(game_data => {
                if (!canceled) {
                    set_initial_game_data(game_data);
                }
            });
        }
        return () => {
            canceled = true;
        };
    }, [initial_mods]);

    const initial_url_state = useMemo<ExpandedCalculatorUrlState | undefined>(() => {
        if (!initial_game_data) {
            return undefined;
        }
        const default_settings = get_default_settings_for_game_data(initial_game_data);
        return expandCalculatorUrlState(
            raw_url_state,
            init_low_footprint_scheme_data(initial_game_data, default_settings),
            initial_game_data
        );
    }, [initial_game_data, raw_url_state]);

    if (!initial_game_data) {
        return <div className="calculator-page">
            <div className="small text-muted">加载分享链接配置中...</div>
        </div>;
    }

    return <ContextProvider
        initial_game_data={initial_game_data}
        initial_mods={initial_mods}
        initial_state={initial_url_state}
    >
        <AppWithContexts initial_needs_list={initial_url_state?.needs_list}/>
    </ContextProvider>;
}
