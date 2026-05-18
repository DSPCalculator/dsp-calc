import type {CSSProperties, ChangeEvent, KeyboardEvent, ReactNode} from 'react';
import type {IconGrid, ItemName, NumericMap, Settings} from '@engine/types/domain';

export interface HorizontalOption<TValue extends string | number = string | number> {
    value: TValue;
    label?: string;
    item_icon?: ItemName;
    className?: string;
}

export interface ItemIconProps {
    item: ItemName;
    size?: number;
    tooltip?: boolean;
}

export interface ItemSelectProps {
    item?: ItemName;
    set_item: (item: ItemName) => void;
    text?: string;
    btn_class?: string;
    icon_size?: number;
    icon_only?: boolean;
    icon?: ReactNode;
    compact_on_mobile?: boolean;
}

export interface ItemSelectPanelProps {
    fuzz_result: ItemName[];
    onSelect: (item: ItemName) => void;
    icon_grid: IconGrid;
    icon_size: number;
}

export interface AutoSizedInputProps {
    value: string | number;
    onChange: ((event: ChangeEvent<HTMLInputElement>) => void) | ((value: string) => void);
    className?: string;
    delayed?: boolean;
}

export interface SettingsPanelCondition {
    orbital_enabled?: boolean;
    genesis_enabled?: boolean;
}

export type SettingRowType = 'float' | 'int' | 'percent' | 'toggle' | 'fractionating_speed' | 'time_unit' | 'info';

export interface BaseSettingRow<TKey extends keyof Settings = keyof Settings> {
    type: SettingRowType;
    key?: TKey;
    label?: string;
    step?: number;
    min?: number;
    max?: number;
    unit?: string;
    enabledLabel?: string;
    disabledLabel?: string;
    enabledAction?: string;
    disabledAction?: string;
    title?: string;
    text?: string;
}

export interface SettingRowGroup {
    condition: (context: SettingsPanelCondition) => boolean;
    rows: BaseSettingRow[];
}

export type NumberLikeChangeHandler = (eventOrValue: ChangeEvent<HTMLInputElement> | string | number) => void;
export type StyleWithVars = CSSProperties & {'--bs-bg-opacity'?: string | number};
export type NeedsList = NumericMap;
export type SearchKeyEvent = KeyboardEvent<HTMLInputElement>;
