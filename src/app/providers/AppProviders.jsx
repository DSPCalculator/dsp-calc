import {useState} from 'react';
import {useSetState} from 'ahooks';
import {GlobalState} from '../../core/calculation/globalState.js';
import {GameInfo} from '../../core/game-data/gameInfo.js';
import {default_game_data} from '../../core/game-data/gameData.js';
import {init_scheme_data} from '../../features/settings/schemeData.js';
import {
    GameInfoContext,
    GameInfoSetterContext,
    GlobalStateContext,
    SchemeDataSetterContext,
    SettingsContext,
    SettingsSetterContext
} from './app-contexts.js';
import {DEFAULT_SETTINGS} from './default-settings.js';

export function ContextProvider({children}) {
    const [game_info, set_game_info] = useState(new GameInfo(default_game_data));
    const [scheme_data, set_scheme_data] = useState(init_scheme_data(default_game_data));
    const [settings, set_settings] = useSetState(DEFAULT_SETTINGS);

    let global_state = new GlobalState(game_info, scheme_data, settings);

    function set_game_data(game_data) {
        set_game_info(new GameInfo(game_data));
    }

    return <GameInfoContext.Provider value={game_info}>
        <GlobalStateContext.Provider value={global_state}>
            <GameInfoSetterContext.Provider value={set_game_data}>
                <SchemeDataSetterContext.Provider value={set_scheme_data}>
                    <SettingsSetterContext.Provider value={set_settings}>
                        <SettingsContext.Provider value={settings}>
                            {children}
                        </SettingsContext.Provider>
                    </SettingsSetterContext.Provider>
                </SchemeDataSetterContext.Provider>
            </GameInfoSetterContext.Provider>
        </GlobalStateContext.Provider>
    </GameInfoContext.Provider>;
}
