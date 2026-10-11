import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource, productionSourceNode} from '../src/production_sources.js';
import {PILE_SORTER_TIERS, pileSorterConfig, estimateLogistics, estimateThroughput} from '../src/logistics.js';
import {createNeedsPlanSnapshot, createStrategySnapshot, decodeSavedPlan} from '../src/lib/plan-state.js';
import {createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
function make(scenario = {}, enabled = true) {
    const {state} = createScenario(api, {...scenario, settings: {mineralize_list: {}, production_sources: [], ...scenario.settings}});
    delete state.scheme_data.pile_sorter_level;
    state.scheme_data.use_pile_sorter = enabled;
    return state;
}
function sourceFor(state, item, output, config = {}) {
    return {...createProductionSource(state, item), output, ...config};
}
function recipeForFactory(state, item, factory) {
    return state.item_data[item].slice(1).findIndex(id =>
        state.game_data.factory_data[state.game_data.recipe_data[id].设施].some(entry => entry.名称 === factory)) + 1;
}

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('explicit full-research pile-sorter logistics', () => {
    it.each([[24, 1], [48, 2], [120, 3]])('uses ideal four-layer belt boundaries at %s items/s', (rate, tier) => {
        const state = make({settings: {is_time_unit_minute: false}});
        const result = estimateLogistics(state, '铁块', {automaticOutput: rate});
        expect(result.belt.recommended).toMatchObject({tier, count: 1, capacityPerSecond: rate});
        expect(result.belt.alternatives.map(option => option.capacityPerSecond)).toEqual([24, 48, 120]);
        expect(result.belt.cargoPerSecond).toBe(rate / 4);
        expect(result.sources[0].belt).toMatchObject({stackHeight: 4, grossKnown: true});
        expect(estimateLogistics(state, '铁块', {automaticOutput: rate * (1 + 1e-12)}).belt.recommended.tier).toBe(tier);
        expect(estimateLogistics(state, '铁块', {automaticOutput: rate + 0.0001}).belt.recommended).toMatchObject(
            tier === 3 ? {tier: 3, count: 2} : {tier: tier + 1, count: 1});
    });

    it('uses parallel blue belts above 120, but sizes the sorter per building rather than per bus', () => {
        const state = make({settings: {is_time_unit_minute: false}});
        const result = estimateLogistics(state, '铁块', {automaticOutput: 241});
        expect(result.belt.alternatives.map(option => option.count)).toEqual([11, 6, 3]);
        expect(result.belt.recommended).toMatchObject({tier: 3, count: 3});
        expect(result.sorter).toMatchObject({throughputPerSecond: 1,
            recommended: {name: '集装分拣器', capacityPerSecond: 120, count: 1}});
        expect(result.sorter.alternatives).toHaveLength(1);
        expect(result.sources[0].buildings).toBe(241);
    });

    it('uses a 120 items/s belt-interface limit, with parallel sorters above that limit', () => {
        expect(estimateThroughput(120, PILE_SORTER_TIERS).recommended.count).toBe(1);
        expect(estimateThroughput(120.001, PILE_SORTER_TIERS).recommended.count).toBe(2);
        const state = make({settings: {is_time_unit_minute: false, acc_rate: 100},
            factories: {'电路板': '制造台 Mk.III'}, proliferation: {'电路板': {增产点数: 4, 增产模式: 1}}});
        const result = estimateLogistics(state, '电路板', {automaticOutput: 0.001});
        expect(result.sorter.throughputPerSecond).toBeGreaterThan(120);
        expect(result.sorter.recommended.count).toBe(Math.ceil(result.sorter.throughputPerSecond / 120));
        expect(result.assumptions.join('')).toContain('非分拣器内部绝对速度上限');
        expect(result.sources[0].buildings).toBeLessThan(1);
    });

    it('uses each independent source recipe, building and proliferation without averaging', () => {
        const state = make();
        const source = sourceFor(state, '电路板', 75, {building: 2, proliferator_mode: 2, proliferator_points: 4});
        const result = estimateLogistics(state, '电路板', {automaticOutput: 120, manualSources: [source]});
        expect(result.sources.map(entry => entry.perBuildingPerSecond)).toEqual([1.5, 3.75]);
        expect(result.sorter.sourceId).toBe(source.id);
        expect(result.sorter.throughputPerSecond).toBe(3.75);
        expect(result.belt.cargoPerSecond).toBeCloseTo((2 + 1.25) / 4);
    });

    it('keeps gross recirculating output for both enabled belts and full-load sorters', () => {
        const state = make();
        const recipe_choice = state.item_data.氢.slice(1).findIndex(id => state.game_data.recipe_data[id].原料.氢 > 0) + 1;
        const source = sourceFor(state, '氢', 60, {recipe_choice, proliferator_mode: 1, proliferator_points: 4});
        const node = productionSourceNode(state, source);
        const result = estimateLogistics(state, '氢', {manualSources: [source]});
        expect(node.gross_multiplier).toBeGreaterThan(1);
        expect(result.totalPerSecond).toBe(1);
        expect(result.belt.throughputPerSecond).toBe(node.gross_multiplier);
        expect(result.belt.cargoPerSecond).toBe(node.gross_multiplier / 4);
        expect(result.sorter.throughputPerSecond).toBe(node.output_per_second * node.gross_multiplier);
        state.scheme_data.use_pile_sorter = false;
        expect(estimateLogistics(state, '氢', {manualSources: [source]}).belt.throughputPerSecond).toBe(1);
    });

    it('combines mixed manufacturing, collector, fractionator and byproduct cargo without a blanket 4x multiplier', () => {
        const state = make({settings: {is_time_unit_minute: false}});
        const manualSources = ['微型粒子对撞机', '轨道采集器', '分馏塔'].map(factory =>
            sourceFor(state, '重氢', 24, {recipe_choice: recipeForFactory(state, '重氢', factory)}));
        manualSources.push(sourceFor(state, '铁块', 999)); // A different product is not part of this bus.
        const result = estimateLogistics(state, '重氢', {manualSources, byproductSupply: 24});
        expect(result.totalPerSecond).toBe(96);
        expect(result.belt.cargoPerSecond).toBe(24 / 4 + 24 + 24 + 24);
        expect(result.belt.recommended).toMatchObject({tier: 3, count: 3});
        expect(result.belt.alternatives.map(option => option.count)).toEqual([13, 7, 3]);
        expect(result.belt.recommended.capacityPerSecond).toBeCloseTo(30 * 96 / 78);
        expect(result.belt.reason).toContain('当前来源比例');
        expect(result.belt.reason).toContain('毛出料尚未核实');
        expect(result.sources.filter(source => source.outputPerSecond > 0).map(source => source.belt.stackHeight)).toEqual([4, 1, 1, 1]);
        expect(result.sorter.complete).toBe(false);
    });

    it.each(['铁矿', '原油', '水', '临界光子', '蓄电器（满）'])('never gives direct-belt source %s stacked capacity for free', item => {
        const state = make({settings: {is_time_unit_minute: false}});
        if (item === '蓄电器（满）') state.scheme_data.item_recipe_choices[item] = recipeForFactory(state, item, '能量枢纽');
        const result = estimateLogistics(state, item, {automaticOutput: 31});
        expect(result.belt.recommended).toMatchObject({tier: 3, count: 2, capacityPerSecond: 30});
        expect(result.sources[0].belt.stackHeight).toBe(1);
        expect(result.sorter.status).toBe('not-applicable');
    });

    it.each([[24, 30, 48], [18, 24, 52.5]])('keeps %s/s external supply unstacked alongside 24/s local manufacturing', (external, cargo, capacity) => {
        const state = make({settings: {is_time_unit_minute: false, mineralize_list: {'铁块': true}}});
        const result = estimateLogistics(state, '铁块', {automaticOutput: external, manualSources: [sourceFor(state, '铁块', 24)]});
        expect(result.sources[0].belt.stackHeight).toBe(1);
        expect(result.sources[0].sorter.status).toBe('not-applicable');
        expect(result.sources[1].belt.stackHeight).toBe(4);
        expect(result.belt.cargoPerSecond).toBe(cargo);
        expect(result.belt.recommended).toMatchObject({tier: 3, count: 1, capacityPerSecond: capacity});
    });

    it('retains uncertainty for stacked labs and refuses unverified mod capacities', () => {
        const labs = estimateLogistics(make({settings: {stack_research_lab: 15}}), '电磁矩阵', {automaticOutput: 60});
        expect(labs.sorter.complete).toBe(false);
        expect(labs.warnings.join('')).toContain('共用出料接口');
        const mod = estimateLogistics(make({mods: ['org.LoShin.GenesisBook']}), '铁块', {automaticOutput: 60});
        expect(mod.belt.status).toBe('unavailable');
        expect(mod.sorter.recommended).toBeNull();
    });

    it('is physically invariant under minute/second display and does not mutate sources or production results', () => {
        const minute = make();
        const second = make({settings: {is_time_unit_minute: false}});
        const a = estimateLogistics(minute, '铁块', {automaticOutput: 6000});
        const b = estimateLogistics(second, '铁块', {automaticOutput: 100});
        expect(b).toEqual(a);
        const before = structuredClone({settings: minute.settings, scheme: minute.scheme_data, graph: minute.item_graph});
        const production = minute.calculate({'电路板': 600});
        estimateLogistics(minute, '铁块', {automaticOutput: 6000});
        expect({settings: minute.settings, scheme: minute.scheme_data, graph: minute.item_graph}).toEqual(before);
        minute.scheme_data.use_pile_sorter = false;
        const off = new GlobalState(new GameInfo(minute.game_data), minute.scheme_data, minute.settings);
        expect(off.item_graph).toEqual(minute.item_graph);
        expect(off.calculate({'电路板': 600})).toEqual(production);
    });

    it.each([0, -1, NaN, Infinity, Number.MAX_VALUE])('does not invent capacity for zero or invalid flow %s', automaticOutput => {
        const result = estimateLogistics(make({settings: {is_time_unit_minute: false}}), '铁块', {automaticOutput});
        expect(result.belt.recommended).toBeNull();
        expect(result.belt.status).toBe(automaticOutput === 0 ? 'none' : 'unavailable');
    });
});

describe('pile-sorter strategy and whole-plan persistence', () => {
    it('defaults off and treats a legacy missing flag exactly like false', () => {
        const state = make({}, false);
        expect(init_scheme_data(state.game_data).pile_sorter_level).toBe(-1);
        const options = {automaticOutput: 3600};
        const explicit = estimateLogistics(state, '铁块', options);
        delete state.scheme_data.use_pile_sorter;
        expect(estimateLogistics(state, '铁块', options)).toEqual(explicit);
        for (const value of ['true', 1, {}, null]) {
            state.scheme_data.use_pile_sorter = value;
            expect(estimateLogistics(state, '铁块', options)).toEqual(explicit);
        }
    });

    it.each([false, true])('round-trips %s through strategy and complete plans without changing source quantity modes', enabled => {
        const state = make({}, enabled);
        state.settings.production_sources = [{...createProductionSource(state, '铁块', {standalone: true}),
            quantity_mode: 'buildings', building_quantity: 2, output_per_minute: 120}];
        const info = new GameInfo(state.game_data);
        const strategy = createStrategySnapshot(state.scheme_data, state.settings);
        const loadedStrategy = decodeSavedPlan(JSON.parse(JSON.stringify(strategy)), 'strategy', info);
        expect(loadedStrategy.scheme_data.use_pile_sorter).toBe(enabled);
        expect(loadedStrategy.production_sources).toEqual(state.settings.production_sources);
        const plan = createNeedsPlanSnapshot({'铁块': 600}, state.scheme_data, state.settings, state.game_data.game_name);
        const loadedPlan = decodeSavedPlan(JSON.parse(JSON.stringify(plan)), 'needs', info);
        expect(loadedPlan.scheme_data.use_pile_sorter).toBe(enabled);
        expect(loadedPlan.settings.production_sources).toEqual(state.settings.production_sources);
    });

    it('loads legacy plans and strategies with the flag absent, but rejects malformed present flags', () => {
        const state = make();
        const info = new GameInfo(state.game_data);
        state.settings.production_sources = [];
        delete state.scheme_data.use_pile_sorter;
        const strategy = createStrategySnapshot(state.scheme_data, state.settings);
        const plan = createNeedsPlanSnapshot({'铁块': 600}, state.scheme_data, state.settings, state.game_data.game_name);
        expect(decodeSavedPlan(strategy, 'strategy', info).scheme_data.use_pile_sorter).toBeUndefined();
        expect(decodeSavedPlan(plan, 'needs', info).scheme_data.use_pile_sorter).toBeUndefined();
        for (const value of ['false', 1, null]) {
            expect(() => decodeSavedPlan({...strategy, use_pile_sorter: value}, 'strategy', info)).toThrow('不匹配');
            expect(() => decodeSavedPlan({...plan, scheme_data: {...plan.scheme_data, use_pile_sorter: value}}, 'needs', info)).toThrow('不匹配');
        }
    });
});


describe('pile sorter research dropdown levels', () => {
    const levels = [
        [0, 2, 1, 13.3], [1, 2, 2, 17.1], [2, 3, 2, 18], [3, 3, 3, 22.5],
        [4, 4, 3, 21.8], [5, 4, 4, 26.7], [6, 4, 4, 120],
    ];
    it.each(levels)('uses level %s carrying, stacking and disclosed interface reference', (level, carrying, stack, capacity) => {
        const state = make({settings: {is_time_unit_minute: false}});
        state.scheme_data.pile_sorter_level = level;
        const result = estimateLogistics(state, '铁块', {automaticOutput: 120});
        expect(pileSorterConfig(level)).toMatchObject({carryingCapacity: carrying, stackHeight: stack});
        expect(result.sources[0].belt.stackHeight).toBe(stack);
        expect(result.belt.cargoPerSecond).toBe(120 / stack);
        expect(result.sorter.recommended.capacityPerSecond).toBe(capacity);
        if (level < 6) expect(result.assumptions.join('')).toContain('并非官方精确公式');
        const info = new GameInfo(state.game_data);
        const strategy = createStrategySnapshot(state.scheme_data, state.settings);
        const plan = createNeedsPlanSnapshot({'铁块': 120}, state.scheme_data, state.settings, state.game_data.game_name);
        expect(decodeSavedPlan(strategy, 'strategy', info).scheme_data.pile_sorter_level).toBe(level);
        expect(decodeSavedPlan(plan, 'needs', info).scheme_data.pile_sorter_level).toBe(level);
        expect(estimateLogistics(state, '铁矿', {automaticOutput: 120}).sources[0].belt.stackHeight).toBe(1);
    });
    it.each([true, false])('migrates legacy %s to an explicit level', enabled => {
        const state = make({}, enabled);
        const saved = createStrategySnapshot(state.scheme_data, state.settings);
        expect(decodeSavedPlan(saved, 'strategy', new GameInfo(state.game_data)).scheme_data.pile_sorter_level).toBe(enabled ? 6 : -1);
    });
    it('rejects malformed levels and makes explicit no-pile override a legacy true flag', () => {
        const state = make();
        state.scheme_data.pile_sorter_level = -1;
        expect(estimateLogistics(state, '铁块', {automaticOutput: 6000}).usePileSorter).toBeUndefined();
        const info = new GameInfo(state.game_data);
        const saved = createStrategySnapshot(state.scheme_data, state.settings);
        for (const value of [null, '2', -2, 7, 2.5, true]) {
            expect(() => decodeSavedPlan({...saved, pile_sorter_level: value}, 'strategy', info)).toThrow('不匹配');
        }
    });
});
