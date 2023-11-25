import { createContext, useEffect, useState } from 'react';
import structuredClone from '@ungap/structured-clone';
import { GameInfo, GlobalState } from './global_state';
import { init_scheme_data } from './scheme_data';

/** set_game_name_and_data(game_name, game_data) */
export const GameInfoSetterContext = createContext(null);
export const SchemeDataSetterContext = createContext(null);

/** set_ui_settings(prop, value) */
export const UiSettingsSetterContext = createContext(null);

export const GlobalStateContext = createContext(null);
export const UiSettingsContext = createContext(null);
export const GameInfoContext = createContext(null);

const DEFAULT_UI_SETTINGS = {
    proliferate_itself: true,
    is_time_unit_minute: true,
    fixed_num: 2,
    stackable_buildings: { 研究站: 15 },
    mineralize_list: [],
    natural_production_line: []
};

export function ContextProvider({ children }) {
    const [game_info, set_game_info] = useState(
        new GameInfo("vanilla", GameData.vanilla));

    const [scheme_data, set_scheme_data] = useState(
        init_scheme_data(GameData.vanilla));

    const [ui_settings, _set_ui_settings] = useState(DEFAULT_UI_SETTINGS);

    console.log("[+] new GlobalState");
    let global_state = new GlobalState(game_info, scheme_data, ui_settings);

    function set_game_name_and_data(game_name, game_data) {
        set_game_info(new GameInfo(game_name, game_data));
    }

    function set_ui_settings(prop, value) {
        let new_ui_settings = structuredClone(ui_settings);
        new_ui_settings[prop] = value;
        _set_ui_settings(new_ui_settings);
    }

    return <GameInfoContext.Provider value={game_info}>
        <GlobalStateContext.Provider value={global_state}>
            <GameInfoSetterContext.Provider value={set_game_name_and_data}>
                <SchemeDataSetterContext.Provider value={set_scheme_data}>
                    <UiSettingsSetterContext.Provider value={set_ui_settings}>
                        <UiSettingsContext.Provider value={ui_settings}>
                            {children}
                        </UiSettingsContext.Provider>
                    </UiSettingsSetterContext.Provider>
                </SchemeDataSetterContext.Provider>
            </GameInfoSetterContext.Provider>
        </GlobalStateContext.Provider>
    </GameInfoContext.Provider>
}
