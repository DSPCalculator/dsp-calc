import {useContext} from 'react';
import {GlobalStateContext} from '../../app/providers/app-contexts.js';
import {HorizontalMultiButtonSelect} from '../../shared/ui/HorizontalMultiButtonSelect.jsx';
import {Recipe} from './RecipeDisplay.jsx';
import {pro_mode_class} from './resultSelectorClasses.js';

export function RecipeSelect({item, choice, onChange, show_effective_recipe, scheme_override}) {
    const global_state = useContext(GlobalStateContext);

    let game_data = global_state.game_data;
    let item_data = global_state.item_data;
    const candidate_recipe_indexes = item_data[item].slice(1);

    function get_display_recipe(recipe_index) {
        if (!show_effective_recipe) {
            return game_data.recipe_data[recipe_index];
        }
        return global_state.get_equivalent_recipe_for_recipe(item, recipe_index, scheme_override);
    }

    const display_recipes = Object.fromEntries(
        candidate_recipe_indexes.map(recipe_index => [recipe_index, get_display_recipe(recipe_index)])
    );

    if (item_data[item].length == 2) {
        let recipe_index = item_data[item][1];
        let recipe = display_recipes[recipe_index];
        return <div className="my-1 px-2 py-1"><Recipe recipe={recipe}/></div>;
    }

    let doms = [];
    for (let i = 1; i < item_data[item].length; i++) {
        let recipe_index = item_data[item][i];
        let recipe = display_recipes[recipe_index];
        let bg_class = (i == choice) ? "selected" : "";
        doms.push(<a key={i}
                     className={`recipe-item px-2 py-1 d-block text-decoration-none text-reset cursor-pointer ${bg_class}`}
                     onClick={() => onChange(i)}>
            <Recipe recipe={recipe}/>
        </a>);
    }

    return <div className="border-recipe-item">{doms}</div>;
}

export function ProNumSelect({choice, onChange}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;
    let pro_num_text = {};
    for (let i = 0; i < game_data.proliferator_data.length; i++) {
        pro_num_text[game_data.proliferator_data[i]["增产点数"]] = game_data.proliferator_data[i]["名称"];
    }
    let pro_num_options = [];
    for (let i = 0; i < game_data.proliferator_effect.length; i++) {
        if (i == 0) {
            continue;
        } else if (global_state.proliferator_price[i] != -1) {
            pro_num_options.push({value: i, item_icon: pro_num_text[i]});
        }
    }

    return <HorizontalMultiButtonSelect choice={choice} options={pro_num_options} onChange={onChange}
                                        optionType={"proNumSelect"}/>;
}

export function ProModeSelect({recipe_id, choice, onChange}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;
    let pro_modes = {[0]: "无"};
    // 如果是增产塔，只能选择增产分馏。
    if (game_data.recipe_data[recipe_id]["增产"] & (1 << 3)) {
        pro_modes = {};
    }
    ["加速", "增产", "接收站透镜喷涂", "增产分馏"].forEach((e, i) => {
        if (game_data.recipe_data[recipe_id]["增产"] & (1 << i)) {
            pro_modes[i + 1] = e;
        }
    });
    let options = Object.entries(pro_modes).map(([value, label]) => (
        {value: value, label: label, className: pro_mode_class[value]}
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange}
                                        className={"raw-text-selection"}/>;
}

export function FactorySelect({recipe_id, choice, onChange, no_gap}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;

    let factory_kind = game_data.recipe_data[recipe_id]["设施"];
    let factory_list = game_data.factory_data[factory_kind];

    let options = factory_list.map((factory_data, idx) => (
        {value: idx, item_icon: factory_data["名称"]}
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange} no_gap={no_gap}/>;
}
