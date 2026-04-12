import type {ItemGraph, NumericMap} from '../../types/domain';

export function getGrossOutput(amount: number, item_graph: ItemGraph, item: string): number {
    if (item_graph[item]["自消耗"]) {
        return Number(amount * (1 + item_graph[item]["自消耗"]));
    }
    return Number(amount);
}

export function buildSideProducts(result_dict: NumericMap, item_graph: ItemGraph): Record<string, NumericMap> {
    const side_products: Record<string, NumericMap> = {};
    (Object.entries(result_dict) as Array<[string, number]>).forEach(([item, item_count]) => {
        (Object.entries(item_graph[item]["副产物"]) as Array<[string, number]>).forEach(([side_product, amount]) => {
            side_products[side_product] = side_products[side_product] || {};
            side_products[side_product][item] = item_count * amount;
        });
    });
    return side_products;
}
