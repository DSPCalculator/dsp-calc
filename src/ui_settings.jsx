import {useContext} from 'react';
import {GlobalStateContext, SchemeDataSetterContext, UiSettingsContext, UiSettingsSetterContext} from './contexts.jsx';

export function UiSettings() {
    const ui_settings = useContext(UiSettingsContext);
    const is_min = ui_settings.is_time_unit_minute;
    const set_ui_settings = useContext(UiSettingsSetterContext);
    const global_state = useContext(GlobalStateContext);
    const scheme_data = global_state.scheme_data;
    const set_scheme_data = useContext(SchemeDataSetterContext);

    function toggle_min_or_sec() {
        set_ui_settings("is_time_unit_minute", !is_min);
    }

    const research_stack_num = ui_settings.stackable_buildings["研究站"];

    function change_fixed_num(e) {
        set_ui_settings("fixed_num", Number(e.target.value) || 2);
    }

    function change_research_stack_num(e) {
        set_ui_settings("stackable_buildings", {"研究站": Number(e.target.value) || 15});
    }

    const proliferate_itself = ui_settings.proliferate_itself;

    function toggle_proliferate_itself(e) {
        set_ui_settings("proliferate_itself", !proliferate_itself);
    }

    const hide_mines = ui_settings.hide_mines;

    function toggle_hide_mines(e) {
        set_ui_settings("hide_mines", !hide_mines);
    }

    const fractionating_speed = is_min ? scheme_data.fractionating_speed : scheme_data.fractionating_speed / 60;

    function change_fractionating_speed(event) {
        set_scheme_data(prev_scheme_data => {
            let fractionating_speed = parseFloat(event.target.value) || 0;
            if (!is_min) {
                fractionating_speed *= 60;
            }
            let new_scheme_data = structuredClone(prev_scheme_data);
            new_scheme_data.fractionating_speed = fractionating_speed;
            return new_scheme_data;
        });
    }

    return <table>
        <tbody>
        <tr>
            <td>速率单位</td>
            <td className="ps-2">{is_min ? "个/min" : "个/sec"}</td>
            <td className="ps-2">
                <button onClick={toggle_min_or_sec}>{is_min ? "转化为秒" : "转化为分"}</button>
            </td>
        </tr>
        <tr>
            <td>精度位数</td>
            <td className="ps-2">
                <input type="number" value={ui_settings.fixed_num}
                       onChange={change_fixed_num} style={{maxWidth: '5em'}}/>
            </td>
        </tr>
        <tr>
            <td>研究站层数</td>
            <td className="ps-2">
                <input value={research_stack_num}
                       onChange={change_research_stack_num} style={{maxWidth: '5em'}}/>
            </td>
        </tr>
        <tr>
            <td>增产剂自喷涂</td>
            <td className="ps-2">{proliferate_itself ? "启用" : "禁用"}</td>
            <td className="ps-2">
                <button onClick={toggle_proliferate_itself}>{proliferate_itself ? "改为禁用" : "改为启用"}</button>
            </td>
        </tr>
        <tr>
            <td>原矿显示</td>
            <td className="ps-2">{hide_mines ? "隐藏原矿" : "显示原矿"}</td>
            <td className="ps-2">
                <button onClick={toggle_hide_mines}>{hide_mines ? "显示原矿" : "隐藏原矿"}</button>
            </td>
        </tr>
        <tr>
            <td>分馏实际带速</td>
            <td className="ps-2">
                <input value={fractionating_speed}
                       onChange={change_fractionating_speed} style={{maxWidth: '5em'}}/>
            </td>
            <td className="ps-2">{is_min ? "/min" : "/sec"}</td>
        </tr>
        </tbody>
    </table>;
}
