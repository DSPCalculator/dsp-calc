import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState, ApplyBuildingMultiplier} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import baseline from './fixtures/solver-baseline.json';
import {baselineSettings, calculateScenario, createScenario, solverCases} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('pre-refactor numerical regression', () => {
    it.each(solverCases)('$name', scenario => {
        const actual = calculateScenario(api, scenario);
        const expected = baseline.cases[scenario.name];
        expect(expected).toBeDefined();
        for (const section of Object.keys(actual)) {
            expect(Object.keys(actual[section]).sort()).toEqual(Object.keys(expected[section]).sort());
            for (const [item, value] of Object.entries(actual[section])) {
                expect(Number.isFinite(value), `${section}: ${item}`).toBe(true);
                expect(value, `${section}: ${item}`).toBeCloseTo(expected[section][item], 7);
            }
        }
    });

    it('does not mutate incoming scheme or demand when normalizing proliferation', () => {
        const scenario = solverCases.find(testCase => testCase.name === 'vanilla normalized proliferation points');
        const {state, scheme} = createScenario(api, scenario);
        const recipeId = state.item_data['电路板'][scheme.item_recipe_choices['电路板']];
        expect(scheme.scheme_for_recipe[recipeId].增产点数).toBe(0);
        expect(state.scheme_data.scheme_for_recipe[recipeId].增产点数).toBe(4);
        const needs = structuredClone(scenario.needs);
        const before = structuredClone(needs);
        state.calculate(needs);
        expect(needs).toEqual(before);
    });

    it('initializes independent schemes with every recipe and item', () => {
        const game = get_game_data([]);
        const first = init_scheme_data(game);
        const second = init_scheme_data(game);
        expect(first.scheme_for_recipe).toHaveLength(game.recipe_data.length);
        expect(Object.keys(first.item_recipe_choices).sort()).toEqual(new GameInfo(game).all_target_items.sort());
        first.scheme_for_recipe[0].建筑 = 999;
        first.cost_weight.建筑成本.分拣器 = 99;
        expect(second.scheme_for_recipe[0].建筑).toBe(0);
        expect(second.cost_weight.建筑成本.分拣器).toBe(0);
    });

    it.each([
        ['采矿机', '铁矿', 8],
        ['大型采矿机', '铁矿', 48],
        ['原油萃取站', '原油', 3],
        ['轨道采集器', '氢', 1],
        ['轨道采集器', '重氢', 0.05],
        ['轨道采集器', '氦', 0.02],
        ['大气采集站', '氮', 1.2],
        ['分馏塔', '重氢', 30],
        ['伊卡洛斯', '铁块', 1],
    ])('preserves %s multiplier for %s', (building, item, expected) => {
        expect(ApplyBuildingMultiplier(1, building, item, baselineSettings)).toBe(expected);
    });
});
