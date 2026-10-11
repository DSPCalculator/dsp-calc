import {ApplyBuildingMultiplier} from './building_multipliers.js';

const EPSILON = 1e-8;
const ITEMS = ['氢', '重氢'];
const RECIPE_IDS = {氢: 11120, 重氢: 11121};

/** Only the known vanilla gas-giant pair shares the global planet profile. */
export function orbitalCollectorProfile(state, source, recipeId, factory) {
    const game = state.game_data;
    if ((game.mods || []).some(mod => mod !== 'DarkFogSynthesis') || factory?.名称 !== '轨道采集器'
        || !ITEMS.includes(source.target_item) || Number(source.proliferator_mode || 0) !== 0
        || game.recipe_ids?.[recipeId] !== RECIPE_IDS[source.target_item]) return null;
    const capacities = {};
    for (const item of ITEMS) {
        const id = game.recipe_ids.indexOf(RECIPE_IDS[item]);
        const recipe = game.recipe_data[id];
        const building = game.factory_data[recipe?.设施]?.[Number(source.building)];
        if (!recipe || Object.keys(recipe.原料).length || Object.keys(recipe.产物).length !== 1
            || !(recipe.产物[item] > 0) || building?.名称 !== factory.名称) return null;
        capacities[item] = ApplyBuildingMultiplier(recipe.产物[item] / recipe.时间,
            building.名称, item, state.settings) * building.倍率;
        if (!Number.isFinite(capacities[item]) || capacities[item] <= 0) return null;
    }
    return {id: 'orbital-gas-giant-hydrogen-deuterium', factory_name: factory.名称, items: ITEMS, capacities};
}

/** Preserve the legacy path unless an actual chosen collector route is needed. */
export function needsOrbitalCollectorCalculation(state, production) {
    for (const item of ITEMS) {
        if (!(production[item] > EPSILON) || item in state.settings.mineralize_list) continue;
        const choice = state.scheme_data.item_recipe_choices[item];
        const recipeId = state.item_data[item]?.[choice];
        const config = state.scheme_data.scheme_for_recipe[recipeId];
        const recipe = state.game_data.recipe_data[recipeId];
        const factory = state.game_data.factory_data[recipe?.设施]?.[config?.建筑];
        if (orbitalCollectorProfile(state, {target_item: item, building: config?.建筑,
            proliferator_mode: config?.增产模式}, recipeId, factory)) return true;
    }
    return (state.settings.natural_production_line || []).some(line => {
        if (!(Number(line.建筑数量) > EPSILON)) return false;
        const recipeId = state.item_data[line.目标物品]?.[Number(line.配方id)];
        const recipe = state.game_data.recipe_data[recipeId];
        const factory = state.game_data.factory_data[recipe?.设施]?.[Number(line.建筑)];
        return !!orbitalCollectorProfile(state, {target_item: line.目标物品, building: line.建筑,
            proliferator_mode: line.增产模式}, recipeId, factory);
    });
}

/** Cross-item allocations use the same fleet; rows for one item remain additive. */
export function poolFixedOrbitalCollectors(state, fixed) {
    const lines = fixed.filter(line => line.shared_collector_group && !line.error && !line.mineralized);
    if (!lines.length) return null;
    const capacities = lines[0].collector_capacities;
    const time = state.settings.is_time_unit_minute ? 60 : 1;
    const allocated = Object.fromEntries(ITEMS.map(item => [item,
        lines.filter(line => line.target_item === item).reduce((sum, line) => sum + line.output, 0)]));
    const fixedBuildings = Math.max(...ITEMS.map(item => allocated[item] / capacities[item] / time));
    const dominant = ITEMS.find(item => Math.abs(allocated[item] / capacities[item] / time - fixedBuildings) < EPSILON);
    const owner = lines.find(line => line.target_item === dominant && line.output > EPSILON) || lines[0];
    for (const line of lines) {
        line.byproducts = {};
        line.physical_buildings = 0;
        line.physical_building_count = 0;
    }
    for (const item of ITEMS) {
        const remainder = fixedBuildings * capacities[item] * time - allocated[item];
        if (remainder > EPSILON) owner.byproducts[item] = remainder;
    }
    return {id: lines[0].shared_collector_group, factory_name: '轨道采集器', items: ITEMS,
        capacities, fixed_buildings: fixedBuildings};
}

/** Metadata and count contributions describe physical capacity only once. */
export function finalizeOrbitalCollectors(state, automatic, fixed, fixedPool) {
    const autoLines = Object.values(automatic).filter(line => line.shared_collector_group && !line.mineralized);
    const fixedLines = fixed.filter(line => line.shared_collector_group && !line.error && !line.mineralized);
    const lines = [...fixedLines, ...autoLines];
    if (!lines.length) return [];
    const capacities = fixedPool?.capacities || lines[0].collector_capacities;
    const fixedBuildings = fixedPool?.fixed_buildings || 0;
    const automaticBuildings = autoLines.reduce((sum, line) => sum + line.buildings, 0);
    const buildings = fixedBuildings + automaticBuildings;
    if (buildings <= EPSILON) return [];
    const count = Math.ceil(buildings - EPSILON);
    const owner = fixedLines.find(line => line.output > EPSILON) || autoLines.find(line => line.output > EPSILON) || lines[0];
    for (const line of lines) {
        line.physical_buildings = line === owner ? buildings : 0;
        line.physical_building_count = line === owner ? count : 0;
    }
    const time = state.settings.is_time_unit_minute ? 60 : 1;
    return [{id: lines[0].shared_collector_group, factory_name: '轨道采集器', items: ITEMS,
        source_ids: lines.map(line => line.id), capacities,
        outputs: Object.fromEntries(ITEMS.map(item => [item, capacities[item] * buildings * time])),
        fixed_buildings: fixedBuildings, automatic_buildings: automaticBuildings,
        buildings, building_count: count}];
}
