import { useContext } from 'react';
import { GlobalStateContext } from './contexts';

const image_index_modules = import.meta.glob('../icon/*.json', {
    import: 'default',
    eager: true,
});

/** {[game_name: string]: {[item: string]: image_props}}} */
const image_indices = Object.fromEntries(
    Object.entries(image_index_modules)
        .map(([module, icons]) =>
            [module.replace(/^\.\.\/icon\/(.+)\.json/, "$1"), icons]
        ))

export function IconStyles() {
    function get_icon_style(game_name) {
        return `
.icon-${game_name} {
    vertical-align: bottom;
    display: inline-block;
    background-image: url('icon/${game_name}.png');
    @supports (background-image: url('icon/${game_name}.webp')) {
        background-image: url('icon/${game_name}.webp');
    }
}`;
    }
    const styles = Object.keys(image_indices).map(get_icon_style).join("\n");
    return <style>{styles}</style>;
}

function Icon({ item, size, game_name }) {
    try {
        const { x, y, width, height, total_width, total_height } = image_indices[game_name][item];
        const scale = size / height;

        const tw = total_width * scale, th = total_height * scale;
        const bgx = -x * scale, bgy = -y * scale;

        return <><span className={`icon-${game_name}`}
            style={{
                width: size, height: size,
                backgroundPosition: `${bgx}px ${bgy}px`,
                backgroundSize: `${tw}px ${th}px`,
            }}
        /></>;
    } catch {
        return <><span
            style={{
                width: size, height: size,
                display: "inline-block",
                fontSize: 10,
                textWrap: "pretty",
                overflow: "hidden",
            }}
        >? {item}</span></>
    }
}

export function ItemIcon({ item, size, tooltip }) {
    const global_state = useContext(GlobalStateContext);
    size = size || 40;

    let img = <Icon item={item} size={size} game_name={global_state.game_name} />;

    tooltip = tooltip === undefined ? true : tooltip;
    if (tooltip) {
        let fontSize = Math.min(size / 2, 16);
        return <span data-tooltip={item} className="fast-tooltip"
            style={{ fontSize: fontSize }}>
            {img}
        </span>;
    } else {
        return img;
    }
}
