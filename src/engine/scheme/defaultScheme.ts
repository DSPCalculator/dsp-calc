import {GlobalState} from '@engine/calculation/globalState';
import {GameInfo} from '@engine/data/gameInfo';
import type {GameData, SchemeData, Settings} from '@engine/types/domain';
import {init_scheme_data} from './schemeData';
import {getLowFootprintProliferatorModeForRecipe} from './proliferatorMode';

export function init_low_footprint_scheme_data(game_data: GameData, settings: Settings): SchemeData {
    const scheme_data = init_scheme_data(game_data);
    const game_info = new GameInfo(game_data);
    const low_footprint_state = new GlobalState(game_info, scheme_data, settings);
    return {
        ...scheme_data,
        scheme_for_recipe: scheme_data.scheme_for_recipe.map((recipe_setting, recipe_id) => ({
            ...recipe_setting,
            "增产模式": getLowFootprintProliferatorModeForRecipe({
                game_data,
                getEquivalentRecipe: (target_recipe_id, target_item, scheme_override) => (
                    low_footprint_state.get_equivalent_recipe_for_recipe(target_item, target_recipe_id, scheme_override)
                ),
                item_price: low_footprint_state.snapshot.item_price,
                recipe_id,
                scheme_data: low_footprint_state.scheme_data,
                settings,
            }),
        })),
    };
}
