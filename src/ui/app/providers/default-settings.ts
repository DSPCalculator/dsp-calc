import type {Settings} from '@engine/types/domain';
import type {GameData} from '@engine/types/domain';

export const DEFAULT_SETTINGS: Settings = {
    mining_speed_oil: 3.0,
    mining_speed_water: 3.0,
    mining_speed_deep_seated_lava: 3.0,
    mining_speed_hydrogen: 1.0,
    mining_speed_deuterium: 0.05,
    mining_speed_gas_hydrate: 0.8,
    mining_speed_helium: 0.02,
    mining_speed_ammonia: 0.3,
    mining_speed_nitrogen: 1.2,
    mining_speed_oxygen: 0.6,
    mining_speed_carbon_dioxide: 0.4,
    mining_speed_sulfur_dioxide: 0.6,
    mining_speed_methane: 0.6,

    hide_mines: false,
    covered_veins_small: 8,
    covered_veins_large: 16,
    mining_efficiency_large: 3.0,
    mining_speed_multiple: 1.0,
    enemy_drop_multiple: 1.0,
    dark_fog_base_level: 30,
    icarus_manufacturing_speed: 1.0,
    fractionating_speed: 30,

    is_time_unit_minute: true,
    fixed_num: 2,
    show_effective_recipe: true,
    show_sidebar_item_names: true,
    stack_research_lab: 15,
    proliferate_itself: true,
    acc_rate: 0.0,
    inc_rate: 0.0,
    blue_buff: false,

    mineralize_list: {},
    external_supply_proliferator_points: {},
    external_input_proliferator_points: 0,
    external_output_proliferator_points: 0,
    natural_production_line: [],
};

export function get_default_settings_for_game_data(game_data: GameData): Settings {
    const base_settings: Settings = {
        ...DEFAULT_SETTINGS,
        mineralize_list: {},
        natural_production_line: [],
    };
    if (game_data.GenesisBookEnable) {
        return {
            ...base_settings,
            mining_speed_hydrogen: 1.0,
            mining_speed_deuterium: 0.05,
            mining_speed_gas_hydrate: 0.8,
            mining_speed_helium: 0.02,
            mining_speed_ammonia: 0.3,
            mining_speed_nitrogen: 1.2,
            mining_speed_oxygen: 0.6,
            mining_speed_carbon_dioxide: 0.4,
            mining_speed_sulfur_dioxide: 0.6,
        };
    }
    if (game_data.OrbitalRingEnable) {
        return {
            ...base_settings,
            mining_speed_hydrogen: 1.2,
            mining_speed_deuterium: 0.6,
            mining_speed_methane: 0.6,
        };
    }
    return {
        ...base_settings,
        mining_speed_hydrogen: 1.0,
        mining_speed_deuterium: 0.2,
        mining_speed_gas_hydrate: 0.5,
    };
}
