import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import vanilla from '../data/Vanilla.json';
import mod from '../data/mods/DarkFogSynthesis.json';
import {DarkFogSynthesisGUID, default_game_data, get_game_data, get_mod_options, normalize_mod_list} from '../src/GameData.jsx';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource, resolveProductionSource} from '../src/production_sources.js';
import {createNeedsPlanSnapshot, decodeSavedPlan} from '../src/lib/plan-state.js';
import {estimateLogistics} from '../src/logistics.js';
import {buildDependencyView} from '../src/dependency_view.js';
import {calculateScenario, createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const mods = [DarkFogSynthesisGUID];
const game = get_game_data(mods);
// Independent transcription of the pinned FrozenContent.cs contract, not derived
// from the dataset under test. Tick quantities are converted at 60 ticks/second.
const sourceCommit = '8aeb354826c1996db230a011e9473cee329116d0';
const contracts = [
    {id: 48101, item: '能量碎片', count: 2, seconds: 2, inputs: {燃烧单元: 1, 高能石墨: 1, 玻璃: 1}, factories: ['电弧熔炉', '位面熔炉', '负熵熔炉'], speeds: [1, 2, 3]},
    {id: 48102, item: '黑雾矩阵', count: 1, seconds: 4, inputs: {晶格硅: 2, 光子合并器: 1, 电浆激发器: 1, 钛化玻璃: 1}, factories: ['矩阵研究站', '自演化研究站'], speeds: [1, 3]},
    {id: 48103, item: '硅基神经元', count: 1, seconds: 4, inputs: {微晶元件: 2, 钛合金: 2, 晶格硅: 2}},
    {id: 48104, item: '物质重组器', count: 1, seconds: 6, inputs: {位面过滤器: 1, 超级磁场环: 2, 氢: 2, 晶格硅: 2}},
    {id: 48105, item: '负熵奇点', count: 1, seconds: 8, inputs: {奇异物质: 1, 卡西米尔晶体: 2, 氘核燃料棒: 1, 晶格硅: 2}},
    {id: 48106, item: '核心素', count: 1, seconds: 10, inputs: {反物质: 2, 框架材料: 2, 超级磁场环: 2, 晶格硅: 4}},
].map(contract => ({factories: ['制造台 Mk.I', '制造台 Mk.II', '制造台 Mk.III', '重组式制造台'], speeds: [0.75, 1, 1.5, 3], ...contract}));

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('optional Dark Fog Synthesis profile', () => {
    it('appends six recipes without mutating vanilla recipes, item slots, factory ordinals or icons', () => {
        const original = structuredClone(default_game_data);
        const profile = get_game_data(mods);
        expect(profile.game_name).toBe('DarkFogSynthesis');
        expect(profile.mods).toEqual(['DarkFogSynthesis']);
        expect(mod.sourceCommit).toBe(sourceCommit);
        expect(profile.data_revision).toContain(sourceCommit);
        expect(profile.recipe_data).toHaveLength(247);
        expect(profile.recipe_data.slice(0, 241)).toEqual(original.recipe_data);
        expect(profile.recipe_ids.slice(0, 241)).toEqual(original.recipe_ids);
        expect(profile.recipe_ids.slice(241)).toEqual(contracts.map(contract => contract.id));
        expect(profile.factory_data).toEqual(original.factory_data);
        expect(profile.item_grid).toEqual(original.item_grid);
        expect(profile.item_icon_name).toEqual(original.item_icon_name);
        expect(default_game_data).toEqual(original);
        expect(get_game_data([])).toEqual(original);
        expect(vanilla.recipes).toHaveLength(241);
        const info = new GameInfo(profile);
        const legacy = new GameInfo(original);
        for (const [item, choices] of Object.entries(legacy.item_data)) expect(info.item_data[item].slice(0, choices.length)).toEqual(choices);
    });

    it.each(contracts)('preserves the source recipe and machinery for $item', contract => {
        const index = game.recipe_ids.indexOf(contract.id);
        const recipe = game.recipe_data[index];
        expect(recipe).toMatchObject({原料: contract.inputs, 产物: {[contract.item]: contract.count}, 时间: contract.seconds, 增产: 3});
        expect(game.factory_data[recipe.设施].map(factory => factory.名称)).toEqual(contract.factories);
        expect(game.factory_data[recipe.设施].map(factory => factory.倍率)).toEqual(contract.speeds);
        expect(mod.recipes.find(recipe => recipe.ID === contract.id)).toMatchObject({Handcraft: true, Proliferator: 3});
        expect(init_scheme_data(game).item_recipe_choices[contract.item]).toBe(2);
        expect(init_scheme_data(default_game_data).item_recipe_choices[contract.item]).toBe(1);
        expect(new GameInfo(game).item_data[contract.item][1]).toBe(new GameInfo(default_game_data).item_data[contract.item][1]);
    });

    it('rejects every unverified mixed profile and normalizes stale persisted selections consistently', () => {
        for (const {value} of get_mod_options().filter(option => option.value !== DarkFogSynthesisGUID)) {
            expect(() => get_game_data([value, ...mods])).toThrow('组合数据尚未核验');
            expect(normalize_mod_list([value, ...mods, value])).toEqual(mods);
        }
        expect(get_game_data(['Vanilla', ...mods])).toEqual(game);
        expect(normalize_mod_list(null)).toEqual([]);
        expect(normalize_mod_list(['unknown'])).toEqual([]);
    });
});

describe('Dark Fog Synthesis production engine', () => {
    for (const contract of contracts) {
        it.each(contract.factories.flatMap((factory, building) => [0, 1, 2].map(mode => ({factory, building, mode}))))(
            `${contract.item}: exact fixed-machine rates with $factory / proliferation mode $mode`, ({building, mode}) => {
                const {state} = createScenario(api, {mods});
                const source = {...createProductionSource(state, contract.item), quantity_mode: 'buildings', building_quantity: 1,
                    building, proliferator_mode: mode, proliferator_points: mode ? 4 : 0};
                const node = resolveProductionSource(state, source);
                const speed = contract.speeds[building] * (mode === 1 ? 2 : 1);
                const products = mode === 2 ? 1.25 : 1;
                const rate = 60 / contract.seconds * speed * contract.count * products;
                expect(node.source.output_per_minute).toBeCloseTo(rate, 10);
                expect(node.byproducts).toEqual({});
                for (const [input, amount] of Object.entries(contract.inputs)) {
                    expect(node.inputs[input] * rate).toBeCloseTo(amount * 60 / contract.seconds * speed, 10);
                }
                expect(node.energy_per_building).toBeCloseTo(node.factory.耗能 * (mode ? 2.5 : 1), 10);
                // The automatic solver and independent-source engine must agree.
                const actual = calculateScenario(api, {mods, needs: {[contract.item]: rate},
                    factories: {[contract.item]: contract.factories[building].replace(/\s/g, ' ')},
                    proliferation: {[contract.item]: {增产模式: mode, 增产点数: mode ? 4 : 0}}});
                expect(actual.production[contract.item]).toBeCloseTo(rate, 10);
                expect(actual.buildings[contract.item]).toBeCloseTo(1, 10);
            });
    }

    it('connects the lens manufacturing chain to 120 synthesized matrices and eight labs per minute', () => {
        const result = calculateScenario(api, {mods, needs: {黑雾引力透镜: 10}, factories: {黑雾引力透镜: '制造台 Mk.II'}});
        expect(result.production['黑雾矩阵']).toBeCloseTo(120, 10);
        expect(result.buildings['黑雾矩阵']).toBeCloseTo(8, 10);
        expect(result.production['光子合并器']).toBeCloseTo(120, 10);
        expect(result.buildings['黑雾引力透镜']).toBeCloseTo(1, 10);
    });

    it('synthesizes neurons with titanium alloy and no particle-broadband dependency', () => {
        const recipe = mod.recipes.find(recipe => recipe.ID === 48103);
        expect(recipe.Items).toEqual([1302, 1107, 1113]);
        expect(recipe.ItemCounts).toEqual([2, 2, 2]);
        expect(recipe.Items).not.toContain(1402);
        const result = calculateScenario(api, {mods, needs: {硅基神经元: 15}, factories: {硅基神经元: '制造台 Mk.II'}});
        expect(result.production['硅基神经元']).toBeCloseTo(15, 10);
        expect(result.production['微晶元件']).toBeCloseTo(30, 10);
        expect(result.production['钛合金']).toBeCloseTo(30, 10);
        expect(result.production['晶格硅']).toBeCloseTo(30, 10);
        expect(result.production).not.toHaveProperty('粒子宽带');
        expect(result.buildings['硅基神经元']).toBeCloseTo(1, 10);
        const {state} = createScenario(api, {mods});
        const source = resolveProductionSource(state, {...createProductionSource(state, '硅基神经元'), output_per_minute: 15});
        expect(source.inputs).toEqual({微晶元件: 2, 钛合金: 2, 晶格硅: 2});
        const needs = {硅基神经元: 15};
        const view = buildDependencyView(state, needs, state.calculate(needs));
        expect(view.items).toHaveProperty('钛合金');
        expect(view.items).not.toHaveProperty('粒子宽带');
    });

    it('feeds core element from exactly two antimatter and retains the photon receiver chain', () => {
        const result = calculateScenario(api, {mods, needs: {核心素: 6}, factories: {核心素: '制造台 Mk.II'}, recipes: {临界光子: 3}});
        expect(result.production['反物质']).toBeCloseTo(12, 10);
        expect(result.production['临界光子']).toBeCloseTo(12, 10);
        expect(result.production['黑雾引力透镜']).toBeCloseTo(0.05, 10);
        expect(result.production['黑雾矩阵']).toBeCloseTo(0.6, 10);
        expect(result.buildings['核心素']).toBeCloseTo(1, 10);
    });

    it('balances a fixed-building synthesis source with manual drops and preserves saved source identity', () => {
        const {state} = createScenario(api, {mods, settings: {mineralize_list: {}}});
        state.scheme_data.pile_sorter_level = 6;
        state.settings.production_sources = [
            {...createProductionSource(state, '黑雾矩阵'), id: 'synthesis', quantity_mode: 'buildings', building_quantity: 2},
            {...createProductionSource(state, '黑雾矩阵'), id: 'drops', recipe_choice: 1, output_per_minute: 15},
        ];
        const needs = {黑雾矩阵: 60};
        const calculation = state.calculate(needs);
        const details = calculation[2];
        expect(details.valid).toBe(true);
        expect(details.sources[0]).toMatchObject({id: 'synthesis', buildings: 2, output_per_minute: 30});
        expect(details.sources[1]).toMatchObject({id: 'drops', output_per_minute: 15});
        expect(details.automatic['黑雾矩阵'].output).toBeCloseTo(15, 10);
        expect(calculation[0]['光子合并器']).toBeCloseTo(45, 10);
        const encoded = JSON.stringify(createNeedsPlanSnapshot(needs, state.scheme_data, state.settings, game.game_name));
        const decoded = decodeSavedPlan(JSON.parse(encoded), 'needs', new GameInfo(game));
        expect(decoded.settings.production_sources).toEqual(state.settings.production_sources);
        expect(decoded.scheme_data.pile_sorter_level).toBe(6);
        const restored = new GlobalState(new GameInfo(game), decoded.scheme_data, decoded.settings);
        expect(restored.calculate(decoded.needs_list)).toEqual(calculation);
        expect(() => decodeSavedPlan(JSON.parse(encoded), 'needs', new GameInfo(default_game_data))).toThrow('不属于当前游戏版本');
        expect(() => decodeSavedPlan(init_scheme_data(default_game_data), 'strategy', new GameInfo(game))).toThrow('不匹配当前游戏版本');
        const before = structuredClone(state.scheme_data);
        expect(buildDependencyView(state, needs, calculation)).toBeTruthy();
        expect(state.scheme_data).toEqual(before);
    });

    it('keeps the ordinary and pile-sorter logistics model for the verified standalone profile only', () => {
        const {state} = createScenario(api, {mods});
        let result = estimateLogistics(state, '黑雾矩阵', {automaticOutput: 60});
        expect(result.belt.status).toBe('ready');
        expect(result.belt.alternatives.map(option => option.capacityPerSecond)).toEqual([6, 12, 30]);
        state.scheme_data.pile_sorter_level = 6;
        result = estimateLogistics(state, '黑雾矩阵', {automaticOutput: 60});
        expect(result.belt.status).toBe('ready');
        expect(result.belt.alternatives.map(option => option.capacityPerSecond)).toEqual([24, 48, 120]);
        state.game_data = {...state.game_data, UnknownModEnable: true};
        expect(estimateLogistics(state, '黑雾矩阵', {automaticOutput: 60}).belt.status).toBe('unavailable');
    });
});
