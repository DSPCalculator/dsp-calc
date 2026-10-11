import {useContext} from 'react';
import {GlobalStateContext} from './contexts';
import {get_icon_by_item} from "./GameData.jsx";
import {Tooltip, TooltipContent, TooltipTrigger} from './components/ui/tooltip';
import {createIconStyles} from './lib/icon-styles.js';

const image_index_modules = import.meta.glob(['../icon/*.json', '!../icon/*.assets.json'], {
    import: 'default',
    eager: true,
});

/** {[game_name: string]: {[item: string]: image_props}}} */
const image_indices = Object.fromEntries(
    Object.entries(image_index_modules)
        .map(([module, icons]) =>
            [module.replace(/^\.\.\/icon\/(.+)\.json/, "$1"), icons]
        ))

const image_asset_modules = import.meta.glob('../icon/*.assets.json', {
    import: 'default',
    eager: true,
});
const image_assets = Object.fromEntries(Object.entries(image_asset_modules).map(([module, assets]) =>
    [module.replace(/^\.\.\/icon\/(.+)\.assets\.json$/, '$1'), assets]));

export function IconStyles() {
    const styles = createIconStyles(image_assets, import.meta.env.BASE_URL);
    return <style>{styles}</style>;
}

function Icon({icon, size, mods}) {
    //console.log("Icon(" + icon + ", " + size + ", " + mods + ")");
    if (!mods.includes("Vanilla")) {
        mods = ["Vanilla", ...mods];
    }
    //倒序查询图标
    for (let i = mods.length - 1; i >= 0; i--) {
        let icon2 = get_icon_from_one_mod(icon, size, mods[i]);
        if (icon2 !== null) {
            return icon2;
        }
    }
    return <><span role="img" aria-label={icon}
        style={{
            width: size, height: size,
            display: "inline-block",
            fontSize: 10,
            textWrap: "pretty",
            overflow: "hidden",
        }}
    >? {icon}</span></>
}

function get_icon_from_one_mod(icon, size, mod) {
    //console.log("Icon1(" + icon + ", " + size + ", " + mod + ")");
    //console.log("image_indices", image_indices);
    //console.log("mod", mod);
    //console.log("icon", icon);
    try {
        const {x, y, height, total_width, total_height} = image_indices[mod][icon];
        //console.log("find " + icon + " from " + mod + " success.");
        const scale = size / height;

        const tw = total_width * scale, th = total_height * scale;
        const bgx = -x * scale, bgy = -y * scale;

        return <>
            <span className={`icon-${mod}`} role="img" aria-label={icon}
                 style={{
                     width: size, height: size,
                     backgroundPosition: `${bgx}px ${bgy}px`,
                     backgroundSize: `${tw}px ${th}px`,
                 }}
            />
        </>;
    } catch {
        //console.log("find " + icon + " from " + mod + " fail.");
        return null;
    }
}

export function ItemIcon({item, size, tooltip}) {
    const global_state = useContext(GlobalStateContext);
    size = size || 40;

    const icon = get_icon_by_item(item);

    let img = <Icon icon={icon} size={size} mods={global_state.game_data.mods}/>;

    tooltip = tooltip === undefined ? true : tooltip;
    if (tooltip) {
        return <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex shrink-0 items-center align-middle">{img}</span>
            </TooltipTrigger>
            <TooltipContent side="top">{item}</TooltipContent>
        </Tooltip>;
    }
    return img;
}

// Recipe-grid artwork can differ from the ordinary product icon.
export function GameIcon({icon, size = 40}) {
    const global_state = useContext(GlobalStateContext);
    return <Icon icon={icon} size={size} mods={global_state.game_data.mods}/>;
}
