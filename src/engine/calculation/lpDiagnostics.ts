import type {ItemGraph, ItemPrice, LinearProgrammingBlocker, LinearProgrammingDiagnostics, NumericMap, SolverModel} from '@engine/types/domain';

const LP_SOURCE_EPSILON = 1e-12;
const LP_DEMAND_EPSILON = 1e-9;

function getConstraintCoefficient(variable: Record<string, number>, item: string): number {
    return Number(variable[`i${item}`] || 0);
}

function itemChainConsumesBlocker(
    item_graph: ItemGraph | undefined,
    item_price: ItemPrice | undefined,
    item: string,
    blocker_item: string
): boolean {
    return Number(item_graph?.[item]?.["原料"]?.[blocker_item] || 0) > LP_SOURCE_EPSILON
        || Number(item_price?.[item]?.["原料"]?.[blocker_item] || 0) > LP_SOURCE_EPSILON;
}

function addRelatedItemsForSource({
    blocker_item,
    item_graph,
    item_price,
    related_items,
    source_item,
}: {
    blocker_item: string;
    item_graph?: ItemGraph;
    item_price?: ItemPrice;
    related_items: Set<string>;
    source_item: string;
}): void {
    if (source_item !== blocker_item) {
        related_items.add(source_item);
    }

    Object.keys(item_graph?.[source_item]?.["原料"] || {}).forEach((material) => {
        if (material === blocker_item) {
            return;
        }
        if (itemChainConsumesBlocker(item_graph, item_price, material, blocker_item)) {
            related_items.add(material);
        }
    });
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

export function buildLinearProgrammingDiagnostics(
    model: Pick<SolverModel, 'variables'>,
    lp_item_dict: NumericMap,
    dependency_context?: {
        item_graph: ItemGraph;
        item_price: ItemPrice;
    }
): LinearProgrammingDiagnostics {
    const blockers = findLinearProgrammingBlockers(model, lp_item_dict);
    const related_items = new Set<string>();
    const item_graph = dependency_context?.item_graph;
    const item_price = dependency_context?.item_price;

    blockers.forEach(({item}) => {
        Object.entries(model.variables).forEach(([source_item, variable]) => {
            const coefficient = getConstraintCoefficient(variable, item);
            if (coefficient < -LP_SOURCE_EPSILON) {
                addRelatedItemsForSource({
                    blocker_item: item,
                    item_graph,
                    item_price,
                    related_items,
                    source_item,
                });
            }
        });
    });

    blockers.forEach(({item}) => {
        related_items.delete(item);
    });

    return {
        blockers,
        related_items: Array.from(related_items),
    };
}
