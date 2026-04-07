import {buildCalculationSnapshot} from './calculationSnapshot.js';
import {solveNeeds} from './needsSolver.js';

export class GlobalState {
    game_data;
    effective_game_data;
    item_data;
    raw_scheme_data;
    scheme_data;
    settings;
    snapshot;

    constructor(game_info, scheme_data, settings) {
        this.game_data = game_info.game_data;
        this.item_data = game_info.item_data;
        this.raw_scheme_data = scheme_data;
        this.settings = settings;

        this.#reinit();
    }

    #reinit() {
        this.snapshot = buildCalculationSnapshot({
            game_data: this.game_data,
            item_data: this.item_data,
            raw_scheme_data: this.raw_scheme_data,
            settings: this.settings,
        });
        this.effective_game_data = this.snapshot.effective_game_data;
        this.scheme_data = this.snapshot.scheme_data;
        this.proliferator_price = this.snapshot.proliferator_price;
        this.item_graph = this.snapshot.item_graph;
        this.multi_sources = this.snapshot.multi_sources;
        this.item_list = this.snapshot.item_list;
        this.key_item_list = this.snapshot.key_item_list;
    }

    get_equivalent_recipe_for_item(item) {
        return this.snapshot.getEquivalentRecipeForItem(item);
    }

    get_equivalent_recipe_for_recipe(item, recipe_id, scheme_override) {
        return this.snapshot.getEquivalentRecipeForRecipe(item, recipe_id, scheme_override);
    }

    get_equivalent_recipe_for_natural_line(row) {
        return this.snapshot.getEquivalentRecipeForNaturalLine(row);
    }

    calculate(needs_list) {
        this.#reinit();
        return solveNeeds(this.snapshot, needs_list);
    }
}
