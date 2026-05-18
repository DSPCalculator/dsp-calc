import {get_equivalent_recipe_output_rate} from '@engine/calculation/equivalentRecipe';
import type {GameData, ItemPrice, RecipeData, RecipeScheme, SchemeData, Settings} from '@engine/types/domain';

export type BatchProMode = 0 | 1 | 2 | 3 | 4;

type EquivalentRecipeGetter = (
    recipe_id: number,
    target_item: string,
    scheme_override?: Partial<RecipeScheme>
) => RecipeData;

const COST_EPSILON = 1e-9;

export function getPreferredProliferatorModeForRecipe(recipe_proliferator: number, batch_mode: BatchProMode): number {
    if (batch_mode === 0) {
        return 0;
    }
    if (batch_mode === 1) {
        return recipe_proliferator & 1 ? 1 : 0;
    }
    if (batch_mode === 2) {
        return recipe_proliferator & 2 ? 2 : 0;
    }
    if (recipe_proliferator & 2) {
        return 2;
    }
    if (recipe_proliferator & 1) {
        return 1;
    }
    return 0;
}

function getRecipeTargetItem(recipe: RecipeData): string | undefined {
    if (recipe["名称"] in recipe["产物"]) {
        return recipe["名称"];
    }
    return Object.keys(recipe["产物"])[0];
}

function getModeCost({
                         game_data,
                         getEquivalentRecipe,
                         item_price,
                         recipe_id,
                         scheme_data,
                         settings,
                         target_item,
                         proliferator_mode,
                     }: {
    game_data: GameData;
    getEquivalentRecipe: EquivalentRecipeGetter;
    item_price: ItemPrice;
    recipe_id: number;
    scheme_data: SchemeData;
    settings: Settings;
    target_item: string;
    proliferator_mode: number;
}): number {
    const recipe = game_data.recipe_data[recipe_id];
    const scheme_recipe = scheme_data.scheme_for_recipe[recipe_id];
    const building_info = game_data.factory_data[recipe["设施"]]?.[scheme_recipe["建筑"]];
    if (!building_info) {
        return Number.POSITIVE_INFINITY;
    }

    const equivalent_recipe = getEquivalentRecipe(recipe_id, target_item, {"增产模式": proliferator_mode});
    const target_output = equivalent_recipe["产物"][target_item];
    const output_rate = get_equivalent_recipe_output_rate(equivalent_recipe, target_item);
    if (!target_output || !output_rate || output_rate <= 0) {
        return Number.POSITIVE_INFINITY;
    }

    // 用当前成本图近似上游连锁影响：加速降低本配方占地，增产降低单位原料需求。
    const building_count_per_yield = 1 / output_rate / building_info["倍率"];
    const layer_count = building_info["名称"].endsWith("研究站") ? settings.stack_research_lab : 1;
    let cost = building_count_per_yield * building_info["占地"] / layer_count;

    Object.entries(equivalent_recipe["原料"]).forEach(([item, count]) => {
        const material_price = item_price[item]?.["累计成本"] ?? item_price[item]?.["成本"] ?? 0;
        cost += count / target_output * material_price;
    });

    return cost;
}

export function getLowFootprintProliferatorModeForRecipe({
                                                             game_data,
                                                             getEquivalentRecipe,
                                                             item_price,
                                                             recipe_id,
                                                             scheme_data,
                                                             settings,
                                                         }: {
    game_data: GameData;
    getEquivalentRecipe: EquivalentRecipeGetter;
    item_price: ItemPrice;
    recipe_id: number;
    scheme_data: SchemeData;
    settings: Settings;
}): number {
    const recipe = game_data.recipe_data[recipe_id];
    const preferred_mode = getPreferredProliferatorModeForRecipe(recipe["增产"], 3);
    const scheme_recipe = scheme_data.scheme_for_recipe[recipe_id];
    if ((recipe["增产"] & 3) !== 3 || !scheme_recipe?.["增产点数"]) {
        return preferred_mode;
    }

    const target_item = getRecipeTargetItem(recipe);
    if (!target_item) {
        return preferred_mode;
    }

    const speed_cost = getModeCost({
        game_data,
        getEquivalentRecipe,
        item_price,
        recipe_id,
        scheme_data,
        settings,
        target_item,
        proliferator_mode: 1,
    });
    const extra_products_cost = getModeCost({
        game_data,
        getEquivalentRecipe,
        item_price,
        recipe_id,
        scheme_data,
        settings,
        target_item,
        proliferator_mode: 2,
    });

    return speed_cost + COST_EPSILON < extra_products_cost ? 1 : 2;
}
