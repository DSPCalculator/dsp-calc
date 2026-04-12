import {useContext} from 'react';
import {GlobalStateContext} from '@ui/app/providers/app-contexts';
import type {RecipeScheme} from '@engine/types/domain';
import {HorizontalMultiButtonSelect} from '@ui/components/controls/HorizontalMultiButtonSelect';
import {Recipe} from './RecipeDisplay';
import {pro_mode_class} from './resultSelectorClasses';

export function RecipeSelect({item, choice, onChange, show_effective_recipe, scheme_override}: {
    item: string;
    choice: number;
    onChange: (value: number) => void;
    show_effective_recipe: boolean;
    scheme_override?: Partial<RecipeScheme>;
}) {
    const global_state = useContext(GlobalStateContext);

    const game_data = global_state.game_data;
    const item_data = global_state.item_data;
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
        const recipe_index = item_data[item][1];
        const recipe = display_recipes[recipe_index];
        return <div className="px-2 py-0"><Recipe recipe={recipe}/></div>;
    }

    const doms = [];
    for (let i = 1; i < item_data[item].length; i++) {
        const recipe_index = item_data[item][i];
        const recipe = display_recipes[recipe_index];
        const bg_class = (i == choice) ? "selected" : "";
        doms.push(<a key={i}
                     className={`recipe-item px-2 py-0 d-block text-decoration-none text-reset cursor-pointer ${bg_class}`}
                     onClick={() => onChange(i)}>
            <Recipe recipe={recipe}/>
        </a>);
    }

    return <div className="border-recipe-item">{doms}</div>;
}

export function ProNumSelect({choice, onChange}: {choice: number; onChange: (value: number) => void}) {
    const global_state = useContext(GlobalStateContext);
    const game_data = global_state.game_data;
    const pro_num_text: Record<number, string> = {};
    for (let i = 0; i < game_data.proliferator_data.length; i++) {
        pro_num_text[game_data.proliferator_data[i]["增产点数"]] = game_data.proliferator_data[i]["名称"];
    }
    const pro_num_options = [];
    for (let i = 0; i < game_data.proliferator_effect.length; i++) {
        if (i == 0) {
            continue;
        } else if (global_state.proliferator_price[i] != -1) {
            pro_num_options.push({value: i, item_icon: pro_num_text[i]});
        }
    }

    return <HorizontalMultiButtonSelect choice={choice} options={pro_num_options} onChange={onChange}/>;
}

export function ProModeSelect({recipe_id, choice, onChange}: {
    recipe_id: number;
    choice: number;
    onChange: (value: number) => void;
}) {
    const global_state = useContext(GlobalStateContext);
    const game_data = global_state.game_data;
    let pro_modes: Record<number, string> = {0: "无"};
    // 如果是增产塔，只能选择增产分馏。
    if (game_data.recipe_data[recipe_id]["增产"] & (1 << 3)) {
        pro_modes = {};
    }
    ["加速", "增产", "接收站透镜喷涂", "增产分馏"].forEach((e, i) => {
        if (game_data.recipe_data[recipe_id]["增产"] & (1 << i)) {
            pro_modes[i + 1] = e;
        }
    });
    const options = Object.entries(pro_modes).map(([value, label]) => (
        {value: Number(value), label: label, className: pro_mode_class[value]}
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange}
                                        className={"raw-text-selection"}/>;
}

export function FactorySelect({recipe_id, choice, onChange, no_gap = false}: {
    recipe_id: number;
    choice: number;
    onChange: (value: number) => void;
    no_gap?: boolean;
}) {
    const global_state = useContext(GlobalStateContext);
    const game_data = global_state.game_data;

    const factory_kind = game_data.recipe_data[recipe_id]["设施"];
    const factory_list = game_data.factory_data[factory_kind];

    const options = factory_list.map((factory_data, idx) => (
        {value: idx, item_icon: factory_data["名称"]}
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange} no_gap={no_gap}/>;
}
