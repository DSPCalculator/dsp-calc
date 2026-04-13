import {useState} from 'react';
import {useSetState} from 'ahooks';
import {GlobalState} from '../../core/calculation/globalState';
import {GameInfo} from '../../core/game-data/gameInfo';
import {default_game_data} from '../../core/game-data/gameData';
import {init_scheme_data} from '../../features/settings/schemeData';
import type {GameData, SchemeData, Settings} from '../../types/domain';
import {
    GameInfoContext,
    GameInfoSetterContext,
    GlobalStateContext,
    type ProviderChildren,
    SchemeDataSetterContext,
    SettingsContext,
    SettingsSetterContext
} from './app-contexts';
import {DEFAULT_SETTINGS} from './default-settings';

export function ContextProvider({children}: ProviderChildren) {
    const [game_info, set_game_info] = useState(new GameInfo(default_game_data));
    const [scheme_data, set_scheme_data] = useState<SchemeData>(init_scheme_data(default_game_data));
    const [settings, set_settings] = useSetState<Settings>(DEFAULT_SETTINGS);

    const global_state = new GlobalState(game_info, scheme_data, settings);

    function set_game_data(game_data: GameData) {
        set_game_info(new GameInfo(game_data));
    }

    function update_settings(patch: Partial<Settings>) {
        set_settings(patch as Settings);
    }

    return <GameInfoContext.Provider value={game_info}>
        <GlobalStateContext.Provider value={global_state}>
            <GameInfoSetterContext.Provider value={set_game_data}>
                <SchemeDataSetterContext.Provider value={set_scheme_data}>
                    <SettingsSetterContext.Provider value={update_settings}>
                        <SettingsContext.Provider value={settings}>
                            {children}
                        </SettingsContext.Provider>
                    </SettingsSetterContext.Provider>
                </SchemeDataSetterContext.Provider>
            </GameInfoSetterContext.Provider>
        </GlobalStateContext.Provider>
    </GameInfoContext.Provider>;
}
