import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource} from '../src/production_sources.js';
import {buildProductionPresentation} from '../src/lib/production-presentation.js';
import {createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const make = (scenario = {}) => createScenario(api, scenario).state;
const physical = (item, output, byproducts = {}, inputs = {}, extra = {}) => ({
    id: `automatic-${item}`, target_item: item, output, gross_output: output,
    byproducts, inputs, buildings: 3, recipe_id: 7, ...extra,
});
const project = (needs, automatic, sources = [], legacy_sources = []) =>
    buildProductionPresentation({}, needs, [{}, {}, {automatic, sources, legacy_sources}]);
const automaticLine = (view, owner) => view.lines.find(line => line.kind === 'automatic' && line.controlItem === owner);

function freeze(value) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
        if (child && typeof child === 'object' && !Object.isFrozen(child)) freeze(child);
    }
    return value;
}

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('demand-first physical-source presentation', () => {
    it.each([false, true])('presents the real solar-sail fire-ice process under graphene (details: %s)', withDetails => {
        const state = make({recipes: {石墨烯: 1, 氢: 2}});
        if (withDetails) state.settings.production_sources = [{...createProductionSource(state, '太阳帆'), id: 'zero-sails'}];
        const needs = {太阳帆: 60, 氢: 0};
        const calculation = state.calculate(needs);
        expect(calculation[0]).toMatchObject({石墨烯: 0, 氢: 15, 可燃冰: 30});
        const view = buildProductionPresentation(state, needs, calculation);
        const line = automaticLine(view, '氢');
        expect(line).toMatchObject({sourceId: 'auto:氢', controlItem: '氢', displayItem: '石墨烯',
            item: '石墨烯', output: 30, originalOutput: 15, inputs: {可燃冰: 30}, byproducts: {氢: 15}});
        expect(line.recipeId).toBe(state.item_data.氢[2]);
        expect(line.buildings).toBeCloseTo(0.5, 8);
        expect(view.groups.石墨烯).toMatchObject({required: 30, produced: 30, automatic: 30, surplus: 0});
        expect(view.groups.氢).toMatchObject({required: 0, produced: 15, automatic: 0, byproduct_supply: 15, surplus: 15});
        expect(view.order).toContain('石墨烯');
        expect(view.order).not.toContain('氢');
        expect(view.hiddenItems.has('氢')).toBe(true);
        expect(view.byItem.氢.byproducts).toEqual([expect.objectContaining({
            parentItem: '石墨烯', parentControlItem: '氢', parentSourceId: 'auto:氢', output: 15,
        })]);
    });

    it('moves the real inverse plasma-refining process to the explicitly needed refined oil', () => {
        const state = make({recipes: {氢: 1, 精炼油: 2}});
        const needs = {精炼油: 60};
        const calculation = state.calculate(needs);
        expect(calculation[0].氢).toBeGreaterThan(0);
        const view = buildProductionPresentation(state, needs, calculation);
        expect(automaticLine(view, '氢')).toMatchObject({displayItem: '精炼油', output: 60,
            originalOutput: 30, inputs: {原油: 60}, byproducts: {氢: 30}});
        expect(view.groups.精炼油).toMatchObject({required: 60, produced: 60, surplus: 0});
        expect(view.order).not.toContain('氢');
    });

    it('keeps real X-ray self-recycling net and preserves gross physical metadata', () => {
        const base = make();
        const recipeId = base.game_data.recipe_data.findIndex(recipe => recipe.原料.氢 > 0
            && recipe.原料.精炼油 > 0 && recipe.产物.高能石墨 > 0 && recipe.产物.氢 > 0);
        base.scheme_data.item_recipe_choices.氢 = base.item_data.氢.findIndex((id, index) => index > 0 && id === recipeId);
        base.settings.mineralize_list = {精炼油: true};
        const state = new GlobalState(new GameInfo(base.game_data), base.scheme_data, base.settings);
        const needs = {氢: 60};
        const calculation = state.calculate(needs);
        const view = buildProductionPresentation(state, needs, calculation);
        const line = automaticLine(view, '氢');
        expect(line).toMatchObject({displayItem: '氢', output: 60, originalOutput: 60});
        expect(line.gross_output).toBeCloseTo(180, 8);
        expect(line.originalGrossOutput).toBeCloseTo(180, 8);
        expect(line.displayGrossOutput).toBeCloseTo(180, 8);
        expect(line.inputs.精炼油).toBeCloseTo(60, 8);
        expect(line.byproducts.高能石墨).toBeCloseTo(60, 8);
        expect(line.inputs).not.toHaveProperty('氢');
        expect(view.groups.氢).toMatchObject({required: 60, produced: 60, surplus: 0});
        expect(view.order).not.toContain('高能石墨');
    });

    it('credits all other automatic, manual, fixed and external supplies before choosing the binding output', () => {
        const process = physical('A', 100, {B: 100}, {ore: 30});
        const view = project({A: 100, B: 100}, {
            A: process, other: physical('other', 10, {A: 40}),
        }, [physical('A', 30, {}, {}, {id: 'manual-A'})], [physical('A', 30, {}, {}, {id: 'legacy-A'})]);
        expect(automaticLine(view, 'A')).toMatchObject({displayItem: 'B', output: 100, byproducts: {A: 100}});
        expect(view.groups.A).toMatchObject({required: 100, produced: 200, surplus: 100});
        const external = project({A: -100, B: 50}, {A: process});
        expect(automaticLine(external, 'A').displayItem).toBe('B');
        expect(external.groups.A).toMatchObject({required: 0, external: 100, produced: 200, surplus: 200});
    });

    it('compares residual fractions, rather than absolute output or demand', () => {
        const view = project({A: 60, B: 15}, {A: physical('A', 100, {B: 20})});
        expect(automaticLine(view, 'A').displayItem).toBe('B');
        expect(view.groups.A).toMatchObject({required: 60, produced: 100, surplus: 40});
        expect(view.groups.B).toMatchObject({required: 15, produced: 20, surplus: 5});
    });

    it('uses full physical input demand even when several consumers share a coproduct', () => {
        const view = project({one: 10, two: 10, A: 0}, {
            A: physical('A', 100, {B: 100}),
            one: physical('one', 10, {}, {B: 30}), two: physical('two', 10, {}, {B: 70}),
        });
        expect(automaticLine(view, 'A').displayItem).toBe('B');
        expect(view.groups.B.required).toBe(100);
        expect(view.order).not.toContain('A');
    });

    it('uses explicit positive targets only as a tie-break and never treats zero keys as demand', () => {
        const automatic = {A: physical('A', 100, {B: 100}), consumer: physical('consumer', 1, {}, {A: 100})};
        expect(automaticLine(project({B: 100}, automatic), 'A').displayItem).toBe('B');
        const zeroTarget = project({A: 0, consumer: 1}, {
            A: physical('A', 100, {B: 100}), consumer: physical('consumer', 1, {}, {B: 100}),
        });
        expect(automaticLine(zeroTarget, 'A').displayItem).toBe('B');
        expect(zeroTarget.order).not.toContain('A');
        expect(project({A: 0}, {A: physical('A', 0, {B: 0})}).order).toEqual([]);
    });

    it('breaks ties lexically, independently of output and solve-object insertion order', () => {
        const outputs = [{B: 60, A: 60}, {A: 60, B: 60}];
        const views = outputs.map(byproducts => project({A: 30, B: 30}, {Z: physical('Z', 60, byproducts)}));
        for (const view of views) expect(automaticLine(view, 'Z')).toMatchObject({displayItem: 'A', byproducts: {B: 60, Z: 60}});
        expect(views[0].lines).toEqual(views[1].lines);
        const first = project({A: 30, B: 30}, {Z: physical('Z', 60, {B: 60, A: 60}), ore: physical('ore', 10)});
        const reversed = project({B: 30, A: 30}, {ore: physical('ore', 10), Z: physical('Z', 60, {A: 60, B: 60})});
        expect(automaticLine(first, 'Z').displayItem).toBe(automaticLine(reversed, 'Z').displayItem);
        expect(automaticLine(first, 'Z').id).toBe(automaticLine(reversed, 'Z').id);
    });

    it('keeps a positively served original owner when binding fractions and target priority tie', () => {
        const view = project({石墨烯: 120, 氢: 100}, {
            石墨烯: physical('石墨烯', 120, {氢: 60}), 氢: physical('氢', 40),
        });
        expect(automaticLine(view, '石墨烯').displayItem).toBe('石墨烯');
        expect(automaticLine(view, '氢').displayItem).toBe('氢');
        expect(view.groups.氢).toMatchObject({automatic: 40, byproduct_supply: 60, required: 100});
        // A small original target is not enough to override a more binding
        // downstream requirement, even though it is explicitly requested.
        const downstream = project({氢: 5, 太阳帆: 60}, {
            氢: physical('氢', 15, {石墨烯: 30}), 太阳帆: physical('太阳帆', 60, {}, {石墨烯: 30}),
        });
        expect(automaticLine(downstream, '氢').displayItem).toBe('石墨烯');
    });

    it('keeps multiple different automatic processes that move onto one display item', () => {
        const view = project({B: 100}, {
            A: physical('A', 30, {B: 60}, {ore: 20}, {recipe_id: 3}),
            C: physical('C', 20, {B: 40}, {water: 10}, {recipe_id: 9}),
        });
        expect(view.byItem.B.lines.map(line => [line.sourceId, line.output, line.recipeId]))
            .toEqual([['auto:A', 60, 3], ['auto:C', 40, 9]]);
        expect(new Set(view.lines.map(line => line.id)).size).toBe(view.lines.length);
        expect(view.groups.B).toMatchObject({required: 100, automatic: 100, produced: 100, surplus: 0});
    });

    it('never changes a manual or legacy target, source identity, quantity binding, factory or rate', () => {
        const manual = physical('A', 50, {B: 100}, {ore: 40}, {id: 'fixed-buildings',
            quantity_mode: 'buildings', building_quantity: 3, output_per_minute: 50,
            building: 2, recipe_choice: 4, proliferator_mode: 2, proliferator_points: 4,
            physical_buildings: 3, physical_building_count: 3, energy_mw: 7});
        const legacy = physical('A', 0, {}, {}, {id: 'legacy-zero', error: 'repair needed'});
        const view = project({B: 100}, {}, [manual], [legacy]);
        const line = view.byItem.A.lines[0];
        expect(line).toMatchObject({...manual, id: 'manual:fixed-buildings', sourceId: 'fixed-buildings',
            controlItem: 'A', displayItem: 'A', output: 50, originalOutput: 50, byproducts: {B: 100}});
        expect(line.inputs).toBe(manual.inputs);
        expect(line.source).toBe(manual);
        expect(view.order).toContain('A');
        expect(view.hiddenItems.has('A')).toBe(false);
        expect(view.byItem.B.byproducts[0]).toMatchObject({parentSourceId: 'fixed-buildings', ordinal: 1, output: 100});
        expect(view.byItem.A.lines[1]).toMatchObject({kind: 'legacy', displayItem: 'A', error: 'repair needed'});
    });

    it('does not move a source to an undemanded output when all demand is already oversupplied', () => {
        const view = project({Z: 20}, {Z: physical('Z', 30, {A: 50}), other: physical('other', 1, {Z: 40})});
        expect(automaticLine(view, 'Z').displayItem).toBe('Z');
        expect(view.hiddenItems.has('A')).toBe(true);
    });

    it('uses the exact legacy graph and original recipe settings when moved', () => {
        const inputs = {ore: 2, spray: 0.1};
        const state = {settings: {is_time_unit_minute: true}, item_graph: {A: {原料: inputs, 副产物: {B: 3}, 产出倍率: 2}},
            item_data: {A: [null, 7], B: [null, 8]},
            scheme_data: {item_recipe_choices: {A: 1, B: 1}, scheme_for_recipe: {
                7: {建筑: 1, 增产模式: 2, 增产点数: 4}, 8: {建筑: 0, 增产模式: 0, 增产点数: 0},
            }}, game_data: {recipe_data: {7: {设施: 'plant', 原料: {ore: 1}}},
                factory_data: {plant: [{名称: 'slow', 倍率: 1}, {名称: 'fast', 倍率: 2}]}}};
        const view = buildProductionPresentation(state, {B: 180}, [{A: 60}, {}]);
        expect(automaticLine(view, 'A')).toMatchObject({displayItem: 'B', output: 180,
            originalOutput: 60, gross_output: 60, inputs: {ore: 120, spray: 6},
            byproducts: {A: 60}, recipeId: 7, recipe_choice: 1, building: 1,
            proliferator_mode: 2, proliferator_points: 4, factoryName: 'fast', buildings: 0.25});
    });

    it('does not mutate frozen calculations/settings/graphs or invoke a solver', () => {
        const state = make({recipes: {石墨烯: 1, 氢: 2}});
        state.settings.production_sources = [{...createProductionSource(state, '太阳帆'), id: 'zero-sails'}];
        const needs = freeze({太阳帆: 60});
        const calculation = freeze(state.calculate(needs));
        const before = structuredClone({calculation, settings: state.settings, graph: state.item_graph, scheme: state.scheme_data});
        freeze(state.settings);
        freeze(state.item_graph);
        freeze(state.scheme_data);
        const solve = vi.spyOn(state, 'calculate').mockImplementation(() => { throw new Error('Must not solve'); });
        const view = buildProductionPresentation(state, needs, calculation);
        expect(buildProductionPresentation(state, needs, calculation)).toEqual(view);
        expect(solve).not.toHaveBeenCalled();
        expect({calculation, settings: state.settings, graph: state.item_graph, scheme: state.scheme_data}).toEqual(before);
        expect(automaticLine(view, '氢').inputs).toBe(calculation[2].automatic.氢.inputs);
        expect(automaticLine(view, '氢').buildings).toBe(calculation[2].automatic.氢.buildings);
    });

    it('does not promote invalid, nonpositive or self-recycling coproduct entries', () => {
        const view = project({B: 100, invalid: 10}, {
            A: physical('A', 10, {B: 100, A: 50, negative: -2, infinite: Infinity, tiny: 1e-10}),
            invalid: physical('invalid', 10, {B: 1000}, {ore: 100}, {error: 'invalid source'}),
        });
        expect(automaticLine(view, 'A')).toMatchObject({displayItem: 'B', output: 100, byproducts: {A: 10}});
        expect(view.groups.B.produced).toBe(100);
        expect(view.groups.invalid).toMatchObject({required: 10, produced: 0, missing: 10});
        expect(view.groups).not.toHaveProperty('ore');
    });

    it('converts gross capacity to the moved output without copying the owner gross rate', () => {
        const state = {game_data: {recipe_data: {7: {原料: {氢: 2, 精炼油: 1}, 产物: {氢: 3, 高能石墨: 1}}}}};
        const fromHydrogen = buildProductionPresentation(state, {高能石墨: 60}, [{}, {}, {
            automatic: {氢: physical('氢', 60, {高能石墨: 60}, {精炼油: 60}, {gross_output: 180})},
        }]);
        expect(automaticLine(fromHydrogen, '氢')).toMatchObject({displayItem: '高能石墨', output: 60,
            gross_output: 180, displayGrossOutput: 60, buildings: 3});
        const fromGraphite = buildProductionPresentation(state, {氢: 60}, [{}, {}, {
            automatic: {高能石墨: physical('高能石墨', 60, {氢: 60}, {精炼油: 60})},
        }]);
        expect(automaticLine(fromGraphite, '高能石墨')).toMatchObject({displayItem: '氢', output: 60,
            gross_output: 60, displayGrossOutput: 180, buildings: 3});
        expect(automaticLine(project({B: 100}, {A: physical('A', 60, {B: 100})}), 'A').displayGrossOutput).toBeNull();
    });

    it('preserves coupled orbital ownership and its reachable physical fleet controls', () => {
        const line = physical('氢', 100, {重氢: 5}, {}, {shared_collector_group: 'fleet', physical_buildings: 10});
        const view = project({重氢: 5}, {氢: line});
        expect(automaticLine(view, '氢')).toMatchObject({displayItem: '氢', output: 100, physical_buildings: 10});
        expect(view.order).toEqual(['重氢', '氢']);
        expect(view.hiddenItems.has('氢')).toBe(false);
        expect(view.byItem.重氢.byproducts[0]).toMatchObject({parentItem: '氢', parentSourceId: 'auto:氢', output: 5});
    });

    it('keeps unavailable legacy fixed targets reachable and reports missing source detail without inventing it', () => {
        const state = {settings: {natural_production_line: [{目标物品: 'legacy', 建筑数量: 2}]} };
        const view = buildProductionPresentation(state, {}, [{legacy: 0}, {}]);
        expect(view.warnings).toEqual(['legacy-source-details-unavailable']);
        expect(view.order).toEqual(['legacy']);
        expect(view.groups.legacy.produced).toBe(0);
        expect(view.lines.filter(line => line.kind !== 'automatic')).toEqual([]);
    });
});
