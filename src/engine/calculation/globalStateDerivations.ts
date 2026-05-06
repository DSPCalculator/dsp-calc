import {get_equivalent_recipe_output_rate} from './equivalentRecipe';
import {getMineralizedItemNames, hasMineralizedItem} from './mineralizeState';
import type {
    CalculationSnapshot,
    GameData,
    ItemDataIndex,
    ItemGraph,
    MultiSources,
    NumericMap,
    ProliferatorPrice,
    ProliferatorSupplyPoints,
    RecipeData,
    RecipeScheme,
    SchemeData,
    Settings
} from '@engine/types/domain';

const EXTERNAL_SUPPLY_EPSILON = 1e-6;

function normalizeItemRecipeChoices(item_data: ItemDataIndex, scheme_data: SchemeData): NumericMap {
    const normalized_item_recipe_choices = {...scheme_data.item_recipe_choices};
    for (const item in item_data) {
        const recipe_choice = normalized_item_recipe_choices[item];
        if (item_data[item][recipe_choice] !== undefined) {
            continue;
        }
        if (item_data[item].length > 1) {
            normalized_item_recipe_choices[item] = 1;
        }
    }
    return normalized_item_recipe_choices;
}

export function buildNormalizedSchemeData(game_data: GameData, item_data: ItemDataIndex, scheme_data: SchemeData): SchemeData {
    const normalized_scheme_for_recipe = scheme_data.scheme_for_recipe.map((recipe_setting: RecipeScheme) => ({...recipe_setting}));
    for (let i = normalized_scheme_for_recipe.length; i < game_data.recipe_data.length; i++) {
        normalized_scheme_for_recipe.push({"建筑": 0, "增产点数": 0, "增产模式": 0});
    }
    // 选择增产策略但未选增产剂时，统一补成当前可用的最高等级增产剂。
    const maxProliferatorPoint = game_data.proliferator_data[game_data.proliferator_data.length - 1].增产点数;
    for (let i = 0; i < game_data.recipe_data.length; i++) {
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
        item_recipe_choices: normalizeItemRecipeChoices(item_data, scheme_data),
        scheme_for_recipe: normalized_scheme_for_recipe,
    };
}

export function getExternalSupplyItemNames(settings: Settings): string[] {
    const items = new Set<string>(getMineralizedItemNames(settings.mineralize_list));
    return Array.from(items);
}

function getUnsprayedProliferatorUnitCost(spray_count: number): number {
    return 1 / spray_count;
}

function getSelfSprayedProliferatorUnitCost(
    game_data: GameData,
    spray_count: number,
    proliferator_points: number
): number {
    const effect = game_data.proliferator_effect[proliferator_points];
    if (!effect) {
        return getUnsprayedProliferatorUnitCost(spray_count);
    }
    return 1 / Math.floor(spray_count * effect["增产效果"] - 1 + 1e-6);
}

function getExternalSprayedProliferatorUnitCost(
    game_data: GameData,
    spray_count: number,
    proliferator_points: number
): number {
    const effect = game_data.proliferator_effect[proliferator_points];
    if (!effect) {
        return getUnsprayedProliferatorUnitCost(spray_count);
    }
    return 1 / Math.floor(spray_count * effect["增产效果"] + 1e-6);
}

export function getNaturalLineProliferatorPoints(row: Settings['natural_production_line'][number]): number {
    return row["增产模式"] === 0 ? 0 : row["增产点数"];
}

export function getExternalInputProliferatorPoints(settings: Settings): number {
    return Number(settings.external_input_proliferator_points || 0);
}

export function buildExternalSupplyProliferatorPoints(
    settings: Settings,
    source_points?: ProliferatorSupplyPoints
): ProliferatorSupplyPoints {
    if (source_points) {
        return {...source_points};
    }
    return Object.fromEntries(
        getExternalSupplyItemNames(settings).map(item => [
            item,
            getExternalInputProliferatorPoints(settings),
        ])
    );
}

export function buildExternalSupplyPointSources(
    snapshot: CalculationSnapshot,
    result_dict: NumericMap
): Array<{item: string; amount: number; proliferatorPoints: number}> {
    const settings = snapshot.settings;
    const time_tick = settings.is_time_unit_minute ? 60 : 1;
    const sources: Array<{item: string; amount: number; proliferatorPoints: number}> = [];

    Object.entries(result_dict).forEach(([item, amount]) => {
        if (Math.abs(amount) < EXTERNAL_SUPPLY_EPSILON) {
            return;
        }
        if (hasMineralizedItem(settings.mineralize_list, item)) {
            sources.push({
                item,
                amount,
                proliferatorPoints: getExternalInputProliferatorPoints(settings),
            });
            return;
        }

    });

    settings.natural_production_line.forEach(row => {
        const equivalent_recipe = snapshot.getEquivalentRecipeForNaturalLine(row);
        const output_amount = (equivalent_recipe["产物"][row["目标物品"]] || 0)
            * row["建筑数量"] * time_tick / equivalent_recipe["时间"];
        if (Math.abs(output_amount) < EXTERNAL_SUPPLY_EPSILON) {
            return;
        }
        sources.push({
            item: row["目标物品"],
            amount: output_amount,
            proliferatorPoints: getNaturalLineProliferatorPoints(row),
        });
    });

    return sources;
}

export function buildAverageExternalSupplyProliferatorPoints(
    sources: Array<{item: string; amount: number; proliferatorPoints: number}>
): ProliferatorSupplyPoints {
    const totals: Record<string, {amount: number; pointAmount: number}> = {};
    sources.forEach(({item, amount, proliferatorPoints}) => {
        const source_amount = Math.abs(amount);
        if (source_amount < EXTERNAL_SUPPLY_EPSILON) {
            return;
        }
        const total = totals[item] || {amount: 0, pointAmount: 0};
        total.amount += source_amount;
        total.pointAmount += source_amount * proliferatorPoints;
        totals[item] = total;
    });

    return Object.fromEntries(
        Object.entries(totals).map(([item, total]) => [
            item,
            total.amount > 0 ? total.pointAmount / total.amount : 0,
        ])
    );
}

export function buildProliferatorPrice(
    game_data: GameData,
    settings: Settings,
    external_supply_proliferator_points: ProliferatorSupplyPoints
): ProliferatorPrice {
    const proliferator_price: ProliferatorPrice = [];
    proliferator_price.push({});
    for (let i = 1; i < game_data.proliferator_effect.length; i++) {
        proliferator_price.push(-1);
    }
    for (let i = 0; i < game_data.proliferator_data.length; i++) {
        const proliferator = game_data.proliferator_data[i];
        if (proliferator["增产点数"] != 0) {
            proliferator_price[proliferator["增产点数"]] = {};
            const current_price = proliferator_price[proliferator["增产点数"]];
            if (current_price !== -1) {
                const proliferator_item = proliferator["增产剂"].toString();
                const external_points = external_supply_proliferator_points[proliferator_item];
                if (external_points !== undefined) {
                    const target_points = proliferator["增产点数"];
                    const external_ready_ratio = target_points > 0
                        ? Math.max(0, Math.min(1, external_points / target_points))
                        : 0;
                    current_price[proliferator_item]
                        = external_ready_ratio * getExternalSprayedProliferatorUnitCost(
                            game_data,
                            proliferator["喷涂次数"],
                            target_points
                        )
                        + (1 - external_ready_ratio) * getUnsprayedProliferatorUnitCost(proliferator["喷涂次数"]);
                } else if (settings.proliferate_itself) {
                    current_price[proliferator_item] = getSelfSprayedProliferatorUnitCost(
                        game_data,
                        proliferator["喷涂次数"],
                        proliferator["增产点数"]
                    );
                } else {
                    current_price[proliferator_item] = getUnsprayedProliferatorUnitCost(proliferator["喷涂次数"]);
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
                                   getEquivalentRecipe,
                               }: {
    item_data: ItemDataIndex;
    scheme_data: SchemeData;
    settings: Settings;
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
        if (recipe_id === undefined) {
            continue;
        }
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
