import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource} from '../src/production_sources.js';
import {buildLinkedByproducts} from '../src/lib/linked-byproducts.js';
import {createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
// Independent recipe oracles: one execution per second, no spray. X-ray rates
// are net of the two hydrogen units recycled internally on each execution.
const families = [
    {name: 'fire ice', primary: '石墨烯', secondary: '氢', input: '可燃冰', primaryRate: 120, secondaryRate: 60, inputRate: 120, buildings: 2},
    {name: 'plasma refining', primary: '精炼油', secondary: '氢', input: '原油', primaryRate: 120, secondaryRate: 60, inputRate: 120, buildings: 4},
    {name: 'X-ray cracking', primary: '氢', secondary: '高能石墨', input: '精炼油', primaryRate: 60, secondaryRate: 60, inputRate: 60, buildings: 4},
    {name: 'photon splitting', primary: '反物质', secondary: '氢', input: '临界光子', primaryRate: 120, secondaryRate: 120, inputRate: 120, buildings: 2},
];
beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

function make(family, isolate = true) {
    const base = createScenario(api, {}).state;
    const id = base.game_data.recipe_data.findIndex(recipe => recipe.原料[family.input] > 0
        && recipe.产物[family.primary] > 0 && recipe.产物[family.secondary] > 0);
    expect(id).toBeGreaterThanOrEqual(0);
    for (const item of [family.primary, family.secondary]) {
        base.scheme_data.item_recipe_choices[item] = base.item_data[item].findIndex((value, index) => index > 0 && value === id);
    }
    // Isolate this process; separate tests below retain the full upstream chain.
    if (isolate) base.settings.mineralize_list = Object.fromEntries([
        family.input, ...Object.keys(base.item_data).filter(item => item.startsWith('增产剂')),
    ].map(item => [item, true]));
    return new GlobalState(new GameInfo(base.game_data), base.scheme_data, base.settings);
}
const needsFor = family => ({[family.primary]: family.primaryRate, [family.secondary]: family.secondaryRate});
const source = (state, item, output, overrides = {}) => ({...createProductionSource(state, item), output_per_minute: output, ...overrides});
const sum = (lines, value) => lines.reduce((total, line) => total + value(line), 0);
function processLines(state, details, family) {
    const id = state.item_data[family.primary][state.scheme_data.item_recipe_choices[family.primary]];
    return [...Object.values(details.automatic), ...details.sources].filter(line => line.recipe_id === id);
}
function expectProcess(state, details, family, {scale = 1, buildings = family.buildings * scale} = {}) {
    const lines = processLines(state, details, family);
    expect(sum(lines, line => line.inputs[family.input] || 0)).toBeCloseTo(family.inputRate * scale, 6);
    expect(sum(lines, line => line.buildings)).toBeCloseTo(buildings, 6);
    for (const [item, rate] of [[family.primary, family.primaryRate], [family.secondary, family.secondaryRate]]) {
        expect(sum(lines, line => line.target_item === item ? line.output : line.byproducts[item] || 0), item).toBeCloseTo(rate * scale, 6);
    }
    expect(lines.every(line => !line.shared_collector_group && line.physical_buildings === undefined)).toBe(true);
    expect(details.valid).toBe(true);
    expect(details.errors).toEqual([]);
    for (const [item, group] of Object.entries(details.groups)) {
        expect(group.automatic + group.allocated + group.byproduct_supply, item).toBeCloseTo(group.required + group.surplus, 6);
        expect(group.missing, item).toBeLessThan(1e-6);
    }
    return lines;
}

describe.each(families)('$name physical production and coproduct allocation', family => {
    it('executes one automatic process for both outputs and preserves the no-source baseline', () => {
        const state = make(family);
        const needs = needsFor(family);
        const baseline = state.calculate(needs);
        expect(baseline[0][family.input]).toBeCloseTo(family.inputRate, 6);
        expect((baseline[0][family.primary] || 0) / family.primaryRate
            + (baseline[0][family.secondary] || 0) / family.secondaryRate).toBeCloseTo(1, 6);
        state.settings.production_sources = [source(state, family.primary, 0)];
        const calculation = state.calculate(needs);
        expect(calculation.slice(0, 2)).toEqual(baseline);
        const lines = expectProcess(state, calculation[2], family);
        expect(lines.filter(line => line.output > 1e-8)).toHaveLength(1);
        expect(calculation[2].shared_collectors).toEqual([]);
    });

    it.each(['primary', 'secondary'])('credits a half-size %s source before adding automatic capacity', role => {
        const state = make(family);
        const item = family[role];
        const needs = needsFor(family);
        const saved = source(state, item, needs[item] / 2);
        state.settings.production_sources = [saved];
        const before = structuredClone(saved);
        const calculation = state.calculate(needs);
        const details = calculation[2];
        const lines = expectProcess(state, details, family);
        expect(details.sources[0].buildings).toBeCloseTo(family.buildings / 2, 6);
        expect(sum(lines.filter(line => line.id !== saved.id), line => line.buildings)).toBeCloseTo(family.buildings / 2, 6);
        expect(calculation[1]).toEqual({});
        expect(saved).toEqual(before);
        const projection = buildLinkedByproducts(state, needs, calculation);
        for (const [coproduct, rate] of Object.entries(details.sources[0].byproducts)) {
            expect(projection.byItem[coproduct]).toContainEqual(expect.objectContaining({
                parentKind: 'manual', parentSourceId: saved.id, parentItem: item, output: rate,
            }));
        }
    });

    it('keeps same-item forks additive and rounds factory counts per independent line', () => {
        const state = make(family);
        state.settings.production_sources = [source(state, family.primary, family.primaryRate / 4), source(state, family.primary, family.primaryRate / 4)];
        const [, surplus, details] = state.calculate(needsFor(family));
        const lines = expectProcess(state, details, family);
        expect(new Set(details.sources.map(line => line.id)).size).toBe(2);
        expect(details.sources.map(line => line.buildings)).toEqual([family.buildings / 4, family.buildings / 4]);
        expect(sum(lines, line => line.building_count)).toBe(2 * Math.ceil(family.buildings / 4) + Math.ceil(family.buildings / 2));
        expect(surplus).toEqual({});
    });

    it('does not merge independent full-size sources merely because they use the same recipe', () => {
        const state = make(family);
        state.settings.production_sources = [source(state, family.primary, family.primaryRate), source(state, family.secondary, family.secondaryRate)];
        const [automatic, surplus, details] = state.calculate(needsFor(family));
        expectProcess(state, details, family, {scale: 2});
        expect(automatic[family.primary] || 0).toBe(0);
        expect(automatic[family.secondary] || 0).toBe(0);
        expect(automatic[family.input]).toBeCloseTo(family.inputRate * 2, 6);
        expect(surplus[family.primary]).toBeCloseTo(family.primaryRate, 6);
        expect(surplus[family.secondary]).toBeCloseTo(family.secondaryRate, 6);
        expect(details.sources.map(line => line.buildings)).toEqual([family.buildings, family.buildings]);
    });

    it.each(['primary', 'secondary'])('preserves unequal spray settings on the %s source and automatic remainder', role => {
        const state = make(family);
        const item = family[role];
        const needs = needsFor(family);
        state.settings.production_sources = [source(state, item, needs[item] / 2, {proliferator_mode: 1, proliferator_points: 4})];
        const [, surplus, details] = state.calculate(needs);
        const lines = expectProcess(state, details, family, {buildings: family.buildings * 3 / 4});
        const fixed = details.sources[0];
        expect(fixed).toMatchObject({buildings: family.buildings / 4, proliferator_mode: 1, proliferator_points: 4});
        expect(Object.entries(fixed.inputs).some(([material, rate]) => material.startsWith('增产剂') && rate > 0)).toBe(true);
        const automatic = lines.filter(line => line.id !== fixed.id && line.output > 1e-8);
        expect(automatic).toHaveLength(1);
        expect(automatic[0]).toMatchObject({proliferator_mode: 0, buildings: family.buildings / 2});
        expect(surplus).toEqual({});
    });

    it('sizes one automatic process to the larger coproduct requirement', () => {
        const state = make(family);
        state.settings.production_sources = [source(state, family.primary, 0)];
        const needs = {...needsFor(family), [family.secondary]: family.secondaryRate * 1.5};
        const [, surplus, details] = state.calculate(needs);
        expectProcess(state, details, family, {scale: 1.5});
        expect(surplus[family.primary]).toBeCloseTo(family.primaryRate / 2, 6);
        expect(surplus[family.secondary] || 0).toBe(0);
    });

    it('keeps source configuration and capacity separate through full-LP canonicalization', () => {
        const state = make(family);
        // Any disposal penalty bypasses the compatible legacy solver, forcing
        // the full balance model and equivalent-automatic-recipe canonicalizer.
        state.scheme_data.cost_weight.物品额外成本[family.primary].溢出时处理成本 = 1;
        const fixed = source(state, family.secondary, family.secondaryRate / 2, {proliferator_mode: 1, proliferator_points: 4});
        state.settings.production_sources = [fixed];
        const [, surplus, details] = state.calculate(needsFor(family));
        const lines = expectProcess(state, details, family, {buildings: family.buildings * 3 / 4});
        expect(details.sources[0]).toMatchObject({id: fixed.id, target_item: family.secondary, proliferator_mode: 1, buildings: family.buildings / 4});
        const automatic = lines.filter(line => line.id !== fixed.id && line.output > 1e-8);
        expect(automatic).toHaveLength(1);
        expect(automatic[0]).toMatchObject({proliferator_mode: 0, buildings: family.buildings / 2});
        expect(surplus).toEqual({});
    });

    it('retains input and machine totals with the full upstream chain', () => {
        const state = make(family, false);
        state.settings.production_sources = [source(state, family.primary, family.primaryRate / 2)];
        const [, surplus, details] = state.calculate(needsFor(family));
        expectProcess(state, details, family);
        if (family.input === '精炼油') {
            // The 60 oil needed for cracking makes another 30 hydrogen.
            expect(details.totals.fractionalBuildingCounts.原油精炼厂).toBeCloseTo(6, 6);
            expect(details.totals.rawMaterials.原油).toBeCloseTo(60, 6);
            expect(surplus.氢).toBeCloseTo(30, 6);
        } else {
            expect(surplus).toEqual({});
        }
    });
});

it('keeps ordinary and quantum chemical plants distinct while crediting both hydrogen coproducts', () => {
    const family = families[0];
    const state = make(family);
    state.settings.production_sources = [source(state, family.primary, 60, {building: 1})];
    const [, surplus, details] = state.calculate(needsFor(family));
    expectProcess(state, details, family, {buildings: 1.5});
    expect(details.sources[0]).toMatchObject({factory_name: '量子化工厂', buildings: 0.5, inputs: {可燃冰: 60}, byproducts: {氢: 30}});
    expect(details.automatic.石墨烯).toMatchObject({factory_name: '化工厂', buildings: 1, inputs: {可燃冰: 60}, byproducts: {氢: 30}});
    expect(details.totals.fractionalBuildingCounts).toMatchObject({量子化工厂: 0.5, 化工厂: 1});
    expect(surplus).toEqual({});
});

it('counts two independent half-loaded plants as two machines and gives their coproduct links no extra machines', () => {
    const family = families[0];
    const state = make(family);
    state.settings.production_sources = [source(state, '石墨烯', 30), source(state, '石墨烯', 30)];
    const needs = {石墨烯: 60, 氢: 30};
    const calculation = state.calculate(needs);
    const details = calculation[2];
    expectProcess(state, details, family, {scale: 0.5});
    expect(details.sources.map(line => line.buildings)).toEqual([0.5, 0.5]);
    expect(details.sources.map(line => line.building_count)).toEqual([1, 1]);
    expect(details.totals.fractionalBuildingCounts.化工厂).toBe(1);
    expect(details.totals.buildingCounts.化工厂).toBe(2);
    const links = buildLinkedByproducts(state, needs, calculation).byItem.氢;
    expect(links).toHaveLength(2);
    expect(links.map(line => line.output)).toEqual([15, 15]);
    expect(links.map(line => line.parentSourceId)).toEqual(state.settings.production_sources.map(line => line.id));
    expect(links.every(line => line.buildings === undefined && line.building_count === undefined)).toBe(true);
});
