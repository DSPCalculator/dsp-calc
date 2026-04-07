function uniq(arr) {
    return Array.from(new Set(arr));
}

function buildItemData(game_data) {
    let item_data = {};
    let recipe_data = game_data.recipe_data;
    let i = 0;
    for (let num = 0; num < recipe_data.length; num++) {
        for (let item in recipe_data[num].产物) {
            if (!(item in item_data)) {
                item_data[item] = [i];
                i++;
            }
            item_data[item].push(num);
        }
    }
    return item_data;
}

function buildIconGrid(game_data, all_target_items) {
    let loc_item = {};
    for (let [item, gridIndex] of Object.entries(game_data.item_grid)) {
        if (game_data.item_grid_index_valid[item]
            || (item === "沙土" && game_data.FractionateEverythingEnable)) {
            let x = gridIndex % 100;
            let y = (gridIndex - x) / 100;
            loc_item[[x, y]] = {item: item, x: x, y: y};
        }
    }
    let xs = Object.values(loc_item).map(({x}) => x);
    let ys = Object.values(loc_item).map(({y}) => y);
    let minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    let minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);

    let icons = [];
    let all_unused_targets = new Set(all_target_items);
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            let item = loc_item[[x, y]]?.item;
            if (item) {
                icons.push({col: x - minX + 1, row: y - minY + 1, item: item});
                all_unused_targets.delete(item);
            }
        }
    }

    if (all_unused_targets.size > 0) {
        console.warn("如下产物未能在物品选择器中显示", all_unused_targets);
    }

    return {nrow: maxY - minY + 1, ncol: maxX - minX + 1, icons: icons};
}

export class GameInfo {
    game_data;
    item_data;
    all_target_items;
    icon_grid;

    constructor(game_data) {
        this.reinit(game_data);
    }

    reinit(game_data) {
        this.game_data = game_data;
        this.item_data = buildItemData(this.game_data);
        this.all_target_items = uniq(this.game_data.recipe_data.flatMap(recipe => Object.keys(recipe["产物"])));
        this.icon_grid = buildIconGrid(this.game_data, this.all_target_items);
    }
}
