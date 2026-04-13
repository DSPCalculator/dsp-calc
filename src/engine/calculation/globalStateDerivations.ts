import {get_equivalent_recipe_output_rate, get_factory_speed_multiplier} from './equivalentRecipe';
import {hasMineralizedItem} from './mineralizeState';
import type {GameData, ItemDataIndex, ItemGraph, MultiSources, ProliferatorPrice, RecipeData, RecipeScheme, SchemeData, Settings} from '@engine/types/domain';

export function buildNormalizedSchemeData(game_data: GameData, scheme_data: SchemeData): SchemeData {
    const normalized_scheme_for_recipe = scheme_data.scheme_for_recipe.map((recipe_setting: RecipeScheme) => ({...recipe_setting}));
    // 选择增产策略但未选增产剂时，统一补成当前可用的最高等级增产剂。
    const maxProliferatorPoint = game_data.proliferator_data[game_data.proliferator_data.length - 1].增产点数;
    for (let i = 0; i < normalized_scheme_for_recipe.length; i++) {
        if (game_data.recipe_data[i].增产 == 8 && normalized_scheme_for_recipe[i].增产模式 == 0) {
            normalized_scheme_for_recipe[i].增产模式 = 4;
        }
        if (normalized_scheme_for_recipe[i].增产模式 > 0
            && normalized_scheme_for_recipe[i].增产点数 == 0) {
            normalized_scheme_for_recipe[i].增产点数 = maxProliferatorPoint;
        }
    }
    return {
        ...scheme_data,
        scheme_for_recipe: normalized_scheme_for_recipe,
    };
}

export function buildProliferatorPrice(game_data: GameData, proliferate_itself: boolean): ProliferatorPrice {
    const proliferator_price: ProliferatorPrice = [];
    proliferator_price.push({});
    for (let i = 1; i < game_data.proliferator_effect.length; i++) {
        proliferator_price.push(-1);
    }
    for (let i = 0; i < game_data.proliferator_data.length; i++) {
        const proliferator = game_data.proliferator_data[i];
        if (proliferator["增产点数"] != 0) {
            proliferator_price[proliferator["增产点数"]] = {};
            if (proliferate_itself) {
                const current_price = proliferator_price[proliferator["增产点数"]];
                if (current_price !== -1) {
                    current_price[proliferator["增产剂"].toString()]
                        = 1 / Math.floor(proliferator["喷涂次数"] *
                        game_data.proliferator_effect[proliferator["增产点数"]]["增产效果"] - 1 + 1e-6);
                }
            } else {
                const current_price = proliferator_price[proliferator["增产点数"]];
                if (current_price !== -1) {
                    current_price[proliferator["增产剂"].toString()] = 1 / proliferator["喷涂次数"];
                }
            }
        }
    }
    return proliferator_price;
}

export function buildItemGraph({
                                   item_data,
                                   scheme_data,
                                   settings,
                                   effective_game_data,
                                   getEquivalentRecipe,
                               }: {
    item_data: ItemDataIndex;
    scheme_data: SchemeData;
    settings: Settings;
    effective_game_data: GameData;
    getEquivalentRecipe: (recipe_id: number, item: string, scheme_override?: Partial<RecipeScheme>) => RecipeData;
}): {item_graph: ItemGraph; multi_sources: MultiSources} {
    const multi_sources: MultiSources = {};
    const item_graph: ItemGraph = {};

    for (const item in item_data) {
        item_graph[item] = {"原料": {}, "可生产": {}, "产出倍率": 0, "副产物": {}};
    }
    for (const item in item_data) {
        if (hasMineralizedItem(settings.mineralize_list, item)) {
            item_graph[item]["产出倍率"] = 100000000 ** (settings.fixed_num + 1);
            continue;
        }
        const recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
        const equivalent_recipe = getEquivalentRecipe(recipe_id, item);
        item_graph[item]["产出倍率"] = get_equivalent_recipe_output_rate(equivalent_recipe, item);
        for (const material in equivalent_recipe["原料"]) {
            item_graph[item]["原料"][material] = equivalent_recipe["原料"][material] / equivalent_recipe["产物"][item];
        }
        if (item in item_graph[item]["原料"]) {
            const self_used = 1 / (1 - item_graph[item]["原料"][item]);
            item_graph[item]["产出倍率"] /= self_used;
            item_graph[item]["自消耗"] = self_used - 1;
            delete item_graph[item]["原料"][item];
            for (const material in item_graph[item]["原料"]) {
                item_graph[item]["原料"][material] *= self_used;
            }
        }
        for (const material in item_graph[item]["原料"]) {
            item_graph[material]["可生产"][item] = 1 / item_graph[item]["原料"][material];
        }

        if (Object.keys(equivalent_recipe["产物"]).length > 1) {
            const self_cost = item_graph[item]["自消耗"] ?? 0;
            for (const product in equivalent_recipe["产物"]) {
                if (product != item) {
                    if (product in item_graph[item]["原料"]) {
                        if (Math.min(equivalent_recipe["产物"][product] / (equivalent_recipe["产物"][item] - self_cost), item_graph[item]["原料"][product]) == item_graph[item]["原料"][product]) {
                            item_graph[item]["副产物"][product] = equivalent_recipe["产物"][product] / (equivalent_recipe["产物"][item] - self_cost) - item_graph[item]["原料"][product];
                            item_graph[item]["原料"][product] = 0;
                            if (product in multi_sources) {
                                multi_sources[product].push(item);
                            } else {
                                multi_sources[product] = [item];
                            }
                        } else {
                            item_graph[item]["原料"][product] -= equivalent_recipe["产物"][product] / (equivalent_recipe["产物"][item] - self_cost);
                        }
                    } else {
                        item_graph[item]["副产物"][product] = equivalent_recipe["产物"][product] / (equivalent_recipe["产物"][item] - self_cost);
                        if (product in multi_sources) {
                            multi_sources[product].push(item);
                        } else {
                            multi_sources[product] = [item];
                        }
                    }
                }
            }
        }
        const factory_info = effective_game_data.factory_data[effective_game_data.recipe_data[recipe_id]["设施"]][scheme_data.scheme_for_recipe[recipe_id]["建筑"]];
        item_graph[item]["产出倍率"] *= get_factory_speed_multiplier(factory_info["名称"], item, settings);
    }

    return {item_graph, multi_sources};
}

export function buildItemList(item_graph: ItemGraph): {item_list: string[]; key_item_list: string[]} {
    const product_graph: ItemGraph = JSON.parse(JSON.stringify(item_graph));
    const item_list: string[] = [];
    const key_item_list: string[] = [];
    const P_item_list: [number, number] = [0, Object.keys(product_graph).length - 1];

    function delete_item_from_product_graph(name: string): void {
        for (const item in product_graph[name]["原料"]) {
            delete product_graph[item]["可生产"][name];
        }
        for (const item in product_graph[name]["可生产"]) {
            delete product_graph[item]["原料"][name];
        }
        delete product_graph[name];
    }

    function find_item(name: string, isProduction: number): void {
        if (!isProduction) {
            if (product_graph[name] && Object.keys(product_graph[name]["原料"]).length == 0) {
                const production = product_graph[name]["可生产"];
                delete_item_from_product_graph(name);
                item_list[P_item_list[0]] = name;
                P_item_list[0] += 1;
                for (const item in production) {
                    find_item(item, 0);
                }
            }
        } else {
            if (product_graph[name] && Object.keys(product_graph[name]["可生产"]).length == 0) {
                const material = product_graph[name]["原料"];
                delete_item_from_product_graph(name);
                item_list[P_item_list[1]] = name;
                P_item_list[1] -= 1;
                for (const item in material) {
                    find_item(item, 1);
                }
            }
        }
    }

    for (; ;) {
        for (const this_item in product_graph) {
            if (this_item in product_graph) {
                if (Object.keys(product_graph[this_item]["原料"]).length == 0) {
                    find_item(this_item, 0);
                } else if (Object.keys(product_graph[this_item]["可生产"]).length == 0) {
                    find_item(this_item, 1);
                }
            }
        }
        if (Object.keys(product_graph).length <= 0) {
            break;
        }
        const key_item: {name: string; count: number} = {name: '', count: 1};
        let count = 0;
        for (const this_item in product_graph) {
            count = Object.keys(product_graph[this_item]["原料"]).length + Object.keys(product_graph[this_item]["可生产"]).length;
            if (count > key_item["count"]) {
                key_item["name"] = this_item;
                key_item["count"] = count;
            }
        }
        key_item_list.push(key_item["name"]);
        item_list[P_item_list[0]] = key_item["name"];
        P_item_list[0] += 1;
        delete_item_from_product_graph(key_item["name"]);
    }

    return {item_list, key_item_list};
}
