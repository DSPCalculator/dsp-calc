import {createContext} from 'react';
import type {Dispatch, ReactNode, SetStateAction} from 'react';
import type {GameInfo} from '@engine/data/gameInfo';
import type {GlobalState} from '@engine/calculation/globalState';
import type {GameData, SchemeData, Settings} from '@engine/types/domain';
import {DEFAULT_SETTINGS} from './default-settings';

function createMissingFunction<T extends (...args: never[]) => unknown>(label: string): T {
    return ((..._args: never[]) => {
        throw new Error(`${label} Provider 缺失`);
    }) as unknown as T;
}

function createMissingObject<T extends object>(label: string): T {
    return new Proxy({} as T, {
        get() {
            throw new Error(`${label} Provider 缺失`);
        },
    });
}

export type GameInfoSetter = (game_data: GameData) => void;
export type SchemeDataSetter = Dispatch<SetStateAction<SchemeData>>;
export type SettingsSetter = (patch: Partial<Settings>) => void;
export type ModSelectionSetter = Dispatch<SetStateAction<string[]>>;
export type ProviderChildren = {children: ReactNode};

export const GameInfoSetterContext = createContext<GameInfoSetter>(
    createMissingFunction<GameInfoSetter>('GameInfoSetterContext')
);
export const SchemeDataSetterContext = createContext<SchemeDataSetter>(
    createMissingFunction<SchemeDataSetter>('SchemeDataSetterContext')
);
export const SettingsSetterContext = createContext<SettingsSetter>(
    createMissingFunction<SettingsSetter>('SettingsSetterContext')
);
export const GlobalStateContext = createContext<GlobalState>(
    createMissingObject<GlobalState>('GlobalStateContext')
);
export const SettingsContext = createContext<Settings>(DEFAULT_SETTINGS);
export const GameInfoContext = createContext<GameInfo>(
    createMissingObject<GameInfo>('GameInfoContext')
);
export const DefaultSettingsContext = createContext<Settings>(DEFAULT_SETTINGS);
export const ModSelectionContext = createContext<string[]>([]);
export const ModSelectionSetterContext = createContext<ModSelectionSetter>(
    createMissingFunction<ModSelectionSetter>('ModSelectionSetterContext')
);
