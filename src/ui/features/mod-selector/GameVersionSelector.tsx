import {useContext, useRef, useState} from 'react';
import {Select} from 'antd';
import {
    GameInfoSetterContext,
    SchemeDataSetterContext,
    SettingsContext,
    SettingsSetterContext
} from '@ui/app/providers/app-contexts';
import {
    game_data_info_list,
    get_game_data,
    get_mod_options,
    vanilla_game_version
} from '@engine/data/gameData';
import {DEFAULT_SETTINGS} from '@ui/app/providers/default-settings';
import {hasActiveProduction, isSameModSelection, normalizeModSelection} from './modSelectionRules';
import {init_scheme_data} from '@engine/scheme/schemeData';

function get_default_settings_for_game_data(game_data) {
    const base_settings = {
        ...DEFAULT_SETTINGS,
        mineralize_list: {},
        natural_production_line: [],
    };
    if (game_data.GenesisBookEnable) {
        return {
            ...base_settings,
            mining_speed_hydrogen: 1.0,
            mining_speed_deuterium: 0.05,
            mining_speed_gas_hydrate: 0.8,
            mining_speed_helium: 0.02,
            mining_speed_ammonia: 0.3,
            mining_speed_nitrogen: 1.2,
            mining_speed_oxygen: 0.6,
            mining_speed_carbon_dioxide: 0.4,
            mining_speed_sulfur_dioxide: 0.6,
        };
    }
    if (game_data.OrbitalRingEnable) {
        return {
            ...base_settings,
            mining_speed_hydrogen: 1.2,
            mining_speed_deuterium: 0.6,
            mining_speed_methane: 0.6,
        };
    }
    return {
        ...base_settings,
        mining_speed_hydrogen: 1.0,
        mining_speed_deuterium: 0.2,
        mining_speed_gas_hydrate: 0.5,
    };
}

export function GameVersion({needs_list, set_needs_list}) {
    const mod_options = get_mod_options();
    const set_game_data = useContext(GameInfoSetterContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const [mods, set_mods] = useState([]);
    const settings = useContext(SettingsContext);
    const set_settings = useContext(SettingsSetterContext);
    const latest_request_id = useRef(0);

    async function mods_change(modList) {
        if (hasActiveProduction(needs_list, settings.natural_production_line)
            && !confirm(`检测到计算器内有产线，确认继续切换mod吗？切换后将清空产线！`)) {
            return;
        }
        set_needs_list({});
        const modList2 = normalizeModSelection(mods, modList, game_data_info_list);
        if (isSameModSelection(modList2, mods)) {
            return;
        }
        set_mods(modList2);
        const request_id = latest_request_id.current + 1;
        latest_request_id.current = request_id;
        const game_data = await get_game_data(modList2);
        if (request_id !== latest_request_id.current) {
            return;
        }
        set_game_data(game_data);
        set_scheme_data(init_scheme_data(game_data));
        set_settings(get_default_settings_for_game_data(game_data));
    }

    return <div className="game-version-row d-flex gap-2 align-items-center">
        <div className="text-nowrap game-version-label">游戏版本 v{vanilla_game_version}</div>
        <div className="text-nowrap game-version-label">模组选择</div>
        <Select className="game-version-mod-select" mode={"multiple"} options={mod_options} value={mods} onChange={mods_change}/>
    </div>;
}
