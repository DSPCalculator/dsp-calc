export function getGrossOutput(amount, item_graph, item, fixed_num) {
    const offset = 0.49994 * 0.1 ** fixed_num;
    if (item_graph[item]["自消耗"]) {
        return Number(amount * (1 + item_graph[item]["自消耗"])) + offset;
    }
    return Number(amount) + offset;
}

export function buildSideProducts(result_dict, item_graph) {
    let side_products = {};
    Object.entries(result_dict).forEach(([item, item_count]) => {
        Object.entries(item_graph[item]["副产物"]).forEach(([side_product, amount]) => {
            side_products[side_product] = side_products[side_product] || {};
            side_products[side_product][item] = item_count * amount;
        });
    });
    return side_products;
}
