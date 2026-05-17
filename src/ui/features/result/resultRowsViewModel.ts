import {hasMineralizedItem} from '@engine/calculation/mineralizeState';
import type {GameData, ItemDataIndex, NumericMap, ResultRowViewModel, SchemeData, Settings} from '@engine/types/domain';

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
    lp_issue_items = new Set<string>(),
    lp_related_items = new Set<string>(),
}: {
    fixed_num: number;
    game_data: GameData;
    item_data: ItemDataIndex;
    mineralize_list: Settings['mineralize_list'];
    result_dict: NumericMap;
    scheme_data: SchemeData;
    settings: Settings;
    side_products: Record<string, NumericMap>;
    getFactoryNumber: (amount: number, item: string) => number;
    lp_issue_items?: Set<string>;
    lp_related_items?: Set<string>;
}): ResultRowViewModel[] {
    const rows: ResultRowViewModel[] = [];
    const normalized_side_products: Record<string, NumericMap> = {...side_products};

    const row_items = new Set([...Object.keys(result_dict), ...lp_issue_items, ...lp_related_items]);
    row_items.forEach((item_name) => {
        normalized_side_products[item_name] = normalized_side_products[item_name] || {};
        const result_amount = result_dict[item_name] ?? 0;
        const total = result_amount + (Object.values(normalized_side_products[item_name]) as number[]).reduce((a, b) => a + b, 0);
        if (total < 1e-6 && !lp_issue_items.has(item_name) && !lp_related_items.has(item_name)) {
            return;
        }
        const recipe_id = item_data[item_name][scheme_data.item_recipe_choices[item_name]];
        if (settings.hide_mines
            && (hasMineralizedItem(mineralize_list, item_name) || Object.keys(game_data.recipe_data[recipe_id]["原料"]).length < 1)) {
            return;
        }

        const factory_number = getFactoryNumber(result_amount, item_name);
        const from_side_products = (Object.entries(normalized_side_products[item_name]) as Array<[string, number]>).map(([from, amount]) => ({
            from,
            amount_text: amount.toFixed(fixed_num),
        }));
        const factory_name = game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_data.scheme_for_recipe[recipe_id]["建筑"]]["名称"];
        const is_mineralized = hasMineralizedItem(mineralize_list, item_name);
        const row_classes = [
            is_mineralized ? "table-secondary" : "",
            lp_issue_items.has(item_name) ? "table-danger lp-issue-row" : "",
            lp_related_items.has(item_name) ? "table-warning" : "",
        ].filter(Boolean).join(" ");
        const issue_relation = lp_issue_items.has(item_name)
            ? 'blocker'
            : lp_related_items.has(item_name)
                ? 'related'
                : undefined;

        rows.push({
            item_name,
            recipe_id,
            factory_number,
            from_side_products,
            factory_name,
            is_mineralized,
            issue_relation,
            row_class: row_classes,
            proliferator_mode: scheme_data.scheme_for_recipe[recipe_id]["增产模式"],
            proliferator_points: scheme_data.scheme_for_recipe[recipe_id]["增产点数"],
            building_choice: scheme_data.scheme_for_recipe[recipe_id]["建筑"],
            recipe_choice: scheme_data.item_recipe_choices[item_name],
        });
    });

    return rows;
}
