import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data, GenesisBookGUID, MoreMegaStructureGUID, TheyComeFromVoidGUID, FractionateEverythingGUID, DarkFogSynthesisGUID} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource} from '../src/production_sources.js';
import {createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const profiles = [[], [FractionateEverythingGUID], [GenesisBookGUID], [GenesisBookGUID, FractionateEverythingGUID],
    [MoreMegaStructureGUID], [MoreMegaStructureGUID, FractionateEverythingGUID],
    [MoreMegaStructureGUID, GenesisBookGUID], [MoreMegaStructureGUID, GenesisBookGUID, FractionateEverythingGUID],
    [MoreMegaStructureGUID, TheyComeFromVoidGUID], [MoreMegaStructureGUID, TheyComeFromVoidGUID, FractionateEverythingGUID],
    [MoreMegaStructureGUID, TheyComeFromVoidGUID, GenesisBookGUID],
    [MoreMegaStructureGUID, TheyComeFromVoidGUID, GenesisBookGUID, FractionateEverythingGUID], [DarkFogSynthesisGUID]]
    .map(mods => ({mods, name: get_game_data(mods).game_name}));
const genesis = profiles.filter(({mods}) => mods.includes(GenesisBookGUID));
const mega = profiles.filter(({mods}) => mods.includes(MoreMegaStructureGUID));

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

function configured(mods, recipeId, item, mode = 0, blue = false) {
    const base = createScenario(api, {mods}).state;
    const ordinal = base.game_data.recipe_ids.indexOf(recipeId);
    expect(ordinal).toBeGreaterThanOrEqual(0);
    const outputs = base.game_data.recipe_data[ordinal].产物;
    const recipes = Object.fromEntries(Object.keys(outputs).map(output =>
        [output, base.item_data[output].findIndex((id, index) => index > 0 && id === ordinal)]));
    // Isolate the audited physical process from unrelated upstream recipes.
    const mineralize_list = Object.fromEntries(Object.keys(base.item_data)
        .filter(name => !(name in outputs)).map(name => [name, true]));
    const state = createScenario(api, {mods, recipes, settings: {mineralize_list, blue_buff: blue},
        proliferation: {[item]: {增产模式: mode, 增产点数: mode ? 4 : 0}}}).state;
    return {state, ordinal, source: {...createProductionSource(state, item), output_per_minute: 0}};
}

function verifyProcess(details, ordinal, expected) {
    expect(details.errors).toEqual([]);
    const lines = [...Object.values(details.automatic), ...details.sources]
        .filter(line => line.recipe_id === ordinal && line.output > 1e-8);
    const inputs = {};
    const outputs = {};
    for (const line of lines) {
        outputs[line.target_item] = (outputs[line.target_item] || 0) + line.output;
        for (const [item, amount] of Object.entries(line.inputs)) inputs[item] = (inputs[item] || 0) + amount;
        for (const [item, amount] of Object.entries(line.byproducts)) outputs[item] = (outputs[item] || 0) + amount;
    }
    for (const [item, amount] of Object.entries(expected.inputs)) expect(inputs[item] || 0, item).toBeCloseTo(amount, 7);
    for (const [item, amount] of Object.entries(expected.outputs)) expect(outputs[item] || 0, item).toBeCloseTo(amount, 7);
    expect(lines.reduce((sum, line) => sum + line.buildings, 0)).toBeCloseTo(expected.buildings, 7);
    expect(new Set(lines.map(line => line.factory_name)).size).toBe(1);
    expect(details.totals.fractionalBuildingCounts[lines[0].factory_name]).toBeCloseTo(expected.buildings, 7);
    for (const group of Object.values(details.groups)) {
        expect(group.automatic + group.allocated + group.byproduct_supply).toBeCloseTo(group.required + group.surplus, 6);
        expect(group.missing).toBeLessThan(1e-6);
    }
}

// Numeric oracles are taken directly from the shipped recipe quantities,
// durations and factory speeds, independently of productionSourceNode.
const genesisProcesses = [
    {id: 401, item: '铀矿', mode: 2, needs: {铀矿: 60, 钚矿: 30},
        inputs: {放射性矿物: 96, 氢氧化钠: 96}, outputs: {铀矿: 60, 钚矿: 30}, buildings: 0.4},
    {id: 40401, item: '铀矿', mode: 0, needs: {铀矿: 60, 钚矿: 30},
        inputs: {放射性矿物: 60, 氢氧化钠: 60}, outputs: {铀矿: 60, 钚矿: 30}, buildings: 0.125},
    {id: 801, item: '氯化钠', mode: 2, needs: {氯化钠: 60, 水: 240},
        inputs: {海水: 192}, outputs: {氯化钠: 60, 水: 240}, buildings: 0.6},
    {id: 58, item: '氢', mode: 1, needs: {氢: 60, 高能石墨: 60},
        inputs: {焦油: 60, 氢: 0}, outputs: {氢: 60, 高能石墨: 60}, buildings: 0.25},
];

describe('real mod recipes share coproduct supply and charge their physical process once', () => {
    it.each(profiles)('credits sprayed fire-ice hydrogen with the correct factory speed in $name', ({mods}) => {
        const {state, ordinal, source} = configured(mods, 32, '石墨烯', 2);
        // 2 fire ice -> 2 graphene + 1 H in 2 s; chemical speed is 1,
        // or 4 in Genesis. Mk.III extra output is 1.25, not extra speed.
        const expected = {inputs: {可燃冰: 96}, outputs: {石墨烯: 120, 氢: 60},
            buildings: mods.includes(GenesisBookGUID) ? 0.4 : 1.6};
        for (const allocated of [0, 60, 120]) {
            state.settings.production_sources = [{...source, output_per_minute: allocated}];
            verifyProcess(state.calculate(expected.outputs)[2], ordinal, expected);
        }
    });

    it.each(genesis)('balances Genesis recipes with automatic, partial and fixed output in $name', ({mods}) => {
        for (const process of genesisProcesses) {
            const {state, ordinal, source} = configured(mods, process.id, process.item, process.mode);
            for (const allocated of [0, 30, 60]) {
                state.settings.production_sources = [{...source, output_per_minute: allocated}];
                verifyProcess(state.calculate(process.needs)[2], ordinal, process);
            }
        }
    });

    it.each(mega)('credits Mega logistics vessels without a second assembly process in $name', ({mods}) => {
        const {state, ordinal, source} = configured(mods, 562, '星际物流运输站');
        const expected = {inputs: {多功能集成组件: 300}, outputs: {星际物流运输站: 60, 星际物流运输船: 600},
            buildings: mods.includes(GenesisBookGUID) ? 0.05 : 2 / 15};
        for (const allocated of [0, 30, 60]) {
            state.settings.production_sources = [{...source, output_per_minute: allocated}];
            verifyProcess(state.calculate(expected.outputs)[2], ordinal, expected);
        }
    });

    it.each(genesis.filter(({mods}) => mods.includes(TheyComeFromVoidGUID)))(
        'nets blue-buff returns with recycled hydrogen and speed spraying in $name', ({mods}) => {
            const {state, ordinal, source} = configured(mods, 58, '氢', 1, true);
            const expected = {inputs: {焦油: 0, 氢: 0, 增产剂: 180 / 74},
                outputs: {氢: 60, 高能石墨: 60, 焦油: 120}, buildings: 0.25};
            for (const allocated of [0, 30, 60]) {
                state.settings.production_sources = [{...source, output_per_minute: allocated}];
                verifyProcess(state.calculate({氢: 60, 高能石墨: 60})[2], ordinal, expected);
            }
        });

    it('keeps separately entered manual mod lines physically additive despite identical recipe IDs', () => {
        const {state, ordinal, source} = configured([GenesisBookGUID], 401, '铀矿', 2);
        state.settings.production_sources = [{...source, output_per_minute: 60},
            {...createProductionSource(state, '钚矿'), output_per_minute: 30}];
        verifyProcess(state.calculate({铀矿: 60, 钚矿: 30})[2], ordinal,
            {inputs: {放射性矿物: 192, 氢氧化钠: 192}, outputs: {铀矿: 120, 钚矿: 60}, buildings: 0.8});
    });
});

describe('synthetic mod acquisition retains its explicit provenance boundary', () => {
    it.each(profiles)('does not encode planet or multi-output acquisition identity in $name', ({mods}) => {
        const game = get_game_data(mods);
        const multi = game.recipe_data.filter(recipe => Object.keys(recipe.产物).length > 1);
        expect(multi).toHaveLength(4 + (mods.includes(GenesisBookGUID) ? 10 : 0)
            + (mods.includes(MoreMegaStructureGUID) ? 3 : 0));
        expect(multi.every(recipe => Object.keys(recipe.原料).length > 0)).toBe(true);
        for (const id of [11011, 11120, 11121,
            ...(mods.includes(GenesisBookGUID) ? [16234, 17002, 16220, 17019, 16205, 16206] : [])]) {
            const recipe = game.recipe_data[game.recipe_ids.indexOf(id)];
            expect(recipe.原料).toEqual({});
            expect(Object.keys(recipe.产物)).toHaveLength(1);
        }
    });
});
