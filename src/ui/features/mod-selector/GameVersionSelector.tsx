import {useContext, useRef} from 'react';
import {Select} from 'antd';
import {
    GameInfoSetterContext,
    ModSelectionContext,
    ModSelectionSetterContext,
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
import {get_default_settings_for_game_data} from '@ui/app/providers/default-settings';
import {hasActiveProduction, isSameModSelection, normalizeModSelection} from './modSelectionRules';
import {init_low_footprint_scheme_data} from '@engine/scheme/defaultScheme';

export function GameVersion({needs_list, set_needs_list}) {
    const mod_options = get_mod_options();
    const set_game_data = useContext(GameInfoSetterContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const mods = useContext(ModSelectionContext);
    const set_mods = useContext(ModSelectionSetterContext);
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
        const default_settings = get_default_settings_for_game_data(game_data);
        set_game_data(game_data);
        set_scheme_data(init_low_footprint_scheme_data(game_data, default_settings));
        set_settings(default_settings);
    }

    return <div className="game-version-row d-flex gap-2 align-items-center">
        <div className="text-nowrap game-version-label">游戏版本 v{vanilla_game_version}</div>
        <div className="text-nowrap game-version-label">模组选择</div>
        <Select className="game-version-mod-select" mode={"multiple"} options={mod_options} value={mods} onChange={mods_change}/>
    </div>;
}
