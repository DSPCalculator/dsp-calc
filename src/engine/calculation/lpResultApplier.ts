import type {CalculationSnapshot, LinearProgrammingIssue, NumericMap, SolverModel, SolverResults} from '@engine/types/domain';
import {buildLinearProgrammingDiagnostics} from './lpDiagnostics';

export class LinearProgrammingError extends Error {
    issue: LinearProgrammingIssue;

    constructor(issue: LinearProgrammingIssue) {
        super(issue.message);
        this.name = 'LinearProgrammingError';
        this.issue = issue;
    }
}

function formatBlockedItems(items: string[]): string {
    if (items.length === 0) {
        return '';
    }
    if (items.length <= 4) {
        return items.join('、');
    }
    return `${items.slice(0, 4).join('、')} 等 ${items.length} 项`;
}

function normalizeSolverResults(
    snapshot: CalculationSnapshot,
    results: SolverResults,
    model: SolverModel,
    lp_item_dict: NumericMap
): void {
    const lp_items = Object.keys(lp_item_dict);
    if ("result" in results) {
        delete results["result"];
    }
    if ("feasible" in results) {
        if (!results.feasible) {
            const diagnostics = buildLinearProgrammingDiagnostics(model, lp_item_dict, {
                item_graph: snapshot.item_graph,
                item_price: snapshot.item_price,
            });
            const {blockers, related_items} = diagnostics;
            const blocker_items = blockers.map(({item}) => item);
            const issue_items = blocker_items.length > 0 ? blocker_items : lp_items;
            const blocked_text = formatBlockedItems(blocker_items);
            throw new LinearProgrammingError({
                kind: 'infeasible',
                message: blocked_text
                    ? `线性规划无解：${blocked_text} 有正需求，但当前配方链没有任何净正产出来源。红色项是直接阻塞项，黄色项是会消耗阻塞项的相关链路，可从这些行调整上游增产设置。`
                    : "线性规划无解，请检查红色物品的来源配方设置。",
                items: issue_items,
                blockers,
                related_items,
            });
        }
        delete results.feasible;
    }
    if ("bounded" in results) {
        if (!results.bounded) {
            throw new LinearProgrammingError({
                kind: 'unbounded',
                message: "线性规划目标函数无界，请检查红色物品的配方执行成本。",
                items: lp_items,
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

    normalizeSolverResults(snapshot, results, model, lp_item_dict);

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
