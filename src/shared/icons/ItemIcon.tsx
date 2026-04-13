import {useContext} from 'react';
import {GlobalStateContext} from '../../app/providers/app-contexts';
import {get_icon_by_item} from "../../core/game-data/gameData";
import type {ItemIconProps} from '../../types/ui';
import {
    areIconRegistriesLoading,
    areIconRegistriesReady,
    getLoadedIconUrl,
    useIconRegistries
} from './iconRegistryLoader';

function Icon({icon, size, mods}: {icon?: string; size: number; mods: string[]}) {
    useIconRegistries(mods);

    if (areIconRegistriesLoading(mods)) {
        return <span
            style={{
                width: size,
                height: size,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: Math.min(size / 2, 16),
                overflow: "hidden",
            }}
        >?</span>;
    }

    const url = getLoadedIconUrl(icon, mods);
    if (url) {
        return <img
            src={url}
            alt={icon}
            width={size}
            height={size}
            style={{
                display: "inline-block",
                verticalAlign: "bottom",
                objectFit: "contain",
            }}
        />;
    }

    if (!areIconRegistriesReady(mods)) {
        return <span
            style={{
                width: size,
                height: size,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: Math.min(size / 2, 16),
                overflow: "hidden",
            }}
        >?</span>;
    }

    return <span
        style={{
            width: size,
            height: size,
            display: "inline-block",
            fontSize: 10,
            textWrap: "pretty",
            overflow: "hidden",
        }}
    >? {icon}</span>;
}

export function ItemIcon({item, size = 40, tooltip = true}: ItemIconProps) {
    const global_state = useContext(GlobalStateContext);

    const icon = get_icon_by_item(item);
    const img = <Icon icon={icon} size={size} mods={global_state.game_data.mod_name_list}/>;

    if (tooltip) {
        const fontSize = Math.min(size / 2, 16);
        return <span data-tooltip={item} className="fast-tooltip"
                     style={{fontSize: fontSize}}>
            {img}
        </span>;
    }

    return img;
}
