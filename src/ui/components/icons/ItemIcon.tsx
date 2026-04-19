import {useContext} from 'react';
import {GlobalStateContext} from '@ui/app/providers/app-contexts';
import {get_icon_by_item} from "@engine/data/gameData";
import type {ItemIconProps} from '@ui/types/ui';
import {
    areIconRegistriesLoading,
    areIconRegistriesReady,
    getLoadedIconUrl,
    useIconRegistries
} from './iconRegistryLoader';

export const ITEM_ICON_CONTENT_SIZE = 36;
export const ITEM_ICON_OUTER_SIZE = 40;
const ITEM_ICON_INNER_PADDING = (ITEM_ICON_OUTER_SIZE - ITEM_ICON_CONTENT_SIZE) / 2;
const ITEM_ICON_RESPONSIVE_SCALE = 'var(--item-icon-responsive-scale, 1)';

function scaledPx(size: number) {
    return `calc(${size}px * ${ITEM_ICON_RESPONSIVE_SCALE})`;
}

function Icon({icon, size, mods}: {icon?: string; size: number; mods: string[]}) {
    useIconRegistries(mods);

    if (areIconRegistriesLoading(mods)) {
        return <span
            style={{
                width: scaledPx(size),
                height: scaledPx(size),
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: scaledPx(Math.min(size / 2, 16)),
                overflow: "hidden",
            }}
        >?</span>;
    }

    const url = getLoadedIconUrl(icon, mods);
    if (url) {
        return <img
            src={url}
            alt={icon}
            style={{
                width: scaledPx(size),
                height: scaledPx(size),
                display: "inline-block",
                verticalAlign: "bottom",
                objectFit: "contain",
            }}
        />;
    }

    if (!areIconRegistriesReady(mods)) {
        return <span
            style={{
                width: scaledPx(size),
                height: scaledPx(size),
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: scaledPx(Math.min(size / 2, 16)),
                overflow: "hidden",
            }}
        >?</span>;
    }

    return <span
        style={{
            width: scaledPx(size),
            height: scaledPx(size),
            display: "inline-block",
            fontSize: scaledPx(10),
            textWrap: "pretty",
            overflow: "hidden",
        }}
    >? {icon}</span>;
}

export function ItemIcon({item, size = ITEM_ICON_CONTENT_SIZE, tooltip = true}: ItemIconProps) {
    const global_state = useContext(GlobalStateContext);

    const icon = get_icon_by_item(item);
    const img = <Icon icon={icon} size={size} mods={global_state.game_data.mod_name_list}/>;
    const outerSize = size === ITEM_ICON_CONTENT_SIZE ? ITEM_ICON_OUTER_SIZE : size;
    const iconWithFrame = <span
        className="item-icon-frame"
        style={{
            width: scaledPx(outerSize),
            height: scaledPx(outerSize),
            padding: size === ITEM_ICON_CONTENT_SIZE ? scaledPx(ITEM_ICON_INNER_PADDING) : 0,
            boxSizing: "border-box",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: `0 0 ${scaledPx(outerSize)}`,
        }}
    >
        {img}
    </span>;

    if (tooltip) {
        const fontSize = Math.min(size / 2, 16);
        return <span data-tooltip={item} className="fast-tooltip"
                     style={{fontSize: fontSize, display: "inline-flex", alignItems: "center"}}>
            {iconWithFrame}
        </span>;
    }

    return iconWithFrame;
}
