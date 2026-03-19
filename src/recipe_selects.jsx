import React, {useContext} from 'react';
import {GlobalStateContext} from './contexts';
import {HorizontalMultiButtonSelect, Recipe} from './recipe';

export const pro_mode_class = {
    [1]: "pro-mode-speedup",
    [2]: "pro-mode-extra-products"
}

export const RecipeSelect = React.memo(function RecipeSelect({item, choice, onChange, compact}) {
    const global_state = useContext(GlobalStateContext);

    let game_data = global_state.game_data;
    let item_data = global_state.item_data;

    if (item_data[item].length === 2) {
        let recipe_index = item_data[item][1];
        let recipe = game_data.recipe_data[recipe_index];
        return <div className="my-1 px-2 py-1"><Recipe recipe={recipe} compact={compact}/></div>
    } else {
        let doms = [];
        for (let i = 1; i < item_data[item].length; i++) {
            let recipe_index = item_data[item][i];
            let recipe = game_data.recipe_data[recipe_index];
            let bg_class = (i === choice) ? "selected" : "";
            doms.push(<a key={i}
                         className={`recipe-item px-2 py-1 d-block text-decoration-none text-reset cursor-pointer ${bg_class}`}
                         onClick={() => onChange(i)}>
                <Recipe recipe={recipe} compact={compact}/>
            </a>);
        }

        return <div className="border-recipe-item">{doms}</div>;
    }
});

export const ProNumSelect = React.memo(function ProNumSelect({choice, onChange, icon_size}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;
    let pro_num_text = {};
    for (let i = 0; i < game_data.proliferator_data.length; i++) {
        pro_num_text[game_data.proliferator_data[i]["增产点数"]] = game_data.proliferator_data[i]["名称"];
    }
    let pro_num_options = [];
    for (let i = 0; i < game_data.proliferator_effect.length; i++) {
        if (i === 0) {
            continue;
        } else if (global_state.proliferator_price[i] !== -1)
            pro_num_options.push({value: i, item_icon: pro_num_text[i]});

    }

    return <HorizontalMultiButtonSelect choice={choice} options={pro_num_options} onChange={onChange}
                                        icon_size={icon_size} optionType={"proNumSelect"}/>;
});

export const ProModeSelect = React.memo(function ProModeSelect({recipe_id, choice, onChange}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;
    let pro_modes = {[0]: "无"};
    //如果是增产塔，只能选择增产分馏
    if (game_data.recipe_data[recipe_id]["增产"] & (1 << 3)) {
        pro_modes = {};
    }
    ["加速", "增产", "接收站透镜喷涂", "增产分馏"].forEach((e, i) => {
        if (game_data.recipe_data[recipe_id]["增产"] & (1 << i)) pro_modes[i + 1] = e
    })
    let options = Object.entries(pro_modes).map(([value, label]) => (
        {value: value, label: label, className: pro_mode_class[value]}
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange}
                                        className={"raw-text-selection"}/>;
});

export const FactorySelect = React.memo(function FactorySelect({recipe_id, choice, onChange, no_gap, icon_size}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;

    let factory_kind = game_data.recipe_data[recipe_id]["设施"];
    let factory_list = game_data.factory_data[factory_kind];

    let options = factory_list.map((factory_data, idx) => (
        {value: idx, item_icon: factory_data["名称"]}
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange}
                                        no_gap={no_gap} icon_size={icon_size}/>;
});
