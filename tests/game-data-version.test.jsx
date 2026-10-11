import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {useContext, useEffect} from 'react';
import {act, cleanup, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import vanilla from '../data/Vanilla.json';
import {default_game_data, get_game_data, get_mod_options, DarkFogSynthesisGUID, vanilla_data_description, vanilla_game_version} from '../src/GameData.jsx';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {ContextProvider, GlobalStateContext, NeedsListContext, PlanLoaderContext, StorageWarningContext} from '../src/contexts.jsx';
import {decodeSavedPlan} from '../src/lib/plan-state.js';
import {buildGamePickerLayout} from '../src/lib/game-picker-layout.js';
import {isReplacedLegacyVanillaScheme, migrateSchemeForGame} from '../src/lib/game-data-migrations.js';
import {backupGameDataStorage, GAME_DATA_BACKUP_KEY, updateScopedStorage} from '../src/lib/storage.js';
import {baselineSettings, calculateScenario} from './helpers/solver-cases.js';

const baseCount = 238;
const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const legacyGame = {...default_game_data, recipe_data: default_game_data.recipe_data.slice(0, baseCount),
    recipe_ids: default_game_data.recipe_ids.slice(0, baseCount)};
const craftingGame = {...default_game_data, recipe_data: default_game_data.recipe_data.slice(0, 240),
    recipe_ids: default_game_data.recipe_ids.slice(0, 240)};
const readStore = key => JSON.parse(localStorage.getItem(key));
function oldScheme(count = baseCount) {
    const scheme = init_scheme_data({...default_game_data, recipe_data: default_game_data.recipe_data.slice(0, count),
        recipe_ids: default_game_data.recipe_ids.slice(0, count)});
    scheme.item_recipe_choices['石墨烯'] = 2;
    scheme.item_recipe_choices['临界光子'] = 2;
    const receiver = default_game_data.recipe_ids.indexOf(21208);
    scheme.scheme_for_recipe[receiver] = {建筑: 0, 增产模式: 3, 增产点数: 4};
    scheme.cost_weight['物品额外成本']['临界光子'] = {成本: 7, 启用: 1, 与其它成本累计: 1, 溢出时处理成本: 9};
    scheme.scheme_for_recipe[0] = {建筑: 1, 增产模式: 2, 增产点数: 4};
    scheme.cost_weight['电力'] = 13;
    scheme.cost_weight['物品额外成本']['铁块'] = {成本: 12, 启用: 1, 与其它成本累计: 1, 溢出时处理成本: 45};
    if (count >= 239) {
        scheme.scheme_for_recipe[238] = {建筑: 2, 增产模式: 2, 增产点数: 4};
        scheme.cost_weight['物品额外成本']['全息信标'] = {成本: 27, 启用: 1, 与其它成本累计: 1, 溢出时处理成本: 3};
    }
    if (count >= 240) {
        scheme.scheme_for_recipe[239] = {建筑: 1, 增产模式: 2, 增产点数: 2};
        scheme.cost_weight['物品额外成本']['黑雾引力透镜'] = {成本: 31, 启用: 1, 与其它成本累计: 1, 溢出时处理成本: 5};
    }
    return scheme;
}
function expectPreserved(migrated, original) {
    const count = original.scheme_for_recipe.length;
    expect(migrated.scheme_for_recipe.slice(0, count)).toEqual(original.scheme_for_recipe);
    for (const [item, choice] of Object.entries(original.item_recipe_choices)) expect(migrated.item_recipe_choices[item]).toBe(choice);
    const restored = structuredClone(migrated);
    restored.scheme_for_recipe.length = count;
    for (const item of count === 238 ? ['全息信标', '黑雾引力透镜'] : count === 239 ? ['黑雾引力透镜'] : []) {
        delete restored.item_recipe_choices[item];
        delete restored.cost_weight['物品额外成本'][item];
    }
    expect(restored).toEqual(original);
}
function Probe({observe}) {
    const state = useContext(GlobalStateContext);
    const needs = useContext(NeedsListContext);
    const load = useContext(PlanLoaderContext);
    const warning = useContext(StorageWarningContext);
    useEffect(() => observe({state, needs, load, warning}), [observe, state, needs, load, warning]);
    return null;
}
function mount() {
    let current;
    const result = render(<ContextProvider><Probe observe={value => { current = value; }}/></ContextProvider>);
    return {...result, current: () => current};
}
beforeEach(() => { localStorage.clear(); vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('verified vanilla crafting and receiver data increments', () => {
    it('preserves all 238 original recipe values and ordering from commit d531233', () => {
        // SHA-256 of JSON.stringify(original recipes), computed from the pristine Git source.
        expect(createHash('sha256').update(JSON.stringify(vanilla.recipes.slice(0, baseCount))).digest('hex'))
            .toBe('c8143f0b621fd4d293afeef55d11d1ffd7b53c3ac156833de4ad9883eb454759');
        expect(createHash('sha256').update(JSON.stringify(vanilla.recipes.slice(0, 239))).digest('hex'))
            .toBe('e94e1821f7ec342181c5c139e17de8beb20a2c2099a90fc12759bf711fbe9317');
        expect(createHash('sha256').update(JSON.stringify(vanilla.items.slice(0, 175))).digest('hex'))
            .toBe('2ba74cc5eb83bbfbff344e44318bdbabb977505cb6deafbec5146d7416abc846');
        expect(createHash('sha256').update(JSON.stringify(vanilla.recipes.slice(0, 240))).digest('hex'))
            .toBe('17c07d13c6a8b97191f6357994f8a35ce0f3982629ad8490f25fb8625f201c2f');
        expect(vanilla.recipes).toHaveLength(241);
        expect(vanilla.items).toHaveLength(176);
        const legacyInfo = new GameInfo(craftingGame);
        const info = new GameInfo(default_game_data);
        for (const [item, recipes] of Object.entries(legacyInfo.item_data)) {
            expect(info.item_data[item].slice(0, recipes.length)).toEqual(recipes);
            if (item !== '临界光子') expect(info.item_data[item]).toEqual(recipes);
        }
        expect(info.item_data['临界光子']).toEqual([...legacyInfo.item_data['临界光子'], 240]);
        expect(init_scheme_data(default_game_data).item_recipe_choices['临界光子']).toBe(1);
        expect(default_game_data.factory_data).toEqual(legacyGame.factory_data);
    });

    it('appends the pinned exporter recipe with correct quantities, ticks, factories and proliferation', () => {
        expect(vanilla.recipes[238]).toEqual({ID: 161, Type: 4, Factories: [2303, 2304, 2305, 2318], Name: '全息信标',
            Items: [1101, 1111, 1401, 1301], ItemCounts: [3, 4, 2, 2], Results: [2401], ResultCounts: [1],
            TimeSpend: 240, Proliferator: 3, IconName: 'lighthouse'});
        expect(default_game_data.recipe_data[238]).toMatchObject({原料: {铁块: 3, 棱镜: 4, 电浆激发器: 2, 电路板: 2},
            产物: {全息信标: 1}, 时间: 4, 增产: 3});
    });

    it.each([['制造台 Mk.I', 4 / 3], ['制造台 Mk.II', 1], ['制造台 Mk.III', 2 / 3], ['重组式制造台', 1 / 3]])('calculates 15/min with %s and correct full-load building count', (factory, count) => {
        const result = calculateScenario(api, {needs: {全息信标: 15}, factories: {全息信标: factory}});
        expect(result.production['全息信标']).toBe(15);
        expect(result.buildings['全息信标']).toBeCloseTo(count, 10);
    });

    it.each([[2, 0.8], [1, 0.5]])('uses mode %s without altering the verified recipe', (mode, count) => {
        const result = calculateScenario(api, {needs: {全息信标: 15}, factories: {全息信标: '制造台 Mk.II'},
            proliferation: {全息信标: {增产模式: mode, 增产点数: 4}}});
        expect(result.buildings['全息信标']).toBeCloseTo(count, 10);
        expect(default_game_data.recipe_data[238].原料).toEqual({铁块: 3, 棱镜: 4, 电浆激发器: 2, 电路板: 2});
    });

    it('places Beacon and both shifted buildings in distinct original game slots', () => {
        const layout = buildGamePickerLayout(new GameInfo(default_game_data));
        const buildings = layout.pages.find(page => page.id === '2');
        expect(buildings.slots.get('4:10').item).toBe('全息信标');
        expect(buildings.slots.get('4:11').item).toBe('电磁轨道弹射器');
        expect(buildings.slots.get('4:12').item).toBe('垂直发射井');
        expect(new Set(layout.names).size).toBe(layout.names.length);
        const icon = readFileSync('icon/Vanilla/lighthouse.png');
        expect(icon.readUInt32BE(16)).toBe(80);
        expect(icon.readUInt32BE(20)).toBe(80);
    });

    it('does not claim 0.10.35 support or add the item to old mod profiles', () => {
        expect(vanilla_game_version).toBe('0.10.31.24710');
        expect(vanilla_data_description).toContain('仅原版追加已核验的 v0.10.34 全息信标');
        expect(vanilla_data_description).toContain('尚未完整适配 v0.10.35');
        expect(vanilla_data_description).toContain('v0.10.35 黑雾引力透镜制造配方');
        expect(vanilla_data_description).toContain('黑雾透镜稳态光子接收');
        expect(vanilla_data_description).toContain('至少 20 分钟');
        expect(vanilla_data_description).toContain('未模拟启动、断续接收、戴森功率与损耗');
        for (const {value} of get_mod_options().filter(option => option.value !== DarkFogSynthesisGUID)) {
            // Void's bundled profile includes MoreMegaStructure, as required by the selector.
            const mods = value === 'com.ckcz123.DSP_Battle' ? ['Gnimaerd.DSP.plugin.MoreMegaStructure', value] : [value];
            expect(new GameInfo(get_game_data(mods)).item_data['全息信标']).toBeUndefined();
            expect(new GameInfo(get_game_data(mods)).item_data['黑雾引力透镜']).toBeUndefined();
        }
    });

    it('preserves Dark Fog Lens crafting with corroborated quantities, time and assembler family', () => {
        expect(vanilla.recipes[239]).toEqual({ID: 162, Type: 4, Factories: [2303, 2304, 2305, 2318],
            Name: '黑雾引力透镜', Items: [1209, 5201], ItemCounts: [1, 12], Results: [1211], ResultCounts: [1],
            TimeSpend: 360, Proliferator: 3, IconName: 'darkfog-lens'});
        expect(default_game_data.recipe_data[239]).toMatchObject({原料: {引力透镜: 1, 黑雾矩阵: 12},
            产物: {黑雾引力透镜: 1}, 时间: 6, 增产: 3});
        expect(vanilla.recipes.filter(recipe => recipe.Items.includes(1211)).map(recipe => recipe.ID)).toEqual([31208]);
        expect(vanilla.recipes.find(recipe => recipe.ID === 15201)).toMatchObject({Items: [], Results: [5201],
            ResultCounts: [1], TimeSpend: 60, Proliferator: 0, Factories: [1]});
    });

    it.each([['制造台 Mk.I', 4 / 3], ['制造台 Mk.II', 1], ['制造台 Mk.III', 2 / 3], ['重组式制造台', 1 / 3]])(
        'crafts 10 Dark Fog Lenses/min with %s and the existing matrix-drop supply', (factory, count) => {
            const result = calculateScenario(api, {needs: {黑雾引力透镜: 10}, factories: {黑雾引力透镜: factory}});
            expect(result.production['黑雾引力透镜']).toBe(10);
            expect(result.production['引力透镜']).toBe(10);
            expect(result.production['黑雾矩阵']).toBe(120);
            expect(result.buildings['黑雾引力透镜']).toBeCloseTo(count, 10);
        });

    it.each([[2, 0.8, 8, 96], [1, 0.5, 10, 120]])(
        'applies lens crafting proliferation mode %s to machines and material demand', (mode, count, lenses, matrices) => {
            const result = calculateScenario(api, {needs: {黑雾引力透镜: 10}, factories: {黑雾引力透镜: '制造台 Mk.II'},
                proliferation: {黑雾引力透镜: {增产模式: mode, 增产点数: 4}}});
            expect(result.production['黑雾引力透镜']).toBe(10);
            expect(result.production['引力透镜']).toBe(lenses);
            expect(result.production['黑雾矩阵']).toBe(matrices);
            expect(result.buildings['黑雾引力透镜']).toBeCloseTo(count, 10);
        });

    it('uses the verified crafting position for the lens without changing its original exported item slot', () => {
        expect(vanilla.items.find(item => item.ID === 1211)).toEqual({ID: 1211, Type: 3, Name: '黑雾引力透镜',
            GridIndex: null, IconName: 'darkfog-lens'});
        const layout = buildGamePickerLayout(new GameInfo(default_game_data));
        expect(layout.pages.find(page => page.id === '1').slots.get('6:6')).toMatchObject({item: '黑雾引力透镜', recipeId: 162});
        expect(layout.names.filter(item => item === '黑雾引力透镜')).toHaveLength(1);
        const icon = readFileSync('icon/Vanilla/darkfog-lens.png');
        expect(icon.readUInt32BE(16)).toBe(80);
        expect(icon.readUInt32BE(20)).toBe(80);
    });
});

describe('append-only strategy and plan migration', () => {
    it.each([238, 239, 240])('migrates %s recipes without changing prior choices/costs or mutating input', count => {
        const old = oldScheme(count);
        const before = structuredClone(old);
        const migrated = migrateSchemeForGame(old, default_game_data);
        expectPreserved(migrated, old);
        expect(old).toEqual(before);
        expect(migrated.scheme_for_recipe).toHaveLength(241);
        expect(migrated.scheme_for_recipe[240]).toEqual({建筑: 0, 增产点数: 0, 增产模式: 0});
        if (count < 240) expect(migrated.scheme_for_recipe[239]).toEqual({建筑: 0, 增产点数: 0, 增产模式: 0});
        if (count === 238) expect(migrated.scheme_for_recipe[238]).toEqual({建筑: 0, 增产点数: 0, 增产模式: 0});
        expect(migrated.item_recipe_choices['全息信标']).toBe(1);
        expect(migrated.item_recipe_choices['黑雾引力透镜']).toBe(1);
        expect(isReplacedLegacyVanillaScheme(old, migrated)).toBe(true);
        expect(migrateSchemeForGame(migrated, default_game_data)).toBe(migrated);
    });

    it.each([238, 239, 240].flatMap(count => [1, 2].map(choice => [count, choice])))(
        'keeps critical-photon choice %s / %s through migration instead of selecting the new alternative', (count, choice) => {
            const old = oldScheme(count);
            old.item_recipe_choices['临界光子'] = choice;
            const migrated = decodeSavedPlan(old, 'scheme', new GameInfo(default_game_data));
            expectPreserved(migrated.scheme_data, old);
            expect(migrated.scheme_data.item_recipe_choices['临界光子']).toBe(choice);
        });

    it('retains an already-current scheme using the new receiver without migrating it again', () => {
        const current = init_scheme_data(default_game_data);
        current.item_recipe_choices['临界光子'] = 3;
        current.scheme_for_recipe[240] = {建筑: 0, 增产模式: 3, 增产点数: 4};
        expect(migrateSchemeForGame(current, default_game_data)).toBe(current);
        expect(decodeSavedPlan(current, 'scheme', new GameInfo(default_game_data)).scheme_data).toEqual(current);
        expect(isReplacedLegacyVanillaScheme(current, current)).toBe(false);
    });

    it.each([238, 239, 240])('refuses foreign scopes or changed append identities when migrating %s recipes', count => {
        const old = oldScheme(count);
        for (const game of [{...default_game_data, game_name: 'GenesisBook'}, {...default_game_data, data_revision: 'future'},
            ...[238, 239, 240].map(changed => ({...default_game_data,
                recipe_ids: default_game_data.recipe_ids.map((id, index) => index === changed ? 999 : id)}))]) {
            expect(migrateSchemeForGame(old, game)).toBe(old);
        }
        old.scheme_for_recipe.length = 237;
        expect(() => decodeSavedPlan(old, 'scheme', new GameInfo(default_game_data))).toThrow('不匹配');
    });

    it.each([238, 239, 240])('restores a %s-recipe autosave, archives exact raw bytes and preserves another game across reload', count => {
        const original = oldScheme(count);
        const raw = JSON.stringify({Vanilla: original, AnotherGame: {leave: 'alone'}}, null, 2);
        localStorage.setItem('auto_scheme', raw);
        const sources = [{id: 'old-fixed-receiver', target_item: '临界光子', standalone: true,
            quantity_mode: 'buildings', building_quantity: 2.125, output_per_minute: 38.25,
            recipe_choice: 2, building: 0, proliferator_mode: 3, proliferator_points: 2}];
        localStorage.setItem('auto_settings', JSON.stringify({production_sources: sources}));
        let app = mount();
        expect(app.current().state.settings.production_sources).toEqual(sources);
        expectPreserved(readStore('auto_scheme').Vanilla, original);
        expect(readStore(GAME_DATA_BACKUP_KEY).auto_scheme).toEqual([raw]);
        expect(readStore('auto_scheme').AnotherGame).toEqual({leave: 'alone'});
        app.unmount();
        app = mount();
        expectPreserved(readStore('auto_scheme').Vanilla, original);
        expect(readStore(GAME_DATA_BACKUP_KEY).auto_scheme).toEqual([raw]);
        expect(app.current().warning).toBe('');
        expect(readStore('auto_settings').production_sources).toEqual(sources);
    });

    it.each([238, 239, 240].flatMap(count => ['scheme', 'needs'].map(kind => [count, kind])))(
        'restores a %s-recipe named %s with source identities and recoverable original content', (count, kind) => {
        const original = oldScheme(count);
        const target = count === 240 ? '黑雾引力透镜' : count === 239 ? '全息信标' : '铁块';
        const sources = [{id: 'saved-source', target_item: target, standalone: kind === 'scheme',
            ...(kind === 'needs' ? {scope: 'plan'} : {}), output_per_minute: 10,
            recipe_choice: 1, building: 0, proliferator_mode: 0, proliferator_points: 0},
        {id: 'ordinary-receiver', target_item: '临界光子', standalone: kind === 'scheme',
            ...(kind === 'needs' ? {scope: 'plan'} : {}), quantity_mode: 'buildings', building_quantity: 2.125,
            output_per_minute: 38.25, recipe_choice: 2, building: 0, proliferator_mode: 3, proliferator_points: 2}];
        const saved = kind === 'scheme' ? {...original, production_sources: sources} : {
            plan_version: 1, game_name: 'Vanilla', needs_list: {铁块: 60}, scheme_data: original,
            settings: {...baselineSettings, mineralize_list: {}, production_sources: sources},
        };
        const key = kind === 'scheme' ? 'scheme_data' : 'needs_list';
        const raw = JSON.stringify({Vanilla: {legacy: saved}}, null, 2);
        localStorage.setItem(key, raw);
        const app = mount();
        act(() => app.current().load(saved, kind));
        expectPreserved(readStore('auto_scheme').Vanilla, original);
        expect(app.current().state.settings.production_sources).toEqual(sources);
        expect(app.current().state.item_data[target][1]).toBe(count === 240 ? 239 : count === 239 ? 238 : 0);
        if (kind === 'needs') {
            expect(app.current().needs).toEqual({铁块: 60});
            expect(readStore('auto_settings').production_sources).toEqual([]);
        }
        expect(localStorage.getItem(key)).toBe(raw);
        expect(localStorage.getItem(GAME_DATA_BACKUP_KEY)).toBeNull();
        act(() => app.current().load(saved, kind));
        expect(localStorage.getItem(GAME_DATA_BACKUP_KEY)).toBeNull();
        // Only an explicit overwrite now needs the recovery archive.
        const replacement = kind === 'scheme' ? {...app.current().state.scheme_data, production_sources: sources}
            : {...saved, scheme_data: app.current().state.scheme_data};
        updateScopedStorage(key, 'Vanilla', current => ({...current, legacy: replacement}));
        expect(readStore(GAME_DATA_BACKUP_KEY)[key]).toEqual([raw]);
        expect(readStore(key).Vanilla.legacy).toEqual(replacement);
    });

    it('rejects corrupt old plans before migration changes the active state or archives them', () => {
        const original = oldScheme();
        original.item_recipe_choices['铁块'] = 999;
        const app = mount();
        const before = localStorage.getItem('auto_scheme');
        expect(() => app.current().load(original, 'scheme')).toThrow('不匹配');
        expect(localStorage.getItem('auto_scheme')).toBe(before);
        expect(localStorage.getItem(GAME_DATA_BACKUP_KEY)).toBeNull();
    });

    it.each([238, 239, 240])('does not overwrite a %s-recipe autosave when its recovery archive cannot be written', count => {
        const raw = JSON.stringify({Vanilla: oldScheme(count)});
        localStorage.setItem('auto_scheme', raw);
        const set = Storage.prototype.setItem;
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === GAME_DATA_BACKUP_KEY) throw new Error('quota');
            return set.call(this, key, value);
        });
        const app = mount();
        expect(localStorage.getItem('auto_scheme')).toBe(raw);
        expect(app.current().state.scheme_data.scheme_for_recipe).toHaveLength(241);
        expect(app.current().warning).toContain('原始保存数据未被修改');
    });

    it.each([238, 239, 240])('loads a %s-recipe preset without a backup, but refuses overwrite when archival fails', count => {
        const saved = oldScheme(count);
        const raw = JSON.stringify({Vanilla: {legacy: saved}});
        localStorage.setItem('scheme_data', raw);
        localStorage.setItem(GAME_DATA_BACKUP_KEY, '{unreadable');
        const app = mount();
        act(() => app.current().load(saved, 'scheme'));
        expectPreserved(app.current().state.scheme_data, saved);
        expect(localStorage.getItem('scheme_data')).toBe(raw);
        expect(() => updateScopedStorage('scheme_data', 'Vanilla', current =>
            ({...current, legacy: app.current().state.scheme_data}))).toThrow('备份无法读取');
        expect(localStorage.getItem('scheme_data')).toBe(raw);
        expect(localStorage.getItem(GAME_DATA_BACKUP_KEY)).toBe('{unreadable');
    });

    it.each([238, 239, 240])('does not reinterpret a %s-recipe save with conflicting increment fields', count => {
        const conflicts = [
            saved => { if (count < 240) saved.item_recipe_choices['黑雾引力透镜'] = 1;
                else delete saved.item_recipe_choices['黑雾引力透镜']; },
            saved => { if (count < 240) saved.cost_weight['物品额外成本']['黑雾引力透镜'] = {};
                else delete saved.cost_weight['物品额外成本']['黑雾引力透镜']; },
            saved => { saved.item_recipe_choices['临界光子'] = 3; },
            saved => { if (count === 238) saved.item_recipe_choices['全息信标'] = 1;
                else delete saved.item_recipe_choices['全息信标']; },
        ];
        for (const change of conflicts) {
            const saved = oldScheme(count);
            change(saved);
            expect(migrateSchemeForGame(saved, default_game_data)).toBe(saved);
            expect(isReplacedLegacyVanillaScheme(saved, init_scheme_data(default_game_data))).toBe(false);
        }
    });

    it('preserves unknown autosave revisions instead of automatically resetting their data', () => {
        const invalid = oldScheme();
        invalid.scheme_for_recipe.length = 20;
        const raw = JSON.stringify({Vanilla: invalid});
        localStorage.setItem('auto_scheme', raw);
        const app = mount();
        expect(localStorage.getItem('auto_scheme')).toBe(raw);
        expect(app.current().warning).toContain('原始保存数据未被修改');
    });

    it('retains multiple distinct raw archives without duplicating repeated snapshots', () => {
        for (const raw of ['{ "first": 1 }', '{ "first": 2 }', '{ "first": 1 }']) {
            localStorage.setItem('auto_scheme', raw);
            backupGameDataStorage('auto_scheme');
        }
        expect(readStore(GAME_DATA_BACKUP_KEY).auto_scheme).toEqual(['{ "first": 1 }', '{ "first": 2 }']);
    });
});
