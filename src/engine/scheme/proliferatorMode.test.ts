import assert from 'node:assert/strict';
import {calculateLowFootprintModeCost} from './proliferatorCost.js';

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

test('Excel 口径下加速只降低设备成本，增产降低合计单位成本', () => {
    const material_cost = 100;
    const facility_cost = 10;
    const spray_cost = 1;
    const speed_multiplier = 2;
    const output_multiplier = 1.25;

    assert.equal(calculateLowFootprintModeCost({
        material_cost,
        facility_cost,
        spray_cost,
        speed_multiplier,
        output_multiplier,
        mode: 1,
    }), 106);

    assert.equal(calculateLowFootprintModeCost({
        material_cost,
        facility_cost,
        spray_cost,
        speed_multiplier,
        output_multiplier,
        mode: 2,
    }), 88.8);
});

test('原料成本占主导时 Excel 口径会选择增产而不是旧公式偏向的加速', () => {
    const material_cost = 100;
    const facility_cost = 10;
    const spray_cost = 1;
    const speed_multiplier = 2;
    const output_multiplier = 1.25;
    const old_speed_cost = (material_cost + facility_cost) / speed_multiplier;
    const old_extra_products_cost = (material_cost + facility_cost) / output_multiplier;
    const speed_cost = calculateLowFootprintModeCost({
        material_cost,
        facility_cost,
        spray_cost,
        speed_multiplier,
        output_multiplier,
        mode: 1,
    });
    const extra_products_cost = calculateLowFootprintModeCost({
        material_cost,
        facility_cost,
        spray_cost,
        speed_multiplier,
        output_multiplier,
        mode: 2,
    });

    assert.equal(old_speed_cost, 55);
    assert.equal(old_extra_products_cost, 88);
    assert.equal(speed_cost, 106);
    assert.equal(extra_products_cost, 88.8);
    assert.equal(extra_products_cost < speed_cost, true);
});
