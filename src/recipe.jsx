import React from 'react';
import {ItemIcon} from './icon';

export function Recipe({recipe}) {
    const RECIPE_ITEM_ICON_SIZE = 40;

    function RecipeItemIcon({item, count}) {
        return <span className="recipe-item-icon me-1">
            <ItemIcon item={item} size={RECIPE_ITEM_ICON_SIZE}/>
            <span className="recipe-item-icon-count">{count}</span>
        </span>;
    }

    function formatRecipeCount(count) {
        // 很小的数用科学计数法，避免被 3 位小数直接抹成 0。
        if (count !== 0 && Math.abs(count) < 0.001) {
            return count.toExponential(1);
        }
        // 其余配方角标统一限制到最多 3 位小数，并去掉无意义的尾随 0。
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
            <span className="mx-1 text-recipe-time text-nowrap">
                {format_fractionate_ratio(recipe["成功率"] || 0)}
            </span>
            {output_doms}
        </span>;
    }

    const input_doms = Object.entries(recipe["原料"]).map(item_to_doms);
    const output_doms = Object.entries(recipe["产物"]).map(item_to_doms);
    //时间向上取整，因为工厂也是向上取整
    const time = Math.ceil(recipe["时间"] * 100) / 100;

    return <span className="d-inline-flex">
        {input_doms.length > 0 && <>
            {input_doms}
            <span className="me-1 position-relative"
                  style={{fontSize: "32px", lineHeight: "20px"}}>
                &#10230;
                <span className="position-absolute text-center text-recipe-time"
                      style={{left: 0, width: "100%", top: "50%", fontSize: "12px"}}>
                    {time}s
                </span>
            </span>
        </>}
        {output_doms}

        {input_doms.length === 0 && <small className="ms-1 align-self-end text-recipe-time">
            ({time}s)
        </small>}
    </span>;
}

export function HorizontalMultiButtonSelect({choice, options, onChange, no_gap, className}) {
    let gap_class = no_gap ? "" : "gap-1";
    let option_doms = options.map(({value, label, item_icon, className}) => {
        let selected_class = choice == value ? "bg-selected" : "bg-unselected";
        // insert 1px white border if [no_gap == true]
        let gap_class = no_gap ? "border-between border-white" : "";
        return <div key={value}
                    className={`py-1 px-1 text-nowrap d-flex align-items-center cursor-pointer small
                ${selected_class} ${gap_class} ${className || ""}`}
                    onClick={() => onChange(value)}
        >{item_icon && <ItemIcon item={item_icon} size={40}/>}
            {label && <span className="mx-1">{label}</span>}
        </div>;
    })

    return <div className={`d-flex ${gap_class} ${className || ""}`}>{option_doms}</div>;
}
