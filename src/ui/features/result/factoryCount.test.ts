import assert from 'node:assert/strict';
import {calculateRawFactoryNumber} from './factoryCount';

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

test('工厂数量直接使用已包含建筑倍率的等效产出率', () => {
    const amount_per_minute = 180;
    const time_tick = 60;
    const mk3_output_rate_per_second = 3;

    assert.equal(
        calculateRawFactoryNumber(amount_per_minute, time_tick, mk3_output_rate_per_second),
        1
    );
});
