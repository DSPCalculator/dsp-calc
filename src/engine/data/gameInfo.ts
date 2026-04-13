import type {GameData, IconGrid, IconGridEntry, ItemDataIndex, ItemName} from '@engine/types/domain';

function uniq(arr: ItemName[]): ItemName[] {
    return Array.from(new Set(arr));
}

function buildItemData(game_data: GameData): ItemDataIndex {
    const item_data: ItemDataIndex = {};
    const recipe_data = game_data.recipe_data;
    let i = 0;
    for (let num = 0; num < recipe_data.length; num++) {
        for (const item in recipe_data[num].产物) {
            if (!(item in item_data)) {
                item_data[item] = [i];
                i++;
            }
            item_data[item].push(num);
        }
    }
    return item_data;
}

function buildIconGrid(game_data: GameData, all_target_items: ItemName[]): IconGrid {
    const loc_item: Record<string, {item: ItemName; x: number; y: number}> = {};
    for (const [item, gridIndex] of Object.entries(game_data.item_grid)) {
        if (game_data.item_grid_index_valid[item]
            || (item === "沙土" && game_data.FractionateEverythingEnable)) {
            const x = gridIndex % 100;
            const y = (gridIndex - x) / 100;
            loc_item[`${x},${y}`] = {item: item, x: x, y: y};
        }
    }
    const xs = Object.values(loc_item).map(({x}) => x);
    const ys = Object.values(loc_item).map(({y}) => y);
    const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);

    const icons: IconGridEntry[] = [];
    const all_unused_targets = new Set(all_target_items);
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            const item = loc_item[`${x},${y}`]?.item;
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
    game_data!: GameData;
    item_data!: ItemDataIndex;
    all_target_items!: ItemName[];
    icon_grid!: IconGrid;

    constructor(game_data: GameData) {
        this.reinit(game_data);
    }

    reinit(game_data: GameData): void {
        this.game_data = game_data;
        this.item_data = buildItemData(this.game_data);
        this.all_target_items = uniq(this.game_data.recipe_data.flatMap(recipe => Object.keys(recipe["产物"])));
        this.icon_grid = buildIconGrid(this.game_data, this.all_target_items);
    }
}
