import type {CalculationSnapshot, NumericMap} from '@engine/types/domain';

export function aggregateNetNeeds(snapshot: CalculationSnapshot, needs_list: NumericMap): {
    in_out_list: NumericMap;
    external_supply_item: NumericMap;
} {
    const settings = snapshot.settings;
    const time_tick = settings.is_time_unit_minute ? 60 : 1;
    const natural_production_line = settings.natural_production_line;
    const in_out_list: NumericMap = {};
    const external_supply_item: NumericMap = {};

    for (const item in needs_list) {
        in_out_list[item] = needs_list[item];
    }

    for (const id in natural_production_line) {
        const equivalent_recipe = snapshot.getEquivalentRecipeForNaturalLine(natural_production_line[id]);
        const execute_count = time_tick * natural_production_line[id]["建筑数量"] / equivalent_recipe["时间"];
        for (const item in equivalent_recipe["产物"]) {
            const remaining_need = Number(in_out_list[item] || 0);
            if (remaining_need <= 0) {
                continue;
            }
            in_out_list[item] = Math.max(0, remaining_need - equivalent_recipe["产物"][item] * execute_count);
        }
    }

    for (const item in in_out_list) {
        if (in_out_list[item] < 0) {
            external_supply_item[item] = in_out_list[item];
        }
    }

    return {in_out_list, external_supply_item};
}

export function buildInitialResultDict(item_price: CalculationSnapshot['item_price'], in_out_list: NumericMap): NumericMap {
    const result_dict: NumericMap = {};
    for (const item in in_out_list) {
        if (in_out_list[item] > 0) {
            if (item in result_dict) {
                result_dict[item] = Number(result_dict[item]) + in_out_list[item];
            } else {
                result_dict[item] = in_out_list[item];
            }
            for (const material in item_price[item]["原料"]) {
                if (material in result_dict) {
                    result_dict[material] = Number(result_dict[material]) + item_price[item]["原料"][material] * in_out_list[item];
                } else {
                    result_dict[material] = item_price[item]["原料"][material] * in_out_list[item];
                }
            }
        }
    }
    return result_dict;
}
