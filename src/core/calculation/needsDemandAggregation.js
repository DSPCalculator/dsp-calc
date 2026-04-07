export function aggregateNetNeeds(snapshot, needs_list) {
    let settings = snapshot.settings;
    const time_tick = settings.is_time_unit_minute ? 60 : 1;
    let natural_production_line = settings.natural_production_line;
    let in_out_list = {};
    let external_supply_item = {};

    for (let item in needs_list) {
        in_out_list[item] = needs_list[item];
    }

    for (let id in natural_production_line) {
        const equivalent_recipe = snapshot.getEquivalentRecipeForNaturalLine(natural_production_line[id]);
        const execute_count = time_tick * natural_production_line[id]["建筑数量"] / equivalent_recipe["时间"];
        for (let item in equivalent_recipe["原料"]) {
            if (item in in_out_list) {
                in_out_list[item] = Number(in_out_list[item]) + equivalent_recipe["原料"][item] * execute_count;
            } else {
                in_out_list[item] = equivalent_recipe["原料"][item] * execute_count;
            }
        }
        for (let item in equivalent_recipe["产物"]) {
            if (item in in_out_list) {
                in_out_list[item] = Number(in_out_list[item]) - equivalent_recipe["产物"][item] * execute_count;
            } else {
                in_out_list[item] = -1 * equivalent_recipe["产物"][item] * execute_count;
            }
        }
    }

    for (let item in in_out_list) {
        if (in_out_list[item] < 0) {
            external_supply_item[item] = in_out_list[item];
        }
    }

    return {in_out_list, external_supply_item};
}

export function buildInitialResultDict(item_price, in_out_list) {
    let result_dict = {};
    for (let item in in_out_list) {
        if (in_out_list[item] > 0) {
            if (item in result_dict) {
                result_dict[item] = Number(result_dict[item]) + in_out_list[item];
            } else {
                result_dict[item] = in_out_list[item];
            }
            for (let material in item_price[item]["原料"]) {
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
