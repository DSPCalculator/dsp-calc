import {useState} from 'react';
import {useSetState} from 'ahooks';
import {GlobalState} from '@engine/calculation/globalState';
import {GameInfo} from '@engine/data/gameInfo';
import {default_game_data} from '@engine/data/gameData';
import {init_low_footprint_scheme_data} from '@engine/scheme/defaultScheme';
import type {GameData, SchemeData, Settings} from '@engine/types/domain';
import type {ExpandedCalculatorUrlState} from '../urlState';
import {
    GameInfoContext,
    GameInfoSetterContext,
    GlobalStateContext,
    ModSelectionContext,
    ModSelectionSetterContext,
    type ProviderChildren,
    SchemeDataSetterContext,
    SettingsContext,
    SettingsSetterContext
} from './app-contexts';
import {get_default_settings_for_game_data} from './default-settings';

export function ContextProvider({
    children,
    initial_game_data = default_game_data,
    initial_mods = [],
    initial_state,
}: ProviderChildren & {
    initial_game_data?: GameData;
    initial_mods?: string[];
    initial_state?: ExpandedCalculatorUrlState;
}) {
    const [game_info, set_game_info] = useState(new GameInfo(initial_game_data));
    const [mod_selection, set_mod_selection] = useState<string[]>(initial_mods);
    const [settings, set_settings] = useSetState<Settings>({
        ...get_default_settings_for_game_data(initial_game_data),
        ...(initial_state?.settings || {}),
    });
    const [scheme_data, set_scheme_data] = useState<SchemeData>(() => (
        initial_state?.scheme_data || init_low_footprint_scheme_data(
            initial_game_data,
            {
                ...get_default_settings_for_game_data(initial_game_data),
                ...(initial_state?.settings || {}),
            }
        )
    ));

    const global_state = new GlobalState(game_info, scheme_data, settings);

    function set_game_data(game_data: GameData) {
        set_game_info(new GameInfo(game_data));
    }

    function update_settings(patch: Partial<Settings>) {
        set_settings(patch as Settings);
    }

    return <GameInfoContext.Provider value={game_info}>
        <GlobalStateContext.Provider value={global_state}>
            <ModSelectionContext.Provider value={mod_selection}>
                <ModSelectionSetterContext.Provider value={set_mod_selection}>
                    <GameInfoSetterContext.Provider value={set_game_data}>
                        <SchemeDataSetterContext.Provider value={set_scheme_data}>
                            <SettingsSetterContext.Provider value={update_settings}>
                                <SettingsContext.Provider value={settings}>
                                    {children}
                                </SettingsContext.Provider>
                            </SettingsSetterContext.Provider>
                        </SchemeDataSetterContext.Provider>
                    </GameInfoSetterContext.Provider>
                </ModSelectionSetterContext.Provider>
            </ModSelectionContext.Provider>
        </GlobalStateContext.Provider>
    </GameInfoContext.Provider>;
}
