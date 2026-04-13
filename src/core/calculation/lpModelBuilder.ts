import type {CalculationSnapshot, NumericMap, SolverModel} from '../../types/domain';

export function buildLpInputs(
    snapshot: CalculationSnapshot,
    in_out_list: NumericMap,
    external_supply_item: NumericMap,
    result_dict: NumericMap
): {lp_item_dict: NumericMap; result_dict: NumericMap} {
    const multi_sources = snapshot.multi_sources;
    const key_item_list = snapshot.key_item_list;
    const item_price = snapshot.item_price;
    const surplus_list: NumericMap = {};
    const lp_item_dict: NumericMap = {};

    for (const item in multi_sources) {
        if (item in result_dict) {
            if (item in surplus_list) {
                lp_item_dict[item] = result_dict[item] - surplus_list[item];
            } else {
                lp_item_dict[item] = result_dict[item];
            }
        } else {
            if (item in surplus_list) {
                lp_item_dict[item] = -surplus_list[item];
            } else {
                lp_item_dict[item] = 0;
            }
        }
    }

    for (const item in external_supply_item) {
        if (!(item in multi_sources)) {
            if (item in result_dict) {
                if (result_dict[item] + in_out_list[item] > 0) {
                    for (const i in item_price[item]["原料"]) {
                        result_dict[i] = Number(result_dict[i]) + item_price[item]["原料"][i] * in_out_list[item];
                    }
                    result_dict[item] = Number(result_dict[item]) + in_out_list[item];
                } else {
                    for (const i in item_price[item]["原料"]) {
                        result_dict[i] = Number(result_dict[i]) - item_price[item]["原料"][i] * result_dict[item];
                    }
                    lp_item_dict[item] = result_dict[item] + in_out_list[item];
                    result_dict[item] = 0;
                }
            } else {
                lp_item_dict[item] = in_out_list[item];
            }
        } else {
            lp_item_dict[item] = Number(lp_item_dict[item]) + in_out_list[item];
        }
    }

    for (const item in key_item_list) {
        if (!(key_item_list[item] in multi_sources) && !(key_item_list[item] in external_supply_item)) {
            if (key_item_list[item] in result_dict) {
                lp_item_dict[key_item_list[item]] = result_dict[key_item_list[item]];
            } else {
                lp_item_dict[key_item_list[item]] = 0;
            }
        }
    }

    return {lp_item_dict, result_dict};
}

export function buildLinearProgrammingModel(snapshot: CalculationSnapshot, lp_item_dict: NumericMap): SolverModel {
    const item_graph = snapshot.item_graph;
    const scheme_data = snapshot.scheme_data;
    const item_price = snapshot.item_price;
    const model: SolverModel = {
        optimize: 'cost',
        opType: 'min',
        constraints: {},
        variables: {}
    };

    for (const item in lp_item_dict) {
        model.constraints["i" + item] = {min: lp_item_dict[item]};
        model.variables[item] = {cost: snapshot.getItemCost(item)};
        for (const other_item in lp_item_dict) {
            model.variables[item]["i" + other_item] = 0.0;
        }
        model.variables[item]["i" + item] = 1.0;
        model.variables[item].cost = Number(model.variables[item].cost) + scheme_data.cost_weight["物品额外成本"][item]["溢出时处理成本"];
        if ("副产物" in item_graph[item]) {
            for (const sub_product in item_graph[item]["副产物"]) {
                model.variables[item]["i" + sub_product] = Number(model.variables[item]["i" + sub_product]) + item_graph[item]["副产物"][sub_product];
                model.variables[item].cost = Number(model.variables[item].cost) + item_graph[item]["副产物"][sub_product] * scheme_data.cost_weight["物品额外成本"][sub_product]["溢出时处理成本"];
            }
        }
        for (const material in item_graph[item]["原料"]) {
            model.variables[item].cost = Number(model.variables[item].cost) + item_graph[item]["原料"][material] * item_price[material]["累计成本"];
            if (material in lp_item_dict) {
                model.variables[item]["i" + material] = Number(model.variables[item]["i" + material]) - item_graph[item]["原料"][material];
            }
            for (const sub_item in item_price[material]["原料"]) {
                if (sub_item in lp_item_dict) {
                    model.variables[item]["i" + sub_item] = Number(model.variables[item]["i" + sub_item]) - (item_price[material]["原料"][sub_item] ?? 0) * item_graph[item]["原料"][material];
                }
                if ("副产物" in item_graph[sub_item] && !(sub_item in lp_item_dict)) {
                    for (const sub_product in item_graph[sub_item]["副产物"]) {
                        model.variables[item]["i" + sub_product] = Number(model.variables[item]["i" + sub_product]) + item_graph[sub_item]["副产物"][sub_product] * item_graph[item]["原料"][material] * (item_price[material]["原料"][sub_item] ?? 0);
                    }
                }
            }
        }
    }

    return model;
}
