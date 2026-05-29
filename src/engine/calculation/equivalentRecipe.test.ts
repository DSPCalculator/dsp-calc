import assert from 'node:assert/strict';
import {build_effective_game_data, get_dark_fog_base_level_multiplier} from '@engine/adapters/dsp/equivalentRecipeAdapter';
import type {GameData, Settings} from '@engine/types/domain';

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

test('黑雾基地等级倍率按游戏随机掉落期望公式增长', () => {
    assert.equal(get_dark_fog_base_level_multiplier(1), 2 + 1 / 15);
    assert.equal(get_dark_fog_base_level_multiplier(30), 4);
});

test('黑雾基地等级倍率限制在 1-30 级', () => {
    assert.equal(get_dark_fog_base_level_multiplier(0), 2 + 1 / 15);
    assert.equal(get_dark_fog_base_level_multiplier(31), 4);
});

test('黑雾基地等级倍率按 30 级原始基准换算等效配方', () => {
    const game_data: GameData = {
        MoreMegaStructureEnable: false,
        GenesisBookEnable: false,
        OrbitalRingEnable: false,
        FractionateEverythingEnable: false,
        mod_name_list: [],
        mod_guid_list: [],
        game_name: 'test',
        item_grid: {},
        item_grid_index_valid: {},
        item_icon_name: {},
        recipe_data: [
            {
                名称: '[无中生有]模组黑雾掉落',
                原料: {},
                产物: {模组掉落物: 1},
                设施: 0,
                时间: 1,
                增产: 0,
                模型: 'normal',
                黑雾掉落: {
                    等级: 0,
                    概率: 0.01,
                    数量: 2.5,
                },
            },
        ],
        factory_data: [[
            {名称: '伊卡洛斯', 耗能: 0, 倍率: 10000, 产物倍率: 1, 占地: 0},
            {名称: '行星基地', 耗能: 0, 倍率: 10000, 产物倍率: 1, 占地: 0},
        ]],
        TheyComeFromVoidEnable: false,
        proliferator_data: [],
        proliferator_effect: [],
    };
    const settings = {
        dark_fog_base_level: 1,
    } as Settings;

    const effective_game_data = build_effective_game_data(game_data, settings);

    assert.equal(effective_game_data.recipe_data[0]["时间"], 1);
    assert.equal(
        effective_game_data.recipe_data[0]["产物"]["模组掉落物"],
        get_dark_fog_base_level_multiplier(1) / get_dark_fog_base_level_multiplier(30)
    );
});
