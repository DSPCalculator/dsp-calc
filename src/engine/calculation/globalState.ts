import {buildCalculationSnapshot} from './calculationSnapshot';
import {
    buildAverageExternalSupplyProliferatorPoints,
    buildExternalSupplyPointSources
} from './globalStateDerivations';
import {solveNeeds} from './needsSolver';
import {LinearProgrammingError} from './lpResultApplier';
import type {
    CalculationSnapshot,
    GameInfoState,
    LinearProgrammingIssue,
    NumericMap,
    ProliferatorSupplyPoints,
    RecipeData,
    RecipeScheme,
    SchemeData,
    Settings
} from '@engine/types/domain';

const EXTERNAL_SUPPLY_POINT_ITERATIONS = 3;
const EXTERNAL_SUPPLY_POINT_EPSILON = 1e-6;

export class GlobalState {
    game_data: GameInfoState['game_data'];
    effective_game_data!: GameInfoState['game_data'];
    item_data: GameInfoState['item_data'];
    raw_scheme_data: SchemeData;
    scheme_data!: SchemeData;
    settings: Settings;
    snapshot!: CalculationSnapshot;
    proliferator_price!: CalculationSnapshot['proliferator_price'];
    item_graph!: CalculationSnapshot['item_graph'];
    multi_sources!: CalculationSnapshot['multi_sources'];
    item_list!: CalculationSnapshot['item_list'];
    key_item_list!: CalculationSnapshot['key_item_list'];

    constructor(game_info: GameInfoState, scheme_data: SchemeData, settings: Settings) {
        this.game_data = game_info.game_data;
        this.item_data = game_info.item_data;
        this.raw_scheme_data = scheme_data;
        this.settings = settings;

        this.#reinit();
    }

    #reinit(external_supply_proliferator_points?: ProliferatorSupplyPoints) {
        this.snapshot = buildCalculationSnapshot({
            game_data: this.game_data,
            item_data: this.item_data,
            raw_scheme_data: this.raw_scheme_data,
            settings: this.settings,
            external_supply_proliferator_points,
        });
        this.effective_game_data = this.snapshot.effective_game_data;
        this.scheme_data = this.snapshot.scheme_data;
        this.proliferator_price = this.snapshot.proliferator_price;
        this.item_graph = this.snapshot.item_graph;
        this.multi_sources = this.snapshot.multi_sources;
        this.item_list = this.snapshot.item_list;
        this.key_item_list = this.snapshot.key_item_list;
    }

    #areExternalSupplyPointsEqual(left: ProliferatorSupplyPoints, right: ProliferatorSupplyPoints): boolean {
        const items = new Set([...Object.keys(left), ...Object.keys(right)]);
        for (const item of items) {
            if (Math.abs(Number(left[item] || 0) - Number(right[item] || 0)) > EXTERNAL_SUPPLY_POINT_EPSILON) {
                return false;
            }
        }
        return true;
    }

    get_equivalent_recipe_for_item(item: string): RecipeData {
        return this.snapshot.getEquivalentRecipeForItem(item);
    }

    get_equivalent_recipe_for_recipe(item: string, recipe_id: number, scheme_override?: Partial<RecipeScheme>): RecipeData {
        return this.snapshot.getEquivalentRecipeForRecipe(item, recipe_id, scheme_override);
    }

    get_equivalent_recipe_for_natural_line(row: Settings['natural_production_line'][number]): RecipeData {
        return this.snapshot.getEquivalentRecipeForNaturalLine(row);
    }

    calculate(needs_list: NumericMap): [NumericMap, NumericMap, LinearProgrammingIssue?] {
        this.#reinit();
        let result: [NumericMap, NumericMap, LinearProgrammingIssue?];
        try {
            result = solveNeeds(this.snapshot, needs_list);
        } catch (error) {
            if (error instanceof LinearProgrammingError) {
                return [{}, {}, error.issue];
            }
            throw error;
        }
        let previous_external_points = this.snapshot.external_supply_proliferator_points;

        for (let i = 0; i < EXTERNAL_SUPPLY_POINT_ITERATIONS; i++) {
            const next_external_points = buildAverageExternalSupplyProliferatorPoints(
                buildExternalSupplyPointSources(this.snapshot, result[0])
            );
            if (this.#areExternalSupplyPointsEqual(previous_external_points, next_external_points)) {
                return result;
            }
            this.#reinit(next_external_points);
            try {
                result = solveNeeds(this.snapshot, needs_list);
            } catch (error) {
                if (error instanceof LinearProgrammingError) {
                    return [{}, {}, error.issue];
                }
                throw error;
            }
            previous_external_points = next_external_points;
        }

        return result;
    }
}
