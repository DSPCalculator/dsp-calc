import {useContext} from 'react';
import {
    DefaultSettingsContext,
    GlobalStateContext,
    SettingsContext,
    SettingsSetterContext
} from '@ui/app/providers/app-contexts';
import {normalizeFloatValue, normalizeIntValue, normalizePercentValue} from './settingFieldHelpers';
import {
    DISPLAY_AND_PROLIFERATION_ROWS,
    MINING_BEHAVIOR_ROWS,
    RESOURCE_PANEL_GROUPS,
    THEY_COME_FROM_VOID_ROWS
} from './settingsPanelConfig';
import type {NumericMap} from '@engine/types/domain';

export function Settings({
    needs_list,
    set_needs_list,
}: {
    needs_list: NumericMap;
    set_needs_list: (next_needs_list: NumericMap) => void;
}) {
    const settings = useContext(SettingsContext);
    const set_settings = useContext(SettingsSetterContext);
    const DEFAULT_SETTINGS = useContext(DefaultSettingsContext);
    const global_state = useContext(GlobalStateContext);

    const visibility_flags = {
        they_come_from_void_enabled: global_state.game_data.TheyComeFromVoidEnable,
        genesis_enabled: global_state.game_data.GenesisBookEnable,
        orbital_enabled: global_state.game_data.OrbitalRingEnable,
    };
    const percent_val = {
        mining_efficiency_large: Math.round(settings.mining_efficiency_large * 100),
        mining_speed_multiple: Math.round(settings.mining_speed_multiple * 100),
        enemy_drop_multiple: Math.round(settings.enemy_drop_multiple * 100),
        icarus_manufacturing_speed: Math.round(settings.icarus_manufacturing_speed * 100),
        acc_rate: Math.round(settings.acc_rate * 100),
        inc_rate: Math.round(settings.inc_rate * 100),
    };

    function changeIntSetting(raw_value, name, min_value) {
        set_settings({[name]: normalizeIntValue(raw_value, DEFAULT_SETTINGS[name], min_value)});
    }

    function changeFloatSetting(raw_value, name, min_value) {
        set_settings({[name]: normalizeFloatValue(raw_value, DEFAULT_SETTINGS[name], min_value)});
    }

    function changePercentSetting(raw_value, name, min_value) {
        const val = normalizePercentValue(raw_value, DEFAULT_SETTINGS[name] * 100, min_value);
        set_settings({[name]: val / 100});
    }

    function toggleSetting(name) {
        set_settings({[name]: !settings[name]});
    }

    function toggleTimeUnit() {
        const next_is_minute = !settings.is_time_unit_minute;
        const ratio = settings.is_time_unit_minute ? 1 / 60 : 60;
        const next_needs_list = Object.fromEntries(
            Object.entries(needs_list).map(([item, count]) => [item, count * ratio])
        );
        const next_natural_production_line = settings.natural_production_line.map((row) => ({
            ...row,
            "目标产量": row["目标产量"] === undefined ? row["目标产量"] : row["目标产量"] * ratio,
        }));
        set_needs_list(next_needs_list);
        set_settings({
            "is_time_unit_minute": next_is_minute,
            "natural_production_line": next_natural_production_line,
        });
    }

    function changeFractionatingSpeed(raw_value) {
        let fractionating_speed = normalizeFloatValue(raw_value, settings.is_time_unit_minute ? 1800 : 30, 0.0001);
        if (settings.is_time_unit_minute) {
            fractionating_speed /= 60;
        }
        set_settings({"fractionating_speed": fractionating_speed});
    }

    function renderNumberRow(row) {
        const is_percent = row.type === 'percent';
        const value = is_percent ? percent_val[row.key] : settings[row.key];
        const onChange = (e) => {
            if (row.type === 'int') {
                changeIntSetting(e.target.value, row.key, row.min);
            } else if (row.type === 'float') {
                changeFloatSetting(e.target.value, row.key, row.min);
            } else if (row.type === 'percent') {
                changePercentSetting(e.target.value, row.key, row.min);
            }
        };

        return <tr key={row.key}>
            <td>{row.label}</td>
            <td className="ps-2">
                <input type="number"
                       value={value}
                       step={row.step}
                       style={{maxWidth: '5em'}}
                       onChange={onChange}/>
            </td>
            <td className="ps-2">{row.unit || null}</td>
        </tr>;
    }

    function renderToggleRow(row) {
        const enabled = Boolean(settings[row.key]);
        return <tr key={row.key}>
            <td title={row.title}>{row.label}</td>
            <td className="ps-2">{enabled ? row.enabledLabel : row.disabledLabel}</td>
            <td className="ps-2">
                <button onClick={() => toggleSetting(row.key)}>
                    {enabled ? row.enabledAction : row.disabledAction}
                </button>
            </td>
        </tr>;
    }

    function renderSpecialRow(row) {
        if (row.type === 'fractionating_speed') {
            const fractionating_speed = settings.is_time_unit_minute
                ? settings.fractionating_speed * 60
                : settings.fractionating_speed;
            return <tr key="fractionating_speed">
                <td>{row.label}</td>
                <td className="ps-2">
                    <input value={fractionating_speed}
                           onChange={e => changeFractionatingSpeed(e.target.value)}
                           style={{maxWidth: '5em'}}/>
                </td>
                <td className="ps-2">{settings.is_time_unit_minute ? "/min" : "/sec"}</td>
            </tr>;
        }

        if (row.type === 'time_unit') {
            return <tr key="is_time_unit_minute">
                <td>速率单位</td>
                <td className="ps-2">{settings.is_time_unit_minute ? "个/min" : "个/sec"}</td>
                <td className="ps-2">
                    <button onClick={toggleTimeUnit}>
                        {settings.is_time_unit_minute ? "转化为秒" : "转化为分"}
                    </button>
                </td>
            </tr>;
        }

        if (row.type === 'info') {
            return <tr key={row.text}>
                <td colSpan={4}>{row.text}</td>
            </tr>;
        }

        return null;
    }

    function renderRow(row) {
        if (row.type === 'int' || row.type === 'float' || row.type === 'percent') {
            return renderNumberRow(row);
        }
        if (row.type === 'toggle') {
            return renderToggleRow(row);
        }
        return renderSpecialRow(row);
    }

    function renderTableBodyGroups(groups) {
        return groups.map((group, idx) => {
            if (!group.condition(visibility_flags)) {
                return null;
            }
            return <tbody key={idx}>
                {group.rows.map(renderRow)}
            </tbody>;
        });
    }

    return <div style={{display: 'flex', flexWrap: 'wrap'}}>
        <table>
            {renderTableBodyGroups(RESOURCE_PANEL_GROUPS)}
        </table>
        <table>
            <tbody>
                {MINING_BEHAVIOR_ROWS.map(renderRow)}
            </tbody>
        </table>
        <table>
            <tbody>
                {DISPLAY_AND_PROLIFERATION_ROWS.map(renderRow)}
            </tbody>
        </table>
        {visibility_flags.they_come_from_void_enabled &&
            <table>
                <tbody>
                    {THEY_COME_FROM_VOID_ROWS.map(renderRow)}
                </tbody>
            </table>
        }
    </div>;
}
