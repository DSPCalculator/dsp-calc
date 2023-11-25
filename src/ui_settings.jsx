import { useContext, useEffect, useRef, useState } from 'react';
import { BatchSetting } from './batch_setting.jsx';
import { ContextProvider, GameInfoContext, GameInfoSetterContext, GlobalStateContext, SchemeDataSetterContext, UiSettingsSetterContext, UiSettingsContext } from './contexts.jsx';
import { GameInfo } from './global_state.jsx';
import { NeedsList } from './needs_list.jsx';
import { Result } from './result.jsx';
import { FractionatingSetting, MiningSettings, SchemeStorage, init_scheme_data } from './scheme_data.jsx';

export function UiSettings() {
    const ui_settings = useContext(UiSettingsContext);
    const set_ui_settings = useContext(UiSettingsSetterContext);

    const is_min = ui_settings.is_time_unit_minute;
    function toggle_min_or_sec() {
        set_ui_settings("is_time_unit_minute", !is_min);
    }

    const research_stack_num = ui_settings.stackable_buildings["研究站"];

    function change_fixed_num(e) {
        set_ui_settings("fixed_num", Number(e.target.value) || 2);
    }

    function change_research_stack_num(e) {
        set_ui_settings("stackable_buildings", { "研究站": Number(e.target.value) || 15 });
    }

    const proliferate_itself = ui_settings.proliferate_itself;
    function toggle_proliferate_itself(e) {
        set_ui_settings("proliferate_itself", !proliferate_itself);
    }

    return <span>
        <span>单位：{is_min ? "个/min" : "个/sec"}</span>
        <button onClick={toggle_min_or_sec}>{is_min ? "转化为秒" : "转化为分"}</button>
        <span>显示精度：</span><input type="number" value={ui_settings.fixed_num} onChange={change_fixed_num} style={{ maxWidth: '4em' }} />
        <span>建筑层数（研究站）：</span><input value={research_stack_num} onChange={change_research_stack_num} size={4} />
        <button onClick={toggle_proliferate_itself}>自喷涂？</button><span>{proliferate_itself ? "Yes!" : "No!"}</span>
    </span>;
}
