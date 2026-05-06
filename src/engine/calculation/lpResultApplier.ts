import type {CalculationSnapshot, LinearProgrammingIssue, NumericMap, SolverModel, SolverResults} from '@engine/types/domain';

export class LinearProgrammingError extends Error {
    issue: LinearProgrammingIssue;

    constructor(issue: LinearProgrammingIssue) {
        super(issue.message);
        this.name = 'LinearProgrammingError';
        this.issue = issue;
    }
}

function normalizeSolverResults(results: SolverResults, items: string[]): void {
    if ("result" in results) {
        delete results["result"];
    }
    if ("feasible" in results) {
        if (!results.feasible) {
            throw new LinearProgrammingError({
                kind: 'infeasible',
                message: "线性规划无解，请检查红色物品的来源配方设置。",
                items,
            });
        }
        delete results.feasible;
    }
    if ("bounded" in results) {
        if (!results.bounded) {
            throw new LinearProgrammingError({
                kind: 'unbounded',
                message: "线性规划目标函数无界，请检查红色物品的配方执行成本。",
                items,
            });
        }
        delete results.bounded;
    }
}

export function applyLinearProgrammingResults(
    snapshot: CalculationSnapshot,
    model: SolverModel,
    results: SolverResults,
    lp_item_dict: NumericMap,
    result_dict: NumericMap,
    lp_surplus_list: NumericMap
): void {
    const item_graph = snapshot.item_graph;
    const item_price = snapshot.item_price;

    normalizeSolverResults(results, Object.keys(lp_item_dict));

    const lp_products: NumericMap = {};
    for (const item in model.constraints) {
        lp_products[item] = (-1) * model.constraints[item]["min"];
    }
    for (const recipe in results) {
        if (typeof results[recipe] !== 'number') {
            continue;
        }
        for (const item in model.variables[recipe]) {
            if (item != "cost") {
                lp_products[item] += model.variables[recipe][item] * results[recipe];
            }
        }
    }
    for (const item in lp_products) {
        if (lp_products[item] > 1e-8) {
            lp_surplus_list[item.slice(1)] = lp_products[item];
        }
    }
    for (const item in lp_item_dict) {
        result_dict[item] = 0;
    }
    for (const item in results) {
        if (typeof results[item] !== 'number') {
            continue;
        }
        result_dict[item] = Number(result_dict[item]) + results[item];
        for (const material in item_graph[item]["原料"]) {
            if (!(material in lp_item_dict)) {
                if (material in result_dict) {
                    result_dict[material] = Number(result_dict[material]) + results[item] * item_graph[item]["原料"][material];
                } else {
                    result_dict[material] = results[item] * item_graph[item]["原料"][material];
                }
                for (const sub_material in item_price[material]["原料"]) {
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
