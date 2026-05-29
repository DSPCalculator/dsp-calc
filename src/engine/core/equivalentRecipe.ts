export type CoreItemId = string;
export type CoreNumericMap = Record<CoreItemId, number>;

export interface EquivalentRecipeSourceRef {
    gameId: string;
    rawRecipeId: string | number;
    selectionId?: string;
    [key: string]: unknown;
}

export interface EquivalentRecipeCostBreakdown {
    label: string;
    value: number;
}

export interface EquivalentRecipeDisplay {
    name: string;
    buildingName?: string;
}

export interface EquivalentRecipe {
    id: string;
    inputs: CoreNumericMap;
    outputs: CoreNumericMap;
    duration: number;
    cost: number;
    sourceRef?: EquivalentRecipeSourceRef;
    costBreakdown?: EquivalentRecipeCostBreakdown[];
    display?: EquivalentRecipeDisplay;
}

export function getEquivalentRecipeOutputRate(recipe: Pick<EquivalentRecipe, 'outputs' | 'duration'>, targetItem: CoreItemId): number {
    return recipe.outputs[targetItem] / recipe.duration;
}
