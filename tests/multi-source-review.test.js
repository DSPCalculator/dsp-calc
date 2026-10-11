import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {baselineSettings, createScenario, solverCases} from './helpers/solver-cases.js';

// Independent acceptance oracles: rates below follow the shipped recipes, not
// production_sources.js helper results. Keep numerical assertions unrounded.
const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const mega = 'Gnimaerd.DSP.plugin.MoreMegaStructure';
const voidMod = 'com.ckcz123.DSP_Battle';
let nextId = 0;

beforeEach(() => {
    nextId = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function sourceFor(state, item, quantity, options = {}) {
    let recipeChoice = options.recipe_choice ?? state.scheme_data.item_recipe_choices[item];
    if (options.matchRecipe) {
        recipeChoice = state.item_data[item].findIndex((id, index) => index > 0 &&
            options.matchRecipe(state.game_data.recipe_data[id], state.game_data.factory_data[state.game_data.recipe_data[id].设施]));
        expect(recipeChoice, `A matching ${item} recipe exists`).toBeGreaterThan(0);
    }
    const recipeId = state.item_data[item][recipeChoice];
    const setting = state.scheme_data.scheme_for_recipe[recipeId];
    return {
        id: `review-${nextId++}`,
        target_item: item,
        standalone: options.standalone === true,
        output_per_minute: quantity,
        recipe_choice: recipeChoice,
        building: options.building ?? setting.建筑,
        proliferator_mode: options.proliferator_mode ?? setting.增产模式,
        proliferator_points: options.proliferator_points ?? setting.增产点数,
    };
}

function close(actual, expected, message) {
    expect(Number.isFinite(actual), `${message}: finite`).toBe(true);
    expect(Math.abs(actual - expected), message).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(expected)));
}

function sameNumbers(actual, expected, message) {
    for (const key of new Set([...Object.keys(actual), ...Object.keys(expected)])) {
        close(actual[key] ?? 0, expected[key] ?? 0, `${message}: ${key}`);
    }
}

function recipeBuildings(state, production) {
    const totals = {};
    for (const [item, output] of Object.entries(production)) {
        const recipeId = state.item_data[item][state.scheme_data.item_recipe_choices[item]];
        const config = state.scheme_data.scheme_for_recipe[recipeId];
        const factory = state.game_data.factory_data[state.game_data.recipe_data[recipeId].设施][config.建筑];
        const key = `${recipeId}/${config.建筑}/${config.增产模式}/${config.增产点数}`;
        totals[key] = (totals[key] ?? 0) + output / 60 / state.item_graph[item].产出倍率 / factory.倍率;
    }
    return totals;
}

function reportedRecipeBuildings(details) {
    const totals = {};
    for (const line of [...Object.values(details.automatic), ...details.sources]) {
        const key = `${line.recipe_id}/${line.building}/${line.proliferator_mode}/${line.proliferator_points}`;
        totals[key] = (totals[key] ?? 0) + line.buildings;
    }
    return totals;
}

function balanced(details) {
    expect(details).toBeDefined();
    for (const [item, group] of Object.entries(details.groups)) {
        close(group.automatic + group.allocated + group.byproduct_supply,
            group.required + group.surplus, `mass balance for ${item}`);
        for (const value of Object.values(group)) {
            if (typeof value === 'number') expect(value, item).toBeGreaterThanOrEqual(-1e-6);
        }
    }
    expect(new Set(details.order).size).toBe(details.order.length);
}

const routes = [
    {name: 'orbital collection', matchRecipe: recipe => !Object.keys(recipe.原料).length,
        buildings: 6.25, hydrogen: 0, factory: '轨道采集器', energy: 0},
    {name: 'fractionation', matchRecipe: recipe => recipe.时间 === 100,
        buildings: 150 / 18, hydrogen: 150, factory: '分馏塔', energy: 6},
    {name: 'particle collision', matchRecipe: recipe => recipe.原料.氢 === 10,
        buildings: 1.25, hydrogen: 300, factory: '微型粒子对撞机', energy: 15},
];

describe('independent multi-source numerical review', () => {
    it.each(solverCases)('zero allocation preserves legacy solver exactly: $name', scenario => {
        const {state} = createScenario(api, scenario);
        const expected = state.calculate(structuredClone(scenario.needs));
        const item = Object.keys(scenario.needs)[0];
        state.settings.production_sources = [sourceFor(state, item, 0)];
        const actual = state.calculate(structuredClone(scenario.needs));
        expect(actual.slice(0, 2)).toEqual(expected.slice(0, 2));
    });

    it.each(solverCases.filter(scenario => !scenario.settings?.natural_production_line))(
        'a tiny identical allocation does not change physical totals: $name', scenario => {
            const {state} = createScenario(api, scenario);
            const item = Object.keys(scenario.needs)[0];
            state.settings.production_sources = [sourceFor(state, item, 0)];
            const [, , baseline] = state.calculate(scenario.needs);
            state.settings.production_sources[0].output_per_minute = 0.00001;
            const [, , active] = state.calculate(scenario.needs);
            sameNumbers(active.totals.rawMaterials, baseline.totals.rawMaterials, 'raw material parity');
            sameNumbers(active.totals.fractionalBuildingCounts, baseline.totals.fractionalBuildingCounts, 'physical factory parity');
            close(active.totals.totalEnergyCost, baseline.totals.totalEnergyCost, 'physical power parity');
            expect(active.errors).toEqual([]);
            balanced(active);
        },
    );

    it('does not add a numerical result row for a zero unrelated source', () => {
        const {state} = createScenario(api, {});
        const expected = state.calculate({'铁块': 60});
        state.settings.production_sources = [sourceFor(state, '铜块', 0)];
        const actual = state.calculate({'铁块': 60});
        expect(actual.slice(0, 2)).toEqual(expected.slice(0, 2));
        expect(actual[2].sources).toHaveLength(0);
        expect(actual[2].paused_sources).toHaveLength(1);
        expect(actual[2].paused_sources[0].target_item).toBe('铜块');
    });

    it.each([
        {output_per_minute: -1}, {output_per_minute: Infinity}, {output_per_minute: 'broken'},
        {target_item: 'unknown item'}, {recipe_choice: 99999}, {building: 99999},
        {proliferator_mode: 5}, {proliferator_points: 9},
    ])('keeps an invalid source repairable without corrupting the solution: %j', invalid => {
        const {state} = createScenario(api, {});
        const baseline = state.calculate({'铁块': 60});
        state.settings.production_sources = [{...sourceFor(state, '铁块', 30), ...invalid}];
        const actual = state.calculate({'铁块': 60});
        expect(actual.slice(0, 2)).toEqual(baseline.slice(0, 2));
        expect(actual[2].sources[0].error).toBeTruthy();
        close(actual[2].sources[0].output, 0, 'invalid source contributes nothing');
    });

    it('reports combined numeric overflow without emitting non-finite group totals', () => {
        const {state} = createScenario(api, {});
        const expected = state.calculate({'铁块': 60});
        state.settings.production_sources = [sourceFor(state, '铁块', 1e308), sourceFor(state, '铁块', 1e308)];
        const actual = state.calculate({'铁块': 60});
        expect(actual.slice(0, 2)).toEqual(expected.slice(0, 2));
        expect(actual[2].errors.length).toBeGreaterThan(0);
        for (const source of actual[2].sources) {
            expect(source.error).toBeTruthy();
            expect(source.output).toBe(0);
        }
        balanced(actual[2]);
    });

    it.each(routes)('allocates 150/min deuterium by $name against 60/min gravity matrices', route => {
        const {state} = createScenario(api, {needs: {'引力矩阵': 60}});
        state.settings.production_sources = [sourceFor(state, '重氢', 150, route)];
        const [automatic, surplus, details] = state.calculate({'引力矩阵': 60});
        close(automatic.重氢, 150, 'remaining deuterium');
        close(surplus.重氢 ?? 0, 0, 'deuterium surplus');
        close(details.groups.重氢.required, 300, 'deuterium demand');
        close(details.groups.重氢.allocated, 150, 'deuterium allocation');
        const source = details.sources[0];
        close(source.buildings, route.buildings, 'source buildings');
        close(source.inputs.氢 ?? 0, route.hydrogen, 'source hydrogen');
        close(source.energy_mw, route.energy, 'source energy');
        expect(source.factory_name).toBe(route.factory);
        balanced(details);
    });

    it('adds three routes once, limits automatic output to zero, and exposes over-allocation', () => {
        const {state} = createScenario(api, {});
        state.settings.production_sources = routes.map(route => sourceFor(state, '重氢', 150, route));
        const [automatic, surplus, details] = state.calculate({'引力矩阵': 60});
        close(automatic.重氢 ?? 0, 0, 'automatic deuterium');
        close(surplus.重氢, 150, 'surplus deuterium');
        close(details.groups.重氢.required, 300, 'required deuterium');
        close(details.groups.重氢.allocated, 450, 'allocated deuterium');
        expect(details.sources).toHaveLength(3);
        close(details.sources.reduce((sum, source) => sum + (source.inputs.氢 ?? 0), 0), 450, 'total manual hydrogen');
        balanced(details);
    });

    it('uses canonical per-minute source quantities when the display is per second', () => {
        const {state: minutes} = createScenario(api, {});
        const {state: seconds} = createScenario(api, {settings: {is_time_unit_minute: false}});
        minutes.settings.production_sources = [sourceFor(minutes, '重氢', 150, routes[1])];
        seconds.settings.production_sources = [sourceFor(seconds, '重氢', 150, routes[1])];
        const minute = minutes.calculate({'引力矩阵': 60});
        const second = seconds.calculate({'引力矩阵': 1});
        sameNumbers(second[0], Object.fromEntries(Object.entries(minute[0]).map(([item, amount]) => [item, amount / 60])), 'automatic rates');
        sameNumbers(second[1], Object.fromEntries(Object.entries(minute[1]).map(([item, amount]) => [item, amount / 60])), 'surplus rates');
        close(second[2].sources[0].output, 2.5, 'source display output');
        close(second[2].sources[0].buildings, minute[2].sources[0].buildings, 'same physical factory count');
        close(second[2].totals.totalEnergyCost, minute[2].totals.totalEnergyCost, 'same physical power');
        balanced(second[2]);
    });

    it.each([
        {name: 'iron', needs: {'铁块': 120}, item: '铁块'},
        {name: 'circuits', needs: {'电路板': 120}, item: '电路板'},
        {name: 'faster circuit assembler', needs: {'电路板': 120}, item: '电路板', factories: {'电路板': '制造台 Mk.III'}},
        {name: 'extra-product circuits', needs: {'电路板': 120}, item: '电路板', proliferation: {'电路板': {增产点数: 4, 增产模式: 2}}},
        {name: 'speed circuits', needs: {'电路板': 120}, item: '电路板', proliferation: {'电路板': {增产点数: 4, 增产模式: 1}}},
        {name: 'ore with adjusted mining speed', needs: {'铁矿': 120}, item: '铁矿', settings: {mining_speed_multiple: 2, covered_veins_small: 12}},
    ])('splitting an identical $name route preserves production and surplus', scenario => {
        const {state} = createScenario(api, scenario);
        const [baseProduction, baseSurplus] = state.calculate(scenario.needs);
        state.settings.production_sources = [sourceFor(state, scenario.item, 30), sourceFor(state, scenario.item, 50)];
        const [production, surplus, details] = state.calculate(scenario.needs);
        close((production[scenario.item] ?? 0) + 80, baseProduction[scenario.item], 'combined primary production');
        // A coproduct recipe can be attributed to either of its output rows by
        // an LP tie. Compare physical execution of each recipe, not that label.
        sameNumbers(reportedRecipeBuildings(details), recipeBuildings(state, baseProduction), 'same physical recipe execution');
        sameNumbers(surplus, baseSurplus, 'surplus');
        balanced(details);
    });

    it('counts standalone manual input requirements even for an unrelated, overproduced item', () => {
        const {state} = createScenario(api, {});
        state.settings.production_sources = [sourceFor(state, '铜块', 30, {standalone: true})];
        const [automatic, surplus, details] = state.calculate({'铁块': 60});
        close(automatic.铁块, 60, 'requested iron');
        close(automatic.铜矿, 30, 'manual copper inputs');
        close(automatic.铜块 ?? 0, 0, 'automatic copper');
        close(surplus.铜块, 30, 'unused manual copper');
        close(details.groups.铜块.required, 0, 'no downstream copper demand');
        balanced(details);
    });

    it('net-normalizes X-ray cracking once and credits both kinds of byproduct', () => {
        const {state} = createScenario(api, {});
        state.settings.production_sources = [sourceFor(state, '氢', 60, {matchRecipe: recipe => recipe.原料.氢 === 2})];
        const [automatic, surplus, details] = state.calculate({'氢': 60});
        const source = details.sources[0];
        close(source.buildings, 4, 'cracking refineries');
        close(source.inputs.精炼油, 60, 'net cracking oil consumption');
        close(source.inputs.氢 ?? 0, 0, 'internal hydrogen is netted');
        close(source.byproducts.高能石墨, 60, 'cracking graphite');
        close((automatic.精炼油 ?? 0) + details.groups.精炼油.byproduct_supply, 60, 'oil for cracking');
        close((automatic.氢 ?? 0) + details.groups.氢.byproduct_supply, 30, 'refining also makes hydrogen');
        close(surplus.氢, 30, 'oil refining also makes hydrogen');
        close(surplus.高能石墨, 60, 'unused cracking graphite');
        close(details.totals.fractionalBuildingCounts.原油精炼厂, 6, 'four cracking plus two refining facilities');
        balanced(details);
    });

    it('net-normalizes reforming and counts its coal and hydrogen inputs', () => {
        const {state} = createScenario(api, {settings: {mineralize_list: {'氢': true, '煤矿': true}}});
        state.settings.production_sources = [sourceFor(state, '精炼油', 60, {matchRecipe: recipe => recipe.原料.精炼油 === 2})];
        const [automatic, surplus, details] = state.calculate({'精炼油': 60});
        close(details.sources[0].buildings, 4, 'reforming refineries');
        close(details.sources[0].inputs.氢, 60, 'reforming hydrogen');
        close(details.sources[0].inputs.煤矿, 60, 'reforming coal');
        close(automatic.精炼油 ?? 0, 0, 'no additional oil');
        close(surplus.精炼油 ?? 0, 0, 'no oil surplus');
        balanced(details);
    });

    it('credits a manual coproduct as the complete supply of another target without a duplicate facility', () => {
        const {state} = createScenario(api, {});
        state.settings.production_sources = [sourceFor(state, '石墨烯', 120, {
            matchRecipe: recipe => recipe.原料.可燃冰 === 2,
        })];
        const [automatic, surplus, details] = state.calculate({'石墨烯': 120, '氢': 60});
        close(automatic.石墨烯 ?? 0, 0, 'all graphene manually allocated');
        close(automatic.氢 ?? 0, 0, 'hydrogen entirely supplied by coproduct');
        close(details.groups.氢.byproduct_supply, 60, 'hydrogen coproduct supply');
        close(surplus.氢 ?? 0, 0, 'no hydrogen excess');
        close(details.sources[0].buildings, 2, 'graphene plants counted once');
        close(details.totals.fractionalBuildingCounts.化工厂, 2, 'combined plant count');
        close(details.totals.rawMaterials.可燃冰, 120, 'manual source raw input');
        balanced(details);
    });

    it('balances external supply and mineralized materials with manual allocations', () => {
        const {state} = createScenario(api, {settings: {mineralize_list: {'铁块': true}}});
        state.settings.production_sources = [sourceFor(state, '电路板', 60)];
        const [automatic, surplus, details] = state.calculate({'电路板': 120, '铜块': -90});
        close(automatic.电路板, 60, 'remaining automatic circuit output');
        close(automatic.铁块, 120, 'mineralized iron supply');
        close(automatic.铜块 ?? 0, 0, 'no copper manufacture');
        close(surplus.铜块, 30, 'unused external copper');
        close(details.totals.rawMaterials.铁块, 120, 'mineralized raw total');
        expect(details.totals.buildingCounts.电弧熔炉 ?? 0).toBe(0);
        balanced(details);
    });

    it('scales advanced-miner power by physical building count and the ratio-valued speed setting', () => {
        const {state} = createScenario(api, {settings: {mining_efficiency_large: 1}});
        state.settings.production_sources = [sourceFor(state, '铁矿', 960, {building: 1})];
        const first = state.calculate({'铁矿': 960})[2];
        close(first.sources[0].buildings, 1, 'one100-percent advanced miner');
        close(first.sources[0].energy_mw, 2.94, 'one nominal miner power');
        state.settings.production_sources[0].output_per_minute = 1920;
        const double = state.calculate({'铁矿': 1920})[2];
        close(double.sources[0].energy_mw, 5.88, 'double nominal miner power');
        state.settings.mining_efficiency_large = 3;
        state.settings.production_sources[0].output_per_minute = 2880;
        const fast = state.calculate({'铁矿': 2880})[2];
        close(fast.sources[0].buildings, 1, 'one300-percent advanced miner');
        // Retain the repository's intended quadratic power curve, with the
        // ratio-valued speed and facility multiplicity applied consistently.
        close(fast.sources[0].energy_mw, 0.168 + 2.772 * 9, 'quadratic mining power');
        close(fast.totals.energyCost, 0, 'mining excluded from production-only power');
        close(fast.totals.totalEnergyCost, fast.sources[0].energy_mw, 'mining included in total power');
        balanced(fast);
    });

    it('accounts for fractional buildings and per-source integer hardware without double-counting output', () => {
        const {state} = createScenario(api, {});
        state.settings.production_sources = [sourceFor(state, '铁块', 30), sourceFor(state, '铁块', 30)];
        const [automatic, , details] = state.calculate({'铁块': 120});
        close(automatic.铁块, 60, 'remaining iron');
        close(details.totals.fractionalBuildingCounts.电弧熔炉, 2, 'two effective smelters');
        expect(details.totals.buildingCounts.电弧熔炉).toBe(3);
        close(details.totals.rawMaterials.铁矿, 120, 'iron ore counted once');
        close(details.totals.energyCost, 0.72, 'smelter working power');
        close(details.totals.totalEnergyCost, 0.93, 'smelters plus half mining machine');
        balanced(details);
    });

    it('counts extra-product spraying with blue-buff returned ingredients', () => {
        const {state} = createScenario(api, {mods: [mega, voidMod], settings: {blue_buff: true}});
        state.settings.production_sources = [sourceFor(state, '电路板', 120, {proliferator_mode: 2, proliferator_points: 4})];
        const [automatic, surplus, details] = state.calculate({'电路板': 120});
        const source = details.sources[0];
        close(source.inputs.铜块, 48, 'copper per120 sprayed circuits');
        close(source.inputs.铁块 ?? 0, 0, 'returned iron is netted');
        close(source.byproducts.铁块, 24, 'extra returned iron');
        close(source.inputs['增产剂 Mk.III'], 144 / 74, 'self-sprayed proliferator');
        close(automatic.电路板 ?? 0, 0, 'all circuit output allocated');
        // Upstream proliferator production may consume some returned iron.
        expect(surplus.铁块 ?? 0).toBeLessThanOrEqual(24 + 1e-6);
        balanced(details);
    });

    it('does not leak blue-buff recipe returns into a later disabled calculation on the same game data', () => {
        const game = get_game_data([mega, voidMod]);
        const info = new GameInfo(game);
        const scheme = init_scheme_data(game);
        const enabled = new GlobalState(info, scheme, {...structuredClone(baselineSettings), blue_buff: true});
        enabled.settings.production_sources = [sourceFor(enabled, '电路板', 120)];
        enabled.calculate({'电路板': 120});
        const disabled = new GlobalState(info, scheme, {...structuredClone(baselineSettings), blue_buff: false});
        disabled.settings.production_sources = [sourceFor(disabled, '电路板', 120)];
        const [, , details] = disabled.calculate({'电路板': 120});
        close(details.sources[0].inputs.铁块 ?? 0, 120, 'disabled buff consumes iron normally');
        close(details.sources[0].byproducts.铁块 ?? 0, 0, 'disabled buff does not return iron');
        balanced(details);
    });

    it('uses the lens-spraying output boost without increasing lens consumption', () => {
        const {state} = createScenario(api, {settings: {mineralize_list: {'引力透镜': true, '增产剂 Mk.III': true}}});
        state.settings.production_sources = [sourceFor(state, '临界光子', 60, {
            matchRecipe: recipe => recipe.增产 === 4,
            proliferator_mode: 3, proliferator_points: 4,
        })];
        const [, , details] = state.calculate({'临界光子': 60});
        close(details.sources[0].buildings, 2.5, 'sprayed receivers');
        close(details.sources[0].inputs.引力透镜, 0.25, 'lens input per minute');
        close(details.sources[0].inputs['增产剂 Mk.III'], 0.25 / 74, 'lens proliferator');
        balanced(details);
    });

    it('applies mandatory fractionating proliferation to net output of a self-recycling recipe', () => {
        const {state} = createScenario(api, {
            mods: ['com.menglei.dsp.FractionateEverything'],
            settings: {mineralize_list: {'增产剂 Mk.III': true}},
        });
        state.settings.production_sources = [sourceFor(state, '铁矿', 60, {
            matchRecipe: recipe => recipe.增产 === 8,
            proliferator_mode: 0, proliferator_points: 0,
        })];
        const [, , details] = state.calculate({'铁矿': 60});
        const source = details.sources[0];
        expect(source.proliferator_mode).toBe(4);
        expect(source.proliferator_points).toBe(10);
        close(source.buildings, 1 / 3, 'net fractionation buildings');
        close(source.inputs.铁矿 ?? 0, 0, 'recycled iron is internal');
        close(source.inputs['增产剂 Mk.III'], 60 / 32, 'ten-point self-sprayed proliferator');
        balanced(details);
    });
});

// Four tiny routes make objective-function choices independently auditable:
// 1 ore -> 1 iron + 1 copper; 2 ore -> 1 copper; 1 iron -> 1 gear.
function costScenario() {
    const game = {
        mods: [], item_grid: {'铁矿': 101, '铁块': 102, '铜块': 103, '齿轮': 104},
        proliferator_data: [{增产点数: 0}],
        proliferator_effect: [{增产效果: 1, 加速效果: 1, 耗电倍率: 1}],
        factory_data: [
            [{名称: '原料设备', 倍率: 1, 耗能: 1, 占地: 1}],
            [{名称: '联产设备', 倍率: 1, 耗能: 1, 占地: 1}],
            [{名称: '独产设备', 倍率: 1, 耗能: 10, 占地: 10}],
            [{名称: '齿轮设备', 倍率: 1, 耗能: 1, 占地: 1}],
        ],
        recipe_data: [
            {原料: {}, 产物: {'铁矿': 1}, 时间: 1, 设施: 0, 增产: 0},
            {原料: {'铁矿': 1}, 产物: {'铁块': 1, '铜块': 1}, 时间: 1, 设施: 1, 增产: 0},
            {原料: {'铁矿': 2}, 产物: {'铜块': 1}, 时间: 1, 设施: 2, 增产: 0},
            {原料: {'铁块': 1}, 产物: {'齿轮': 1}, 时间: 1, 设施: 3, 增产: 0},
        ],
    };
    const scheme = init_scheme_data(game);
    scheme.item_recipe_choices.铜块 = 2;
    return new GlobalState(new GameInfo(game), scheme, structuredClone(baselineSettings));
}

describe('independent full-LP objective review', () => {
    it('honors a high item-cost override when choosing whether to overproduce a coproduct route', () => {
        const state = costScenario();
        Object.assign(state.scheme_data.cost_weight.物品额外成本.铁块, {启用: 1, 额外成本: 100, 与其它成本累计: 0});
        state.settings.production_sources = [sourceFor(state, '齿轮', 1, {standalone: true})];
        const [automatic, surplus, details] = state.calculate({'铜块': 10});
        close(automatic.铁块, 1, 'only required coproduct iron');
        close(automatic.铜块, 9, 'remaining copper direct');
        close(automatic.铁矿, 19, 'required ore');
        close(surplus.铁块 ?? 0, 0, 'no surplus iron');
        balanced(details);
    });

    it('applies surplus disposal penalties even when an item overrides its other costs', () => {
        const state = costScenario();
        Object.assign(state.scheme_data.cost_weight.物品额外成本.铁块, {
            启用: 1, 额外成本: 0.01, 与其它成本累计: 0, 溢出时处理成本: 100,
        });
        state.settings.production_sources = [sourceFor(state, '齿轮', 1, {standalone: true})];
        const [automatic, surplus, details] = state.calculate({'铜块': 10});
        close(automatic.铁块, 1, 'avoid disposing nine unnecessary iron');
        close(automatic.铜块, 9, 'make copper directly');
        close(surplus.铁块 ?? 0, 0, 'no surplus iron');
        balanced(details);
    });
});
