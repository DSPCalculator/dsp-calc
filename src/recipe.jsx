import React, { useContext } from 'react';
import { GlobalStateContext } from './contexts';

export function ItemIcon({ item, size }) {
    const global_state = useContext(GlobalStateContext);
    size = size || 40;

    return <img src={`./image/${global_state.game_name}/${item}.png`}
        title={item} style={{ width: size, height: size, verticalAlign: 'bottom' }} />;
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

    return <span>
        {input_doms.length > 0 && <>
            {input_doms}
            <span className='mx-1' style={{ fontSize: "24px", lineHeight: "24px" }}>→</span>
        </>
        }

        {output_doms}
    </span>;
}