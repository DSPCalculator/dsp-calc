import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource, productionSourceNode} from '../src/production_sources.js';
import {BELT_TIERS, SORTER_TIERS, estimateLogistics, estimateThroughput} from '../src/logistics.js';
import {createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const make = (scenario = {}) => createScenario(api, scenario).state;
function sourceFor(state, item, output, config = {}) {
    return {...createProductionSource(state, item), output, ...config};
}
function recipeForFactory(state, item, factory) {
    return state.item_data[item].slice(1).findIndex(id =>
        state.game_data.factory_data[state.game_data.recipe_data[id].设施].some(entry => entry.名称 === factory)) + 1;
}

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('baseline logistics capacity references', () => {
    it.each([
        [BELT_TIERS, 6, 1], [BELT_TIERS, 12, 2], [BELT_TIERS, 30, 3],
        [SORTER_TIERS, 1.5, 1], [SORTER_TIERS, 3, 2], [SORTER_TIERS, 6, 3],
    ])('chooses the minimum tier at exact boundary %s %s', (tiers, rate, tier) => {
        const estimate = estimateThroughput(rate, tiers);
        expect(estimate.recommended).toMatchObject({tier, count: 1, capacityPerSecond: rate});
        expect(estimateThroughput(rate * (1 + 1e-12), tiers).recommended.tier).toBe(tier);
        expect(estimateThroughput(rate + 0.0001, tiers).recommended).toMatchObject(
            tier === 3 ? {tier: 3, count: 2} : {tier: tier + 1, count: 1});
    });

    it('lists parallel counts for every tier and retains the highest tier on overflow', () => {
        const belt = estimateThroughput(61, BELT_TIERS);
        expect(belt.alternatives.map(option => option.count)).toEqual([11, 6, 3]);
        expect(belt.recommended).toMatchObject({name: '极速传送带', count: 3});
        const sorter = estimateThroughput(12, SORTER_TIERS);
        expect(sorter.alternatives.map(option => option.count)).toEqual([8, 4, 2]);
        expect(sorter.recommended).toMatchObject({name: '极速分拣器', count: 2});
    });

    it('handles low and zero demand without rounding a positive flow to zero', () => {
        expect(estimateThroughput(1e-20, BELT_TIERS).recommended).toMatchObject({tier: 1, count: 1});
        expect(estimateThroughput(0, SORTER_TIERS)).toMatchObject({status: 'none', recommended: null, alternatives: []});
    });

    it.each([-1, NaN, Infinity, -Infinity, Number.MAX_VALUE])('refuses invalid or unsafe rates %s', rate => {
        expect(estimateThroughput(rate, BELT_TIERS)).toMatchObject({status: 'unavailable', recommended: null, alternatives: []});
    });

    it('does not infer pile-sorter throughput from a conditional fully upgraded maximum', () => {
        expect(SORTER_TIERS.map(tier => tier.name)).toEqual(['分拣器', '高速分拣器', '极速分拣器']);
        expect(estimateThroughput(120, SORTER_TIERS).recommended).toMatchObject({name: '极速分拣器', count: 20});
        const state = make({settings: {sorter_stack_level: 6, pile_sorter_level: 6}});
        const result = estimateLogistics(state, '铁块', {automaticOutput: 60});
        expect(result.assumptions.join('')).toContain('不将升级或集装能力计入推荐');
        expect(result.sorter.alternatives).toHaveLength(3);
    });
});

describe('item logistics estimates', () => {
    it('estimates aggregate net belt flow and single full-load building sorter separately', () => {
        const state = make();
        const result = estimateLogistics(state, '铁块', {automaticOutput: 3600});
        expect(result.totalPerSecond).toBe(60);
        expect(result.belt.recommended).toMatchObject({tier: 3, count: 2});
        expect(result.sources[0]).toMatchObject({buildings: 60, outputPerSecond: 60, perBuildingPerSecond: 1});
        expect(result.sorter.throughputPerSecond).toBe(1);
        expect(result.sorter.recommended).toMatchObject({tier: 1, count: 1});
    });

    it('does not dilute a fractional building into a slower average output', () => {
        const state = make({factories: {'电路板': '制造台 Mk.III'}});
        const result = estimateLogistics(state, '电路板', {automaticOutput: 9});
        expect(result.sources[0].buildings).toBeCloseTo(0.05);
        expect(result.sorter.throughputPerSecond).toBe(3);
        expect(result.sorter.recommended).toMatchObject({tier: 2, count: 1});
        expect(result.assumptions.join('')).toContain('不足一台');
    });

    it('keeps rates and recommendations stable between minute and second display units', () => {
        const minute = make();
        const second = make({settings: {is_time_unit_minute: false}});
        const a = estimateLogistics(minute, '铁块', {automaticOutput: 300, manualSources: [sourceFor(minute, '铁块', 120)], byproductSupply: 60});
        const b = estimateLogistics(second, '铁块', {automaticOutput: 5, manualSources: [sourceFor(second, '铁块', 2)], byproductSupply: 1});
        expect(a.totalPerSecond).toBe(8);
        expect(b.totalPerSecond).toBe(a.totalPerSecond);
        expect(b.belt).toEqual(a.belt);
        expect(b.sorter).toEqual(a.sorter);
        expect(b.sources.map(source => [source.outputPerSecond, source.perBuildingPerSecond, source.buildings])).toEqual(
            a.sources.map(source => [source.outputPerSecond, source.perBuildingPerSecond, source.buildings]));
    });

    it('uses each independent source recipe, building and proliferation for the busiest single building', () => {
        const state = make();
        const source = sourceFor(state, '电路板', 75, {building: 2, proliferator_mode: 2, proliferator_points: 4});
        const result = estimateLogistics(state, '电路板', {automaticOutput: 120, manualSources: [source]});
        expect(result.totalPerSecond).toBeCloseTo(3.25);
        expect(result.sources[0].perBuildingPerSecond).toBeCloseTo(1.5);
        expect(result.sources[1].perBuildingPerSecond).toBeCloseTo(3.75);
        expect(result.sources[1].belt.throughputPerSecond).toBeCloseTo(1.25);
        expect(result.sorter.sourceId).toBe(source.id);
        expect(result.sorter.throughputPerSecond).toBeCloseTo(3.75);
        expect(result.sorter.recommended).toMatchObject({tier: 3, count: 1});
    });

    it('uses gross target output for recycled recipes, while belt stays net', () => {
        const state = make();
        const choice = state.item_data.氢.slice(1).findIndex(id => state.game_data.recipe_data[id].原料.氢 > 0) + 1;
        const source = sourceFor(state, '氢', 60, {recipe_choice: choice, proliferator_mode: 1, proliferator_points: 4});
        const node = productionSourceNode(state, source);
        expect(node.gross_multiplier).toBeGreaterThan(1);
        const result = estimateLogistics(state, '氢', {manualSources: [source]});
        expect(result.belt.throughputPerSecond).toBe(1);
        expect(result.sorter.throughputPerSecond).toBeCloseTo(node.output_per_second * node.gross_multiplier);
        expect(result.sources[1].buildings).toBeCloseTo(1 / node.output_per_second);
    });

    it('returns no recommendation for zero output even when a recipe is not configured', () => {
        const state = make();
        state.scheme_data.item_recipe_choices.铁块 = 999;
        const result = estimateLogistics(state, '铁块');
        expect(result.totalPerSecond).toBe(0);
        expect(result.belt.status).toBe('none');
        expect(result.sorter.status).toBe('none');
        expect(result.sources[0].buildings).toBe(0);
    });

    it.each([-1, NaN, Infinity])('rejects an invalid automatic total %s', automaticOutput => {
        const result = estimateLogistics(make(), '铁块', {automaticOutput});
        expect(result.totalPerSecond).toBeNull();
        expect(result.belt.status).toBe('unavailable');
        expect(result.sorter.status).toBe('unavailable');
        expect(result.belt.recommended).toBeNull();
    });

    it.each([-1, NaN, Infinity])('rejects invalid manual and byproduct components without cancelling them against valid production %s', amount => {
        const state = make();
        for (const options of [{manualSources: [sourceFor(state, '铁块', amount)]}, {byproductSupply: amount}]) {
            const result = estimateLogistics(state, '铁块', {automaticOutput: 600, ...options});
            expect(result.totalPerSecond).toBeNull();
            expect(result.belt.status).toBe('unavailable');
            expect(result.sorter.complete).toBe(false);
        }
    });

    it('rejects aggregate numeric overflow', () => {
        const state = make({settings: {is_time_unit_minute: false}});
        const result = estimateLogistics(state, '铁块', {automaticOutput: Number.MAX_VALUE, byproductSupply: Number.MAX_VALUE});
        expect(result.totalPerSecond).toBeNull();
        expect(result.belt.status).toBe('unavailable');
    });

    it('never guesses the per-building sorter for an untraced byproduct', () => {
        const state = make();
        const only = estimateLogistics(state, '氢', {byproductSupply: 120});
        expect(only.totalPerSecond).toBe(2);
        expect(only.belt.recommended).toMatchObject({tier: 1, count: 1});
        expect(only.sorter).toMatchObject({status: 'unavailable', recommended: null, complete: false});
        expect(only.sorter.reason).toContain('未追溯');
        const mixed = estimateLogistics(state, '铁块', {automaticOutput: 60, byproductSupply: 60});
        expect(mixed.sorter).toMatchObject({status: 'ready', complete: false});
        expect(mixed.sorter.reason).toContain('仅比较已评估来源');
        expect(mixed.warnings.join('')).toContain('副产物');
    });

    it('does not mutate the production state or source results', () => {
        const state = make();
        const source = sourceFor(state, '电路板', 75, {building: 2, proliferator_mode: 2, proliferator_points: 4});
        const before = structuredClone({game: state.game_data, settings: state.settings, scheme: state.scheme_data, graph: state.item_graph, source});
        estimateLogistics(state, '电路板', {automaticOutput: 120, manualSources: [source], byproductSupply: 30});
        expect({game: state.game_data, settings: state.settings, scheme: state.scheme_data, graph: state.item_graph, source}).toEqual(before);
    });
});

describe('special factories and unverified mod data', () => {
    it('keeps mixed collider, orbital and fractionator sources separate', () => {
        const state = make();
        const manualSources = ['微型粒子对撞机', '轨道采集器', '分馏塔'].map(factory =>
            sourceFor(state, '重氢', 60, {recipe_choice: recipeForFactory(state, '重氢', factory)}));
        const result = estimateLogistics(state, '重氢', {manualSources});
        expect(result.totalPerSecond).toBe(3);
        expect(result.sources.find(source => source.factoryName === '轨道采集器').sorter.status).toBe('not-applicable');
        expect(result.sources.find(source => source.factoryName === '轨道采集器').belt.reason).toContain('带宽折算');
        expect(result.sources.find(source => source.factoryName === '分馏塔').sorter.reason).toContain('循环带');
        expect(result.sorter.sourceId).toBe(manualSources[0].id);
        expect(result.sorter.recommended).toBeTruthy();
    });

    it.each(['铁矿', '原油', '水'])('does not claim raw gathering %s needs output sorters', item => {
        const result = estimateLogistics(make(), item, {automaticOutput: 60});
        expect(result.sorter.status).toBe('not-applicable');
        expect(result.sorter.recommended).toBeNull();
    });

    it('does not claim direct ray-receiver or energy-exchanger interfaces need sorters', () => {
        const state = make();
        for (const [item, factory] of [['临界光子', '射线接收站'], ['蓄电器（满）', '能量枢纽']]) {
            const source = sourceFor(state, item, 60, {recipe_choice: recipeForFactory(state, item, factory)});
            expect(source.recipe_choice).toBeGreaterThan(0);
            const result = estimateLogistics(state, item, {manualSources: [source]});
            expect(result.sorter.status).toBe('not-applicable');
            expect(result.sources[1].sorter.reason).toContain('传送带接口');
        }
    });

    it('marks externalized production not applicable', () => {
        const state = make({settings: {mineralize_list: {'铁块': true}}});
        const result = estimateLogistics(state, '铁块', {automaticOutput: 60});
        expect(result.sources[0].buildings).toBe(0);
        expect(result.sources[0].perBuildingPerSecond).toBeNull();
        expect(result.sorter.status).toBe('not-applicable');
        expect(result.sources[0].sorter.reason).toContain('外部供给');
    });

    it('flags stacked lab interfaces rather than quietly assuming a single-lab port rate covers the stack', () => {
        const state = make({settings: {stack_research_lab: 15}});
        const result = estimateLogistics(state, '电磁矩阵', {automaticOutput: 60});
        expect(result.sorter.status).toBe('ready');
        expect(result.sorter.complete).toBe(false);
        expect(result.warnings.join('')).toContain('堆叠研究站');
    });

    it('does not assign an unrecognized factory a sorter interface', () => {
        const state = make();
        const id = state.item_data.铁块[state.scheme_data.item_recipe_choices.铁块];
        state.game_data.factory_data[state.game_data.recipe_data[id].设施][0].名称 = '未知设施';
        const result = estimateLogistics(state, '铁块', {automaticOutput: 60});
        expect(result.sorter.status).toBe('unavailable');
        expect(result.sorter.reason).toContain('接口未评估');
        expect(result.belt.status).toBe('ready');
    });

    it.each([
        'Gnimaerd.DSP.plugin.MoreMegaStructure', 'org.LoShin.GenesisBook', 'com.menglei.dsp.FractionateEverything',
    ])('keeps rates but refuses exact tiers for supported recipe-data mod %s', mod => {
        const result = estimateLogistics(make({mods: [mod]}), '铁块', {automaticOutput: 60});
        expect(result.supported).toBe(false);
        expect(result.totalPerSecond).toBe(1);
        expect(result.belt).toMatchObject({status: 'unavailable', recommended: null, alternatives: []});
        expect(result.sorter).toMatchObject({status: 'unavailable', recommended: null});
        expect(result.sources[0].perBuildingPerSecond).toBeGreaterThan(0);
        expect(result.warnings.join('')).toContain('模组');
    });

    it('also refuses unknown mod flags and names rather than falling back to vanilla', () => {
        for (const patch of [{mods: ['UnknownMod']}, {NewModEnable: true}, {game_name: 'UnverifiedData'}]) {
            const state = make();
            Object.assign(state.game_data, patch);
            const result = estimateLogistics(state, '铁块', {automaticOutput: 60});
            expect(result.supported).toBe(false);
            expect(result.belt.recommended).toBeNull();
        }
    });
});
