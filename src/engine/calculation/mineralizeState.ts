import type {MineralizeList} from '@engine/types/domain';

export function getMineralizedItemNames(mineralize_list: MineralizeList): string[] {
    if (Array.isArray(mineralize_list)) {
        return mineralize_list;
    }
    return Object.keys(mineralize_list || {});
}

export function hasMineralizedItem(mineralize_list: MineralizeList, item: string): boolean {
    return getMineralizedItemNames(mineralize_list).includes(item);
}

export function addMineralizedItem(mineralize_list: MineralizeList, item: string): Record<string, boolean> {
    return {
        ...(Array.isArray(mineralize_list)
            ? Object.fromEntries(mineralize_list.map(current_item => [current_item, true]))
            : (mineralize_list || {})),
        [item]: true,
    };
}

export function removeMineralizedItem(mineralize_list: MineralizeList, item: string): Record<string, boolean> {
    const normalized_list = Array.isArray(mineralize_list)
        ? Object.fromEntries(mineralize_list.map(current_item => [current_item, true]))
        : {...(mineralize_list || {})};
    delete normalized_list[item];
    return normalized_list;
}

export function clearMineralizedItems(): Record<string, boolean> {
    return {};
}
