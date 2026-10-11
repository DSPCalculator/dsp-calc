import vanillaReplicator from '../../data/layouts/vanilla-replicator.json';

// ItemProto and RecipeProto use the same coordinate encoding but different
// layouts. Never infer F-key crafting positions from the exported item grid.
// The exported game data keeps item/filter coordinates in GridIndex:
// page * 1000 + row * 100 + column (all one-based). The old icon_grid flattens
// pages into one long grid and normalizes the origin, so it cannot restore tabs.
export function decodeGameGridIndex(index) {
    if (!Number.isInteger(index) || index < 1000) return null;
    const page = Math.floor(index / 1000);
    const row = Math.floor(index % 1000 / 100);
    const col = index % 100;
    return row > 0 && col > 0 ? {page, row, col} : null;
}

export function buildGamePickerLayout(gameInfo) {
    const mods = gameInfo.game_data?.mods;
    // get_game_data uses [] for Vanilla and ['DarkFogSynthesis'] for the
    // standalone synthesis profile. Unknown/legacy consumers and every other
    // mod profile retain their exported item layout, including extra pages.
    if (Array.isArray(mods) && mods.every(mod => mod === 'DarkFogSynthesis')) {
        return buildReplicatorLayout(gameInfo);
    }
    return buildExportedItemLayout(gameInfo);
}

function buildReplicatorLayout(gameInfo) {
    const targets = new Set(gameInfo.all_target_items ?? []);
    const placed = new Set();
    const {rows, columns} = vanillaReplicator;
    const pages = vanillaReplicator.pageIds.map(pageNumber => {
        const entries = [];
        const slots = new Map();
        const cells = vanillaReplicator.cells.filter(cell => cell.page === pageNumber).map(cell => {
            let entry;
            if (cell.canonicalName && targets.has(cell.canonicalName)) {
                entry = {
                    item: cell.canonicalName,
                    itemId: cell.itemId,
                    recipeId: cell.recipeId,
                    page: cell.page,
                    row: cell.row,
                    col: cell.col,
                    label: cell.label,
                    iconName: cell.iconName,
                };
                // Recipe alternatives intentionally repeat their target item.
                // Selecting one still selects only that item, not its recipe.
                entries.push(entry);
                slots.set(`${cell.row}:${cell.col}`, entry);
                placed.add(entry.item);
            }
            return {row: cell.row, col: cell.col, entry};
        });
        return {
            id: String(pageNumber),
            label: pageNumber === 1 ? '物品' : '建筑',
            rows, columns, entries, slots, cells,
        };
    });
    // Raw resources, Dark Fog drops and any future unpositioned targets stay
    // reachable in separate rows, without occupying verified crafting holes.
    const extras = [...targets].filter(item => !placed.has(item)).map(item => ({item}));
    const names = [...new Set([...pages.flatMap(page => page.entries.map(entry => entry.item)),
        ...extras.map(entry => entry.item)])];
    return {layoutKind: 'replicator', pages, columns, names, extras};
}

function buildExportedItemLayout(gameInfo) {
    const targets = new Set(gameInfo.all_target_items ?? []);
    const rawGrid = gameInfo.game_data?.item_grid;
    const hasRawGrid = rawGrid != null;
    const locations = hasRawGrid
        ? Object.entries(rawGrid).flatMap(([item, index]) => {
            const position = decodeGameGridIndex(index);
            return position ? [{item, ...position}] : [];
        })
        // Compatibility for consumers that only supply the legacy icon layout.
        // Do not guess page boundaries from already normalized row numbers.
        : (gameInfo.icon_grid?.icons ?? [])
            .filter(({row, col}) => Number.isInteger(row) && row > 0 && Number.isInteger(col) && col > 0)
            .map(entry => ({...entry, page: 1}));

    const pages = new Map();
    const ensurePage = number => {
        if (!pages.has(number)) pages.set(number, {
            id: String(number),
            label: number === 1 ? '物品' : number === 2 ? '建筑' : `模组 ${number}`,
            rows: 0,
            entries: [],
            slots: new Map(),
        });
        return pages.get(number);
    };
    ensurePage(1);
    ensurePage(2);

    let columns = 0;
    const placed = new Set();
    for (const entry of locations.sort((a, b) => a.page - b.page || a.row - b.row || a.col - b.col)) {
        const page = ensurePage(entry.page);
        // Include non-target slots when measuring geometry, but never make them
        // selectable. This preserves empty leading/intermediate/trailing cells.
        columns = Math.max(columns, entry.col);
        page.rows = Math.max(page.rows, entry.row);
        const slot = `${entry.row}:${entry.col}`;
        if (!targets.has(entry.item) || placed.has(entry.item) || page.slots.has(slot)) continue;
        page.entries.push(entry);
        page.slots.set(slot, entry);
        placed.add(entry.item);
    }
    if (!hasRawGrid) {
        const {ncol, nrow} = gameInfo.icon_grid ?? {};
        if (Number.isInteger(ncol) && ncol > 0) columns = Math.max(columns, ncol);
        if (Number.isInteger(nrow) && nrow > 0) ensurePage(1).rows = Math.max(ensurePage(1).rows, nrow);
    }
    columns ||= 8;
    const nativePages = [...pages.entries()].sort(([a], [b]) => a - b).map(([, page]) => ({
        ...page,
        columns,
        cells: Array.from({length: page.rows * columns}, (_, index) => {
            const row = Math.floor(index / columns) + 1;
            const col = index % columns + 1;
            return {row, col, entry: page.slots.get(`${row}:${col}`)};
        }),
    }));
    // Invalid/missing/colliding positions must never drop a selectable target,
    // or be silently reclassified as a building or another native game page.
    const unpositioned = [...targets].filter(item => !placed.has(item));
    if (unpositioned.length) nativePages.push({
        id: 'other', label: '其它', columns, rows: 0,
        entries: unpositioned.map(item => ({item})),
        cells: [],
    });
    return {layoutKind: 'item-grid', pages: nativePages, columns,
        names: nativePages.flatMap(page => page.entries.map(entry => entry.item)), extras: []};
}
