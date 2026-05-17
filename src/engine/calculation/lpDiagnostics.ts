import type {LinearProgrammingBlocker, NumericMap, SolverModel} from '@engine/types/domain';

const LP_SOURCE_EPSILON = 1e-12;
const LP_DEMAND_EPSILON = 1e-9;

function getConstraintCoefficient(variable: Record<string, number>, item: string): number {
    return Number(variable[`i${item}`] || 0);
}

export function findLinearProgrammingBlockers(
    model: Pick<SolverModel, 'variables'>,
    lp_item_dict: NumericMap
): LinearProgrammingBlocker[] {
    const blockers: LinearProgrammingBlocker[] = [];

    Object.entries(lp_item_dict).forEach(([item, demand]) => {
        if (demand <= LP_DEMAND_EPSILON) {
            return;
        }

        let has_positive_source = false;
        Object.values(model.variables).forEach((variable) => {
            const coefficient = getConstraintCoefficient(variable, item);
            if (coefficient <= LP_SOURCE_EPSILON) {
                return;
            }
            has_positive_source = true;
        });

        if (!has_positive_source) {
            blockers.push({
                item,
                demand,
            });
        }
    });

    return blockers;
}
