import {hasMineralizedItem} from '../../core/calculation/mineralizeState.js';

export function buildResultRowsViewModel({
    fixed_num,
    game_data,
    item_data,
    mineralize_list,
    result_dict,
    scheme_data,
    settings,
    side_products,
    getFactoryNumber,
}) {
    let rows = [];
    let normalized_side_products = {...side_products};

    for (let item_name in result_dict) {
        normalized_side_products[item_name] = normalized_side_products[item_name] || {};
        let total = result_dict[item_name] + Object.values(normalized_side_products[item_name]).reduce((a, b) => a + b, 0);
        if (total < 1e-6) continue;
        let recipe_id = item_data[item_name][scheme_data.item_recipe_choices[item_name]];
        if (settings.hide_mines
            && (hasMineralizedItem(mineralize_list, item_name) || Object.keys(game_data.recipe_data[recipe_id]["原料"]).length < 1)) {
            continue;
        }

        let factory_number = getFactoryNumber(result_dict[item_name], item_name);
        let from_side_products = Object.entries(normalized_side_products[item_name]).map(([from, amount]) => ({
            from,
            amount_text: amount.toFixed(fixed_num),
        }));
        let factory_name = game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_data.scheme_for_recipe[recipe_id]["建筑"]]["名称"];
        let is_mineralized = hasMineralizedItem(mineralize_list, item_name);

        rows.push({
            item_name,
            recipe_id,
            factory_number,
            from_side_products,
            factory_name,
            is_mineralized,
            row_class: is_mineralized ? "table-secondary" : "",
            proliferator_mode: scheme_data.scheme_for_recipe[recipe_id]["增产模式"],
            proliferator_points: scheme_data.scheme_for_recipe[recipe_id]["增产点数"],
            building_choice: scheme_data.scheme_for_recipe[recipe_id]["建筑"],
            recipe_choice: scheme_data.item_recipe_choices[item_name],
        });
    }

    return rows;
}
