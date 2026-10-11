import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import vanilla from '../data/Vanilla.json';
import {default_game_data, get_game_data} from '../src/GameData.jsx';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource, resolveProductionSource} from '../src/production_sources.js';
import {calculateScenario, createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const photon = '临界光子';
const lens = '黑雾引力透镜';
// Default multipliers, full continuous reception and sufficient Dyson supply.
const tiers = [[0, 24], [1, 30], [2, 36], [4, 48]];
const spray = points => ({增产模式: points ? 3 : 0, 增产点数: points});
beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('Dark Fog Lens steady-state photon receiving', () => {
    it('appends a synthetic receiver recipe using the existing receiver-only spray mode', () => {
        expect(vanilla.recipes[240]).toEqual({ID: 31208, Type: -1, Factories: [2208],
            Name: '[射线接收带黑雾透镜]临界光子', Items: [1211], ItemCounts: [1 / 240],
            Results: [1208], ResultCounts: [1], TimeSpend: 150, Proliferator: 4,
            IconName: 'photon-capacitor-full'});
        expect(default_game_data.recipe_data[240]).toMatchObject({原料: {[lens]: 1 / 240},
            产物: {[photon]: 1}, 时间: 2.5, 增产: 4});
        const oldReceiver = default_game_data.recipe_ids.indexOf(21208);
        expect(default_game_data.recipe_data[240].设施).toBe(default_game_data.recipe_data[oldReceiver].设施);
        expect(init_scheme_data(default_game_data).item_recipe_choices[photon]).toBe(1);
    });

    it.each(tiers)('produces the %s-point steady-state rate of %s/min using one receiver and 0.1 lens/min', (points, rate) => {
        const result = calculateScenario(api, {needs: {[photon]: rate}, recipes: {[photon]: 3},
            proliferation: {[photon]: spray(points)}});
        expect(result.production[photon]).toBeCloseTo(rate, 10);
        expect(result.buildings[photon]).toBeCloseTo(1, 10);
        expect(result.production[lens]).toBeCloseTo(0.1, 10);
        expect(result.production['引力透镜']).toBeCloseTo(0.1, 10);
        expect(result.production['黑雾矩阵']).toBeCloseTo(1.2, 10);
    });

    it('feeds antimatter production through the selected Dark Fog receiver', () => {
        const result = calculateScenario(api, {needs: {反物质: 48}, recipes: {[photon]: 3},
            proliferation: {[photon]: spray(4)}});
        expect(result.production['反物质']).toBeCloseTo(48, 10);
        expect(result.production[photon]).toBeCloseTo(48, 10);
        expect(result.buildings[photon]).toBeCloseTo(1, 10);
        expect(result.production[lens]).toBeCloseTo(0.1, 10);
    });

    it.each(tiers)('keeps a manual receiver count fixed at %s points while balancing all lens input', (points, rate) => {
        const {state} = createScenario(api, {});
        const source = {...createProductionSource(state, photon), recipe_choice: 3,
            quantity_mode: 'buildings', building_quantity: 2.5, output_per_minute: 999,
            proliferator_mode: points ? 3 : 0, proliferator_points: points};
        const before = structuredClone(source);
        state.settings.production_sources = [source];
        const [, , details] = state.calculate({[photon]: 144});
        const manual = details.sources[0];
        expect(details.valid).toBe(true);
        expect(manual).toMatchObject({recipe_id: 240, factory_name: '射线接收站',
            quantity_mode: 'buildings', building_quantity: 2.5, buildings: 2.5});
        expect(manual.output_per_minute).toBeCloseTo(rate * 2.5, 10);
        expect(manual.inputs[lens]).toBeCloseTo(0.25, 10);
        if (points) {
            const [proliferator, sprays] = {1: ['增产剂 Mk.I', 12], 2: ['增产剂 Mk.II', 27], 4: ['增产剂 Mk.III', 74]}[points];
            expect(manual.inputs[proliferator]).toBeCloseTo(0.25 / sprays, 10);
        } else expect(manual.inputs).toEqual({[lens]: 0.25});
        expect(details.automatic[photon].output).toBeCloseTo(144 - rate * 2.5, 10);
        expect(details.automatic[lens].output).toBeCloseTo(0.25, 10);
        expect(state.scheme_data.item_recipe_choices[photon]).toBe(1);
        expect(source).toEqual(before);
    });

    it('preserves the ordinary lens choice and balances mixed receiver sources downstream', () => {
        const {state} = createScenario(api, {recipes: {[photon]: 2}});
        state.settings.production_sources = [{...createProductionSource(state, photon), recipe_choice: 3,
            quantity_mode: 'buildings', building_quantity: 1, proliferator_mode: 3, proliferator_points: 4}];
        const [, , details] = state.calculate({反物质: 60});
        expect(details.valid).toBe(true);
        expect(details.sources[0].output).toBeCloseTo(48, 10);
        expect(details.automatic[photon]).toMatchObject({recipe_choice: 2, buildings: 1});
        expect(details.automatic[photon].output).toBeCloseTo(12, 10);
        expect(details.sources[0].inputs[lens]).toBeCloseTo(0.1, 10);
        expect(details.automatic[photon].inputs['引力透镜']).toBeCloseTo(0.1, 10);
        expect(state.scheme_data.item_recipe_choices[photon]).toBe(2);
    });

    it('supports fixed-rate sources and preserves the existing rejection of unsupported spray settings', () => {
        const {state} = createScenario(api, {});
        const source = {...createProductionSource(state, photon), recipe_choice: 3,
            output_per_minute: 48, proliferator_mode: 3, proliferator_points: 4};
        expect(resolveProductionSource(state, source).source.output_per_minute).toBe(48);
        expect(() => resolveProductionSource(state, {...source, proliferator_points: 3})).toThrow('增产剂已失效');
        for (const mode of [1, 2]) {
            expect(() => resolveProductionSource(state, {...source, proliferator_mode: mode})).toThrow('不支持所选增产模式');
        }
    });
});
