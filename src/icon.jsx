import {useContext} from 'react';
import {GlobalStateContext} from './contexts';
import {get_icon_by_item} from "./GameData.jsx";

const icon_modules = import.meta.glob('../icon/**/*.png', {
    import: 'default',
    eager: true,
});

/** {[modName: string]: {[iconName: string]: string}} */
const icon_urls = Object.entries(icon_modules).reduce((groups, [modulePath, url]) => {
    const match = modulePath.match(/^\.\.\/icon\/([^/]+)\/(.+)\.png$/);
    if (!match) {
        return groups;
    }

    const [, modName, iconName] = match;
    if (!(modName in groups)) {
        groups[modName] = {};
    }
    groups[modName][iconName] = url;
    return groups;
}, {});

function Icon({icon, size, mods}) {
    if (!mods.includes("Vanilla")) {
        mods = ["Vanilla", ...mods];
    }

    // 保持原有覆盖规则：后启用的模组优先，最后回退到 Vanilla。
    for (let i = mods.length - 1; i >= 0; i--) {
        const icon_dom = get_icon_from_one_mod(icon, size, mods[i]);
        if (icon_dom !== null) {
            return icon_dom;
        }
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

function get_icon_from_one_mod(icon, size, mod) {
    const url = icon_urls[mod]?.[icon];
    if (!url) {
        return null;
    }

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

export function ItemIcon({item, size, tooltip}) {
    const global_state = useContext(GlobalStateContext);
    size = size || 40;

    const icon = get_icon_by_item(item);
    const img = <Icon icon={icon} size={size} mods={global_state.game_data.mod_name_list}/>;

    tooltip = tooltip === undefined ? true : tooltip;
    if (tooltip) {
        const fontSize = Math.min(size / 2, 16);
        return <span data-tooltip={item} className="fast-tooltip"
                     style={{fontSize: fontSize}}>
            {img}
        </span>;
    }

    return img;
}
