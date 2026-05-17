import assert from 'node:assert/strict';
import {findLinearProgrammingBlockers} from './lpDiagnostics';
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
