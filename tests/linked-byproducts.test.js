import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource} from '../src/production_sources.js';
import {buildLinkedByproducts} from '../src/lib/linked-byproducts.js';
import {createNeedsPlanSnapshot, decodeSavedPlan} from '../src/lib/plan-state.js';
import {createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
function make(scenario = {}) {
    const state = createScenario(api, scenario).state;
    // An orbital automatic route isolates the graphene coproduct from refining
    // coproducts, so the remaining hydrogen is a primary automatic output.
    state.scheme_data.item_recipe_choices.氢 = state.item_data.氢.findIndex((id, index) =>
        index > 0 && Object.keys(state.game_data.recipe_data[id].原料).length === 0);
    return new GlobalState(new GameInfo(state.game_data), state.scheme_data, state.settings);
}
const source = (state, id, amount, overrides = {}) => ({
    ...createProductionSource(state, '石墨烯'), id, recipe_choice: 2, building: 0,
    output_per_minute: amount, proliferator_mode: 0, proliferator_points: 0, ...overrides,
});
const project = (state, needs) => buildLinkedByproducts(state, needs, state.calculate(needs));

function freeze(value) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
        if (child && typeof child === 'object' && !Object.isFrozen(child)) freeze(child);
    }
    return value;
}

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('read-only linked byproduct sources', () => {
    it('derives graphene 120 → hydrogen 60 from the legacy graph with remaining automatic hydrogen', () => {
        const base = make({recipes: {石墨烯: 2}});
        // Keep this fallback-graph test outside the coupled orbital solver.
        const scheme = structuredClone(base.scheme_data);
        const hydrogenRecipe = base.item_data.氢[scheme.item_recipe_choices.氢];
        const factories = base.game_data.factory_data[base.game_data.recipe_data[hydrogenRecipe].设施];
        scheme.scheme_for_recipe[hydrogenRecipe].建筑 = factories.findIndex(factory => factory.名称 === '行星基地');
        const state = new GlobalState(new GameInfo(base.game_data), scheme, base.settings);
        const needs = {石墨烯: 120, 氢: 100};
        const calculation = state.calculate(needs);
        expect(calculation).toHaveLength(2);
        const linked = buildLinkedByproducts(state, needs, calculation);
        expect(linked.byItem.氢).toEqual([{
            id: expect.any(String), item: '氢', parentItem: '石墨烯', parentSourceId: 'auto:石墨烯',
            parentKind: 'automatic', ordinal: null, output: 60,
            recipeId: state.item_data.石墨烯[2], factoryName: '化工厂',
        }]);
        expect(linked.groups.氢).toEqual({required: 100, automatic: 40, allocated: 0,
            byproduct_supply: 60, surplus: 0, missing: 0});
    });

    it('uses the exact current graph and sums shared demand without guessing consumer routing', () => {
        const state = {item_graph: {
            parent: {原料: {}, 副产物: {shared: 0.5}},
            consumerA: {原料: {shared: 2}, 副产物: {}},
            consumerB: {原料: {shared: 3}, 副产物: {}},
        }};
        const linked = buildLinkedByproducts(state, {parent: 120, consumerA: 10, consumerB: 20, shared: 5},
            [{parent: 120, consumerA: 10, consumerB: 20, shared: 25}, {}]);
        expect(linked.groups.shared).toEqual({required: 85, automatic: 25, allocated: 0,
            byproduct_supply: 60, surplus: 0, missing: 0});
        expect(linked.byItem.shared).toHaveLength(1);
        expect(linked.byItem.shared[0]).toMatchObject({parentItem: 'parent', output: 60});
        expect(linked.byItem.shared[0]).not.toHaveProperty('consumer');
        expect(linked.byItem.shared[0]).not.toHaveProperty('allocation');
        state.item_graph.parent.副产物.shared = 0.625;
        expect(buildLinkedByproducts(state, {}, [{parent: 120}, {}]).byItem.shared[0].output).toBe(75);
    });

    it.each([
        {demand: 300, automatic: 240, surplus: 0},
        {demand: 60, automatic: 0, surplus: 0},
        {demand: 30, automatic: 0, surplus: 30},
        {demand: 0, automatic: 0, surplus: 60},
    ])('shows true hydrogen demand $demand before crediting 60 coproducts', ({demand, automatic, surplus}) => {
        const state = make({recipes: {石墨烯: 2}});
        const needs = demand ? {石墨烯: 120, 氢: demand} : {石墨烯: 120};
        const linked = project(state, needs);
        expect(linked.groups.氢).toEqual({required: demand, automatic, allocated: 0,
            byproduct_supply: 60, surplus, missing: 0});
    });

    it('shows 300 downstream hydrogen demand before crediting graphene coproducts', () => {
        const state = {item_graph: {
            石墨烯: {原料: {}, 副产物: {氢: 0.5}},
            消费物品: {原料: {氢: 3}, 副产物: {}},
            氢: {原料: {}, 副产物: {}},
        }};
        const linked = buildLinkedByproducts(state, {石墨烯: 120, 消费物品: 100},
            [{石墨烯: 120, 消费物品: 100, 氢: 240}, {}]);
        expect(linked.groups.氢).toEqual({required: 300, automatic: 240, allocated: 0,
            byproduct_supply: 60, surplus: 0, missing: 0});
        expect(linked.byItem.氢[0]).toMatchObject({parentItem: '石墨烯', output: 60});
    });

    it('keeps two manual parents distinct, with ordinals within their item and stable IDs', () => {
        const state = make();
        state.settings.production_sources = [
            source(state, 'graphene-a', 40),
            {...createProductionSource(state, '铁块'), id: 'unrelated', output_per_minute: 0},
            source(state, 'graphene-b', 80),
        ];
        const needs = {石墨烯: 120, 氢: 100, 铁块: 1};
        const calculation = state.calculate(needs);
        const linked = buildLinkedByproducts(state, needs, calculation);
        expect(linked.byItem.氢).toHaveLength(2);
        expect(linked.byItem.氢.map(row => [row.parentSourceId, row.parentKind, row.ordinal, row.output]))
            .toEqual([['graphene-a', 'manual', 1, 20], ['graphene-b', 'manual', 2, 40]]);
        expect(new Set(linked.byItem.氢.map(row => row.id)).size).toBe(2);
        expect(linked.groups).toBe(calculation[2].groups);
        expect(linked.groups.氢).toMatchObject({required: 100, automatic: 40, byproduct_supply: 60});
        expect(project(state, needs)).toEqual(linked);
        state.settings.production_sources[0].output_per_minute = 60;
        const changed = project(state, needs);
        expect(changed.byItem.氢.map(row => row.id)).toEqual(linked.byItem.氢.map(row => row.id));
        expect(changed.byItem.氢.map(row => row.output)).toEqual([30, 40]);
    });

    it('projects automatic and manual sources separately even for the same parent item', () => {
        const state = make({recipes: {石墨烯: 2}});
        state.settings.production_sources = [source(state, 'manual-graphene', 40)];
        const linked = project(state, {石墨烯: 120, 氢: 100});
        expect(linked.byItem.氢.map(row => [row.parentSourceId, row.output]))
            .toEqual([['auto:石墨烯', 40], ['manual-graphene', 20]]);
        expect(linked.groups.氢.byproduct_supply).toBe(60);
    });

    it('updates fixed-building parent proliferation and factory changes without creating linked allocations', () => {
        const state = make();
        const saved = source(state, 'fixed-factories', 0, {quantity_mode: 'buildings', building_quantity: 2});
        state.settings.production_sources = [saved];
        const needs = {石墨烯: 300, 氢: 200};
        const parentLink = () => project(state, needs).byItem.氢.find(row => row.parentSourceId === saved.id);
        const initial = parentLink();
        expect(initial.output).toBe(60);
        saved.proliferator_mode = 2;
        saved.proliferator_points = 4;
        const sprayed = parentLink();
        expect(sprayed.id).toBe(initial.id);
        expect(sprayed.output).toBeCloseTo(60 * state.game_data.proliferator_effect[4].增产效果, 10);
        saved.building = 1;
        const upgraded = parentLink();
        const recipe = state.game_data.recipe_data[state.item_data.石墨烯[2]];
        const factories = state.game_data.factory_data[recipe.设施];
        expect(upgraded.output).toBeCloseTo(sprayed.output * factories[1].倍率 / factories[0].倍率, 10);
        expect(upgraded.factoryName).toBe(factories[1].名称);
        expect(upgraded.id).toBe(initial.id);
        expect(state.settings.production_sources).toHaveLength(1);
        expect(state.settings.production_sources[0].target_item).toBe('石墨烯');
    });

    it('removes a link after recipe changes, zeroing, deletion or pausing its parent', () => {
        const state = make();
        const parent = source(state, 'temporary-parent', 120);
        state.settings.production_sources = [parent];
        const needs = {石墨烯: 120, 氢: 100};
        const parentLink = (targets = needs) => project(state, targets).byItem.氢?.find(row => row.parentSourceId === parent.id);
        const original = parentLink();
        parent.recipe_choice = 1;
        expect(parentLink()).toBeUndefined();
        parent.recipe_choice = 2;
        parent.output_per_minute = 0;
        expect(parentLink()).toBeUndefined();
        parent.output_per_minute = 120;
        expect(parentLink().id).toBe(original.id);
        expect(parentLink({铁块: 60})).toBeUndefined();
        state.settings.production_sources = [];
        expect(parentLink()).toBeUndefined();
    });

    it('does not link external supply even though it is included in group byproduct supply', () => {
        const state = make({recipes: {石墨烯: 2}});
        const needs = {石墨烯: 120, 氢: -40};
        const legacy = project(state, needs);
        expect(legacy.byItem.氢).toHaveLength(1);
        expect(legacy.byItem.氢[0].output).toBe(60);
        expect(legacy.groups.氢).toMatchObject({required: 0, byproduct_supply: 100, surplus: 100});
        state.settings.production_sources = [source(state, 'graphene', 120)];
        const linked = project(state, needs);
        expect(linked.byItem.氢).toHaveLength(1);
        expect(linked.byItem.氢[0]).toMatchObject({parentSourceId: 'graphene', output: 60});
        expect(linked.groups.氢.byproduct_supply).toBe(100);
        expect(project(make(), {铁块: 10, 氢: -40}).byItem.氢).toBeUndefined();
    });

    it('represents legacy fixed source details with a separate source kind and no invented graph contribution', () => {
        const state = make({settings: {natural_production_line: [
            {目标物品: '石墨烯', 配方id: 2, 建筑: 0, 建筑数量: 2, 增产点数: 0, 增产模式: 0},
        ]}});
        state.settings.production_sources = [{...createProductionSource(state, '氢'), id: 'zero-hydrogen'}];
        const needs = {石墨烯: 120, 氢: 100};
        const calculation = state.calculate(needs);
        const linked = buildLinkedByproducts(state, needs, calculation);
        expect(linked.byItem.氢).toEqual([expect.objectContaining({
            parentKind: 'legacy', parentSourceId: calculation[2].legacy_sources[0].id,
            parentItem: '石墨烯', ordinal: null, output: 60,
        })]);
    });

    it('ignores nonfinite, nonpositive and self byproduct flows, including fallback multiplication overflow', () => {
        const state = {item_graph: {parent: {原料: {}, 副产物: {
            valid: 0.5, parent: 3, zero: 0, tiny: 1e-10, negative: -1, nan: NaN, infinite: Infinity, overflow: Number.MAX_VALUE,
        }}, idle: {副产物: {ghost: 1}}}};
        const fallback = buildLinkedByproducts(state, {}, [{parent: 10, idle: 0}, {}]);
        expect(Object.keys(fallback.byItem)).toEqual(['valid']);
        expect(fallback.byItem.valid[0].output).toBe(5);
        const details = {automatic: {}, groups: {}, sources: [{id: 'manual', target_item: 'parent',
            byproducts: {valid: 5, parent: 3, zero: 0, negative: -1, nan: NaN, infinite: Infinity}}]};
        const explicit = buildLinkedByproducts(state, {}, [{parent: 10}, {}, details]);
        expect(Object.keys(explicit.byItem)).toEqual(['valid']);
        expect(explicit.byItem.valid[0].output).toBe(5);
        details.sources[0].error = 'invalid-source';
        expect(buildLinkedByproducts(state, {}, [{parent: 10}, {}, details]).byItem).toEqual({});
    });

    it('keeps ordinals aligned with parent cards when an earlier manual source has no coproduct', () => {
        const state = make();
        state.settings.production_sources = [source(state, 'zero', 0), source(state, 'active', 120)];
        const linked = project(state, {石墨烯: 120, 氢: 60});
        expect(linked.byItem.氢).toHaveLength(1);
        expect(linked.byItem.氢[0]).toMatchObject({parentSourceId: 'active', ordinal: 2});
    });

    it.each([true, false])('uses current display rates directly (minutes: %s)', is_time_unit_minute => {
        const unit = is_time_unit_minute ? 1 : 60;
        const state = make({settings: {is_time_unit_minute}});
        state.settings.production_sources = [source(state, 'graphene', 120)];
        const linked = project(state, {石墨烯: 120 / unit, 氢: 100 / unit});
        expect(linked.byItem.氢[0].output).toBeCloseTo(60 / unit, 10);
        expect(linked.groups.氢.automatic).toBeCloseTo(40 / unit, 7);
    });

    it('does not mutate the calculation, source settings, totals or graph and never invokes a solver', () => {
        const state = make();
        state.settings.production_sources = [source(state, 'graphene', 120)];
        const needs = freeze({石墨烯: 120, 氢: 100});
        const calculation = freeze(state.calculate(needs));
        const before = structuredClone({calculation, settings: state.settings, graph: state.item_graph, scheme: state.scheme_data});
        freeze(state.settings);
        freeze(state.item_graph);
        freeze(state.scheme_data);
        const solver = vi.spyOn(state, 'calculate').mockImplementation(() => { throw new Error('Projection must not solve'); });
        const linked = buildLinkedByproducts(state, needs, calculation);
        expect(buildLinkedByproducts(state, needs, calculation)).toEqual(linked);
        expect(solver).not.toHaveBeenCalled();
        expect({calculation, settings: state.settings, graph: state.item_graph, scheme: state.scheme_data}).toEqual(before);
        expect(calculation[2].totals.fractionalBuildingCounts.化工厂).toBe(2);
        expect(calculation[2].totals.rawMaterials.可燃冰).toBe(120);
        expect(linked.groups.氢.automatic + linked.groups.氢.allocated + linked.groups.氢.byproduct_supply).toBe(100);
        expect(linked).not.toHaveProperty('totals');
        expect(linked.byItem.氢[0]).not.toHaveProperty('buildings');
    });

    it('rederives stable links after a full saved plan reload without persisting linked rows', () => {
        const state = make({settings: {mineralize_list: {}}});
        state.settings.production_sources = [
            source(state, 'fixed-parent', 60, {quantity_mode: 'buildings', building_quantity: 1}),
            source(state, 'rate-parent', 30),
        ];
        const needs = {石墨烯: 120, 氢: 100};
        const original = project(state, needs);
        const encoded = JSON.stringify(createNeedsPlanSnapshot(needs, state.scheme_data, state.settings, state.game_data.game_name));
        for (const row of original.byItem.氢) expect(encoded).not.toContain(row.id);
        const info = new GameInfo(state.game_data);
        const decoded = decodeSavedPlan(JSON.parse(encoded), 'needs', info);
        const restored = new GlobalState(info, decoded.scheme_data, decoded.settings);
        expect(project(restored, decoded.needs_list)).toEqual(original);
        expect(restored.settings.production_sources.map(line => line.id)).toEqual(['fixed-parent', 'rate-parent']);
    });
});
