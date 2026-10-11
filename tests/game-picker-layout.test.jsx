import '@testing-library/jest-dom/vitest';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import vanilla from '../data/Vanilla.json';
import replicator from '../data/layouts/vanilla-replicator.json';
const vanillaIcons = import.meta.glob('../icon/Vanilla/*.png', {eager: true, query: '?url', import: 'default'});
import {buildGamePickerLayout, decodeGameGridIndex} from '../src/lib/game-picker-layout.js';
import {get_game_data, MoreMegaStructureGUID, TheyComeFromVoidGUID, GenesisBookGUID, FractionateEverythingGUID, DarkFogSynthesisGUID} from '../src/GameData.jsx';
import {GameInfo} from '../src/global_state.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {ItemSelect} from '../src/item_select.jsx';
import {CompactModeContext, GameInfoContext, GlobalStateContext} from '../src/contexts.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';

const datasets = import.meta.glob('../data/*.json', {import: 'default', eager: true});
const modGuids = {MoreMegaStructure: MoreMegaStructureGUID, TheyComeFromVoid: TheyComeFromVoidGUID,
    GenesisBook: GenesisBookGUID, FractionateEverything: FractionateEverythingGUID};
const cases = Object.entries(datasets).map(([path, data]) => ({
    name: path.split('/').pop().replace('.json', ''), data,
    mods: path.split('/').pop().replace('.json', '').split('_').map(name => modGuids[name]).filter(Boolean),
}));
const nativeCases = [{name: 'Vanilla', mods: []}, {name: 'DarkFogSynthesis', mods: [DarkFogSynthesisGUID]}];
// Independently transcribed from the complete 14 × 8 F-panel reference,
// https://wiki.biligame.com/dsp/index.php?title=合成面板&oldid=13637.
// Keep every empty cell and repeated output; ItemProto.GridIndex is a different layout.
const expectedReplicatorItems = [
    [1101, 1104, 1105, 1106, 1108, 1109, 1114, 1123, 1115, 1141, 1142, 1143, 1601, 1609],
    [1102, 1202, 1113, 1107, 1110, 1112, 1120, 1123, 1117, 1128, 1129, 1130, 1602, 1610],
    [1103, 1203, 1113, 1119, 1111, 1112, 1114, 1118, 1117, 1407, 1405, 1406, 1603, 1611],
    [1201, 1204, 1003, 1301, 1126, 1206, 1121, 1124, 1124, 5003, 5001, 5002, 1607, 1604],
    [1401, 1205, 1402, 1303, 1126, 1206, 1121, 1116, 1501, 1125, 1502, 1503, 1608, 1605],
    [1404, 1404, 1302, 1305, 1209, 1211, 1304, 1403, 1801, 1802, 1803, 1804, 1612, 1606],
    [5101, 5102, 5103, 5111, 5112, 1127, 1210, 1210, 1122, null, null, null, 1613, 1131],
    [6001, 6002, 6003, 6004, 6005, 6006, null, null, null, null, null, null, null, null],
    [2201, 2202, 2212, 2203, 2204, 2205, 2206, 2213, 2211, 2209, 2208, 2210, null, 2207],
    [2001, 2002, 2003, 2020, 2040, 2030, 2313, 2101, 2102, 2106, 2107, 2103, 2104, 2105],
    [2011, 2012, 2013, 2014, 2301, 2316, 2306, 2307, 2308, 2314, 2309, 2317, 2310, null],
    [2302, 2315, 2319, 2303, 2304, 2305, 2318, 2901, 2902, 2401, 2311, 2312, null, null],
    [3001, 3005, 3003, 3002, 3004, 3010, 3009, 3006, 3007, 3008, null, null, null, null],
    Array(14).fill(null), Array(14).fill(null), Array(14).fill(null),
];
// Pin alternate-recipe identity too: equal output IDs alone cannot catch
// swapped efficient/default recipes in the same pair of occupied cells.
const expectedReplicatorRecipes = [
    [1, 3, 59, 65, 4, 17, 16, 31, 23, 106, 107, 108, 136, 144],
    [2, 6, 37, 66, 57, 60, 58, 32, 25, 133, 134, 135, 137, 145],
    [63, 97, 62, 30, 11, 61, 121, 26, 54, 105, 20, 21, 138, 146],
    [5, 98, 34, 50, 28, 99, 115, 33, 35, 123, 94, 96, 142, 139],
    [12, 103, 36, 51, 29, 100, 40, 24, 70, 80, 81, 83, 143, 140],
    [68, 69, 53, 52, 101, 162, 38, 42, 19, 41, 44, 156, 158, 141],
    [147, 148, 149, 150, 151, 104, 78, 79, 74, null, null, null, 159, 112],
    [9, 18, 27, 55, 102, 75, null, null, null, null, null, null, null, null],
    [8, 13, 73, 7, 64, 67, 76, 118, 113, 77, 72, 43, null, null],
    [84, 89, 92, 87, 120, 117, 109, 86, 91, 114, 122, 93, 95, 111],
    [85, 88, 90, 160, 48, 119, 49, 14, 15, 110, 22, 124, 39, null],
    [56, 116, 155, 45, 46, 47, 154, 10, 153, 161, 71, 82, null, null],
    [125, 129, 127, 126, 128, 157, 152, 130, 131, 132, null, null, null, null],
    Array(14).fill(null), Array(14).fill(null), Array(14).fill(null),
];

afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
});

describe('game picker coordinates and target coverage', () => {
    it('decodes native pages rather than the old flattened, normalized icon grid', () => {
        expect(decodeGameGridIndex(1201)).toEqual({page: 1, row: 2, col: 1});
        expect(decodeGameGridIndex(2201)).toEqual({page: 2, row: 2, col: 1});
        expect(decodeGameGridIndex(6716)).toEqual({page: 6, row: 7, col: 16});
        for (const invalid of [-1, 0, 201, 1000, 1001, 1100, 1.5, NaN, Infinity, '1201']) {
            expect(decodeGameGridIndex(invalid)).toBeNull();
        }
    });

    it.each([...cases, nativeCases[1]])('indexes each available target exactly once for search in $name', ({data, mods}) => {
        const info = new GameInfo(get_game_data(mods));
        const layout = buildGamePickerLayout(info);
        if (data) {
            const rawTargets = new Set(data.recipes.flatMap(recipe => recipe.Results));
            const expectedNames = data.items.filter(item => rawTargets.has(item.ID)).map(item => item.Name);
            expect(layout.names.slice().sort()).toEqual(expectedNames.slice().sort());
        }
        expect(new Set(layout.names).size).toBe(layout.names.length);
        expect(layout.names.slice().sort()).toEqual(info.all_target_items.slice().sort());
        const reachable = new Set([...layout.pages.flatMap(page => page.entries), ...(layout.extras ?? [])].map(entry => entry.item));
        expect([...reachable].sort()).toEqual(layout.names.slice().sort());
    });

    it.each(cases.filter(({mods}) => mods.length))('retains exact exported item geometry for unverified mod profile $name', ({data, mods}) => {
        const info = new GameInfo(get_game_data(mods));
        const layout = buildGamePickerLayout(info);
        const rawTargets = new Set(data.recipes.flatMap(recipe => recipe.Results));
        expect(layout.layoutKind).toBe('item-grid');
        expect(layout.pages.slice(0, 2).map(page => page.label)).toEqual(['物品', '建筑']);
        expect(layout.columns).toBe(Math.max(...data.items.map(item => decodeGameGridIndex(item.GridIndex)?.col ?? 0)));
        for (const raw of data.items) {
            if (!rawTargets.has(raw.ID)) continue;
            const position = decodeGameGridIndex(raw.GridIndex);
            const page = layout.pages.find(page => page.entries.some(entry => entry.item === raw.Name));
            expect(page, raw.Name).toBeDefined();
            if (!position) {
                expect(page.id).toBe('other');
                continue;
            }
            expect(page.id, raw.Name).toBe(String(position.page));
            expect(page.entries.find(entry => entry.item === raw.Name)).toMatchObject(position);
        }
        for (const page of layout.pages.filter(page => page.id !== 'other')) {
            const rawPage = data.items.map(item => decodeGameGridIndex(item.GridIndex)).filter(position => String(position?.page) === page.id);
            expect(page.rows).toBe(Math.max(0, ...rawPage.map(position => position.row)));
            expect(page.cells).toHaveLength(page.rows * layout.columns);
            expect(page.cells.filter(cell => cell.entry)).toHaveLength(page.entries.length);
            expect(new Set(page.entries.map(entry => `${entry.row}:${entry.col}`)).size).toBe(page.entries.length);
        }
    });

    it('preserves whole blank rows and mixed native mod pages rather than guessing building categories', () => {
        const layout = buildGamePickerLayout(new GameInfo(get_game_data([GenesisBookGUID])));
        const nuclear = layout.pages.find(page => page.id === '3');
        const combat = layout.pages.find(page => page.id === '5');
        expect(layout.columns).toBe(17);
        expect(layout.pages[0].rows).toBe(7);
        expect(nuclear.rows).toBe(7);
        for (const row of [1, 2, 5, 6]) {
            const cells = nuclear.cells.filter(cell => cell.row === row);
            expect(cells).toHaveLength(17);
            expect(cells.every(cell => !cell.entry)).toBe(true);
        }
        expect(nuclear.entries.find(entry => entry.item === '液氢燃料棒')).toMatchObject({row: 7, col: 2});
        expect(combat.entries.some(entry => entry.item === '高斯机枪塔')).toBe(true);
        expect(combat.entries.some(entry => entry.item === '机枪弹箱')).toBe(true);
        expect(layout.pages[1].entries.some(entry => entry.item === '高斯机枪塔')).toBe(false);
    });

    it('retains invalid, missing and colliding targets once in a neutral fallback', () => {
        const info = {
            all_target_items: ['铁块', '铜块', '缺少格位', '负值', '无效列', '无效行', '传送带', '铁块'],
            game_data: {item_grid: {'铁块': 1201, '铜块': 1201, '负值': -1, '无效列': 1100, '无效行': 1001, '传送带': 2201, '非目标': 1805}},
            icon_grid: {nrow: 100, ncol: 100, icons: [{item: '铁块', row: 99, col: 99}]},
        };
        const before = structuredClone(info);
        const layout = buildGamePickerLayout(info);
        expect(layout.columns).toBe(5);
        expect(layout.pages[0].rows).toBe(8);
        expect(layout.pages[0].entries).toEqual([{item: '铁块', page: 1, row: 2, col: 1}]);
        expect(layout.pages.find(page => page.id === 'other').entries.map(entry => entry.item)).toEqual(['铜块', '缺少格位', '负值', '无效列', '无效行']);
        expect(layout.names.slice().sort()).toEqual([...new Set(info.all_target_items)].sort());
        expect(info).toEqual(before);
    });

    it('supports old normalized grid consumers without guessing page boundaries', () => {
        const layout = buildGamePickerLayout({all_target_items: ['铁块', '氢'], icon_grid: {
            ncol: 5, nrow: 15, icons: [{item: '铁块', row: 12, col: 4}, {item: '铁块', row: 13, col: 4}],
        }});
        expect(layout.pages[0]).toMatchObject({rows: 15, columns: 5});
        expect(layout.pages[0].entries).toEqual([{item: '铁块', page: 1, row: 12, col: 4}]);
        expect(layout.pages.find(page => page.id === 'other').entries).toEqual([{item: '氢'}]);
    });
});

describe('verified F-key crafting layout', () => {
    it.each(nativeCases)('matches every occupied cell and hole in both 14 × 8 pages for $name', ({mods}) => {
        const info = new GameInfo(get_game_data(mods));
        const before = structuredClone(info);
        const layout = buildGamePickerLayout(info);
        expect(layout.layoutKind).toBe('replicator');
        expect(layout.columns).toBe(14);
        expect(layout.pages.map(page => page.id)).toEqual(['1', '2']);
        const expectedIds = expectedReplicatorItems.flat();
        expect(replicator.cells.map(cell => cell.itemId)).toEqual(expectedIds);
        expect(layout.pages.flatMap(page => page.cells.map(cell => cell.entry?.itemId ?? null))).toEqual(expectedIds);
        expect(replicator.cells.map(cell => cell.recipeId)).toEqual(expectedReplicatorRecipes.flat());
        expect(layout.pages.flatMap(page => page.cells.map(cell => cell.entry?.recipeId ?? null))).toEqual(expectedReplicatorRecipes.flat());
        for (const page of layout.pages) {
            expect(page).toMatchObject({rows: 8, columns: 14});
            expect(page.cells).toHaveLength(112);
            expect(new Set(page.entries.map(entry => `${entry.row}:${entry.col}`)).size).toBe(page.entries.length);
            for (let index = 0; index < page.cells.length; index++) {
                const cell = page.cells[index];
                expect(cell).toMatchObject({row: Math.floor(index / 14) + 1, col: index % 14 + 1});
                if (cell.entry) expect(cell.entry).toMatchObject({page: Number(page.id), row: cell.row, col: cell.col});
            }
        }
        const [items, buildings] = layout.pages;
        expect(items.slots.get('1:1')).toMatchObject({item: '铁块', recipeId: 1});
        expect([10, 11, 12].map(col => items.slots.get(`1:${col}`).itemId)).toEqual([1141, 1142, 1143]);
        expect(items.slots.get('6:6')).toMatchObject({item: '黑雾引力透镜', recipeId: 162});
        expect(buildings.slots.get('4:10')).toMatchObject({item: '全息信标', recipeId: 161});
        expect(buildings.slots.get('1:14')).toMatchObject({item: '蓄电器（满）', recipeId: null});
        expect(buildings.cells.filter(cell => cell.row >= 6).every(cell => !cell.entry)).toBe(true);
        expect(info).toEqual(before);
    });

    it('maps all 162 recipes to real products and existing recipe artwork without altering their ordinals', () => {
        expect(replicator.cells).toHaveLength(224);
        const cells = replicator.cells.filter(cell => cell.itemId !== null);
        expect(cells).toHaveLength(163);
        const recipes = cells.filter(cell => cell.recipeId !== null);
        expect(recipes.map(cell => cell.recipeId).sort((a, b) => a - b)).toEqual(Array.from({length: 162}, (_, i) => i + 1));
        for (const cell of cells) {
            expect(decodeGameGridIndex(cell.gridIndex)).toEqual({page: cell.page, row: cell.row, col: cell.col});
            const rawItem = vanilla.items.find(item => item.ID === cell.itemId);
            expect(rawItem.Name).toBe(cell.canonicalName);
            expect(vanillaIcons[`../icon/Vanilla/${cell.iconName}.png`], cell.iconName).toBeDefined();
            if (cell.recipeId !== null) {
                const rawRecipe = vanilla.recipes.find(recipe => recipe.ID === cell.recipeId);
                expect(rawRecipe.Results, `${cell.recipeId}: ${cell.canonicalName}`).toContain(cell.itemId);
                expect(cell.iconName).toBe(rawRecipe.IconName);
                expect(cell.label).toBe(cell.recipeId === 20 ? '推进器' : rawRecipe.Name);
            }
        }
    });

    it.each(nativeCases)('retains recipe alternatives and places all remaining $name targets only in supplementary rows', ({mods}) => {
        const info = new GameInfo(get_game_data(mods));
        const layout = buildGamePickerLayout(info);
        const entries = layout.pages.flatMap(page => page.entries);
        const graphite = entries.filter(entry => entry.item === '石墨烯');
        expect(graphite.map(({recipeId, row, col, iconName}) => ({recipeId, row, col, iconName}))).toEqual([
            {recipeId: 31, row: 1, col: 8, iconName: 'graphene'},
            {recipeId: 32, row: 2, col: 8, iconName: 'graphene-lv2'},
        ]);
        for (const [recipeId, item] of [[16, '精炼油'], [58, '氢'], [74, '反物质']]) {
            expect(entries.find(entry => entry.recipeId === recipeId).item).toBe(item);
        }
        const positioned = new Set(entries.map(entry => entry.item));
        const extraNames = layout.extras.map(entry => entry.item);
        expect(extraNames).toEqual(info.all_target_items.filter(item => !positioned.has(item)));
        expect(new Set(extraNames).size).toBe(extraNames.length);
        expect(extraNames).toEqual(expect.arrayContaining(['铁矿', '铜矿', '原油', '水', '临界光子', '黑雾矩阵', '硅基神经元', '核心素']));
        expect(layout.names.filter(item => item === '石墨烯')).toHaveLength(1);
        expect(layout.pages.some(page => page.id === 'other')).toBe(false);
    });
});

const smallInfo = {
    all_target_items: ['铁块', '传送带', '氢', '机枪弹箱'],
    game_data: {item_grid: {'铁块': 1201, '传送带': 2201, '氢': -1, '机枪弹箱': 3304, '空位边界': 1805}},
};

async function openPicker({item, info = smallInfo, onSelect = vi.fn(), globalState, mode = 'full'} = {}) {
    const user = userEvent.setup();
    render(<CompactModeContext.Provider value={mode}><GameInfoContext.Provider value={info}>
        <GlobalStateContext.Provider value={globalState ?? {game_data: {mods: info.game_data?.mods ?? []}}}><TooltipProvider delayDuration={0}>
            <ItemSelect text="添加需求物品" item={item} set_item={onSelect}/>
        </TooltipProvider></GlobalStateContext.Provider>
    </GameInfoContext.Provider></CompactModeContext.Provider>);
    await user.click(screen.getByRole('button', {name: /^添加需求物品/}));
    return {user, onSelect, dialog: screen.getByRole('dialog', {name: '选择物品'})};
}

describe('game picker tabs and search state', () => {
    it('uses accessible shadcn tabs with arrow, Home and End keyboard navigation', async () => {
        const {user, dialog} = await openPicker();
        const items = within(dialog).getByRole('tab', {name: '物品', exact: true});
        const buildings = within(dialog).getByRole('tab', {name: '建筑', exact: true});
        const other = within(dialog).getByRole('tab', {name: '其它', exact: true});
        expect(within(dialog).getByRole('tablist', {name: '游戏物品分页'})).toHaveAttribute('data-slot', 'tabs-list');
        expect(items).toHaveAttribute('aria-selected', 'true');
        await user.click(items);
        await user.keyboard('{ArrowRight}');
        await waitFor(() => expect(buildings).toHaveAttribute('aria-selected', 'true'));
        expect(buildings).toHaveFocus();
        expect(within(dialog).getByRole('tabpanel', {name: '建筑'})).toBeInTheDocument();
        expect(within(dialog).getByRole('button', {name: '选择传送带'})).toHaveStyle({gridColumn: '1', gridRow: '2'});
        expect(within(dialog).queryByRole('button', {name: '选择铁块'})).not.toBeInTheDocument();
        await user.keyboard('{End}');
        await waitFor(() => expect(other).toHaveAttribute('aria-selected', 'true'));
        expect(within(dialog).getByRole('button', {name: '选择氢'})).toBeInTheDocument();
        await user.keyboard('{Home}');
        await waitFor(() => expect(items).toHaveAttribute('aria-selected', 'true'));
    });

    it('searches every native and fallback page then restores the current fixed tab on clear', async () => {
        const {user, dialog} = await openPicker();
        const buildings = within(dialog).getByRole('tab', {name: '建筑', exact: true});
        await user.click(buildings);
        const search = within(dialog).getByRole('searchbox');
        for (const [query, target] of [['tiekuai', '铁块'], ['qing', '氢'], ['jqdx', '机枪弹箱']]) {
            await user.type(search, query);
            expect(within(dialog).getByRole('button', {name: `选择${target}`})).toHaveTextContent(target);
            expect(within(dialog).getByRole('tabpanel', {name: '所有分页搜索结果'})).toBeInTheDocument();
            expect(buildings).toHaveAttribute('aria-selected', 'true');
            await user.click(within(dialog).getByRole('button', {name: '清除搜索'}));
            expect(search).toHaveFocus();
            expect(within(dialog).getByRole('group', {name: '建筑固定位置网格'})).toBeInTheDocument();
            expect(within(dialog).getByRole('button', {name: '选择传送带'})).toHaveStyle({gridColumn: '1', gridRow: '2'});
        }
        await user.type(search, '铁块');
        await user.click(within(dialog).getByRole('tab', {name: '模组 3'}));
        expect(search).toHaveValue('');
        expect(within(dialog).getByRole('button', {name: '选择机枪弹箱'})).toHaveStyle({gridColumn: '4', gridRow: '3'});
    });

    it('opens on the selected item’s native page and preserves tabs through dismissed searches', async () => {
        const {user, dialog} = await openPicker({item: '传送带'});
        expect(within(dialog).getByRole('tab', {name: '建筑', exact: true})).toHaveAttribute('aria-selected', 'true');
        expect(within(dialog).getByRole('button', {name: '选择传送带'})).toHaveAttribute('aria-pressed', 'true');
        await user.type(within(dialog).getByRole('searchbox'), 'tk');
        await user.keyboard('{Escape}');
        const trigger = screen.getByRole('button', {name: '添加需求物品：传送带'});
        expect(trigger).toHaveFocus();
        await user.click(trigger);
        expect(screen.getByRole('searchbox')).toHaveValue('');
        expect(screen.getByRole('tab', {name: '建筑', exact: true})).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('button', {name: '选择传送带'})).toHaveStyle({gridColumn: '1', gridRow: '2'});
    });

    it('does not select or close during IME composition, including legacy 229 key events', async () => {
        const {dialog, onSelect} = await openPicker();
        const search = within(dialog).getByRole('searchbox');
        fireEvent.compositionStart(search);
        fireEvent.change(search, {target: {value: '铁块'}});
        fireEvent.keyDown(search, {key: 'Enter'});
        expect(onSelect).not.toHaveBeenCalled();
        fireEvent.compositionEnd(search);
        fireEvent.keyDown(search, {key: 'Enter', keyCode: 229});
        expect(onSelect).not.toHaveBeenCalled();
        fireEvent.keyDown(search, {key: 'Enter'});
        expect(onSelect).toHaveBeenCalledExactlyOnceWith('铁块');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

describe('native crafting picker interaction', () => {
    it.each(nativeCases)('keeps $name raw resources and drops below both complete game tabs', async ({mods}) => {
        const info = new GameInfo(get_game_data(mods));
        const layout = buildGamePickerLayout(info);
        const {user, dialog, onSelect} = await openPicker({info});
        // Reserve desktop scrollbar space so the fourteenth column is visible.
        expect(dialog).toHaveStyle({width: '743px'});
        expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['物品', '建筑']);
        for (const page of layout.pages) {
            await user.click(within(dialog).getByRole('tab', {name: page.label, exact: true}));
            const grid = within(dialog).getByRole('group', {name: `${page.label}固定位置网格`});
            expect(grid).toHaveStyle({gridTemplateColumns: 'repeat(14, var(--picker-tile-size))', gridTemplateRows: 'repeat(8, var(--picker-tile-size))'});
            const buttons = within(grid).getAllByRole('button');
            expect(buttons).toHaveLength(page.entries.length);
            expect(grid.querySelectorAll('[data-slot="picker-empty-slot"]')).toHaveLength(112 - page.entries.length);
            for (const entry of page.entries) {
                const button = buttons.find(button => button.style.gridRow === String(entry.row) && button.style.gridColumn === String(entry.col));
                expect(button, `${page.label} ${entry.row}:${entry.col}`).toBeDefined();
                expect(button).toHaveAttribute('aria-label', `选择${entry.item}`);
                expect(within(button).getByRole('img')).toHaveAttribute('aria-label', entry.iconName);
            }
            const extras = within(dialog).getByRole('region', {name: '合成面板外的补充物品'});
            expect(grid.compareDocumentPosition(extras) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            const extraGrid = within(extras).getByRole('group', {name: '补充物品固定位置网格'});
            expect(within(extraGrid).getAllByRole('button').map(button => button.getAttribute('aria-label').replace(/^选择/, '')).sort())
                .toEqual(layout.extras.map(entry => entry.item).sort());
        }
        await user.click(within(dialog).getByRole('button', {name: '选择黑雾矩阵', exact: true}));
        expect(onSelect).toHaveBeenCalledExactlyOnceWith('黑雾矩阵');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('filters Chinese, pinyin and initials in original cells across both pages and preserves supplementary positions', async () => {
        const {user, dialog} = await openPicker({info: new GameInfo(get_game_data([]))});
        const buildings = within(dialog).getByRole('tab', {name: '建筑', exact: true});
        await user.click(buildings);
        const search = within(dialog).getByRole('searchbox');
        const rawIron = within(dialog).getByRole('button', {name: '选择铁矿', exact: true});
        const extraPosition = {gridColumn: rawIron.style.gridColumn, gridRow: rawIron.style.gridRow};
        for (const query of ['铁块', 'tiekuai', 'tk']) {
            fireEvent.change(search, {target: {value: query}});
            expect(within(dialog).getByRole('button', {name: '选择铁块', exact: true})).toHaveStyle({gridColumn: '1', gridRow: '1'});
            const grid = within(dialog).getByRole('group', {name: '物品固定位置网格'});
            expect(grid).toHaveStyle({gridTemplateColumns: 'repeat(14, var(--picker-tile-size))', gridTemplateRows: 'repeat(8, var(--picker-tile-size))'});
            expect(grid.querySelectorAll('button, [data-slot="picker-empty-slot"]')).toHaveLength(112);
            expect(buildings).toHaveAttribute('aria-selected', 'true');
        }
        for (const query of ['增产剂', 'zengchanji', 'zcj']) {
            fireEvent.change(search, {target: {value: query}});
            const proliferators = within(dialog).getAllByRole('button', {name: /^选择增产剂/});
            expect(proliferators.map(button => button.style.gridColumn)).toEqual(['10', '11', '12']);
            expect(proliferators.every(button => button.style.gridRow === '1')).toBe(true);
        }
        fireEvent.change(search, {target: {value: '机'}});
        expect(within(dialog).getByRole('group', {name: '物品固定位置网格'})).toBeInTheDocument();
        expect(within(dialog).getByRole('group', {name: '建筑固定位置网格'})).toBeInTheDocument();
        fireEvent.change(search, {target: {value: 'tiekuang'}});
        expect(within(dialog).getByRole('button', {name: '选择铁矿', exact: true})).toHaveStyle(extraPosition);
        await user.click(within(dialog).getByRole('button', {name: '清除搜索'}));
        expect(search).toHaveFocus();
        expect(within(dialog).getByRole('button', {name: '选择全息信标', exact: true})).toHaveStyle({gridColumn: '10', gridRow: '4'});
        expect(buildings).toHaveAttribute('aria-selected', 'true');
    });

    it('keeps both alternate recipe cells while selecting only the target item and leaving recipes and saved plans untouched', async () => {
        const info = new GameInfo(get_game_data([]));
        const scheme = init_scheme_data(info.game_data);
        scheme.item_recipe_choices['石墨烯'] = 2;
        scheme.scheme_for_recipe[info.game_data.recipe_ids.indexOf(32)] = {建筑: 0, 增产模式: 2, 增产点数: 4};
        const before = structuredClone({info, scheme});
        const savedPlan = JSON.stringify({needs: {'石墨烯': 120}, scheme});
        localStorage.setItem('crafting-picker-regression-plan', savedPlan);
        const writes = vi.spyOn(Storage.prototype, 'setItem');
        const onSelect = vi.fn(() => false);
        const {user, dialog} = await openPicker({info, onSelect, globalState: {game_data: info.game_data, scheme_data: scheme}});
        fireEvent.change(within(dialog).getByRole('searchbox'), {target: {value: '石墨烯'}});
        const alternatives = within(dialog).getAllByRole('button', {name: '选择石墨烯', exact: true});
        expect(alternatives).toHaveLength(2);
        expect(alternatives.map(button => [button.style.gridRow, button.style.gridColumn])).toEqual([['1', '8'], ['2', '8']]);
        expect(alternatives.map(button => within(button).getByRole('img').getAttribute('aria-label'))).toEqual(['graphene', 'graphene-lv2']);
        expect(dialog.querySelector('[aria-live="polite"]')).toHaveTextContent('1 项');
        await user.hover(alternatives[1]);
        expect(await screen.findByRole('tooltip')).toHaveTextContent('石墨烯（高效）');
        await user.click(alternatives[1]);
        await user.click(alternatives[0]);
        expect(onSelect.mock.calls).toEqual([['石墨烯'], ['石墨烯']]);
        expect(dialog).toBeInTheDocument();
        expect({info, scheme}).toEqual(before);
        expect(localStorage.getItem('crafting-picker-regression-plan')).toBe(savedPlan);
        expect(writes).not.toHaveBeenCalled();
    });

    it('identifies the fuzzy-ranked Enter choice even when fixed-grid visual order differs', async () => {
        const {dialog, onSelect} = await openPicker({info: new GameInfo(get_game_data([]))});
        const search = within(dialog).getByRole('searchbox');
        fireEvent.change(search, {target: {value: 'tk'}});
        const firstVisible = within(dialog).getAllByRole('button', {name: /^选择/})[0];
        expect(firstVisible).toHaveAttribute('aria-label', '选择铁块');
        const primary = within(dialog).getByRole('button', {name: '选择钛块', exact: true});
        expect(primary).toHaveAttribute('data-search-primary', 'true');
        expect(within(dialog).getByText('所有分页 · Enter 选择：钛块')).toBeInTheDocument();
        fireEvent.keyDown(search, {key: 'Enter'});
        expect(onSelect).toHaveBeenCalledExactlyOnceWith('钛块');
    });

    it('keeps native mobile geometry and resets an interrupted search on the selected building page', async () => {
        const {user, dialog, onSelect} = await openPicker({info: new GameInfo(get_game_data([])), item: '全息信标', mode: 'mobile'});
        expect(dialog.style.getPropertyValue('--picker-tile-size')).toBe('32px');
        const grid = within(dialog).getByRole('group', {name: '建筑固定位置网格'});
        expect(grid).toHaveStyle({gridTemplateColumns: 'repeat(14, var(--picker-tile-size))', gridTemplateRows: 'repeat(8, var(--picker-tile-size))'});
        const beacon = within(grid).getByRole('button', {name: '选择全息信标'});
        expect(beacon).toHaveAttribute('aria-pressed', 'true');
        expect(within(beacon).getByRole('img')).toHaveStyle({width: '28px', height: '28px'});
        const search = within(dialog).getByRole('searchbox');
        fireEvent.compositionStart(search);
        fireEvent.change(search, {target: {value: '全息信标'}});
        fireEvent.keyDown(search, {key: 'Enter'});
        expect(onSelect).not.toHaveBeenCalled();
        fireEvent.compositionEnd(search);
        fireEvent.keyDown(search, {key: 'Enter', keyCode: 229});
        expect(onSelect).not.toHaveBeenCalled();
        await user.keyboard('{Escape}');
        const trigger = screen.getByRole('button', {name: '添加需求物品：全息信标'});
        expect(trigger).toHaveFocus();
        await user.click(trigger);
        expect(screen.getByRole('searchbox')).toHaveValue('');
        expect(screen.getByRole('tab', {name: '建筑', exact: true})).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('button', {name: '选择全息信标'})).toHaveStyle({gridColumn: '10', gridRow: '4'});
        fireEvent.change(screen.getByRole('searchbox'), {target: {value: 'zzzzzzzz'}});
        expect(screen.getByText('没有找到相关物品')).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole('searchbox'), {key: 'Enter'});
        expect(onSelect).not.toHaveBeenCalled();
    });
});
