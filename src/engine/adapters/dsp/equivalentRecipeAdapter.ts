import {
    build_effective_game_data,
    get_dark_fog_base_level_multiplier,
    get_equivalent_recipe,
} from '@engine/calculation/equivalentRecipe';
import {getEquivalentRecipeOutputRate} from '@engine/core/equivalentRecipe';
import type {
    EquivalentRecipe,
    EquivalentRecipeSourceRef
} from '@engine/core/equivalentRecipe';
import type {
    GameData,
    ProliferatorPrice,
    ProliferatorSupplyPoints,
    RecipeData,
    RecipeScheme,
    Settings
} from '@engine/types/domain';

export {build_effective_game_data, get_dark_fog_base_level_multiplier};

export interface DspEquivalentRecipeInput {
    game_data: GameData;
    scheme_data: {scheme_for_recipe: RecipeScheme[]};
    settings: Settings;
    proliferator_price: ProliferatorPrice;
    external_supply_proliferator_points: ProliferatorSupplyPoints;
    recipe_id: number;
    target_item: string;
    scheme_override?: Partial<RecipeScheme>;
}

export function buildDspEquivalentRecipe(input: DspEquivalentRecipeInput): RecipeData {
    return get_equivalent_recipe(input);
}

export function getDspEquivalentRecipeOutputRate(recipe: RecipeData, targetItem: string): number {
    return getEquivalentRecipeOutputRate(
        {
            outputs: recipe["产物"],
            duration: recipe["时间"],
        },
        targetItem
    );
}

export function toCoreEquivalentRecipe(recipe: RecipeData, sourceRef: EquivalentRecipeSourceRef, cost = 0): EquivalentRecipe {
    return {
        id: `${sourceRef.gameId}:${String(sourceRef.rawRecipeId)}:${String(sourceRef.selectionId ?? '')}`,
        inputs: recipe["原料"],
        outputs: recipe["产物"],
        duration: recipe["时间"],
        cost,
        sourceRef,
        display: {
            name: recipe["名称"],
            buildingName: recipe["建筑名称"],
        },
    };
}
