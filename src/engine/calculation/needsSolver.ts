import solver from '../solver/javascriptLpSolverBrowser';
import {aggregateNetNeeds, buildInitialResultDict} from './needsDemandAggregation';
import {buildLinearProgrammingModel, buildLpInputs} from './lpModelBuilder';
import {applyLinearProgrammingResults} from './lpResultApplier';
import type {CalculationSnapshot, LinearProgrammingIssue, NumericMap, SolverResults} from '@engine/types/domain';

function solveLinearProgramming(
    snapshot: CalculationSnapshot,
    lp_item_dict: NumericMap,
    result_dict: NumericMap,
    lp_surplus_list: NumericMap
): void {
    const model = buildLinearProgrammingModel(snapshot, lp_item_dict);
    const results = solver.Solve(model) as SolverResults;
    applyLinearProgrammingResults(snapshot, model, results, lp_item_dict, result_dict, lp_surplus_list);
}

export function solveNeeds(snapshot: CalculationSnapshot, needs_list: NumericMap): [NumericMap, NumericMap, LinearProgrammingIssue?] {
    const {in_out_list, external_supply_item} = aggregateNetNeeds(snapshot, needs_list);
    const result_dict = buildInitialResultDict(snapshot.item_price, in_out_list);
    const lp_surplus_list: NumericMap = {};
    const {lp_item_dict} = buildLpInputs(snapshot, in_out_list, external_supply_item, result_dict);

    solveLinearProgramming(snapshot, lp_item_dict, result_dict, lp_surplus_list);
    return [result_dict, lp_surplus_list];
}
