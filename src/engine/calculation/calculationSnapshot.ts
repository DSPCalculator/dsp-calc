import {
    build_effective_game_data,
    get_equivalent_recipe,
    get_equivalent_recipe_output_rate
} from './equivalentRecipe';
import {
    buildItemGraph,
    buildItemList,
    buildExternalSupplyProliferatorPoints,
    buildNormalizedSchemeData,
    buildProliferatorPrice
} from './globalStateDerivations';
import {getMineralizedItemNames} from './mineralizeState';
import type {
    CalculationSnapshot,
    GameData,
    ItemDataIndex,
    ItemPrice,
    NumericMap,
    RecipeData,
    RecipeScheme,
    SchemeData,
    Settings
} from '@engine/types/domain';

function createEquivalentRecipeGetter(snapshot: Omit<CalculationSnapshot, 'getEquivalentRecipe' | 'getEquivalentRecipeForItem' | 'getEquivalentRecipeForRecipe' | 'getEquivalentRecipeForNaturalLine' | 'getItemCost' | 'item_price' | 'item_graph' | 'multi_sources' | 'item_list' | 'key_item_list'> & Partial<CalculationSnapshot>) {
    return function (recipe_id: number, target_item: string, scheme_override?: Partial<RecipeScheme>): RecipeData {
        return get_equivalent_recipe({
            game_data: snapshot.effective_game_data,
            scheme_data: snapshot.scheme_data,
            settings: snapshot.settings,
            proliferator_price: snapshot.proliferator_price,
            external_supply_proliferator_points: snapshot.external_supply_proliferator_points,
            recipe_id,
            target_item,
            scheme_override
        });
    };
}

function createItemCostGetter(snapshot: CalculationSnapshot) {
    return function (item: string): number {
        const game_data = snapshot.effective_game_data;
        const scheme_data = snapshot.scheme_data;
        const item_data = snapshot.item_data;
        const stack_research_lab = snapshot.settings.stack_research_lab;

        let cost = 0.0;
        if (scheme_data.cost_weight["物品额外成本"][item]["启用"]) {
            cost = Number(cost) + (scheme_data.cost_weight["物品额外成本"][item]["额外成本"]
                ?? scheme_data.cost_weight["物品额外成本"][item]["成本"]);
            if (!scheme_data.cost_weight["物品额外成本"][item]["与其它成本累计"]) {
                return cost;
            }
        }
        const recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
        const equivalent_recipe = snapshot.getEquivalentRecipe(recipe_id, item);
        const building_info = game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_data.scheme_for_recipe[recipe_id]["建筑"]];
        const building_count_per_yield = 1 / get_equivalent_recipe_output_rate(equivalent_recipe, item) / building_info["倍率"];
        const layer_count = building_info["名称"].endsWith("研究站") ? stack_research_lab : 1;
        cost = Number(cost) + building_count_per_yield * scheme_data.cost_weight["占地"] * building_info["占地"] / layer_count;
        cost = Number(cost) + building_count_per_yield * scheme_data.cost_weight["电力"] * building_info["耗能"] * game_data.proliferator_effect[scheme_data.scheme_for_recipe[recipe_id]["增产点数"]]["耗电倍率"];
        cost = Number(cost) + building_count_per_yield * (0 * scheme_data.cost_weight["建筑成本"]["分拣器"] / layer_count + scheme_data.cost_weight["建筑成本"][building_info["名称"]]);
        return cost;
    };
}

function buildItemPrice(snapshot: CalculationSnapshot): ItemPrice {
    const item_graph = snapshot.item_graph;
    const item_list = snapshot.item_list;
    const key_item_set = new Set(snapshot.key_item_list);
    const multi_sources = snapshot.multi_sources;
    const mineralize_item_set = new Set(getMineralizedItemNames(snapshot.settings.mineralize_list));
    const item_price: ItemPrice = {};

    function count_total_material(dict: NumericMap, material: string, num: number): NumericMap {
        if (material in dict) {
            dict[material] = Number(dict[material]) + num;
        } else {
            dict[material] = num;
        }
        for (const sub_material in item_price[material]["原料"]) {
            if (sub_material in dict) {
                dict[sub_material] = Number(dict[sub_material]) + item_price[material]["原料"][sub_material] * num;
            } else {
                dict[sub_material] = item_price[material]["原料"][sub_material] * num;
            }
        }
        return dict;
    }

    snapshot.key_item_list.forEach((item) => {
        item_price[item] = {"原料": {}, "成本": 0, "累计成本": 0};
    });
    getMineralizedItemNames(snapshot.settings.mineralize_list).forEach((item) => {
        item_price[item] = {"原料": {}, "成本": 0, "累计成本": 0};
    });
    Object.keys(multi_sources).forEach((item) => {
        item_price[item] = {"原料": {}, "成本": 0, "累计成本": 0};
    });

    for (let i = 0; i < item_list.length; i++) {
        const item_name = item_list[i];
        if (key_item_set.has(item_name)) {
            continue;
        }
        if (mineralize_item_set.has(item_name)) {
            continue;
        }
        if (item_name in multi_sources) {
            continue;
        }

        item_price[item_name] = {"原料": {}, "成本": snapshot.getItemCost(item_name), "累计成本": 0};
        for (const material in item_graph[item_name]["原料"]) {
            item_price[item_name]["原料"] = count_total_material(item_price[item_name]["原料"], material, item_graph[item_name]["原料"][material]);
        }
        for (const side_products in item_graph[item_name]["副产物"]) {
            item_price[item_name]["原料"] = count_total_material(item_price[item_name]["原料"], side_products, -item_graph[item_name]["副产物"][side_products]);
        }
        item_price[item_name]["累计成本"] = item_price[item_name]["成本"];
        for (const item in item_price[item_name]["原料"]) {
            if (item_price[item_name]["原料"][item] > 0) {
                item_price[item_name]["累计成本"] = Number(item_price[item_name]["累计成本"]) + Number(item_price[item]["成本"]) * item_price[item_name]["原料"][item];
            }
        }
    }
    return item_price;
}

export function buildCalculationSnapshot({
    game_data,
    item_data,
    raw_scheme_data,
    settings,
    external_supply_proliferator_points: source_external_supply_proliferator_points,
}: {
    game_data: GameData;
    item_data: ItemDataIndex;
    raw_scheme_data: SchemeData;
    settings: Settings;
    external_supply_proliferator_points?: CalculationSnapshot['external_supply_proliferator_points'];
}): CalculationSnapshot {
    const effective_game_data = build_effective_game_data(game_data, settings);
    const scheme_data = buildNormalizedSchemeData(effective_game_data, raw_scheme_data);
    const external_supply_proliferator_points = buildExternalSupplyProliferatorPoints(
        settings,
        source_external_supply_proliferator_points
    );
    const proliferator_price = buildProliferatorPrice(
        effective_game_data,
        settings,
        external_supply_proliferator_points
    );

    const snapshot = {
        game_data,
        effective_game_data,
        item_data,
        raw_scheme_data,
        scheme_data,
        settings,
        external_supply_proliferator_points,
        proliferator_price,
    } as CalculationSnapshot;

    snapshot.getEquivalentRecipe = createEquivalentRecipeGetter(snapshot) as CalculationSnapshot['getEquivalentRecipe'];

    const {item_graph, multi_sources} = buildItemGraph({
        item_data,
        scheme_data,
        settings,
        getEquivalentRecipe: snapshot.getEquivalentRecipe,
    });
    const {item_list, key_item_list} = buildItemList(item_graph);

    snapshot.item_graph = item_graph;
    snapshot.multi_sources = multi_sources;
    snapshot.item_list = item_list;
    snapshot.key_item_list = key_item_list;
    snapshot.getItemCost = createItemCostGetter(snapshot);
    snapshot.item_price = buildItemPrice(snapshot);
    snapshot.getEquivalentRecipeForItem = (item: string) => {
        const recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
        return snapshot.getEquivalentRecipe(recipe_id, item);
    };
    snapshot.getEquivalentRecipeForRecipe = (item: string, recipe_id: number, scheme_override?: Partial<RecipeScheme>) => (
        snapshot.getEquivalentRecipe(recipe_id, item, scheme_override)
    );
    snapshot.getEquivalentRecipeForNaturalLine = (row) => {
        const recipe_id = item_data[row["目标物品"]][row["配方id"]];
        return snapshot.getEquivalentRecipe(recipe_id, row["目标物品"], {
            "建筑": row["建筑"],
            "增产点数": row["增产点数"],
            "增产模式": row["增产模式"]
        });
    };

    return snapshot;
}
