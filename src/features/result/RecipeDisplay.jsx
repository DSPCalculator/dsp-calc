import React from 'react';
import {ItemIcon} from '../../shared/icons/ItemIcon.jsx';

export function Recipe({recipe}) {
    const RECIPE_ITEM_ICON_SIZE = 40;

    function RecipeItemIcon({item, count}) {
        return <span className="recipe-item-icon me-1">
            <ItemIcon item={item} size={RECIPE_ITEM_ICON_SIZE}/>
            <span className="recipe-item-icon-count">{count}</span>
        </span>;
    }

    function formatRecipeCount(count) {
        if (count !== 0 && Math.abs(count) < 0.001) {
            return count.toExponential(1);
        }
        const rounded = Math.round((count + Number.EPSILON) * 1000) / 1000;
        return rounded.toFixed(3).replace(/\.?0+$/, '');
    }

    function item_to_doms([item, count]) {
        return <React.Fragment key={item}>
            <RecipeItemIcon item={item} count={formatRecipeCount(count)}/>
        </React.Fragment>;
    }

    function raw_fractionate_output_to_doms(output) {
        return <React.Fragment key={output["物品"]}>
            <RecipeItemIcon item={output["物品"]} count={formatRecipeCount(output["数量"])}/>
        </React.Fragment>;
    }

    function format_fractionate_ratio(ratio) {
        return `${(ratio * 100).toFixed(1).replace(/\.0$/, '')}%`;
    }

    if (recipe["模型"] === "fractionate_raw") {
        const input_doms = Object.entries(recipe["原料"]).map(item_to_doms);
        const output_doms = (recipe["主产物"] || []).map(raw_fractionate_output_to_doms);
        return <span className="d-inline-flex align-items-center">
            {input_doms}
            <span className="mx-1 d-inline-flex flex-column align-items-center justify-content-center"
                  style={{transform: "translateY(2px)"}}>
                <small className="text-center text-recipe-time"
                       style={{lineHeight: "10px", marginBottom: "-6px"}}>
                    {format_fractionate_ratio(recipe["成功率"] || 0)}
                </small>
                <span style={{fontSize: "32px", lineHeight: "20px"}}>
                    &#10230;
                </span>
            </span>
            {output_doms}
        </span>;
    }

    const input_doms = Object.entries(recipe["原料"]).map(item_to_doms);
    const output_doms = Object.entries(recipe["产物"]).map(item_to_doms);
    const time = Math.ceil(recipe["时间"] * 100) / 100;

    return <span className="d-inline-flex">
        {input_doms.length > 0 && <>
            {input_doms}
            <span className="me-1 d-inline-flex flex-column align-items-center justify-content-center"
                  style={{transform: "translateY(2px)"}}>
                <small className="text-center text-recipe-time"
                       style={{lineHeight: "10px", marginBottom: "-6px"}}>
                    {time}s
                </small>
                <span style={{fontSize: "32px", lineHeight: "20px"}}>
                    &#10230;
                </span>
            </span>
        </>}
        {output_doms}

        {input_doms.length === 0 && <small className="ms-1 align-self-end text-recipe-time">
            ({time}s)
        </small>}
    </span>;
}
