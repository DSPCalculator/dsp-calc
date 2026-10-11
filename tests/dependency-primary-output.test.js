import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource} from '../src/production_sources.js';
import {buildProductionPresentation} from '../src/lib/production-presentation.js';
import {buildDependencyView} from '../src/dependency_view.js';
import {createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const make = scenario => createScenario(api, scenario).state;
const branch = (view, ...path) => path.slice(1).reduce((node, item) => node?.children.find(child => child.item === item),
    view.roots.find(root => root.item === path[0]));
const physical = (item, output, byproducts = {}, inputs = {}, buildings = 1) => ({
    id: `automatic-${item}`, recipe_id: `recipe-${item}`, target_item: item, output, gross_output: output,
    byproducts, inputs, buildings, factory_name: `factory-${item}`,
});
function synthetic(automatic, needs) {
    const items = new Set([...Object.keys(needs), ...Object.keys(automatic),
        ...Object.values(automatic).flatMap(source => [...Object.keys(source.inputs), ...Object.keys(source.byproducts)])]);
    const state = {settings: {}, item_data: Object.fromEntries([...items].map(item => [item, [0, 1]])),
        item_graph: Object.fromEntries([...items].map(item => [item, {原料: {}, 副产物: {}}])),
        game_data: {recipe_data: Object.fromEntries(Object.values(automatic).map(source => [source.recipe_id,
            {原料: source.inputs, 产物: {[source.target_item]: source.output, ...source.byproducts}}]))}};
    const calculation = [Object.fromEntries(Object.entries(automatic).map(([item, source]) => [item, source.output])), {}, {automatic}];
    return {state, calculation, view: buildDependencyView(state, needs, calculation)};
}

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('dependency trees share demand-first source ownership', () => {
    it.each([false, true])('expands the real fire-ice process under graphene without a hydrogen supply root (details: %s)', withDetails => {
        const state = make({recipes: {石墨烯: 1, 氢: 2}});
        if (withDetails) state.settings.production_sources = [{...createProductionSource(state, '太阳帆'), id: 'zero-sails'}];
        const needs = {太阳帆: 60, 氢: 0};
        const calculation = state.calculate(needs);
        const before = structuredClone({calculation, needs, graph: state.item_graph, scheme: state.scheme_data, settings: state.settings});
        const presentation = buildProductionPresentation(state, needs, calculation);
        const view = buildDependencyView(state, needs, calculation, {presentation});
        const graphene = branch(view, '太阳帆', '石墨烯');
        expect(calculation[0]).toMatchObject({石墨烯: 0, 氢: 15, 可燃冰: 30});
        expect(graphene).toMatchObject({branchRate: 30, reason: null,
            production: {capacity: 30, buildings: 0.5, factoryName: '化工厂', status: 'recipe'}});
        expect(graphene.children.map(child => [child.item, child.branchRate])).toEqual([['可燃冰', 30]]);
        expect(view.sources['automatic:automatic-氢']).toMatchObject({
            item: '石墨烯', controlItem: '氢', sourceId: 'automatic-氢', uiId: 'auto:氢',
            outputRate: 30, grossRate: 30, buildings: 0.5, inputs: {可燃冰: 30}, byproducts: {氢: 15},
        });
        expect(view.items.石墨烯).toMatchObject({automaticRate: 30, automaticSourceId: 'automatic:automatic-氢',
            hasCanonicalRow: true, hasCanonicalGroup: true});
        expect(view.items.氢).toMatchObject({automaticRate: 0, byproductRate: 15, surplusRate: 15,
            hasCanonicalRow: false, coproductSourceIds: ['automatic:automatic-氢']});
        expect(view.rows.some(row => row.item === '氢')).toBe(false);
        expect(view.supplyRoots).toEqual([]);
        expect(buildDependencyView(state, needs, calculation)).toEqual(view);
        expect({calculation, needs, graph: state.item_graph, scheme: state.scheme_data, settings: state.settings}).toEqual(before);
    });

    it('retains physical factory fractions across minute and second display units', () => {
        const scenario = {recipes: {石墨烯: 1, 氢: 2}};
        const minute = make(scenario);
        const second = make({...scenario, settings: {is_time_unit_minute: false}});
        const a = buildDependencyView(minute, {太阳帆: 60}, minute.calculate({太阳帆: 60}));
        const b = buildDependencyView(second, {太阳帆: 1}, second.calculate({太阳帆: 1}));
        for (const row of a.rows) {
            const other = b.rows.find(candidate => candidate.id === row.id);
            expect(other).toBeDefined();
            expect(other.branchRate).toBeCloseTo(row.branchRate / 60, 10);
            expect(other.production.capacity).toBeCloseTo(row.production.capacity / 60, 10);
            expect(other.production.buildings).toBeCloseTo(row.production.buildings, 10);
        }
    });

    it('scales a unique moved process for separate branches instead of using the zero default recipe', () => {
        const {view} = synthetic({
            B: physical('B', 0),
            first: physical('first', 1, {}, {B: 5}), second: physical('second', 1, {}, {B: 15}),
            A: physical('A', 10, {B: 20}, {ore: 30}, 4), ore: physical('ore', 30),
        }, {first: 1, second: 1});
        expect(view.items.B).toMatchObject({automaticRate: 20, automaticSourceId: 'automatic:automatic-A', boundaryReasons: []});
        const first = branch(view, 'first', 'B');
        const second = branch(view, 'second', 'B');
        expect(first.production).toMatchObject({capacity: 5, buildings: 1, factoryName: 'factory-A', status: 'recipe'});
        expect(second.production).toMatchObject({capacity: 15, buildings: 3, factoryName: 'factory-A', status: 'recipe'});
        expect(branch(view, 'first', 'B', 'ore').branchRate).toBe(7.5);
        expect(branch(view, 'second', 'B', 'ore').branchRate).toBe(22.5);
        expect(first.production.buildings + second.production.buildings).toBe(view.sources['automatic:automatic-A'].buildings);
        expect(view.supplyRoots).toEqual([]);
        expect(view.rows.some(row => row.item === 'A')).toBe(false);
    });

    it('keeps two different physical processes in one display group without fabricating branch allocations', () => {
        const {view} = synthetic({
            B: physical('B', 0), target: physical('target', 2, {}, {B: 100}),
            A: physical('A', 30, {B: 60}, {ore: 20}, 3),
            C: physical('C', 20, {B: 40}, {water: 10}, 7),
            ore: physical('ore', 20), water: physical('water', 10),
        }, {target: 2});
        expect(view.items.B).toMatchObject({requiredRate: 100, automaticRate: 100, automaticSourceId: null,
            hasCanonicalGroup: true, boundaryReasons: ['multiple-sources']});
        expect(branch(view, 'target', 'B')).toMatchObject({branchRate: 100, reason: 'global-supply', children: [],
            production: {capacity: null, buildings: null, status: 'unallocated'}});
        const sources = view.supplyRoots.filter(row => row.item === 'B');
        expect(sources.map(row => [row.sourceId, row.globalRate])).toEqual([
            ['automatic:automatic-A', 60], ['automatic:automatic-C', 40],
        ]);
        expect(sources.map(row => row.children.map(child => [child.item, child.globalRate]))).toEqual([
            [['ore', 20]], [['water', 10]],
        ]);
        expect(Object.values(view.sources).filter(source => source.item === 'B' && source.outputRate > 0)
            .map(source => [source.uiId, source.buildings, source.byproducts])).toEqual([
            ['auto:A', 3, {A: 30}], ['auto:C', 7, {C: 20}],
        ]);
        expect(view.rows.some(row => ['A', 'C'].includes(row.item))).toBe(false);
        expect(view.items.ore.requiredRate).toBe(20);
        expect(view.items.water.requiredRate).toBe(10);
    });

    it('does not invent gross product units when a moved source has no recipe metadata', () => {
        const needs = {B: 20};
        const {state, calculation} = synthetic({A: physical('A', 10, {B: 20}, {}, 4)}, needs);
        delete state.game_data;
        const view = buildDependencyView(state, needs, calculation);
        expect(view.sources['automatic:automatic-A']).toMatchObject({item: 'B', outputRate: 20, grossRate: null, buildings: 4});
        expect(view.roots[0].production).toMatchObject({capacity: null, buildings: 4, status: 'recipe'});
    });

    it('keeps moved processing visible when the unrelated display-item default is hidden or mineralized', () => {
        const needs = {B: 20};
        const {state, calculation} = synthetic({
            A: physical('A', 10, {B: 20}, {ore: 30}, 4), ore: physical('ore', 30),
        }, needs);
        state.settings = {hide_mines: true, mineralize_list: {B: true}};
        const view = buildDependencyView(state, needs, calculation);
        expect(view.items.B).toMatchObject({hasCanonicalRow: true, hasCanonicalGroup: true, mineralized: false});
        expect(view.roots[0]).toMatchObject({reason: null, production: {capacity: 20, buildings: 4, status: 'recipe'}});
        expect(view.roots[0].children[0]).toMatchObject({item: 'ore', branchRate: 30});
        expect(view.items.ore.hasCanonicalRow).toBe(false);
    });

    it('terminates cycles after a source moves and leaves cycle factory allocations unknown', () => {
        const {view} = synthetic({
            A: physical('A', 40, {B: 80}, {C: 40}, 4),
            C: physical('C', 40, {}, {B: 20}, 2),
        }, {B: 60});
        expect(view.rows).toHaveLength(3);
        expect(view.roots[0].production).toMatchObject({capacity: 60, buildings: 3});
        expect(branch(view, 'B', 'C').production).toMatchObject({capacity: 30, buildings: 1.5});
        expect(branch(view, 'B', 'C', 'B')).toMatchObject({branchRate: 15, reason: 'cycle', referenceId: view.roots[0].id,
            children: [], production: {capacity: null, buildings: null, status: 'unallocated'}});
        expect(view.supplyRoots).toEqual([]);
    });

    it('keeps input and requested-root order while source orientation and IDs stay insertion-order independent', () => {
        const process = physical('A', 10, {B: 20, C: 20}, {water: 5, ore: 10}, 2);
        const automatic = {A: process, water: physical('water', 5), ore: physical('ore', 10)};
        const first = synthetic(automatic, {B: 20, C: 20}).view;
        const reversed = synthetic(Object.fromEntries(Object.entries(automatic).reverse()), {C: 20, B: 20}).view;
        expect(first.roots.map(row => row.item)).toEqual(['B', 'C']);
        expect(reversed.roots.map(row => row.item)).toEqual(['C', 'B']);
        for (const view of [first, reversed]) {
            expect(view.sources['automatic:automatic-A']).toMatchObject({item: 'B', controlItem: 'A', uiId: 'auto:A'});
            expect(branch(view, 'B').children.map(row => row.item)).toEqual(['water', 'ore']);
            expect(branch(view, 'C')).toMatchObject({branchRate: 20, reason: 'global-supply',
                production: {capacity: null, buildings: null, status: 'unallocated'}});
            expect(view.items.C.coproductSourceIds).toEqual(['automatic:automatic-A']);
            expect(view.supplyRoots).toEqual([]);
        }
    });
});
