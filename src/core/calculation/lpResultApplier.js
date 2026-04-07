function normalizeSolverResults(results) {
    if ("result" in results) {
        delete results["result"];
    }
    if ("feasible" in results) {
        if (!results.feasible) {
            alert("线性规划无解,请检查来源配方设定是否可能满足需求");
        }
        delete results.feasible;
    }
    if ("bounded" in results) {
        if (!results.bounded) {
            alert("线性规划目标函数无界,请检查配方执行成本是否合理");
        }
        delete results.bounded;
    }
}

export function applyLinearProgrammingResults(snapshot, model, results, lp_item_dict, result_dict, lp_surplus_list) {
    let item_graph = snapshot.item_graph;
    let item_price = snapshot.item_price;

    normalizeSolverResults(results);

    const lp_products = {};
    for (let item in model.constraints) {
        lp_products[item] = (-1) * model.constraints[item]["min"];
    }
    for (let recipe in results) {
        for (let item in model.variables[recipe]) {
            if (item != "cost") {
                lp_products[item] += model.variables[recipe][item] * results[recipe];
            }
        }
    }
    for (let item in lp_products) {
        if (lp_products[item] > 1e-8) {
            lp_surplus_list[item.slice(1)] = lp_products[item];
        }
    }
    for (let item in lp_item_dict) {
        result_dict[item] = 0;
    }
    for (let item in results) {
        result_dict[item] = Number(result_dict[item]) + results[item];
        for (let material in item_graph[item]["原料"]) {
            if (!(material in lp_item_dict)) {
                if (material in result_dict) {
                    result_dict[material] = Number(result_dict[material]) + results[item] * item_graph[item]["原料"][material];
                } else {
                    result_dict[material] = results[item] * item_graph[item]["原料"][material];
                }
                for (let sub_material in item_price[material]["原料"]) {
                    if (!(sub_material in lp_item_dict)) {
                        if (sub_material in result_dict) {
                            result_dict[sub_material] = Number(result_dict[sub_material]) + results[item] * item_graph[item]["原料"][material] * item_price[material]["原料"][sub_material];
                        } else {
                            result_dict[sub_material] = results[item] * item_graph[item]["原料"][material] * item_price[material]["原料"][sub_material];
                        }
                    }
                }
            }
        }
    }
}
