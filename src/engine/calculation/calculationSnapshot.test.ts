import assert from 'node:assert/strict';
import {buildCalculationSnapshot} from './calculationSnapshot';
import type {GameData, SchemeData, Settings} from '@engine/types/domain';

function test(name: string, fn: () => void): void {
    try {
        fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        console.error(error);
        process.exitCode = 1;
    }
}

test('物品成本使用已包含建筑倍率的等效产出率', () => {
    const game_data: GameData = {
        MoreMegaStructureEnable: false,
        GenesisBookEnable: false,
        OrbitalRingEnable: false,
        FractionateEverythingEnable: false,
        TheyComeFromVoidEnable: false,
        mod_name_list: [],
        mod_guid_list: [],
        game_name: 'test',
        item_grid: {},
        item_grid_index_valid: {},
        item_icon_name: {},
        recipe_data: [{
            名称: '高速熔炼',
            原料: {铁矿: 1},
            产物: {铁块: 1},
            设施: 0,
            时间: 1,
            增产: 0,
        }],
        factory_data: [[{名称: '高速熔炉', 耗能: 6, 倍率: 3, 产物倍率: 1, 占地: 1}]],
        proliferator_data: [{名称: '无', 增产剂: 0, 喷涂次数: 0, 增产点数: 0, 增产效果: 1, 加速效果: 1, 耗电倍率: 1}],
        proliferator_effect: [{增产效果: 1, 加速效果: 1, 耗电倍率: 1}],
    };
    const scheme_data: SchemeData = {
        item_recipe_choices: {铁块: 0},
        scheme_for_recipe: [{建筑: 0, 增产点数: 0, 增产模式: 0}],
        cost_weight: {
            占地: 1,
            电力: 1,
            建筑成本: {分拣器: 0, 高速熔炉: 0},
            物品额外成本: {
                铁矿: {成本: 0, 启用: 0, 与其它成本累计: 0},
                铁块: {成本: 0, 启用: 0, 与其它成本累计: 0},
            },
        },
    };
    const snapshot = buildCalculationSnapshot({
        game_data,
        item_data: {铁矿: [], 铁块: [0]},
        raw_scheme_data: scheme_data,
        settings: {
            stack_research_lab: 1,
            blue_buff: false,
            mineralize_list: {},
            external_input_proliferator_points: 0,
            external_supply_proliferator_points: {},
            natural_production_line: [],
        } as Settings,
    });

    assert.equal(snapshot.item_graph["铁块"]["产出倍率"], 3);
    assert.equal(snapshot.getItemCost("铁块"), 7 / 3);
});
