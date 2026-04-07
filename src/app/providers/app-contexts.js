import {createContext} from 'react';
import {DEFAULT_SETTINGS} from './default-settings.js';

/** set_game_name_and_data(game_name, game_data) */
export const GameInfoSetterContext = createContext(null);
export const SchemeDataSetterContext = createContext(null);
/** set_settings({prop: value}) */
export const SettingsSetterContext = createContext(null);
export const GlobalStateContext = createContext(null);
export const SettingsContext = createContext(null);
export const GameInfoContext = createContext(null);
export const DefaultSettingsContext = createContext(DEFAULT_SETTINGS);
