import { useContext } from 'react';
import { UiSettingsContext, UiSettingsSetterContext } from './contexts.jsx';

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
    const hide_mines = ui_settings.hide_mines;
    function toggle_hide_mines(e) {
        set_ui_settings("hide_mines", !hide_mines);
    }

    return <table><tbody>
        <tr>
            <td>单位: {is_min ? "个/min" : "个/sec"}</td>
            <td className="ps-2">
                <button onClick={toggle_min_or_sec}>{is_min ? "转化为秒" : "转化为分"}</button>
            </td>
        </tr>
        <tr>
            <td>显示精度</td>
            <td className="ps-2">
                <input type="number" value={ui_settings.fixed_num}
                    onChange={change_fixed_num} style={{ maxWidth: '5em' }} />
            </td>
        </tr>
        <tr>
            <td>研究站层数</td>
            <td className="ps-2">
                <input value={research_stack_num}
                    onChange={change_research_stack_num} style={{ maxWidth: '5em' }} />
            </td>
        </tr>
        <tr>
            <td>增产剂: {proliferate_itself ? "先自喷涂" : "直接喷涂"}</td>
            <td className="ps-2"><button onClick={toggle_proliferate_itself}>{proliferate_itself ? "取消自喷涂" : "改为自喷涂"}</button></td>
        </tr>
        <tr>
            <td>输出列表: {hide_mines ? "隐藏原矿" : "显示原矿"}</td>
            <td className="ps-2"><button onClick={toggle_hide_mines}>{hide_mines ? "显示原矿" : "隐藏原矿"}</button></td>
        </tr>
    </tbody></table>;
}
