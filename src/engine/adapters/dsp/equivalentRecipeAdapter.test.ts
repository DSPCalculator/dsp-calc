import assert from 'node:assert/strict';
import {toCoreEquivalentRecipe} from './equivalentRecipeAdapter';
import type {RecipeData} from '@engine/types/domain';

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

test('DSP 等效配方转换为 core 配方时原样携带 sourceRef', () => {
    const recipe: RecipeData = {
        名称: '测试配方',
        原料: {铁矿: 1},
        产物: {铁块: 1},
        设施: 0,
        时间: 1,
        增产: 0,
        建筑名称: '冶炼设备',
    };

    const sourceRef = {
        gameId: 'dsp',
        rawRecipeId: 12,
        selectionId: '12:0:0:0',
        extra: {opaque: true},
    };
    const coreRecipe = toCoreEquivalentRecipe(recipe, sourceRef, 3);

    assert.equal(coreRecipe.id, 'dsp:12:12:0:0:0');
    assert.deepEqual(coreRecipe.inputs, recipe["原料"]);
    assert.deepEqual(coreRecipe.outputs, recipe["产物"]);
    assert.equal(coreRecipe.duration, recipe["时间"]);
    assert.equal(coreRecipe.cost, 3);
    assert.equal(coreRecipe.sourceRef, sourceRef);
    assert.deepEqual(coreRecipe.display, {
        name: '测试配方',
        buildingName: '冶炼设备',
    });
});
