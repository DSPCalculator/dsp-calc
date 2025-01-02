import {useContext} from 'react';
import {DefaultSettingsContext, GlobalStateContext, SettingsContext, SettingsSetterContext} from './contexts.jsx';

export function Settings() {
    const settings = useContext(SettingsContext);
    const set_settings = useContext(SettingsSetterContext);
    const DEFAULT_SETTINGS = useContext(DefaultSettingsContext);
    const global_state = useContext(GlobalStateContext);
    let GenesisBookEnable = global_state.game_data.GenesisBookEnable ? "" : "none";
    let TheyComeFromVoidEnable = global_state.game_data.TheyComeFromVoidEnable ? "" : "none";

    let percent_val = {
        mining_efficiency_large: Math.round(settings.mining_efficiency_large * 100),
        mining_speed_multiple: Math.round(settings.mining_speed_multiple * 100),
        enemy_drop_multiple: Math.round(settings.enemy_drop_multiple * 100),
        icarus_manufacturing_speed: Math.round(settings.icarus_manufacturing_speed * 100),
        acc_rate: Math.round(settings.acc_rate * 100),
        inc_rate: Math.round(settings.inc_rate * 100),
    }

    function change_int_setting(e, name, minVal) {
        let val = Math.max(parseInt(e.target.value) || DEFAULT_SETTINGS[name], minVal);
        set_settings({[name]: val});
    }

    function change_float_setting(e, name, minVal) {
        let val = Math.max(parseFloat(e.target.value) || DEFAULT_SETTINGS[name], minVal);
        set_settings({[name]: Math.round(val * 10000) / 10000});//输入框最多四位小数
    }

    function change_percent_setting(e, name, minVal) {
        let val = Math.max(parseInt(e.target.value) || (DEFAULT_SETTINGS[name] * 100), minVal);
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
        set_settings({"fractionating_speed": fractionating_speed});
    }

    return <div style={{display: 'flex', flexWrap: 'wrap'}}>
        <table>
            <tbody>
            <tr>
                <td>原油面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_oil} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_oil", 0.01)}/>
                </td>
                <td className="ps-2">{"/s（单个油井）"}</td>
            </tr>
            <tr>
                <td>巨星氢面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_hydrogen} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_hydrogen", 0.01)}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>巨星重氢面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_deuterium} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_deuterium", 0.01)}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>巨星可燃冰面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_gas_hydrate} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_gas_hydrate", 0.01)}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            </tbody>
            <tbody style={{display: GenesisBookEnable}}>
            <tr>
                <td>巨星氦面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_helium} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_helium", 0.01)}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>巨星氨面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_ammonia} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_ammonia", 0.01)}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>行星氮面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_nitrogen} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_nitrogen", 0.01)}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>行星氧面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_oxygen} step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_oxygen", 0.01)}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>行星二氧化碳面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_carbon_dioxide}
                           step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_carbon_dioxide", 0.01)}/>
                </td>
                <td className="ps-2">{"/s（星球资源详情）"}</td>
            </tr>
            <tr>
                <td>行星二氧化硫面板</td>
                <td className="ps-2">
                    <input type="number" value={settings.mining_speed_sulfur_dioxide}
                           step={0.10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_float_setting(e, "mining_speed_sulfur_dioxide", 0.01)}/>
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
                    <input type="number" value={settings.covered_veins_small} step={1}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_int_setting(e, "covered_veins_small", 1)}/>
                </td>
            </tr>
            <tr>
                <td>大矿机覆盖矿脉数</td>
                <td className="ps-2">
                    <input type="number" value={settings.covered_veins_large} step={1}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_int_setting(e, "covered_veins_large", 1)}/>
                </td>
            </tr>
            <tr>
                <td>大矿机开采速度</td>
                <td className="ps-2">
                    <input type="number" value={percent_val["mining_efficiency_large"]} step={100}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_percent_setting(e, "mining_efficiency_large", 100)}/>
                </td>
                <td className="ps-2">{"%"}</td>
            </tr>
            <tr>
                <td>采矿速度</td>
                <td className="ps-2">
                    <input type="number" value={percent_val["mining_speed_multiple"]} step={10}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_percent_setting(e, "mining_speed_multiple", 100)}/>
                </td>
                <td className="ps-2">{"%（科技面板右上）"}</td>
            </tr>
            <tr>
                <td>残骸产出倍率</td>
                <td className="ps-2">
                    <input type="number" value={percent_val["enemy_drop_multiple"]} step={4}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_percent_setting(e, "enemy_drop_multiple", 100)}/>
                </td>
                <td className="ps-2">{"%（科技面板右上）"}</td>
            </tr>
            <tr>
                <td>手动制造速度</td>
                <td className="ps-2">
                    <input type="number" value={percent_val["icarus_manufacturing_speed"]} step={50}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_percent_setting(e, "icarus_manufacturing_speed", 100)}/>
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
                <td>混带计算</td>
                <td className="ps-2">{settings.is_mix_vein_calculation ? "启用" : "禁用"}</td>
                <td className="ps-2">
                    <button onClick={e => change_bool_setting(e, "is_mix_vein_calculation")}>
                        {settings.is_mix_vein_calculation ? "改为禁用" : "改为启用"}</button>
                </td>
            </tr>
            <tr>
                <td>精度位数</td>
                <td className="ps-2">
                    <input type="number" value={settings.fixed_num} step={1} style={{maxWidth: '5em'}}
                           onChange={e => change_int_setting(e, "fixed_num", 0)}/>
                </td>
            </tr>
            <tr>
                <td>研究站层数</td>
                <td className="ps-2">
                    <input type="number" value={settings.stack_research_lab} step={1}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_int_setting(e, "stack_research_lab", 1)}/>
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
                    <input type="number" value={percent_val["acc_rate"]} step={5}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_percent_setting(e, "acc_rate", 1)}/>
                </td>
                <td className="ps-2">{"%"}</td>
            </tr>
            <tr>
                <td>增产剂增产效率修正</td>
                <td className="ps-2">
                    <input type="number" value={percent_val["inc_rate"]} step={5}
                           style={{maxWidth: '5em'}}
                           onChange={e => change_percent_setting(e, "inc_rate", 1)}/>
                </td>
                <td className="ps-2">{"%"}</td>
            </tr>
            </tbody>
        </table>
        <table style={{display: TheyComeFromVoidEnable}}>
            <tbody>
            <tr>
                <td colSpan={4}>【深空来敌元驱动】</td>
            </tr>
            <tr>
                <td colSpan={4}>注意：更改任意元驱动状态后，必须重新选择MOD！</td>
            </tr>
            <tr>
                <td colSpan={4}>PS：鼠标悬停在元驱动名称上以查看具体效果</td>
            </tr>
            <tr>
                <td title="制造厂在制造原材料至少2种的配方时，每产出1个产物，会返还1个第1位置的原材料">蓝Buff</td>
                <td className="ps-2">{settings.blue_buff ? "启用" : "禁用"}</td>
                <td className="ps-2">
                    <button onClick={e => change_bool_setting(e, "blue_buff")}>
                        {settings.blue_buff ? "改为禁用" : "改为启用"}</button>
                </td>
            </tr>
            </tbody>
        </table>
    </div>;
}
