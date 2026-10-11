import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data, GenesisBookGUID, DarkFogSynthesisGUID} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource, synchronizeProductionSourceRates} from '../src/production_sources.js';
import {createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const route = (state, item, name = '轨道采集器') => state.item_data[item].findIndex((id, index) => index > 0
    && state.game_data.factory_data[state.game_data.recipe_data[id].设施].some(factory => factory.名称 === name));
function make({items = ['氢'], ...scenario} = {}) {
    const base = createScenario(api, scenario).state;
    const recipes = {...scenario.recipes};
    for (const item of items) recipes[item] = route(base, item);
    return createScenario(api, {...scenario, recipes, factories: {...scenario.factories,
        ...Object.fromEntries(items.map(item => [item, '轨道采集器']))}}).state;
}
function source(state, item, rate, extra = {}) {
    return {...createProductionSource(state, item), recipe_choice: route(state, item), output_per_minute: rate, ...extra};
}
function balance(details) {
    expect(details.errors).toEqual([]);
    for (const group of Object.values(details.groups)) {
        expect(group.automatic + group.allocated + group.byproduct_supply).toBeCloseTo(group.required + group.surplus, 6);
        expect(group.missing).toBeLessThan(1e-6);
    }
    const collector = details.shared_collectors[0];
    if (collector) {
        expect(details.totals.rawMaterials.氢 || 0).toBeCloseTo(collector.outputs.氢, 6);
        expect(details.totals.rawMaterials.重氢 || 0).toBeCloseTo(collector.outputs.重氢, 6);
    }
}
beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('a physical gas-giant fleet co-produces hydrogen and deuterium', () => {
    it.each([0, 24, 60, 150, 300])('balances30 fuel rods with fixed deuterium %s without expanding collectors to replace the collider', allocation => {
        const state = make();
        state.settings.production_sources = [source(state, '重氢', allocation)];
        const before = structuredClone(state.settings.production_sources);
        const [, surplus, details] = state.calculate({'氘核燃料棒': 30});
        const expectedFleet = Math.max(1.09375, allocation / 24);
        const expectedCollider = 300 - expectedFleet * 24;
        expect(details.automatic.重氢.factory_name).toBe('微型粒子对撞机');
        expect(details.automatic.重氢.output).toBeCloseTo(expectedCollider, 7);
        expect(details.automatic.氢.output).toBeCloseTo(Math.max(0, 525 - allocation * 20), 7);
        expect(details.sources[0].output).toBe(allocation);
        expect(details.sources[0].buildings).toBeCloseTo(allocation / 24, 7);
        expect(details.totals.fractionalBuildingCounts.轨道采集器).toBeCloseTo(expectedFleet, 7);
        expect(details.totals.buildingCounts.轨道采集器).toBe(Math.ceil(expectedFleet));
        expect(surplus.氢 || 0).toBeCloseTo(Math.max(0, expectedFleet * 480 + 22.5 - expectedCollider * 2), 7);
        expect(state.settings.production_sources).toEqual(before);
        balance(details);
    });

    it('uses the same coupled result without sources, after removal, and in the automatic baseline', () => {
        const state = make();
        const baseline = state.calculate({'氘核燃料棒': 30});
        expect(baseline[2].shared_collectors[0].buildings).toBeCloseTo(1.09375, 8);
        state.settings.production_sources = [source(state, '重氢', 24)];
        expect(state.calculateBaseline({'氘核燃料棒': 30})[0]).toEqual(baseline[0]);
        state.settings.production_sources = [];
        expect(state.calculate({'氘核燃料棒': 30})).toEqual(baseline);
    });

    it('uses one physical variable when both automatic items choose orbital collection', () => {
        const state = make({items: ['氢', '重氢']});
        const [, , details] = state.calculate({氢: 480, 重氢: 24});
        expect(details.shared_collectors[0]).toMatchObject({buildings: 1, building_count: 1, outputs: {氢: 480, 重氢: 24}});
        expect(details.totals.buildingCounts.轨道采集器).toBe(1);
        expect(details.automatic.氢.output).toBe(480);
        expect(details.automatic.重氢.output).toBe(0);
        balance(details);
    });

    it('lets deuterium drive the fleet when both automatic products select collectors', () => {
        const state = make({items: ['氢', '重氢']});
        const [, surplus, details] = state.calculate({氢: 480, 重氢: 48});
        expect(details.shared_collectors[0].buildings).toBe(2);
        expect(surplus.氢).toBe(480);
        balance(details);
    });

    it('pools opposite manual outputs by max capacity and same-item rows add', () => {
        const state = make({items: ['氢', '重氢']});
        state.settings.production_sources = [source(state, '氢', 480), source(state, '重氢', 24), source(state, '重氢', 12)];
        const [, , details] = state.calculate({氢: 480, 重氢: 36});
        expect(details.sources.map(line => line.output)).toEqual([480, 24, 12]);
        expect(details.sources.map(line => line.buildings)).toEqual([1, 1, 0.5]);
        expect(details.shared_collectors[0]).toMatchObject({fixed_buildings: 1.5, automatic_buildings: 0, buildings: 1.5, building_count: 2});
        expect(details.sources.reduce((sum, line) => sum + (line.byproducts.氢 || 0), 0)).toBe(240);
        expect(details.sources.reduce((sum, line) => sum + (line.byproducts.重氢 || 0), 0)).toBe(0);
        expect(details.totals.buildingCounts.轨道采集器).toBe(2);
        balance(details);
    });

    it('runs a standalone fixed fleet but pauses a bound one when there is no demand', () => {
        const state = make();
        const fixed = source(state, '重氢', 24);
        state.settings.production_sources = [fixed];
        const paused = state.calculate({})[2];
        expect(paused.paused_sources[0].id).toBe(fixed.id);
        expect(paused.shared_collectors).toEqual([]);
        state.settings.production_sources = [{...fixed, standalone: true}];
        const [, surplus, standalone] = state.calculate({});
        expect(standalone.shared_collectors[0].buildings).toBe(1);
        expect(surplus).toMatchObject({氢: 480, 重氢: 24});
        balance(standalone);
    });

    it('preserves building ownership and physical results when time units or global panels change', () => {
        const minute = make();
        minute.settings.production_sources = [source(minute, '重氢', 24, {quantity_mode: 'buildings', building_quantity: 1})];
        const a = minute.calculate({'氘核燃料棒': 30})[2];
        const second = make({settings: {is_time_unit_minute: false}});
        second.settings.production_sources = structuredClone(minute.settings.production_sources);
        const b = second.calculate({'氘核燃料棒': .5})[2];
        expect(b.shared_collectors[0].buildings).toBeCloseTo(a.shared_collectors[0].buildings, 7);
        expect(b.shared_collectors[0].outputs.氢).toBeCloseTo(a.shared_collectors[0].outputs.氢 / 60, 7);
        const faster = make({settings: {mining_speed_multiple: 2, mining_speed_hydrogen: 1.3, mining_speed_deuterium: .08}});
        faster.settings.production_sources = structuredClone(minute.settings.production_sources);
        faster.settings.production_sources = synchronizeProductionSourceRates(faster);
        expect(faster.settings.production_sources[0].output_per_minute).toBe(76.8);
        const c = faster.calculate({'氘核燃料棒': 30})[2];
        expect(c.sources[0].buildings).toBe(1);
        expect(c.shared_collectors[0].capacities).toEqual({氢: 20.8, 重氢: 1.28});
        balance(b);
        balance(c);
    });

    it('does not turn a mineralized automatic item into a physical collector', () => {
        const state = make({settings: {mineralize_list: {氢: true}}});
        state.settings.production_sources = [source(state, '重氢', 24)];
        const [, , details] = state.calculate({'氘核燃料棒': 30});
        expect(details.automatic.氢.mineralized).toBe(true);
        expect(details.automatic.氢.shared_collector_group).toBeUndefined();
        expect(details.shared_collectors[0].buildings).toBe(1);
        expect(details.automatic.重氢.output).toBe(276);
        expect(details.totals.buildingCounts.轨道采集器).toBe(1);
    });

    it('keeps an invalid allocation repairable and outside the shared pool', () => {
        const state = make();
        state.settings.production_sources = [source(state, '重氢', -24)];
        const [, , details] = state.calculate({'氘核燃料棒': 30});
        expect(details.sources[0].error).toBeTruthy();
        expect(details.sources[0].shared_collector_group).toBeUndefined();
        expect(details.shared_collectors[0].fixed_buildings).toBe(0);
        expect(details.shared_collectors[0].buildings).toBeCloseTo(1.09375, 7);
    });

    it('keeps ice giants and mod collectors separate from the known gas-giant pair', () => {
        const ice = make({items: ['可燃冰']});
        ice.settings.production_sources = [source(ice, '重氢', 24, {standalone: true})];
        const [, , details] = ice.calculate({可燃冰: 384});
        expect(details.shared_collectors[0].buildings).toBe(1);
        expect(details.totals.buildingCounts.轨道采集器).toBe(2);
        expect(details.automatic.可燃冰.shared_collector_group).toBeUndefined();
        const mod = make({mods: [GenesisBookGUID], items: ['氢', '重氢']});
        mod.settings.production_sources = [source(mod, '氦', 12, {standalone: true})];
        expect(mod.calculate({氢: 600, 重氢: 30})[2].shared_collectors).toEqual([]);
    });

    it('activates shared automatic collectors for transitive standalone-source inputs', () => {
        const state = make();
        state.settings.production_sources = [{...createProductionSource(state, '氘核燃料棒'),
            output_per_minute: 30, standalone: true}];
        const [, , details] = state.calculate({});
        expect(details.automatic.重氢.output).toBeCloseTo(273.75, 7);
        expect(details.automatic.氢.output).toBeCloseTo(525, 7);
        expect(details.shared_collectors[0].buildings).toBeCloseTo(1.09375, 7);
        balance(details);
    });

    it.each([0, .01])('does not invent hydrogen-consuming production at extreme collider cost (sink demand %s)', sinkDemand => {
        const state = make();
        state.scheme_data.cost_weight.物品额外成本.重氢 = {启用: true, 额外成本: 1e6, 与其它成本累计: false};
        const [, , details] = state.calculate({'氘核燃料棒': 30, ...(sinkDemand ? {'液氢燃料棒': sinkDemand} : {})});
        expect(details.automatic.液氢燃料棒?.output || 0).toBeCloseTo(sinkDemand, 7);
        expect(details.automatic.重氢.output).toBeGreaterThan(273);
        expect(details.shared_collectors[0].buildings).toBeLessThan(1.1);
        balance(details);
    });

    it.each([1, 2])('balances a sprayed fuel-rod product with valid collider speed mode (mode %s)', mode => {
        const state = make({proliferation: {'氘核燃料棒': {增产模式: mode, 增产点数: 4}, 重氢: {增产模式: 1, 增产点数: 4}}});
        state.settings.production_sources = [source(state, '重氢', 24)];
        const [, , details] = state.calculate({'氘核燃料棒': 30});
        expect(details.groups.重氢.required).toBeCloseTo(mode === 2 ? 240 : 300, 6);
        expect(details.automatic.重氢.proliferator_mode).toBe(1);
        expect(details.automatic.重氢.output).toBeGreaterThan(0);
        balance(details);
    });

    it('keeps physical outputs and counts invariant when manual H/D rows reorder', () => {
        const state = make({items: ['氢', '重氢']});
        const rows = [source(state, '氢', 200), source(state, '重氢', 24), source(state, '重氢', 12)];
        state.settings.production_sources = rows;
        const a = state.calculate({氢: 720, 重氢: 36})[2];
        state.settings.production_sources = [...rows].reverse();
        const b = state.calculate({氢: 720, 重氢: 36})[2];
        expect(b.totals).toEqual(a.totals);
        expect(b.groups).toEqual(a.groups);
        expect(b.shared_collectors[0].outputs).toEqual(a.shared_collectors[0].outputs);
        expect(b.sources.map(row => row.id)).toEqual(rows.map(row => row.id).reverse());
        balance(b);
    });

    it('retains negative external supply and fixed excess without adding automatic collectors', () => {
        const state = make();
        state.settings.production_sources = [source(state, '重氢', 24)];
        const [, surplus, details] = state.calculate({'氘核燃料棒': 30, 氢: -1000});
        expect(details.shared_collectors[0].buildings).toBe(1);
        expect(details.automatic.氢.output).toBe(0);
        expect(details.automatic.重氢.output).toBe(276);
        expect(surplus.氢).toBeCloseTo(950.5, 7);
        balance(details);
    });

    it('treats mineralized D as an external remainder while preserving physical D coproduct', () => {
        const state = make({items: ['氢', '重氢'], settings: {mineralize_list: {重氢: true}}});
        const [, , details] = state.calculate({氢: 480, 重氢: 300});
        expect(details.shared_collectors[0]).toMatchObject({buildings: 1, outputs: {氢: 480, 重氢: 24}});
        expect(details.automatic.重氢.mineralized).toBe(true);
        expect(details.automatic.重氢.output).toBe(276);
        expect(details.automatic.重氢.shared_collector_group).toBeUndefined();
        expect(details.errors).toEqual([]);
    });

    it('supports the vanilla-derived Dark Fog Synthesis data and preserves unrelated baselines', () => {
        const dark = make({mods: [DarkFogSynthesisGUID]});
        expect(dark.calculate({重氢: 300})[2].shared_collectors[0].buildings).toBeGreaterThan(0);
        const ordinary = make();
        expect(ordinary.calculate({铁块: 60})).toHaveLength(2);
    });
});
