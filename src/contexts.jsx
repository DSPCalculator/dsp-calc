import { createContext, useEffect, useState } from 'react';
import { GameInfo, GlobalState } from './global_state';
import { init_scheme_data } from './scheme_data';

/** set_game_name_and_data(game_name, game_data) */
export const GameInfoSetterContext = createContext(null);
export const SchemeDataSetterContext = createContext(null);
export const UiSettingsSetterContext = createContext(null);
export const NaturalProductionLineSetterContext = createContext(null);

export const GlobalStateContext = createContext(null);
export const GameInfoContext = createContext(null);

const DEFAULT_UI_SETTINGS = {
    proliferate_itself: false, time_tick: 60, mineralize_list: [], stackable_buildings: []
};

export function ContextProvider({ children }) {
    const [game_info, set_game_info] = useState(
        new GameInfo("vanilla", GameData.vanilla));

    const [scheme_data, set_scheme_data] = useState(
        init_scheme_data(GameData.vanilla));


    const [ui_settings, set_ui_settings] = useState(DEFAULT_UI_SETTINGS);
    const [natural_production_line, set_natural_production_line] = useState([]);

    const [global_state, set_global_state] = useState(
        new GlobalState(game_info, scheme_data, [], DEFAULT_UI_SETTINGS));

    function set_game_name_and_data(game_name, game_data) {
        set_game_info(new GameInfo(game_name, game_data));
    }

    useEffect(() => {
        set_global_state(new GlobalState(
            game_info, scheme_data, natural_production_line, ui_settings));
    }, [game_data, scheme_data, natural_production_line, ui_settings]);

    return <GameInfoContext.Provider value={game_info}>
        <GlobalStateContext.Provider value={global_state}>
            <GameInfoSetterContext.Provider value={set_game_name_and_data}>
                <SchemeDataSetterContext.Provider value={set_scheme_data}>
                    <UiSettingsSetterContext.Provider value={set_ui_settings}>
                        <NaturalProductionLineSetterContext.Provider value={set_natural_production_line}>
                            {children}
                        </NaturalProductionLineSetterContext.Provider>
                    </UiSettingsSetterContext.Provider>
                </SchemeDataSetterContext.Provider>
            </GameInfoSetterContext.Provider>
        </GlobalStateContext.Provider>
    </GameInfoContext.Provider>
}
