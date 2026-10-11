import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource, fromDisplayRate, migrateLegacyProductionSources, productionSourceNode, toDisplayRate, isItemRequired} from '../src/production_sources.js';
import {createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const make = (scenario = {}) => createScenario(api, scenario).state;
const withSources = (state, sources) => new GlobalState({game_data: state.game_data, item_data: structuredClone(state.item_data)}, state.scheme_data, {...state.settings, production_sources: sources});
const sourceFor = (state, item, amount, recipeChoice = state.scheme_data.item_recipe_choices[item], overrides = {}) => ({...createProductionSource(state, item), output_per_minute: amount, recipe_choice: recipeChoice, ...overrides});
function balances(details) {
    for (const [item, group] of Object.entries(details.groups)) {
        expect(group.automatic + group.allocated + group.byproduct_supply, item).toBeCloseTo(group.required + group.surplus, 6);
        expect(group.missing, item).toBeLessThan(1e-6);
    }
}

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('source activation follows current targets', () => {
    it('pauses saved bound sources with no targets without deleting or running them', () => {
        const base = make();
        const saved = sourceFor(base, '重氢', 150);
        delete saved.standalone; // Untagged records from previous saved versions.
        const state = withSources(base, [saved]);
        const before = structuredClone(state.settings.production_sources);
        const [auto, surplus, details] = state.calculate({});
        expect([auto, surplus]).toEqual(base.calculate({}));
        expect(details.sources).toEqual([]);
        expect(details.paused_sources).toEqual([{...saved, standalone: false}]);
        expect(details.totals.buildingCounts).toEqual({});
        expect(details.totals.rawMaterials).toEqual({});
        expect(details.totals.totalEnergyCost).toBe(0);
        expect(state.settings.production_sources).toEqual(before);
    });

    it('reactivates the same allocation when its parent target returns', () => {
        const base = make();
        const state = withSources(base, [sourceFor(base, '重氢', 150)]);
        expect(state.calculate({})[2].paused_sources).toHaveLength(1);
        const [auto, , details] = state.calculate({'引力矩阵': 60});
        expect(details.paused_sources).toEqual([]);
        expect(details.sources).toHaveLength(1);
        expect(auto.重氢).toBeCloseTo(150, 7);
        expect(details.groups.重氢.required).toBeCloseTo(300, 7);
        expect(details.groups.重氢.allocated).toBeCloseTo(150, 7);
        balances(details);
    });

    it('runs an explicitly standalone source with no targets', () => {
        const base = make();
        const source = {...createProductionSource(base, '重氢', {standalone: true}), output_per_minute: 150};
        const [, surplus, details] = withSources(base, [source]).calculate({});
        expect(details.paused_sources).toEqual([]);
        expect(details.sources[0].output).toBeCloseTo(150, 7);
        expect(details.sources[0].inputs.氢).toBeCloseTo(300, 7);
        expect(surplus.重氢).toBeCloseTo(150, 7);
        expect(details.totals.totalEnergyCost).toBeGreaterThan(0);
        balances(details);
    });

    it('does not activate a bound source for an unrelated target or a zero LP key', () => {
        const base = make();
        const source = sourceFor(base, '重氢', 150);
        const [auto, surplus, details] = withSources(base, [source]).calculate({'铁块': 60});
        expect([auto, surplus]).toEqual(base.calculate({'铁块': 60}));
        expect(details.sources).toEqual([]);
        expect(details.paused_sources[0].id).toBe(source.id);
        expect(isItemRequired(base, {}, '氢')).toBe(false);
        expect(isItemRequired(base, {'铁块': 60}, '重氢')).toBe(false);
        expect(isItemRequired(base, {'引力矩阵': 60}, '重氢')).toBe(true);
    });

    it('keeps a bound source active when coproducts cover its downstream demand', () => {
        const base = make();
        const needs = {'反物质': 60, '重氢': 30};
        expect(base.calculate(needs)[0].氢).toBe(0);
        expect(isItemRequired(base, needs, '氢')).toBe(true);
        const [, , details] = withSources(base, [sourceFor(base, '氢', 30)]).calculate(needs);
        expect(details.sources).toHaveLength(1);
        expect(details.paused_sources).toEqual([]);
        expect(details.groups.氢.required).toBeGreaterThan(0);
        balances(details);
    });

    it('shows invalid source errors even when their target is no longer needed', () => {
        const base = make();
        const source = {...sourceFor(base, '重氢', 150), recipe_choice: 999};
        const [, , details] = withSources(base, [source]).calculate({});
        expect(details.sources[0].error).toBeTruthy();
        expect(details.sources[0].output).toBe(0);
        expect(details.paused_sources).toEqual([]);
    });

    it('does not infer standalone intent from migrated fixed-building lines', () => {
        const base = make();
        const source = migrateLegacyProductionSources(base, [{目标物品: '重氢', 配方id: 1, 建筑: 0, 建筑数量: 2, 增产点数: 0, 增产模式: 0}])[0];
        expect(source.standalone).toBe(false);
        const [, , details] = withSources(base, [source]).calculate({});
        expect(details.sources).toEqual([]);
        expect(details.paused_sources[0].output_per_minute).toBe(240);
        expect(withSources(base, [{...source, standalone: true}]).calculate({})[2].sources[0].output).toBe(240);
    });
});

describe('independent production allocations', () => {
    it('starts a source at zero without changing the numerical result', () => {
        const state = make();
        const source = createProductionSource(state, '重氢');
        expect(source.output_per_minute).toBe(0);
        const baseline = state.calculate({'引力矩阵': 60});
        const actual = withSources(state, [source]).calculate({'引力矩阵': 60});
        expect(actual.slice(0, 2)).toEqual(baseline);
        expect(actual[2].sources[0].buildings).toBe(0);
        expect(actual[2].order.indexOf('重氢')).toBe(Object.keys(baseline[0]).indexOf('重氢'));
    });

    it('allocates 150 of a standalone 300 demand and balances exactly 150 automatically', () => {
        const state = make();
        const [auto, surplus, detail] = withSources(state, [sourceFor(state, '重氢', 150)]).calculate({'重氢': 300});
        expect(auto.重氢).toBeCloseTo(150, 7);
        expect(detail.groups.重氢).toMatchObject({required: 300, allocated: 150, automatic: 150, surplus: 0});
        expect(surplus.重氢).toBeUndefined();
        balances(detail);
    });

    it('splits gravity matrix intermediates among orbital, fractionating and collider sources', () => {
        const state = make();
        const choices = state.item_data.重氢.slice(1).map((id, index) => ({choice: index + 1, facility: state.game_data.recipe_data[id].设施}));
        const lines = choices.map(({choice}) => sourceFor(state, '重氢', 50, choice));
        const [, , detail] = withSources(state, lines).calculate({'引力矩阵': 60});
        expect(detail.errors).toEqual([]);
        expect(detail.sources.every(line => !line.error)).toBe(true);
        expect(detail.groups.重氢.required).toBeCloseTo(300, 7);
        expect(detail.groups.重氢.allocated).toBeCloseTo(150, 7);
        expect(detail.groups.重氢.automatic).toBeCloseTo(150, 7);
        expect(new Set(detail.sources.map(line => line.factory_name)).size).toBe(3);
        expect(detail.sources.find(line => line.factory_name === '轨道采集器').inputs).toEqual({});
        expect(detail.sources.find(line => line.factory_name === '分馏塔').inputs.氢).toBeCloseTo(50, 7);
        expect(detail.sources.find(line => line.factory_name === '微型粒子对撞机').inputs.氢).toBeCloseTo(100, 7);
        balances(detail);
    });

    it('keeps a zero automatic source, reports over-allocation, and restores it on removal', () => {
        const state = make();
        const line = sourceFor(state, '重氢', 400);
        const [auto, surplus, detail] = withSources(state, [line]).calculate({'重氢': 300});
        expect(auto.重氢).toBe(0);
        expect(surplus.重氢).toBeCloseTo(100, 7);
        expect(detail.groups.重氢.required).toBe(300);
        expect(detail.groups.重氢.surplus).toBeCloseTo(100, 7);
        expect(withSources(state, []).calculate({'重氢': 300})).toEqual(state.calculate({'重氢': 300}));
        balances(detail);
    });

    it('supports multiple allocations on final products and sums buildings and power once', () => {
        const state = make();
        const lines = [sourceFor(state, '铁块', 30), sourceFor(state, '铁块', 30)];
        const [auto, , detail] = withSources(state, lines).calculate({'铁块': 120});
        expect(auto.铁块).toBeCloseTo(60, 7);
        expect(auto.铁矿).toBeCloseTo(120, 7);
        expect(detail.totals.rawMaterials.铁矿).toBeCloseTo(120, 7);
        expect(detail.sources[0].buildings).toBeCloseTo(0.5, 7);
        expect(detail.totals.fractionalBuildingCounts['电弧熔炉']).toBeCloseTo(2, 7);
        expect(detail.totals.buildingCounts['电弧熔炉']).toBe(3);
        expect(detail.totals.energyCost).toBeCloseTo(detail.automatic.铁块.energy_mw + detail.sources.reduce((sum, line) => sum + line.energy_mw, 0), 7);
        balances(detail);
    });

    it('preserves physical allocation, building count, and power in per-second mode', () => {
        const minute = make();
        const source = sourceFor(minute, '重氢', 150);
        const second = make({settings: {is_time_unit_minute: false}});
        const a = withSources(minute, [source]).calculate({'重氢': 300})[2];
        const b = withSources(second, [source]).calculate({'重氢': 5})[2];
        expect(b.sources[0].output).toBeCloseTo(2.5, 7);
        expect(b.sources[0].buildings).toBeCloseTo(a.sources[0].buildings, 7);
        expect(b.sources[0].energy_mw).toBeCloseTo(a.sources[0].energy_mw, 7);
        expect(b.totals.totalEnergyCost).toBeCloseTo(a.totals.totalEnergyCost, 7);
        expect(toDisplayRate(150, second.settings)).toBe(2.5);
        expect(fromDisplayRate(2.5, second.settings)).toBe(150);
        balances(b);
    });

    it('keeps independent building and proliferation settings with exact material costs', () => {
        const state = make();
        const source = sourceFor(state, '电路板', 75, 1, {building: 2, proliferator_mode: 2, proliferator_points: 4});
        const [, , detail] = withSources(state, [source]).calculate({'电路板': 120});
        const line = detail.sources[0];
        expect(line.inputs.铁块).toBeCloseTo(60, 7);
        expect(line.inputs.铜块).toBeCloseTo(30, 7);
        expect(line.inputs['增产剂 Mk.III']).toBeGreaterThan(0);
        expect(line.factory_name).toBe('制造台 Mk.III');
        expect(line.buildings).toBeCloseTo(75 / (60 * 2 * 1.25 * 1.5), 7);
        expect(detail.automatic.电路板.proliferator_mode).toBe(0);
        expect(detail.automatic.电路板.factory_name).toBe('制造台 Mk.I');
        balances(detail);
    });

    it('converts legacy fixed buildings using actual mining and fractionating settings', () => {
        const state = make({settings: {mining_speed_multiple: 2, fractionating_speed: 60}});
        const records = state.item_data.重氢.slice(1).map((_, index) => ({目标物品: '重氢', 配方id: index + 1, 建筑: 0, 建筑数量: 2, 增产点数: 0, 增产模式: 0}));
        const migrated = migrateLegacyProductionSources(state, records);
        expect(migrated).toHaveLength(3);
        for (const source of migrated) {
            const node = productionSourceNode(state, source);
            expect(source.output_per_minute / 60 / node.output_per_second).toBeCloseTo(2, 7);
        }
        expect(migrateLegacyProductionSources(state, records)).toEqual(migrated);
        const broken = migrateLegacyProductionSources(state, [{目标物品: 'missing', 建筑数量: 2}]);
        expect(broken[0].migration_error).toBeTruthy();
        expect(broken[0].output_per_minute).toBe(0);
    });

    it('reports invalid allocations without contaminating the calculation', () => {
        const state = make();
        for (const amount of [-1, Infinity, NaN]) {
            const result = withSources(state, [sourceFor(state, '铁块', amount)]).calculate({'铁块': 60});
            expect(result[2].sources[0].error).toBeTruthy();
            expect(result[0].铁块).toBeCloseTo(60, 7);
            expect(Object.values(result[2].totals.rawMaterials).every(Number.isFinite)).toBe(true);
        }
    });

    it('balances manual byproducts, self-recycling and proliferation without double counting', () => {
        const state = make();
        const choice = state.item_data.氢.slice(1).findIndex(id => state.game_data.recipe_data[id].原料.氢 > 0) + 1;
        expect(choice).toBeGreaterThan(0);
        const source = sourceFor(state, '氢', 70, choice, {proliferator_mode: 1, proliferator_points: 4});
        const [, , detail] = withSources(state, [source]).calculate({'氢': 100, '高能石墨': 20});
        const line = detail.sources[0];
        const recipe = state.game_data.recipe_data[state.item_data.氢[choice]];
        const net = recipe.产物.氢 - recipe.原料.氢;
        expect(line.byproducts.高能石墨).toBeCloseTo(70 * recipe.产物.高能石墨 / net, 7);
        expect(line.inputs.精炼油).toBeCloseTo(70 * recipe.原料.精炼油 / net, 7);
        expect(detail.surplus).toBeUndefined();
        balances(detail);
    });
});
