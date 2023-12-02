import React, { useContext } from 'react';
import { GlobalStateContext } from './contexts';

export function ItemIcon({ item, size, tooltip }) {
    const global_state = useContext(GlobalStateContext);
    size = size || 40;

    let img =
        <img src={`./image/${global_state.game_name}/${item}.png`}
            style={{ width: size, height: size, verticalAlign: 'bottom' }} />;

    tooltip = tooltip === undefined ? true : tooltip;
    if (tooltip) {
        let fontSize = Math.min(size / 2, 16);
        return <span data-tooltip={item} className="fast-tooltip" style={{ fontSize: fontSize }}>{img}</span>;
    } else {
        return img;
    }
}

export function Recipe({ recipe }) {
    function item_to_doms([item, count]) {
        return <React.Fragment key={item}>
            <ItemIcon item={item} size={24} />
            <sub className='me-1'>{count}</sub>
        </React.Fragment>;
    }

    const input_doms = Object.entries(recipe["原料"]).map(item_to_doms);
    const output_doms = Object.entries(recipe["产物"]).map(item_to_doms);

    return <span className="text-nowrap">
        {input_doms.length > 0 && <>
            {input_doms}
            <span className="mx-1" style={{ fontSize: "20px", lineHeight: "20px" }}>→</span>
        </>
        }

        {output_doms}
    </span>;
}