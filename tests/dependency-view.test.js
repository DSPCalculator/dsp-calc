import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource} from '../src/production_sources.js';
import {buildDependencyView} from '../src/dependency_view.js';
import {createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const make = (scenario = {}) => createScenario(api, scenario).state;
const sourceFor = (state, item, amount, overrides = {}) => ({...createProductionSource(state, item),
    output_per_minute: amount, ...overrides});
const project = (state, needs, options) => buildDependencyView(state, needs, state.calculate(needs), options);
const branch = (view, ...path) => path.slice(1).reduce((node, item) => node?.children.find(child => child.item === item),
    view.roots.find(root => root.item === path[0]));
const branchRates = view => view.rows.filter(row => row.scope === 'branch').map(({id, item, branchRate, reason}) => ({id, item, branchRate, reason}));

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('readonly dependency-demand projection', () => {
    it('shows separate blue-matrix ore and copper shares without changing global production', () => {
        const state = make();
        const needs = {'电磁矩阵': 60};
        const calculation = state.calculate(needs);
        const view = buildDependencyView(state, needs, calculation);
        expect(branch(view, '电磁矩阵', '磁线圈', '磁铁', '铁矿').branchRate).toBe(60);
        expect(branch(view, '电磁矩阵', '电路板', '铁块', '铁矿').branchRate).toBe(60);
        expect(branch(view, '电磁矩阵', '磁线圈', '铜块').branchRate).toBe(30);
        expect(branch(view, '电磁矩阵', '电路板', '铜块').branchRate).toBe(30);
        expect(branch(view, '电磁矩阵', '磁线圈', '铁块')).toBeUndefined();
        expect(view.items.铁矿.automaticRate).toBe(120);
        expect(view.items.铜矿.automaticRate).toBe(60);
        const ore = view.rows.filter(row => row.item === '铁矿');
        expect(ore).toHaveLength(2);
        expect(ore.every(row => row.shared && row.reason === 'raw')).toBe(true);
        expect(ore[0].canonicalId).toBe(ore[1].canonicalId);
        expect(ore[0].id).not.toBe(ore[1].id);
        expect(view.supplyRoots).toEqual([]);
        expect(calculation[0].铁矿).toBe(120);
    });

    it('preserves separate positive target roots when a target is also an intermediate', () => {
        const view = project(make(), {'电磁矩阵': 60, '电路板': 120});
        expect(view.roots.map(row => [row.item, row.branchRate])).toEqual([['电磁矩阵', 60], ['电路板', 120]]);
        expect(branch(view, '电磁矩阵', '电路板').branchRate).toBe(60);
        expect(branch(view, '电路板', '铁块', '铁矿').branchRate).toBe(120);
        expect(view.items.电路板.automaticRate).toBe(180);
        expect(view.items.铁矿.automaticRate).toBe(240);
        expect(view.items.铜矿.automaticRate).toBe(120);
        expect(new Set(view.rows.map(row => row.id)).size).toBe(view.rows.length);
    });

    it('keeps ordinary branch rates unchanged when a valid zero manual source is added', () => {
        const base = make();
        const expected = project(base, {'电磁矩阵': 60});
        base.settings.production_sources = [sourceFor(base, '铁块', 0)];
        const actual = project(base, {'电磁矩阵': 60});
        expect(branchRates(actual)).toEqual(branchRates(expected));
        expect(actual.items.铁块.hasCanonicalGroup).toBe(true);
        expect(actual.supplyRoots).toEqual([]);
    });

    it('stops at overallocated iron and exposes the full 200/min source input separately', () => {
        const state = make();
        state.settings.production_sources = [sourceFor(state, '铁块', 200)];
        const view = project(state, {'电路板': 120});
        const iron = branch(view, '电路板', '铁块');
        expect(iron).toMatchObject({branchRate: 120, reason: 'global-supply', children: []});
        expect(iron.boundaryReasons).toEqual(expect.arrayContaining(['manual-supply', 'overproduction']));
        expect(view.items.铁块).toMatchObject({automaticRate: 0, manualRate: 200, surplusRate: 80});
        expect(view.items.铁矿.automaticRate).toBe(200);
        const source = view.supplyRoots.find(row => row.item === '铁块');
        expect(source).toMatchObject({kind: 'supply', scope: 'global', branchRate: null, globalRate: 200});
        expect(source.children[0]).toMatchObject({item: '铁矿', scope: 'global', branchRate: null, globalRate: 200});
    });

    it('retains each independent source and its own exact input without inventing branch routing', () => {
        const state = make();
        state.settings.production_sources = [1, 2, 3].map(recipe_choice => sourceFor(state, '重氢', 50, {recipe_choice}));
        const view = project(state, {'重氢': 300});
        expect(view.roots[0]).toMatchObject({branchRate: 300, reason: 'global-supply', children: []});
        expect(view.items.重氢).toMatchObject({requiredRate: 300, manualRate: 150, automaticRate: 150});
        const lines = Object.values(view.sources).filter(source => source.item === '重氢');
        expect(lines.map(line => line.inputs.氢 || 0)).toEqual([300, 100, 50, 0]);
        expect(lines.filter(line => line.kind === 'manual').map(line => line.ordinal)).toEqual([1, 2, 3]);
        expect(view.supplyRoots.filter(row => row.item === '重氢')).toHaveLength(4);
        expect(view.items.氢.requiredRate).toBe(450);
        expect(view.items.氢.automaticRate).toBe(0);
        expect(view.items.氢.byproductRate).toBeCloseTo(1000, 7);
        expect(view.items.氢.surplusRate).toBeCloseTo(550, 7);
        // The manual D collectors already supply H, so oil refining is unnecessary.
        expect(view.supplyRoots.find(row => row.item === '精炼油')).toBeUndefined();
        expect(view.supplyRoots.some(row => row.item === '原油')).toBe(false);
        expect(view.items.氢.coproductSourceIds).toHaveLength(1);
    });

    it('distinguishes net output and gross self-recirculation without a false input loop', () => {
        const state = make();
        const recipe_choice = state.item_data.氢.slice(1).findIndex(id => state.game_data.recipe_data[id].原料.氢 > 0) + 1;
        state.settings.production_sources = [sourceFor(state, '氢', 70, {recipe_choice})];
        const view = project(state, {'氢': 100, '高能石墨': 20});
        const source = Object.values(view.sources).find(line => line.kind === 'manual');
        expect(source).toMatchObject({outputRate: 70, grossRate: 210, inputs: {'精炼油': 70}, byproducts: {'高能石墨': 70}});
        const root = view.supplyRoots.find(row => row.sourceId === source.id);
        expect(root.children.map(row => row.item)).toEqual(['精炼油']);
        expect(view.rows.some(row => row.reason === 'cycle')).toBe(false);
        expect(view.items.氢.surplusRate).toBe(5);
        expect(view.items.高能石墨.surplusRate).toBe(50);
    });

    it('treats negative targets as pooled external supply, never a negative production root', () => {
        const view = project(make(), {'电路板': 120, '铁块': -60});
        expect(view.roots).toHaveLength(1);
        expect(branch(view, '电路板', '铁块')).toMatchObject({branchRate: 120, reason: 'global-supply', children: []});
        expect(view.items.铁块).toMatchObject({externalRate: 60, requiredRate: 120, automaticRate: 60});
        expect(view.items.铁块.boundaryReasons).toContain('external-supply');
        const local = view.supplyRoots.find(row => row.item === '铁块');
        expect(local.globalRate).toBe(60);
        expect(local.children[0]).toMatchObject({item: '铁矿', globalRate: 60});
    });

    it('terminates mineralized materials and respects hidden canonical mining rows', () => {
        const view = project(make({settings: {mineralize_list: {'铁块': true}, hide_mines: true}}), {'电路板': 120});
        expect(branch(view, '电路板', '铁块')).toMatchObject({branchRate: 120, reason: 'mineralized', children: []});
        expect(view.items.铁块.hasCanonicalRow).toBe(false);
        expect(view.items.铜矿.hasCanonicalRow).toBe(false);
        expect(view.items.铜块.hasCanonicalRow).toBe(true);
        expect(view.rows.some(row => row.item === '铁矿')).toBe(false);
    });

    it('keeps zero manual raw-source groups linkable even when hide_mines is enabled', () => {
        const state = make({settings: {hide_mines: true}});
        state.settings.production_sources = [sourceFor(state, '铁矿', 0)];
        const view = project(state, {'铁块': 60});
        expect(view.items.铁矿).toMatchObject({hasCanonicalRow: true, hasCanonicalGroup: true});
    });

    it('includes independent standalone sources with no requested targets', () => {
        const state = make();
        state.settings.production_sources = [sourceFor(state, '铜块', 30, {standalone: true})];
        const view = project(state, {});
        expect(view.roots).toEqual([]);
        const copper = view.supplyRoots.find(row => row.item === '铜块');
        expect(copper.globalRate).toBe(30);
        expect(copper.children[0]).toMatchObject({item: '铜矿', globalRate: 30, branchRate: null});
    });

    it('omits paused sources but retains invalid-source references', () => {
        const state = make();
        state.settings.production_sources = [sourceFor(state, '重氢', 150)];
        expect(project(state, {'铁块': 60}).supplyRoots).toEqual([]);
        state.settings.production_sources = [sourceFor(state, '重氢', 150, {recipe_choice: 999})];
        const invalid = project(state, {});
        expect(invalid.supplyRoots).toHaveLength(1);
        expect(invalid.supplyRoots[0]).toMatchObject({item: '重氢', reason: 'invalid-source', globalRate: 0});
    });

    it('uses the active proliferation coefficients rather than unmodified recipe ingredients', () => {
        const view = project(make({proliferation: {'电路板': {增产点数: 4, 增产模式: 2}}}), {'电路板': 120});
        expect(branch(view, '电路板', '铁块').branchRate).toBeCloseTo(96, 7);
        expect(branch(view, '电路板', '铜块').branchRate).toBeCloseTo(48, 7);
        expect(branch(view, '电路板', '增产剂 Mk.III').branchRate).toBeCloseTo(1.945945945945946, 7);
    });

    it('uses the actual mod graph, including returned blue-buff ingredients', () => {
        const state = make({mods: ['Gnimaerd.DSP.plugin.MoreMegaStructure', 'com.ckcz123.DSP_Battle'], settings: {blue_buff: true}});
        const view = project(state, {'电路板': 120});
        expect(branch(view, '电路板', '铁块')).toBeUndefined();
        expect(branch(view, '电路板', '铜块').branchRate).toBe(60);
        expect(branch(view, '电路板', '铜块', '铜矿').branchRate).toBe(60);
        expect(view.items.铁块.automaticRate).toBe(0);
    });

    it('keeps physical totals unchanged and displays rates in the provided second unit', () => {
        const minute = make();
        const second = make({settings: {is_time_unit_minute: false}});
        minute.settings.production_sources = [sourceFor(minute, '铁块', 30)];
        second.settings.production_sources = [{...minute.settings.production_sources[0]}];
        const minuteCalculation = minute.calculate({'电路板': 120});
        const secondCalculation = second.calculate({'电路板': 2});
        const a = buildDependencyView(minute, {'电路板': 120}, minuteCalculation);
        const b = buildDependencyView(second, {'电路板': 2}, secondCalculation);
        expect(branch(b, '电路板', '铁块').branchRate).toBe(2);
        expect(b.items.铁块.manualRate).toBe(0.5);
        for (const row of a.rows) {
            const other = b.rows.find(candidate => candidate.id === row.id);
            expect(other).toBeDefined();
            const key = row.scope === 'branch' ? 'branchRate' : 'globalRate';
            expect(other[key]).toBeCloseTo(row[key] / 60, 7);
        }
        expect(secondCalculation[2].totals.buildingCounts).toEqual(minuteCalculation[2].totals.buildingCounts);
        expect(secondCalculation[2].totals.totalEnergyCost).toBeCloseTo(minuteCalculation[2].totals.totalEnergyCost, 7);
    });

    it('never calls the solver or mutates the supplied state, needs, or calculation', () => {
        const state = make();
        state.settings.production_sources = [sourceFor(state, '铁块', 30)];
        const needs = {'电路板': 120};
        const calculation = state.calculate(needs);
        const before = structuredClone({settings: state.settings, graph: state.item_graph, scheme: state.scheme_data, needs, calculation});
        const calculate = vi.spyOn(state, 'calculate').mockImplementation(() => { throw new Error('projection must not solve'); });
        const baseline = vi.spyOn(state, 'calculateBaseline').mockImplementation(() => { throw new Error('projection must not solve'); });
        const first = buildDependencyView(state, needs, calculation);
        const second = buildDependencyView(state, needs, calculation);
        expect(second).toEqual(first);
        expect(calculate).not.toHaveBeenCalled();
        expect(baseline).not.toHaveBeenCalled();
        expect({settings: state.settings, graph: state.item_graph, scheme: state.scheme_data, needs, calculation}).toEqual(before);
    });
});

function synthetic(inputs, production) {
    return {state: {settings: {}, item_data: Object.fromEntries(Object.keys(inputs).map(item => [item, [0, 1]])),
        item_graph: Object.fromEntries(Object.entries(inputs).map(([item, 原料]) => [item, {原料, 副产物: {}}]))},
    calculation: [production, {}]};
}

describe('cycle safety and bounded unfolding', () => {
    it('links a coproduct to its derived flat source group even when absent from automatic production', () => {
        const {state, calculation} = synthetic({A: {}, B: {}}, {A: 1});
        state.item_graph.A.副产物 = {B: 1};
        const view = buildDependencyView(state, {A: 1, B: 1}, calculation);
        expect(view.items.B).toMatchObject({byproductRate: 1, hasCanonicalRow: true, hasCanonicalGroup: true});
        expect(view.items.A.hasCanonicalRow).toBe(true);
        expect(view.roots[1]).toMatchObject({item: 'B', branchRate: 1, reason: 'global-supply'});
    });

    it('uses path-local cycle detection while retaining exact demand at the reference', () => {
        const {state, calculation} = synthetic({A: {B: 0.5}, B: {A: 0.5}}, {A: 4 / 3, B: 2 / 3});
        const view = buildDependencyView(state, {A: 1}, calculation);
        expect(view.rows).toHaveLength(3);
        expect(branch(view, 'A', 'B', 'A')).toMatchObject({branchRate: 0.25, reason: 'cycle', referenceId: view.roots[0].id, children: []});
        expect(view.limits.truncated).toBe(false);
    });

    it('bounds exponentially shared DAGs and explicitly reports omitted input references', () => {
        const inputs = {root: {a1: 1, b1: 1}};
        const production = {root: 1};
        for (let level = 1; level <= 12; level++) {
            for (const prefix of ['a', 'b']) {
                inputs[`${prefix}${level}`] = level === 12 ? {} : {[`a${level + 1}`]: 1, [`b${level + 1}`]: 1};
                production[`${prefix}${level}`] = 2 ** (level - 1);
            }
        }
        const {state, calculation} = synthetic(inputs, production);
        const view = buildDependencyView(state, {root: 1}, calculation, {maxExpandedNodes: 7});
        expect(view.limits).toMatchObject({maxExpandedNodes: 7, expandedNodes: 7, truncated: true});
        expect(view.rows.length).toBeLessThanOrEqual(1 + Object.keys(production).length + 7);
        expect(view.rows.filter(row => row.truncated).every(row => row.reason === 'node-limit' && row.omittedInputs.length > 0)).toBe(true);
        expect(view.roots[0].omittedInputs).toEqual([{item: 'b1', rate: 1, canonicalId: view.items.b1.canonicalId}]);
    });

    it('preserves every root and makes a zero expansion budget explicit', () => {
        const view = project(make(), {'电磁矩阵': 60, '电路板': 120}, {maxExpandedNodes: 0});
        expect(view.roots).toHaveLength(2);
        expect(view.roots.every(root => root.reason === 'node-limit' && root.children.length === 0)).toBe(true);
        expect(view.limits.expandedNodes).toBe(0);
    });

    it('exposes an explicit depth limit rather than silently dropping a long dependency chain', () => {
        const view = project(make(), {'电磁矩阵': 60}, {maxDepth: 1});
        expect(branch(view, '电磁矩阵', '磁线圈')).toMatchObject({reason: 'depth-limit', truncated: true, children: []});
        expect(branch(view, '电磁矩阵', '磁线圈').omittedInputs).toEqual(expect.arrayContaining([
            {item: '磁铁', rate: 60, canonicalId: view.items.磁铁.canonicalId},
            {item: '铜块', rate: 30, canonicalId: view.items.铜块.canonicalId},
        ]));
    });

    it('labels non-finite source flows instead of fabricating a raw-material terminal', () => {
        const {state, calculation} = synthetic({A: {B: 1e308}, B: {}}, {A: 1e308, B: 1});
        const view = buildDependencyView(state, {A: 1e308}, calculation);
        expect(view.roots[0].boundaryReasons).toContain('invalid-source');
        expect(view.supplyRoots.find(row => row.item === 'A').reason).toBe('invalid-source');
    });
});

describe('branch capacity and factory projection', () => {
    it('splits repeated copper and keeps unequal target/intermediate branches distinct', () => {
        const state = make();
        const needs = {'电磁矩阵': 60, '电路板': 120};
        const calculation = state.calculate(needs);
        const snapshot = structuredClone(calculation);
        const view = buildDependencyView(state, needs, calculation);
        const matrixCopper = branch(view, '电磁矩阵', '电路板', '铜块');
        const coilCopper = branch(view, '电磁矩阵', '磁线圈', '铜块');
        const targetCopper = branch(view, '电路板', '铜块');
        expect(matrixCopper.production).toMatchObject({capacity: 30, buildings: 0.5, status: 'recipe'});
        expect(coilCopper.production).toMatchObject({capacity: 30, buildings: 0.5});
        expect(targetCopper.production).toMatchObject({capacity: 60, buildings: 1});
        expect(branch(view, '电磁矩阵', '电路板').production.capacity).toBe(60);
        expect(branch(view, '电路板').production.capacity).toBe(120);
        expect(view.items.铜块.automaticRate).toBe(120);
        expect(calculation).toEqual(snapshot);
    });

    it('uses actual faster/proliferated recipe output and identical factories in seconds', () => {
        const scenario = {factories: {'电路板': '制造台 Mk.III'}, proliferation: {'电路板': {增产点数: 4, 增产模式: 2}}};
        const minute = project(make(scenario), {'电路板': 120});
        const second = project(make({...scenario, settings: {is_time_unit_minute: false}}), {'电路板': 2});
        expect(minute.roots[0].production.buildings).toBeCloseTo(120 / (60 * 2 * 1.5 * 1.25), 12);
        for (const node of minute.rows.filter(row => row.production?.status === 'recipe')) {
            const other = second.rows.find(row => row.id === node.id);
            expect(other.production.capacity).toBeCloseTo(node.production.capacity / 60, 12);
            expect(other.production.buildings).toBeCloseTo(node.production.buildings, 12);
        }
    });

    it('keeps exact fractions and applies the legacy display offset only after scaling', () => {
        const state = make();
        const view = project(state, {'电磁矩阵': 1});
        const copper = branch(view, '电磁矩阵', '电路板', '铜块');
        expect(copper.production.buildings).toBeCloseTo(1 / 120, 14);
        expect(copper.production.displayOffset).toBeCloseTo(0.0049994, 14);
        expect((copper.production.buildings + copper.production.displayOffset).toFixed(2)).toBe('0.01');
    });

    it('uses gross recirculation for capacity without charging its factories twice', () => {
        const state = {settings: {is_time_unit_minute: true, fixed_num: 2}, item_data: {A: [0, 1]},
            scheme_data: {item_recipe_choices: {A: 1}, scheme_for_recipe: {1: {建筑: 0}}},
            game_data: {recipe_data: {1: {设施: 'factory'}}, factory_data: {factory: [{倍率: 2}]}},
            item_graph: {A: {原料: {}, 副产物: {}, 自消耗: 2, 产出倍率: 1}}};
        const legacy = buildDependencyView(state, {A: 60}, [{A: 60}, {}]);
        expect(legacy.roots[0].production).toMatchObject({capacity: 180, buildings: 0.5});
        const detailed = buildDependencyView(state, {A: 60}, [{A: 60}, {}, {automatic: {
            A: {output: 60, gross_output: 180, buildings: 0.5, inputs: {}, byproducts: {}},
        }}]);
        expect(detailed.roots[0].production).toMatchObject({capacity: 180, buildings: 0.5, displayOffset: 0});
    });

    it('still calculates a branch with a zero manual source but never allocates a positive pool', () => {
        const state = make();
        state.settings.production_sources = [sourceFor(state, '铜块', 0)];
        let view = project(state, {'电磁矩阵': 60});
        expect(view.items.铜块.hasCanonicalGroup).toBe(true);
        expect(branch(view, '电磁矩阵', '电路板', '铜块').production).toMatchObject({capacity: 30, buildings: 0.5});
        state.settings.production_sources[0].output_per_minute = 20;
        view = project(state, {'电磁矩阵': 60});
        expect(branch(view, '电磁矩阵', '电路板', '铜块').production).toEqual({capacity: null, buildings: null, displayOffset: 0, status: 'unallocated'});
    });

    it('does not label mineralized branches as zero factories when physical sources also supply them', () => {
        const state = make({settings: {mineralize_list: {'铁块': true}}});
        state.settings.production_sources = [sourceFor(state, '铁块', 30)];
        const view = project(state, {'电路板': 120});
        expect(branch(view, '电路板', '铁块')).toMatchObject({reason: 'global-supply',
            production: {capacity: null, buildings: null, status: 'unallocated'}});
        expect(view.items.铁块.manualRate).toBe(30);
        expect(view.supplyRoots.some(root => root.item === '铁块')).toBe(true);
    });

    it('does not invent factories for coproducts, external supply or cycle references', () => {
        const coproduct = project(make({recipes: {'石墨烯': 2}}), {'石墨烯': 120, '氢': 30});
        expect(branch(coproduct, '氢').production).toMatchObject({capacity: null, buildings: null, status: 'unallocated'});
        const external = project(make(), {'电路板': 120, '铁块': -60});
        expect(branch(external, '电路板', '铁块').production.status).toBe('unallocated');
        const mineralized = project(make({settings: {mineralize_list: {'铁块': true}}}), {'电路板': 120});
        expect(branch(mineralized, '电路板', '铁块').production).toMatchObject({capacity: 120, buildings: 0, status: 'external'});
        const {state, calculation} = synthetic({A: {B: 0.5}, B: {A: 0.5}}, {A: 80, B: 40});
        const cyclic = buildDependencyView(state, {A: 60}, calculation);
        expect(branch(cyclic, 'A', 'B', 'A').production).toMatchObject({capacity: null, buildings: null, status: 'unallocated'});
    });
});
