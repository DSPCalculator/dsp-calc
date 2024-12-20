import {useContext} from 'react';
import {DefaultSettingsContext, GlobalStateContext, SettingsContext, SettingsSetterContext} from './contexts.jsx';

export function Settings() {
    const settings = useContext(SettingsContext);
    const set_settings = useContext(SettingsSetterContext);
    const DEFAULT_SETTINGS = useContext(DefaultSettingsContext);
    const global_state = useContext(GlobalStateContext);
    let display = global_state.game_data.GenesisBookEnable ? "" : "none";

    let fix_multiple = Math.pow(10, settings.fixed_num);
    let percent_val = {
        mining_efficiency_large: Math.round(settings.mining_efficiency_large * 100),
        mining_speed_multiple: Math.round(settings.mining_speed_multiple * 100),
        enemy_drop_multiple: Math.round(settings.enemy_drop_multiple * 100),
        icarus_manufacturing_speed: Math.round(settings.icarus_manufacturing_speed * 100),
        acc_rate: Math.round(settings.acc_rate * 100),
        inc_rate: Math.round(settings.inc_rate * 100),
    }

    function change_int_setting(e, name) {
        let val = parseInt(e.target.value) || DEFAULT_SETTINGS[name];
        set_settings({[name]: val});
    }

    function change_float_setting(e, name) {
        let val = parseFloat(e.target.value) || DEFAULT_SETTINGS[name];
        set_settings({[name]: Math.round(val * fix_multiple) / fix_multiple});
    }

    function change_percent_setting(e, name) {
        let val = parseInt(e.target.value) || (DEFAULT_SETTINGS[name] * 100);
        percent_val[name] = val;
        set_settings({[name]: val / 100});
    }

    function change_bool_setting(e, name) {
        set_settings({[name]: !settings[name]});
    }

    const fractionating_speed = settings.is_time_unit_minute
        ? settings.fractionating_speed * 60
        : settings.fractionating_speed;

    function change_fractionating_speed(e) {
        let fractionating_speed = parseFloat(e.target.value) || (settings.is_time_unit_minute ? 1800 : 30);
        if (settings.is_time_unit_minute) {
            fractionating_speed /= 60;
        }
        set_settings("fractionating_speed", fractionating_speed);
    }

    return <div style={{display: 'flex', flexWrap: 'wrap'}}>
        <table>
            <tbody>
            <tr>
                <td>原油面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_oil} aria-valuemin={0.01} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_oil")}/>
                </td>
                <td className="ps-2">{"/s（单个油井）"}</td>
            </tr>
            <tr>
                <td>巨星氢面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_hydrogen} aria-valuemin={0.01} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_hydrogen")}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>巨星重氢面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_deuterium} aria-valuemin={0.01} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_deuterium")}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>巨星可燃冰面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_gas_hydrate} aria-valuemin={0.01} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_gas_hydrate")}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            </tbody>
            <tbody style={{display: display}}>
            <tr>
                <td>巨星氦面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_helium} aria-valuemin={0.01} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_helium")}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>巨星氨面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_ammonia} aria-valuemin={0.01} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_ammonia")}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>行星氮面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_nitrogen} aria-valuemin={0.01} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_nitrogen")}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>行星氧面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_oxygen} aria-valuemin={0.01} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_oxygen")}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>行星二氧化碳面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_carbon_dioxide} aria-valuemin={0.01}
                           step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_carbon_dioxide")}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>行星二氧化硫面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_sulfur_dioxide} aria-valuemin={0.01}
                           step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_sulfur_dioxide")}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            </tbody>
        </table>
        <table>
            <tbody>
            <tr>
                <td>原矿显示</td>
                <td className="ps-2">{settings.hide_mines ? "隐藏原矿" : "显示原矿"}</td>
                <td className="ps-2">
                    <button onClick={e => change_bool_setting(e, "hide_mines")}>
                        {settings.hide_mines ? "显示原矿" : "隐藏原矿"}</button>
                </td>
            </tr>
            <tr>
                <td>小矿机覆盖矿脉数</td>
                <td className="ps-2">
                    <input type="number" value={settings.covered_veins_small} aria-valuemin={1} step={1}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_int_setting(e, "covered_veins_small")}/>
                </td>
            </tr>
            <tr>
                <td>大矿机覆盖矿脉数</td>
                <td className="ps-2">
                    <input type="number" value={settings.covered_veins_large} aria-valuemin={1} step={1}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_int_setting(e, "covered_veins_large")}/>
                </td>
            </tr>
            <tr>
                <td>大矿机开采速度</td>
                <td className="ps-2">
                    <input type="number" value={percent_val["mining_efficiency_large"]} aria-valuemin={100} step={100}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_percent_setting(e, "mining_efficiency_large")}/>
                </td>
                <td className="ps-2">{"%"}</td>
            </tr>
            <tr>
                <td>采矿速度</td>
                <td className="ps-2">
                    <input type="number" value={percent_val["mining_speed_multiple"]} aria-valuemin={100} step={10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_percent_setting(e, "mining_speed_multiple")}/>
                </td>
                <td className="ps-2">{"%（科技面板右上）"}</td>
            </tr>
            <tr>
                <td>残骸产出倍率</td>
                <td className="ps-2">
                    <input type="number" value={percent_val["enemy_drop_multiple"]} aria-valuemin={100} step={4}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_percent_setting(e, "enemy_drop_multiple")}/>
                </td>
                <td className="ps-2">{"%（科技面板右上）"}</td>
            </tr>
            <tr>
                <td>手动制造速度</td>
                <td className="ps-2">
                    <input type="number" value={percent_val["icarus_manufacturing_speed"]} aria-valuemin={100} step={50}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_percent_setting(e, "icarus_manufacturing_speed")}/>
                </td>
                <td className="ps-2">{"%"}</td>
            </tr>
            <tr>
                <td>分馏带速</td>
                <td className="ps-2">
                    <input value={fractionating_speed} onChange={change_fractionating_speed}
                           style={{maxWidth: '5em'}}/>
                </td>
                <td className="ps-2">{settings.is_time_unit_minute ? "/min" : "/sec"}</td>
            </tr>
            </tbody>
        </table>
        <table>
            <tbody>
            <tr>
                <td>速率单位</td>
                <td className="ps-2">{settings.is_time_unit_minute ? "个/min" : "个/sec"}</td>
                <td className="ps-2">
                    <button onClick={e => change_bool_setting(e, "is_time_unit_minute")}>
                        {settings.is_time_unit_minute ? "转化为秒" : "转化为分"}</button>
                </td>
            </tr>
            <tr>
                <td>精度位数</td>
                <td className="ps-2">
                    <input type="number" value={settings.fixed_num} aria-valuemin={0} step={1} style={{maxWidth: '5em'}}
                           onChange={e => change_int_setting(e, "fixed_num")}/>
                </td>
            </tr>
            <tr>
                <td>研究站层数</td>
                <td className="ps-2">
                    <input type="number" value={settings.stack_research_lab} aria-valuemin={1} step={1}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_int_setting(e, "stack_research_lab")}/>
                </td>
            </tr>
            <tr>
                <td>增产剂自喷涂</td>
                <td className="ps-2">{settings.proliferate_itself ? "启用" : "禁用"}</td>
                <td className="ps-2">
                    <button onClick={e => change_bool_setting(e, "proliferate_itself")}>
                        {settings.proliferate_itself ? "改为禁用" : "改为启用"}</button>
                </td>
            </tr>
            <tr>
                <td>增产剂加速效率修正</td>
                <td className="ps-2">
                    <input type="number" value={percent_val["acc_rate"]} aria-valuemin={1} step={5}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_percent_setting(e, "acc_rate")}/>
                </td>
                <td className="ps-2">{"%"}</td>
            </tr>
            <tr>
                <td>增产剂增产效率修正</td>
                <td className="ps-2">
                    <input type="number" value={percent_val["inc_rate"]} aria-valuemin={1} step={5}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_percent_setting(e, "inc_rate")}/>
                </td>
                <td className="ps-2">{"%"}</td>
            </tr>
            </tbody>
        </table>
    </div>;
}
