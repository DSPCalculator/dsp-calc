import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource} from '../src/production_sources.js';
import {buildLinkedByproducts} from '../src/lib/linked-byproducts.js';
import {estimateLogistics} from '../src/logistics.js';
import {createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('coproduct provenance through group and logistics totals', () => {
    it.each([30, 60])('counts two independent graphene lines once when hydrogen demand is %s/min', hydrogen => {
        const {state} = createScenario(api, {recipes: {石墨烯: 2}, settings: {mineralize_list: {可燃冰: true}}});
        state.settings.production_sources = ['graphene-a', 'graphene-b'].map(id => ({
            ...createProductionSource(state, '石墨烯'), id, output_per_minute: 60,
        }));
        const needs = {石墨烯: 120, 氢: hydrogen};
        const calculation = state.calculate(needs);
        const [automatic, , details] = calculation;
        expect(details.totals.fractionalBuildingCounts.化工厂).toBeCloseTo(2, 9);
        expect(details.totals.buildingCounts.化工厂).toBe(2);
        expect(details.sources.map(line => line.inputs.可燃冰)).toEqual([60, 60]);
        expect(automatic.氢 || 0).toBe(0);
        expect(details.groups.氢).toMatchObject({required: hydrogen, allocated: 0, automatic: 0,
            byproduct_supply: 60, surplus: 60 - hydrogen});
        const linked = buildLinkedByproducts(state, needs, calculation);
        expect(linked.byItem.氢.map(line => [line.parentSourceId, line.output]))
            .toEqual([['graphene-a', 30], ['graphene-b', 30]]);
        const before = structuredClone(details);
        const logistics = estimateLogistics(state, '氢', {automaticOutput: 0,
            manualSources: details.sources, byproductSupply: linked.byItem.氢.reduce((sum, line) => sum + line.output, 0)});
        expect(logistics.totalPerSecond).toBe(1); // Transport all physical H, including any surplus.
        const coproduct = logistics.sources.find(line => line.kind === 'byproduct');
        expect(coproduct).toMatchObject({buildings: null, factoryName: '', outputPerSecond: 1});
        expect(coproduct.sorter.status).toBe('unavailable');
        expect(details).toEqual(before); // Display and logistics cannot allocate another facility.
    });

    it('keeps untraced coproduct logistics conservative instead of inventing stacked output capacity', () => {
        const {state} = createScenario(api, {recipes: {石墨烯: 2}});
        state.scheme_data.pile_sorter_level = 6;
        const result = estimateLogistics(state, '氢', {byproductSupply: 60});
        const coproduct = result.sources.find(line => line.kind === 'byproduct');
        expect(result.totalPerSecond).toBe(1);
        expect(coproduct.belt).toMatchObject({stackHeight: 1, grossKnown: false, cargoPerSecond: 1});
        expect(coproduct.belt.reason).toContain('副产物来源未追溯');
        expect(result.sorter.complete).toBe(false);
    });
});
