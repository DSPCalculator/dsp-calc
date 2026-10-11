import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource, productionSourceNode} from '../src/production_sources.js';
import {baselineSettings} from './helpers/solver-cases.js';

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

function createState({proliferate = true, selfSpray = false, collector = true} = {}) {
    const game = get_game_data([]);
    const info = new GameInfo(game);
    const scheme = init_scheme_data(game);
    if (proliferate) {
        // Match bulk grade III / extra-product settings: acceleration-only
        // recipes (including antimatter and its fuel rods) remain unsprayed.
        game.recipe_data.forEach((recipe, i) => {
            scheme.scheme_for_recipe[i].增产点数 = 4;
            if (recipe.增产 & 2) scheme.scheme_for_recipe[i].增产模式 = 2;
        });
    }
    scheme.item_recipe_choices.石墨烯 = info.item_data.石墨烯.slice(1)
        .findIndex(i => game.recipe_data[i].原料.可燃冰) + 1;
    // These directly gathered materials are selected in #22's screenshots.
    for (const item of [...(collector ? ['氢'] : []), '硅石', '硫酸']) {
        scheme.item_recipe_choices[item] = info.item_data[item].slice(1)
            .findIndex(i => Object.keys(game.recipe_data[i].原料).length === 0) + 1;
    }
    return new GlobalState(info, scheme, {...structuredClone(baselineSettings), proliferate_itself: selfSpray});
}

function expectPhysicalBalance(state, needs, production, surplus) {
    const balance = Object.fromEntries(Object.entries(needs).map(([item, amount]) => [item, -amount]));
    const add = (item, amount) => { balance[item] = (balance[item] || 0) + amount; };
    for (const [item, amount] of Object.entries(production)) {
        // Reconstruct from raw recipes via the separate source normalizer,
        // never the LP's expanded item-price/byproduct coefficients.
        const node = productionSourceNode(state, createProductionSource(state, item));
        add(item, amount);
        for (const [input, rate] of Object.entries(node.inputs)) add(input, -amount * rate);
        for (const [output, rate] of Object.entries(node.byproducts)) add(output, amount * rate);
    }
    for (const item of new Set([...Object.keys(balance), ...Object.keys(surplus)])) {
        expect(balance[item] || 0, `physical balance for ${item}`).toBeCloseTo(surplus[item] || 0, 6);
    }
}

describe('upstream hydrogen surplus regressions', () => {
    // https://github.com/DSPCalculator/dsp-calc/issues/22
    // The screenshots say antimatter fuel rods (反物质燃料棒), not strange
    // annihilation fuel rods. Their displayed 51.11 hydrogen should be 35.15.
    it('counts nested fire-ice byproducts once for the exact issue #22 plan', () => {
        const state = createState();
        const needs = {'反物质燃料棒': 60};
        const [production, surplus] = state.calculate(needs);
        expect(production.氢).toBe(0);
        expect(production.反物质).toBe(360);
        expect(production.石墨烯).toBeCloseTo(70.30995595, 6);
        // 360 antimatter coproduct H - 360 fuel-rod H cancel; fire ice is
        // the only surplus: 1 hydrogen per 2 graphene, including spray inputs.
        expect(surplus.氢).toBeCloseTo(production.石墨烯 / 2, 6);
        expect(surplus.氢).toBeCloseTo(35.154977975, 6);
        expectPhysicalBalance(state, needs, production, surplus);
    });

    it('collects the hydrogen missing after the real coproducts are consumed', () => {
        const state = createState();
        const needs = {'反物质燃料棒': 60, '氢': 50};
        const [production, surplus] = state.calculate(needs);
        expect(production.氢).toBeCloseTo(50 - production.石墨烯 / 2, 6);
        expect(production.氢).toBeGreaterThan(0);
        expect(surplus.氢 || 0).toBe(0);
        expectPhysicalBalance(state, needs, production, surplus);
    });

    it.each([
        ['self-sprayed proliferators', {selfSpray: true}, {'反物质燃料棒': 60}],
        ['explicit hydrogen supply', {}, {'反物质燃料棒': 60, '氢': -20}],
        ['strange annihilation fuel rods', {}, {'奇异湮灭燃料棒': 60}],
        ['oil-refinery hydrogen production', {collector: false}, {'奇异湮灭燃料棒': 60}],
        ['unproliferated fuel rods', {proliferate: false}, {'反物质燃料棒': 60}],
    ])('conserves material with %s', (_name, settings, needs) => {
        const state = createState(settings);
        const [production, surplus] = state.calculate(needs);
        expectPhysicalBalance(state, needs, production, surplus);
    });

    // https://github.com/DSPCalculator/dsp-calc/issues/20
    it('keeps expected oil-refining hydrogen for plastic with zero direct collection', () => {
        const state = createState({proliferate: false});
        const needs = {'塑料': 120};
        const [production, surplus] = state.calculate(needs);
        expect(production.氢).toBe(0);
        expect(production.精炼油).toBe(240);
        expect(surplus.氢).toBe(120);
        expectPhysicalBalance(state, needs, production, surplus);
    });
});
