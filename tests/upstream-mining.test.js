import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data, GenesisBookGUID, FractionateEverythingGUID} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource, migrateLegacyProductionSources, productionSourceNode} from '../src/production_sources.js';
import {baselineSettings, solverCases} from './helpers/solver-cases.js';

// Distinct panel values catch accidentally swapping two resources' settings.
const settings = {...baselineSettings, mining_speed_multiple: 2, covered_veins_small: 6,
    covered_veins_large: 15, mining_efficiency_large: 2.5, mining_speed_oil: 4,
    mining_speed_hydrogen: 1.3, mining_speed_deuterium: 0.08, mining_speed_gas_hydrate: 0.6,
    mining_speed_helium: 0.03, mining_speed_ammonia: 0.7, mining_speed_nitrogen: 1.1,
    mining_speed_oxygen: 0.9, mining_speed_carbon_dioxide: 0.3, mining_speed_sulfur_dioxide: 0.7,
    fractionating_speed: 60};

function make(mods = [], overrides = {}, configure = () => {}) {
    const game = get_game_data(mods);
    const info = new GameInfo(game);
    const scheme = init_scheme_data(game);
    configure(game, info, scheme);
    return new GlobalState(info, scheme, structuredClone({...settings, ...overrides}));
}

function route(state, item, factoryName) {
    for (const [offset, recipeId] of state.item_data[item].slice(1).entries()) {
        const factory = state.game_data.factory_data[state.game_data.recipe_data[recipeId].设施];
        const building = factory.findIndex(candidate => candidate.名称 === factoryName);
        if (building !== -1) return {recipe_choice: offset + 1, building};
    }
    throw new Error(`Missing route: ${item} / ${factoryName}`);
}

const cases = [
    {item: '铁矿', factory: '采矿机', rate: 0.5 * 2 * 6},
    {item: '铁矿', factory: '大型采矿机', rate: 1 * 2 * 15 * 2.5},
    {item: '原油', factory: '原油萃取站', rate: 1 * 2 * 4},
    {item: '氢', factory: '轨道采集器', rate: 8 * 2 * 1.3},
    {item: '重氢', factory: '轨道采集器', rate: 8 * 2 * 0.08},
    {item: '可燃冰', factory: '轨道采集器', rate: 8 * 2 * 0.6},
    {item: '水', factory: '抽水站', rate: 5 / 6 * 2},
    {item: '重氢', factory: '分馏塔', rate: 1 / 100 * 60},
    {item: '重氢', factory: '分馏塔', rate: 1 / 100 * 60 * 2, mode: 1, points: 4},
    {item: '氦', factory: '轨道采集器', rate: 10 * 2 * 0.03, mods: [GenesisBookGUID]},
    {item: '氨', factory: '轨道采集器', rate: 10 * 2 * 0.7, mods: [GenesisBookGUID]},
    {item: '氮', factory: '大气采集站', rate: 10 * 2 * 1.1, mods: [GenesisBookGUID]},
    {item: '氧', factory: '大气采集站', rate: 10 * 2 * 0.9, mods: [GenesisBookGUID]},
    {item: '二氧化碳', factory: '大气采集站', rate: 10 * 2 * 0.3, mods: [GenesisBookGUID]},
    {item: '二氧化硫', factory: '大气采集站', rate: 10 * 2 * 0.7, mods: [GenesisBookGUID]},
    {item: '水', factory: '聚束液体汲取设施', rate: 50 / 3 * 2, mods: [GenesisBookGUID]},
    {item: '重氢', factory: '自然资源分馏塔', rate: 1 / 20 * 60, mods: [FractionateEverythingGUID]},
];

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('upstream #28 / #63: existing resource lines use the configured production rates', () => {
    it.each(cases)('applies settings to a fixed allocation: $item / $factory / mode $mode', scenario => {
        const state = make(scenario.mods);
        const source = {...createProductionSource(state, scenario.item), ...route(state, scenario.item, scenario.factory),
            output_per_minute: 120, proliferator_mode: scenario.mode || 0, proliferator_points: scenario.points || 0};
        const node = productionSourceNode(state, source);
        expect(node.output_per_second).toBeCloseTo(scenario.rate, 9);
        state.settings.production_sources = [source];
        const [, , details] = state.calculate({[scenario.item]: 240});
        expect(details.sources[0].error).toBeNull();
        expect(details.sources[0].buildings).toBeCloseTo(120 / 60 / scenario.rate, 9);
        expect(details.sources[0].output).toBe(120);
    });

    it.each(cases)('applies settings to legacy fixed buildings: $item / $factory / mode $mode', scenario => {
        const state = make(scenario.mods);
        const selected = route(state, scenario.item, scenario.factory);
        const line = {目标物品: scenario.item, 配方id: selected.recipe_choice, 建筑: selected.building,
            建筑数量: 2, 增产点数: scenario.points || 0, 增产模式: scenario.mode || 0};
        state.settings.natural_production_line = [line];
        // Use collection for automatic deuterium so a self-fractionation route
        // cannot create a second source of the fixed line's consumed product.
        const automatic = route(state, scenario.item, scenario.factory.endsWith('分馏塔') ? '轨道采集器' : scenario.factory);
        const configured = make(scenario.mods, {natural_production_line: [line]}, (_game, info, scheme) => {
            scheme.item_recipe_choices[scenario.item] = automatic.recipe_choice;
            scheme.scheme_for_recipe[info.item_data[scenario.item][automatic.recipe_choice]].建筑 = automatic.building;
        });
        const demand = scenario.rate * 60 * 3;
        const [production] = configured.calculate({[scenario.item]: demand});
        expect(production[scenario.item]).toBeCloseTo(scenario.rate * 60, 7);
        const [migrated] = migrateLegacyProductionSources(configured);
        expect(migrated.output_per_minute).toBeCloseTo(scenario.rate * 60 * 2, 7);
    });
});

const datasets = [...new Map(solverCases.map(scenario => {
    const mods = scenario.mods || [];
    return [mods.join(','), {mods, name: get_game_data(mods).game_name}];
})).values()];

describe('upstream #2: orbital fire ice remains available', () => {
    it.each(datasets)('offers the collector and uses its panel in $name', ({mods}) => {
        const state = make(mods);
        const source = {...createProductionSource(state, '可燃冰'), ...route(state, '可燃冰', '轨道采集器')};
        const expected = (mods.includes(GenesisBookGUID) ? 10 : 8) * 2 * 0.6;
        expect(productionSourceNode(state, source).output_per_second).toBeCloseTo(expected, 9);
    });
});

describe('Genesis atmosphere panels keep their resource identities across supported combinations', () => {
    it.each(datasets.filter(({mods}) => mods.includes(GenesisBookGUID)))('uses each gas panel in $name', ({mods}) => {
        for (const [item, panel] of [['氮', 'mining_speed_nitrogen'], ['氧', 'mining_speed_oxygen'],
            ['二氧化碳', 'mining_speed_carbon_dioxide'], ['二氧化硫', 'mining_speed_sulfur_dioxide']]) {
            const state = make(mods);
            const selected = route(state, item, '大气采集站');
            const source = {...createProductionSource(state, item), ...selected};
            const expected = 10 * settings.mining_speed_multiple * settings[panel];
            expect(productionSourceNode(state, source).output_per_second, item).toBeCloseTo(expected, 9);
            const automatic = make(mods, {}, (_game, info, scheme) => {
                scheme.item_recipe_choices[item] = selected.recipe_choice;
                scheme.scheme_for_recipe[info.item_data[item][selected.recipe_choice]].建筑 = selected.building;
            });
            expect(automatic.item_graph[item].产出倍率 * 10, item).toBeCloseTo(expected, 9);
        }
    });
});

describe('FractionateEverything existing proliferation fractionators', () => {
    it.each(datasets.filter(({mods}) => mods.includes(FractionateEverythingGUID)))('honors belt speed and spray points in $name', ({mods}) => {
        const state = make(mods);
        const selected = route(state, '重氢', '增产分馏塔');
        const recipe = state.game_data.recipe_data[state.item_data.重氢[selected.recipe_choice]];
        const points = 4;
        // One net deuterium per cycle. Keep the bundled recipe's floating-point
        // duration rather than rounding it to ten seconds.
        const rate = (recipe.产物.重氢 - recipe.原料.重氢) / recipe.时间 * settings.fractionating_speed * points / 10;
        const source = {...createProductionSource(state, '重氢'), ...selected,
            proliferator_mode: 4, proliferator_points: points};
        expect(productionSourceNode(state, source).output_per_second).toBeCloseTo(rate, 9);
        const line = {目标物品: '重氢', 配方id: selected.recipe_choice, 建筑: selected.building,
            建筑数量: 2, 增产点数: points, 增产模式: 4};
        const collector = route(state, '重氢', '轨道采集器');
        const legacy = make(mods, {natural_production_line: [line]}, (_game, info, scheme) => {
            scheme.item_recipe_choices.重氢 = collector.recipe_choice;
            scheme.scheme_for_recipe[info.item_data.重氢[collector.recipe_choice]].建筑 = collector.building;
        });
        const [production] = legacy.calculate({'重氢': rate * 60 * 3});
        expect(production.重氢).toBeCloseTo(rate * 60, 7);
        expect(production[state.game_data.proliferator_data.find(pro => pro.增产点数 === points).增产剂]).toBeGreaterThan(0);
    });
});
