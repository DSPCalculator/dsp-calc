import solver from '../vendor/javascriptLpSolverBrowser.js';
import {aggregateNetNeeds, buildInitialResultDict} from './needsDemandAggregation.js';
import {buildLinearProgrammingModel, buildLpInputs} from './lpModelBuilder.js';
import {applyLinearProgrammingResults} from './lpResultApplier.js';

function solveLinearProgramming(snapshot, lp_item_dict, result_dict, lp_surplus_list) {
    const model = buildLinearProgrammingModel(snapshot, lp_item_dict);
    const results = solver.Solve(model);
    applyLinearProgrammingResults(snapshot, model, results, lp_item_dict, result_dict, lp_surplus_list);
}

export function solveNeeds(snapshot, needs_list) {
    const {in_out_list, external_supply_item} = aggregateNetNeeds(snapshot, needs_list);
    let result_dict = buildInitialResultDict(snapshot.item_price, in_out_list);
    let lp_surplus_list = {};
    const {lp_item_dict} = buildLpInputs(snapshot, in_out_list, external_supply_item, result_dict);

    solveLinearProgramming(snapshot, lp_item_dict, result_dict, lp_surplus_list);
    return [result_dict, lp_surplus_list];
}
