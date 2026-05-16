import {useContext} from 'react';
import type {CSSProperties} from 'react';
import {GlobalStateContext} from '@ui/app/providers/app-contexts';
import {get_icon_by_item} from "@engine/data/gameData";
import type {ItemIconProps} from '@ui/types/ui';
import {
    areIconRegistriesLoading,
    areIconRegistriesReady,
    getLoadedIconSprite,
    useIconRegistries
} from './iconRegistryLoader';

export const ITEM_ICON_CONTENT_SIZE = 36;
export const ITEM_ICON_OUTER_SIZE = 40;
const ITEM_ICON_INNER_PADDING = (ITEM_ICON_OUTER_SIZE - ITEM_ICON_CONTENT_SIZE) / 2;
const ITEM_ICON_RESPONSIVE_SCALE = 'var(--item-icon-responsive-scale, 1)';

function getSpriteUrl(modName: string, extension: 'png' | 'webp'): string {
    if (import.meta.env.DEV) {
        return `${import.meta.env.BASE_URL}icon/${modName}.${extension}`;
    }

    // 生产环境中内联 CSS 的相对 URL 会按页面地址解析；改按当前 JS chunk 反推部署根目录。
    const assetsUrl = new URL(/* @vite-ignore */ '.', import.meta.url).href;
    return assetsUrl.replace(/assets\/?$/, `icon/${modName}.${extension}`);
}

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

    const sprite = getLoadedIconSprite(icon, mods);
    if (sprite) {
        const {entry, modName} = sprite;
        const scale = size / entry.height;
        const width = entry.width * scale;
        const height = entry.height * scale;
        const backgroundWidth = entry.total_width * scale;
        const backgroundHeight = entry.total_height * scale;
        const backgroundX = -entry.x * scale;
        const backgroundY = -entry.y * scale;
        const spritePng = `url("${getSpriteUrl(modName, 'png')}")`;
        const spriteWebp = `url("${getSpriteUrl(modName, 'webp')}")`;

        return <span
            className="item-icon-sprite"
            role="img"
            aria-label={icon}
            style={{
                '--item-icon-sprite-png': spritePng,
                '--item-icon-sprite-webp': spriteWebp,
                width: scaledPx(width),
                height: scaledPx(height),
                display: "inline-block",
                verticalAlign: "bottom",
                backgroundPosition: `${scaledPx(backgroundX)} ${scaledPx(backgroundY)}`,
                backgroundSize: `${scaledPx(backgroundWidth)} ${scaledPx(backgroundHeight)}`,
                backgroundRepeat: "no-repeat",
            } as CSSProperties}
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
