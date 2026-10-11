import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource, resolveProductionSource} from '../src/production_sources.js';
import {createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const make = (scenario = {}) => createScenario(api, scenario).state;
function line(state, item, count, patch = {}) {
    return {...createProductionSource(state, item), quantity_mode: 'buildings', building_quantity: count, ...patch};
}
function calculate(state, source, needs) {
    state.settings.production_sources = [source];
    return state.calculate(needs)[2];
}
function route(state, item, predicate) {
    return state.item_data[item].slice(1).findIndex(id => predicate(state.game_data.recipe_data[id])) + 1;
}
beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('existing source quantity ownership', () => {
    it('uses exact fractional factory counts to balance output, materials, power, and the automatic remainder', () => {
        const state = make();
        const source = line(state, '铁块', 2.5, {output_per_minute: 999});
        const before = structuredClone(source);
        const details = calculate(state, source, {'铁块': 300});
        expect(details.sources[0]).toMatchObject({quantity_mode: 'buildings', building_quantity: 2.5,
            buildings: 2.5, building_count: 3, output_per_minute: 150, output: 150, inputs: {'铁矿': 150}});
        expect(details.automatic.铁块.output).toBeCloseTo(150);
        expect(details.sources[0].energy_mw).toBeCloseTo(2.5 * 0.36);
        expect(details.totals.rawMaterials.铁矿).toBeCloseTo(300);
        expect(details.totals.fractionalBuildingCounts.电弧熔炉).toBeCloseTo(5);
        expect(details.totals.buildingCounts.电弧熔炉).toBe(6);
        expect(source).toEqual(before);
    });

    it('keeps count fixed across recipe, factory, proliferation mode, and proliferator strength changes', () => {
        const state = make();
        const source = line(state, '铁块', 1.25);
        expect(resolveProductionSource(state, source).source.output_per_minute).toBe(75);
        const faster = {...source, building: 1};
        expect(resolveProductionSource(state, faster).source.output_per_minute).toBe(150);
        const products = {...faster, proliferator_mode: 2, proliferator_points: 4};
        expect(resolveProductionSource(state, products).source.output_per_minute).toBe(187.5);
        expect(resolveProductionSource(state, {...products, proliferator_mode: 1}).source.output_per_minute).toBe(300);
        expect(resolveProductionSource(state, {...products, proliferator_points: 2}).source.output_per_minute).toBe(180);
        const alternate = {...source, recipe_choice: 2};
        const resolved = calculate(state, alternate, {'铁块': 300}).sources[0];
        expect(resolved.buildings).toBe(1.25);
        expect(resolved.output_per_minute).not.toBe(75);
    });

    it('applies actual mining multipliers and the large-miner power curve', () => {
        const state = make({settings: {mining_efficiency_large: 1}});
        const source = line(state, '铁矿', 1.5, {building: 1});
        let details = calculate(state, source, {'铁矿': 6000});
        expect(details.sources[0].output_per_minute).toBe(1440);
        expect(details.sources[0].energy_mw).toBeCloseTo(1.5 * 2.94);
        state.settings.mining_efficiency_large = 3;
        details = state.calculate({'铁矿': 6000})[2];
        expect(details.sources[0].buildings).toBe(1.5);
        expect(details.sources[0].output_per_minute).toBe(4320);
        expect(details.sources[0].energy_mw).toBeCloseTo(1.5 * (0.168 + 2.772 * 9));
        expect(details.automatic.铁矿.output).toBeCloseTo(1680);
    });

    it('uses fractionation throughput and speed-dependent power without treating count as rounded hardware', () => {
        const state = make();
        const source = line(state, '重氢', 2.5, {recipe_choice: route(state, '重氢', recipe => recipe.时间 === 100)});
        let details = calculate(state, source, {'重氢': 300});
        expect(details.sources[0].output_per_minute).toBeCloseTo(45);
        expect(details.sources[0].inputs.氢).toBeCloseTo(45);
        expect(details.sources[0].energy_mw).toBeCloseTo(1.8);
        state.settings.fractionating_speed = 60;
        details = state.calculate({'重氢': 300})[2];
        expect(details.sources[0].output_per_minute).toBeCloseTo(90);
        expect(details.sources[0].buildings).toBe(2.5);
        expect(details.sources[0].energy_mw).toBeCloseTo(4.5);
    });

    it('normalizes recycling recipes by net output and balances their materials', () => {
        const state = make();
        const source = line(state, '氢', 2.5, {recipe_choice: route(state, '氢', recipe => recipe.原料.氢 === 2),
            proliferator_mode: 1, proliferator_points: 4});
        const details = calculate(state, source, {'氢': 100});
        // X-ray cracking: 3 - 2 net hydrogen every four seconds, at 2x speed.
        expect(details.sources[0].output_per_minute).toBeCloseTo(2.5 * 2 / 4 * 60);
        expect(details.sources[0].inputs.精炼油).toBeCloseTo(2.5 * 2 / 4 * 60);
        expect(details.sources[0].byproducts.高能石墨).toBeCloseTo(2.5 * 2 / 4 * 60);
        expect(details.valid).toBe(true);
    });

    it('keeps physical count, canonical rate, and power unchanged in per-second display', () => {
        const minute = make();
        const second = make({settings: {is_time_unit_minute: false}});
        const source = line(minute, '铁块', 1.23456789);
        const a = calculate(minute, source, {'铁块': 300});
        const b = calculate(second, source, {'铁块': 5});
        expect(b.sources[0].buildings).toBe(1.23456789);
        expect(b.sources[0].output_per_minute).toBe(a.sources[0].output_per_minute);
        expect(b.sources[0].output).toBeCloseTo(a.sources[0].output / 60);
        expect(b.totals.totalEnergyCost).toBeCloseTo(a.totals.totalEnergyCost);
    });

    it('supports zero count and excess output without changing demand', () => {
        const state = make();
        let details = calculate(state, line(state, '铁块', 0), {'铁块': 300});
        expect(details.sources[0]).toMatchObject({output: 0, buildings: 0, energy_mw: 0});
        expect(details.automatic.铁块.output).toBe(300);
        details = calculate(state, line(state, '铁块', 6.25), {'铁块': 300});
        expect(details.automatic.铁块.output).toBe(0);
        expect(details.groups.铁块).toMatchObject({required: 300, surplus: 75});
    });

    it.each([-1, NaN, Infinity, -Infinity, '', null, undefined, 'broken', Number.MAX_VALUE])('retains invalid count %s for repair without corrupting balances', count => {
        const state = make();
        const source = line(state, '铁块', count);
        const details = calculate(state, source, {'铁块': 300});
        expect(details.valid).toBe(false);
        expect(details.sources[0].error).toBeTruthy();
        expect(details.sources[0]).toMatchObject({output: 0, buildings: 0, energy_mw: 0});
        expect(details.automatic.铁块.output).toBe(300);
    });

    it('defaults older sources to fixed output and lets rate ownership override a stale count', () => {
        const state = make();
        const source = {...createProductionSource(state, '铁块'), output_per_minute: 150};
        delete source.quantity_mode;
        let details = calculate(state, source, {'铁块': 300});
        expect(details.sources[0]).toMatchObject({quantity_mode: 'rate', output: 150, buildings: 2.5});
        details = calculate(state, {...source, quantity_mode: 'rate', building_quantity: 99, building: 1}, {'铁块': 300});
        expect(details.sources[0]).toMatchObject({output: 150, buildings: 1.25});
    });
});
