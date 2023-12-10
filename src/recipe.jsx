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
            <ItemIcon item={item} size={28} />
            <span className="me-1 ssmall align-self-end">{count}</span>
        </React.Fragment>;
    }

    const input_doms = Object.entries(recipe["原料"]).map(item_to_doms);
    const output_doms = Object.entries(recipe["产物"]).map(item_to_doms);

    return <span className="d-inline-flex">
        {input_doms.length > 0 && <>
            {input_doms}
            <span className="me-1 position-relative"
                style={{ fontSize: "32px", lineHeight: "20px" }}>
                &#10230;
                <span className="position-absolute text-center text-recipe-time"
                    style={{ left: 0, width: "100%", top: "50%", fontSize: "14px" }}>
                    {recipe["时间"]}s
                </span>
            </span>
        </>}
        {output_doms}

        {input_doms.length == 0 && <small className="ms-1 align-self-end text-recipe-time">
            ({recipe["时间"]}s)
        </small>}
    </span>;
}

function getOptionTypebg(optionType, value) {
    if (optionType === "proModeSelect") {
        if (value == "0") {
            return "proMode-none";
        }
        else if (value == "1") {
            return "proMode-speedup";
        }
        else if (value == "2") {
            return "proMode-extraProducts";
        }
        return "bg-selected";
    }
    else {
        return "bg-selected";
    }
}

function getOptionTypeShape(optionType) {
    if (optionType === "proNumSelect") {
        return "proNum-shape";
    }
    else if (optionType === "proModeSelect") {
        return "proMode-shape";
    }
    else {
        return "";
    }

}

function getUnselectedBg(optionType) {
    if (optionType === "factorySelect") {
        return "bg-transparent";
    }
    else {
        return "bg-unselected";
    }
}

export function HorizontalMultiButtonSelect({ choice, options, onChange, no_gap, optionType }) {
    let gap_class = no_gap ? "" : "gap-1";
    let option_doms = options.map(({ value, label, item_icon }) => {
        let selected_class = choice == value ? getOptionTypebg(optionType, value) : getUnselectedBg(optionType);
        let gap_class = no_gap ? "" : "border-between border-white";
        let shape_class = getOptionTypeShape(optionType);
        return <div key={value}
            className={`py-1 px-1 text-nowrap d-flex align-items-center cursor-pointer ${selected_class} ${gap_class} ${shape_class}`}
            onClick={() => onChange(value)}
        >{item_icon && <ItemIcon item={item_icon} size={32} />}{label}</div>;
    })

    return <div className={`d-flex ${gap_class}`}>{option_doms}</div>;
}