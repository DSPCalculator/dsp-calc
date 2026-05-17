import assert from 'node:assert/strict';
import {buildLinearProgrammingDiagnostics, findLinearProgrammingBlockers} from './lpDiagnostics';
import type {SolverModel} from '@engine/types/domain';

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

test('只报告正需求且没有正向来源的物品', () => {
    const model: Pick<SolverModel, 'variables'> = {
        variables: {
            氢: {i氢: 1},
            水: {i水: 1},
            焦油: {i焦油: 1, i增产剂: -0.01},
            增产剂: {i增产剂: -0.08},
        },
    };

    const blockers = findLinearProgrammingBlockers(model, {
        氢: 10,
        水: -5,
        增产剂: 3,
    });

    assert.deepEqual(blockers, [
        {
            item: '增产剂',
            demand: 3,
        },
    ]);
});

test('保留会消耗阻塞物品的相关可调项', () => {
    const model: Pick<SolverModel, 'variables'> = {
        variables: {
            氢: {i氢: 1},
            焦油: {i焦油: 1, i增产剂: -0.01},
            钍燃料: {i钍燃料: 1, i增产剂: -0.14},
            增产剂: {i增产剂: -0.08},
        },
    };

    const diagnostics = buildLinearProgrammingDiagnostics(model, {
        氢: 10,
        增产剂: 3,
    });

    assert.deepEqual(diagnostics.blockers, [
        {
            item: '增产剂',
            demand: 3,
        },
    ]);
    assert.deepEqual(diagnostics.related_items, ['焦油', '钍燃料']);
});

test('保留会消耗阻塞物品的直接上游可调项', () => {
    const model: Pick<SolverModel, 'variables'> = {
        variables: {
            增产剂: {i增产剂: -0.08},
        },
    };

    const diagnostics = buildLinearProgrammingDiagnostics(
        model,
        {增产剂: 3},
        {
            item_graph: {
                增产剂: {
                    原料: {
                        碳纳米管: 1.6,
                        二氧化硫: 1.6,
                        三氯化铁: 0.8,
                    },
                    可生产: {},
                    产出倍率: 1,
                    副产物: {},
                },
                碳纳米管: {
                    原料: {
                        增产剂: 0.04,
                    },
                    可生产: {},
                    产出倍率: 1,
                    副产物: {},
                },
                二氧化硫: {
                    原料: {},
                    可生产: {},
                    产出倍率: 1,
                    副产物: {},
                },
                三氯化铁: {
                    原料: {
                        增产剂: 0.05,
                    },
                    可生产: {},
                    产出倍率: 1,
                    副产物: {},
                },
            },
            item_price: {
                增产剂: {原料: {}, 成本: 0, 累计成本: 0},
                碳纳米管: {原料: {增产剂: 0.04}, 成本: 0, 累计成本: 0},
                二氧化硫: {原料: {}, 成本: 0, 累计成本: 0},
                三氯化铁: {原料: {增产剂: 0.05}, 成本: 0, 累计成本: 0},
            },
        }
    );

    assert.deepEqual(diagnostics.related_items, ['碳纳米管', '三氯化铁']);
});
